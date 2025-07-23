import { Config, GitLabMRDetails, FileDiff, ReviewFeedback, ParsedDiffLine, ParsedFileDiff, GitLabProject, GitLabMergeRequest, ParsedHunk, Severity, GitLabDiscussion } from '../types';

const parseMrUrl = (mrUrl: string, gitlabBaseUrl: string): { projectPath: string; mrIid: string } => {
    try {
        const url = new URL(mrUrl);
        const baseUrl = new URL(gitlabBaseUrl);

        if (url.hostname !== baseUrl.hostname) {
            throw new Error("MR URL hostname does not match the configured GitLab instance hostname.");
        }

        const path = url.pathname;
        const mrPathSegment = '/-/merge_requests/';
        const mrPathIndex = path.indexOf(mrPathSegment);

        if (mrPathIndex === -1) {
            throw new Error("Could not find '/-/merge_requests/' in the URL path.");
        }
        
        const mrIidMatch = path.substring(mrPathIndex + mrPathSegment.length).match(/^(\d+)/);
        if (!mrIidMatch) {
            throw new Error("Could not parse Merge Request IID from the URL.");
        }
        const mrIid = mrIidMatch[1];
        
        const projectPath = path.substring(1, mrPathIndex);
        if (!projectPath) {
            throw new Error("Could not parse project path from the URL.");
        }

        return { projectPath, mrIid };
    } catch(e) {
        throw new Error(`Invalid URL format. Please check your MR URL and GitLab instance URL. Details: ${e.message}`);
    }
};

const gitlabApiFetch = async (url: string, config: Config, options: RequestInit = {}, returnType: 'json' | 'text' = 'json') => {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'PRIVATE-TOKEN': config.accessToken,
            ...(returnType === 'json' && {'Content-Type': 'application/json'}),
        },
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("GitLab API authentication failed. Please check your Personal Access Token in Settings.");
        }
        if (response.status === 404) {
             // For file content, 404 is acceptable (e.g., file doesn't exist on a branch)
            if (!url.includes('/repository/files/')) {
                 throw new Error("Merge Request or Project not found. Please check the URL and your project access permissions.");
            }
        }
        const errorData = await response.text();
        // Don't throw for 404 on file content, just return null
        if (response.status === 404 && url.includes('/repository/files/')) {
            return null;
        }
        throw new Error(`GitLab API error. Status: ${response.status}. Details: ${errorData}`);
    }
    return returnType === 'json' ? response.json() : response.text();
}

const fetchFileContentAsLines = async (config: Config, projectId: number, filePath: string, ref: string): Promise<string[] | undefined> => {
    if (!filePath || !ref) return undefined;
    try {
        const encodedFilePath = encodeURIComponent(filePath);
        const url = `${config.gitlabUrl}/api/v4/projects/${projectId}/repository/files/${encodedFilePath}/raw?ref=${ref}`;
        const textContent = await gitlabApiFetch(url, config, {}, 'text');
        if (typeof textContent === 'string') {
            return textContent.split('\n');
        }
        return undefined;
    } catch (e) {
        console.warn(`Could not fetch file content for ${filePath} at ref ${ref}`, e);
        return undefined;
    }
}


const parseDiffsToHunks = (diffs: FileDiff[]): { diffForPrompt: string, parsedDiffs: ParsedFileDiff[] } => {
    const parsedDiffs: ParsedFileDiff[] = [];

    const diffForPrompt = diffs.map((file) => {
        const hunks: ParsedHunk[] = [];
        let currentHunk: ParsedHunk | null = null;
        
        const diffLines = file.diff.split('\n');
        for (const line of diffLines) {
             if (line.startsWith('@@')) {
                if (currentHunk) {
                    hunks.push(currentHunk);
                }
                const match = line.match(/@@ -(\d+)(,(\d+))? \+(\d+)(,(\d+))? @@/);
                if (match) {
                    const oldStartLine = parseInt(match[1], 10);
                    const oldLineCount = match[3] ? parseInt(match[3], 10) : 1;
                    const newStartLine = parseInt(match[4], 10);
                    const newLineCount = match[6] ? parseInt(match[6], 10) : 1;
                    currentHunk = {
                        header: line,
                        oldStartLine,
                        oldLineCount,
                        newStartLine,
                        newLineCount,
                        lines: [],
                        isCollapsed: false,
                    };
                }
             }

            if (currentHunk) {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    currentHunk.lines.push({ type: 'add', newLine: currentHunk.newStartLine + currentHunk.lines.filter(l => l.type !== 'remove').length, content: line.substring(1) });
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    currentHunk.lines.push({ type: 'remove', oldLine: currentHunk.oldStartLine + currentHunk.lines.filter(l => l.type !== 'add').length, content: line.substring(1) });
                } else if (line.startsWith(' ') && currentHunk) {
                    currentHunk.lines.push({ type: 'context', oldLine: currentHunk.oldStartLine + currentHunk.lines.filter(l => l.type !== 'add').length, newLine: currentHunk.newStartLine + currentHunk.lines.filter(l => l.type !== 'remove').length, content: line.substring(1) });
                } else if (line.startsWith('@@')) {
                     currentHunk.lines.push({ type: 'meta', content: line });
                }
            }
        }
        if (currentHunk) {
            hunks.push(currentHunk);
        }

        parsedDiffs.push({
            filePath: file.new_path,
            oldPath: file.old_path,
            isNew: file.new_file,
            isDeleted: file.deleted_file,
            isRenamed: file.renamed_file,
            hunks,
        });

        return `--- a/${file.old_path}\n+++ b/${file.new_path}\n${file.diff}`;
    }).join('\n');

    return { diffForPrompt, parsedDiffs };
};


const fetchMrDiscussions = async (config: Config, projectId: number, mrIid: string): Promise<any[]> => {
    const url = `${config.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions`;
    return gitlabApiFetch(url, config);
};

const convertDiscussionsToFeedback = (discussions: any[]): ReviewFeedback[] => {
    return discussions.flatMap(discussion => 
        discussion.notes.map((note: any) => ({
            id: `gitlab-${note.id}`,
            lineNumber: note.position?.new_line || 0,
            filePath: note.position?.new_path || '',
            severity: Severity.Info,
            title: `Comment by ${note.author.name}`,
            description: note.body,
            lineContent: '',  // We don't have this from the API
            position: note.position ? {
                base_sha: '',  // These will be filled in later
                start_sha: '',
                head_sha: '',
                position_type: 'text',
                old_path: note.position.old_path || note.position.new_path,
                new_path: note.position.new_path,
                new_line: note.position.new_line
            } : null,
            status: 'submitted',
            isExisting: true
        }))
    );
};

export const fetchMrData = async (config: Config, mrUrl: string): Promise<GitLabMRDetails> => {
    const { projectPath, mrIid } = parseMrUrl(mrUrl, config.gitlabUrl);
    const encodedProjectPath = encodeURIComponent(projectPath);
    const baseUrl = `${config.gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests/${mrIid}`;
    
    // First get the MR details
    const mr = await gitlabApiFetch(baseUrl, config);
    
    // Then fetch versions and discussions in parallel
    const [versions, discussions] = await Promise.all([
        gitlabApiFetch(`${baseUrl}/versions`, config),
        fetchMrDiscussions(config, mr.project_id, mrIid)
    ]);

    const latestVersion = versions[0];
    if (!latestVersion) {
        throw new Error("Could not retrieve merge request version details.");
    }
    
    // Try to fetch diffs with extended context, fallback to default if it fails
    let diffs: FileDiff[];
    try {
        // First attempt with 20 lines of context
        diffs = await gitlabApiFetch(`${baseUrl}/diffs?context_lines=20`, config);
    } catch (error) {
        console.warn('Failed to fetch diffs with extended context, falling back to default context:', error);
        // Fallback to default GitLab context
        diffs = await gitlabApiFetch(`${baseUrl}/diffs`, config);
    }

    const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs);

    // Convert existing discussions to feedback items
    const existingFeedback = convertDiscussionsToFeedback(discussions);

    const fileContents = new Map<string, { oldContent?: string[]; newContent?: string[] }>();
    const contentPromises = diffs.map(async (diff) => {
        const [oldContent, newContent] = await Promise.all([
            !diff.new_file ? fetchFileContentAsLines(config, mr.project_id, diff.old_path, latestVersion.base_commit_sha) : Promise.resolve(undefined),
            !diff.deleted_file ? fetchFileContentAsLines(config, mr.project_id, diff.new_path, latestVersion.head_commit_sha) : Promise.resolve(undefined)
        ]);
        fileContents.set(diff.new_path, { oldContent, newContent });
    });
    await Promise.all(contentPromises);


    // Fill in the SHA values for existing feedback positions
    existingFeedback.forEach(feedback => {
        if (feedback.position) {
            feedback.position.base_sha = latestVersion.base_commit_sha;
            feedback.position.start_sha = latestVersion.start_commit_sha;
            feedback.position.head_sha = latestVersion.head_commit_sha;
        }
    });

    return {
        projectPath,
        mrIid,
        projectId: mr.project_id,
        title: mr.title,
        authorName: mr.author.name,
        webUrl: mr.web_url,
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
        head_sha: latestVersion.head_commit_sha,
        base_sha: latestVersion.base_commit_sha,
        start_sha: latestVersion.start_commit_sha,
        fileDiffs: diffs,
        diffForPrompt,
        parsedDiffs,
        fileContents,
        discussions,
        existingFeedback, // Add existing feedback to the returned object
    };
};

export const postDiscussion = async (config: Config, mrDetails: GitLabMRDetails, feedback: ReviewFeedback): Promise<any> => {
    const { projectId, mrIid } = mrDetails;
    
    const url = `${config.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions`;

    const body = `
**${feedback.severity}: ${feedback.title}**

${feedback.description}

*Powered by AI Code Reviewer*
    `;

    const payload: { body: string; position?: ReviewFeedback['position'] } = { body };
    if (feedback.position) {
        payload.position = feedback.position;
    }

    return gitlabApiFetch(url, config, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const fetchProjects = async (config: Config): Promise<GitLabProject[]> => {
    const url = `${config.gitlabUrl}/api/v4/projects?membership=true&min_access_level=30&order_by=last_activity_at&sort=desc&per_page=100`;
    return gitlabApiFetch(url, config);
};

export const fetchMergeRequestsForProjects = async (config: Config, projects: GitLabProject[], projectIds: number[]): Promise<GitLabMergeRequest[]> => {
    const selectedProjects = projects.filter(p => projectIds.includes(p.id));

    const allMrsPromises = selectedProjects.map(project => {
        const url = `${config.gitlabUrl}/api/v4/projects/${project.id}/merge_requests?state=opened&scope=all&order_by=updated_at&sort=desc&per_page=20`;
        return gitlabApiFetch(url, config).then((mrs: GitLabMergeRequest[]) => 
            mrs.map(mr => ({ ...mr, project_name: project.name_with_namespace }))
        );
    });

    const mrsByProject = await Promise.all(allMrsPromises);
    const allMrs = mrsByProject.flat();

    allMrs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return allMrs;
};

export const approveMergeRequest = async (config: Config, projectId: number, mrIid: string): Promise<void> => {
    const url = `${config.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/approve`;
    await gitlabApiFetch(url, config, {
        method: 'POST',
    });
};