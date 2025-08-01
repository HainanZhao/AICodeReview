import {
  GitLabConfig,
  GitLabMRDetails,
  FileDiff,
  ReviewFeedback,
  ParsedFileDiff,
  GitLabProject,
  GitLabMergeRequest,
  ParsedHunk,
  Severity,
  GitLabDiscussion,
} from '../types/gitlab.js';

/**
 * Core GitLab service functions that can be shared between UI and CLI
 */

const MAX_FILE_LINES = 10000;

/**
 * Parses a GitLab MR URL to extract project and MR information
 */
export const parseMrUrl = (
  mrUrl: string,
  gitlabBaseUrl: string
): { projectPath: string; mrIid: string } => {
  try {
    const url = new URL(mrUrl);
    const baseUrl = new URL(gitlabBaseUrl);

    if (url.hostname !== baseUrl.hostname) {
      throw new Error('MR URL hostname does not match the configured GitLab instance hostname.');
    }

    const path = url.pathname;
    const mrPathSegment = '/-/merge_requests/';
    const mrPathIndex = path.indexOf(mrPathSegment);

    if (mrPathIndex === -1) {
      throw new Error("Could not find '/-/merge_requests/' in the URL path.");
    }

    const mrIidMatch = path.substring(mrPathIndex + mrPathSegment.length).match(/^(\d+)/);
    if (!mrIidMatch) {
      throw new Error('Could not parse Merge Request IID from the URL.');
    }
    const mrIid = mrIidMatch[1];

    const projectPath = path.substring(1, mrPathIndex);
    if (!projectPath) {
      throw new Error('Could not parse project path from the URL.');
    }

    return { projectPath, mrIid };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    throw new Error(
      `Invalid URL format. Please check your MR URL and GitLab instance URL. Details: ${errorMessage}`
    );
  }
};

/**
 * Makes authenticated API calls to GitLab
 */
export const gitlabApiFetch = async (
  url: string,
  config: GitLabConfig,
  options: RequestInit = {},
  returnType: 'json' | 'text' = 'json'
) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'PRIVATE-TOKEN': config.accessToken,
      ...(returnType === 'json' && { 'Content-Type': 'application/json' }),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'GitLab API authentication failed. Please check your Personal Access Token in Settings.'
      );
    }
    if (response.status === 404) {
      // For file content, 404 is acceptable (e.g., file doesn't exist on a branch)
      if (!url.includes('/repository/files/')) {
        throw new Error(
          'Merge Request or Project not found. Please check the URL and your project access permissions.'
        );
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
};

/**
 * Fetches file content as lines from GitLab repository
 */
export const fetchFileContentAsLines = async (
  config: GitLabConfig,
  projectId: number,
  filePath: string,
  ref: string
): Promise<string[] | undefined> => {
  if (!filePath || !ref) return undefined;
  try {
    const encodedFilePath = encodeURIComponent(filePath);
    const url = `${config.url}/api/v4/projects/${projectId}/repository/files/${encodedFilePath}/raw?ref=${ref}`;
    const textContent = await gitlabApiFetch(url, config, {}, 'text');
    if (typeof textContent === 'string') {
      return textContent.split('\n');
    }
    return undefined;
  } catch (e) {
    console.warn(`Could not fetch file content for ${filePath} at ref ${ref}`, e);
    return undefined;
  }
};

/**
 * Parses a single diff string into structured hunks
 */
const parseDiffs = (diffString: string): ParsedHunk[] => {
  const hunks: ParsedHunk[] = [];
  let oldLineOffset = 0;
  let newLineOffset = 0;

  const diffLines = diffString.split('\n');

  for (const line of diffLines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(,(\d+))? \+(\d+)(,(\d+))? @@/);
      if (match) {
        const oldStartLine = parseInt(match[1], 10);
        const oldLineCount = match[3] ? parseInt(match[3], 10) : 1;
        const newStartLine = parseInt(match[4], 10);
        const newLineCount = match[6] ? parseInt(match[6], 10) : 1;

        const currentHunk: ParsedHunk = {
          header: line,
          oldStartLine,
          oldLineCount,
          newStartLine,
          newLineCount,
          lines: [],
          isCollapsed: false,
        };
        hunks.push(currentHunk);
        oldLineOffset = 0;
        newLineOffset = 0;
      }
    } else if (hunks.length > 0) {
      const currentHunk = hunks[hunks.length - 1];

      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({
          type: 'add',
          newLine: currentHunk.newStartLine + newLineOffset,
          content: line.substring(1),
        });
        newLineOffset++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({
          type: 'remove',
          oldLine: currentHunk.oldStartLine + oldLineOffset,
          content: line.substring(1),
        });
        oldLineOffset++;
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          oldLine: currentHunk.oldStartLine + oldLineOffset,
          newLine: currentHunk.newStartLine + newLineOffset,
          content: line.substring(1),
        });
        oldLineOffset++;
        newLineOffset++;
      }
    }
  }

  return hunks;
};

/**
 * Parses Git diffs into structured hunks with file content context
 */
export const parseDiffsToHunks = (
  diffs: FileDiff[],
  fileContents: Map<string, { oldContent?: string[]; newContent?: string[] }>
): { diffForPrompt: string; parsedDiffs: ParsedFileDiff[] } => {
  const parsedDiffs: ParsedFileDiff[] = [];
  const allDiffsForPrompt: string[] = [];
  const processedFiles = new Set<string>(); // Track files for which we've already included full content

  diffs.forEach((file) => {
    const newFileContent = fileContents.get(file.new_path)?.newContent;

    // Parse the diff into structured hunks
    const hunks = parseDiffs(file.diff);

    // Generate simplified prompt content
    const promptParts: string[] = [];

    // Files that typically don't contain meaningful code logic and should be excluded from full content
    const isNonMeaningfulFile = (filePath: string): boolean => {
      const fileName = filePath.toLowerCase();
      const baseName = fileName.split('/').pop() || '';

      // Lock files
      if (
        baseName.includes('lock') &&
        (baseName.endsWith('.json') || baseName.endsWith('.yaml') || baseName.endsWith('.yml'))
      ) {
        return true;
      }

      // Common auto-generated or non-code files
      const skipPatterns = [
        // Package managers
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'composer.lock',
        'pipfile.lock',
        'poetry.lock',
        'cargo.lock',
        'gemfile.lock',
        'go.sum',

        // Build artifacts and dependencies
        'node_modules/',
        'vendor/',
        'target/',
        'build/',
        'dist/',
        '.next/',
        '.nuxt/',

        // IDE and editor files
        '.vscode/',
        '.idea/',
        '*.iml',

        // Version control
        '.git/',
        '.gitignore',

        // Large data files
        '*.min.js',
        '*.min.css',
        '*.bundle.js',
        '*.chunk.js',

        // Binary or media files (though these shouldn't be in diffs usually)
        '*.png',
        '*.jpg',
        '*.jpeg',
        '*.gif',
        '*.ico',
        '*.pdf',
        '*.zip',
        '*.tar.gz',

        // Generated documentation
        'docs/api/',
        'coverage/',

        // Configuration files that are typically large and auto-generated
        'webpack.config.js',
        'vite.config.js',
        'rollup.config.js',
      ];

      return skipPatterns.some((pattern) => {
        if (pattern.endsWith('/')) {
          return fileName.includes(pattern);
        }
        if (pattern.startsWith('*.')) {
          return baseName.endsWith(pattern.substring(1));
        }
        return baseName === pattern || fileName.endsWith('/' + pattern);
      });
    };

    // Check if we should include full file content (for small files with meaningful code)
    // Use new file content for accurate line numbers
    const shouldIncludeFullFile =
      newFileContent &&
      newFileContent.length <= MAX_FILE_LINES &&
      !file.new_file &&
      !file.deleted_file &&
      !isNonMeaningfulFile(file.new_path) &&
      !processedFiles.has(file.new_path); // Only include once per file

    if (shouldIncludeFullFile) {
      // Include full file content with line numbers (use new file content for accurate line numbers)
      promptParts.push(`\n=== FULL FILE CONTENT: ${file.new_path} ===`);
      newFileContent.forEach((line: string, index: number) => {
        promptParts.push(`${(index + 1).toString()}: ${line}`);
      });
      promptParts.push(`=== END FILE CONTENT ===\n`);
      processedFiles.add(file.new_path); // Mark this file as processed
    }

    // Always include the git diff
    promptParts.push(`\n=== GIT DIFF: ${file.new_path} ===`);
    promptParts.push(file.diff);
    promptParts.push(`=== END DIFF ===\n`);

    allDiffsForPrompt.push(promptParts.join('\n'));

    parsedDiffs.push({
      filePath: file.new_path,
      oldPath: file.old_path,
      isNew: file.new_file,
      isDeleted: file.deleted_file,
      isRenamed: file.renamed_file,
      hunks,
    });
  });

  const diffForPrompt = allDiffsForPrompt.join('\n');
  return {
    diffForPrompt,
    parsedDiffs,
  };
};

/**
 * Fetches merge request discussions from GitLab
 */
export const fetchMrDiscussions = async (
  config: GitLabConfig,
  projectId: number,
  mrIid: string
): Promise<GitLabDiscussion[]> => {
  const url = `${config.url}/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions`;
  return gitlabApiFetch(url, config);
};

/**
 * Converts GitLab discussions to ReviewFeedback format
 */
export const convertDiscussionsToFeedback = (discussions: GitLabDiscussion[]): ReviewFeedback[] => {
  return discussions.flatMap((discussion) =>
    discussion.notes
      .filter((note) => !note.system && note.position) // Only inline comments with position
      .map((note) => ({
        id: `gitlab-${note.id}`,
        lineNumber: note.position?.new_line || 0,
        filePath: note.position?.new_path || '',
        severity: Severity.Info,
        title: `Comment by ${note.author.name || note.author.username}`,
        description: note.body,
        lineContent: '', // We don't have this from the API
        position: {
          base_sha: '', // These will be filled in later
          start_sha: '',
          head_sha: '',
          position_type: 'text',
          old_path: note.position?.old_path || note.position?.new_path || '',
          new_path: note.position?.new_path || '',
          new_line: note.position?.new_line,
          old_line: note.position?.old_line,
        },
        status: 'submitted' as const,
        isExisting: true,
      }))
  );
};

/**
 * Posts a review comment to GitLab with fallback to general comment if inline posting fails
 */
export const postDiscussion = async (
  config: GitLabConfig,
  mrDetails: GitLabMRDetails,
  feedback: ReviewFeedback
): Promise<GitLabDiscussion> => {
  const { projectId, mrIid } = mrDetails;

  const baseBody = `
**[AI] ${feedback.severity}: ${feedback.title}**

${feedback.description}
    `;

  // Use discussions endpoint for all comments (both inline and general)
  const url = `${config.url}/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions`;

  // First, try to post as an inline comment if we have position data
  const hasValidPosition =
    feedback.position &&
    feedback.position.base_sha &&
    feedback.position.start_sha &&
    feedback.position.head_sha &&
    feedback.position.old_path &&
    feedback.position.new_path &&
    (feedback.position.new_line || feedback.position.old_line);

  if (hasValidPosition) {
    try {
      const inlinePayload = {
        body: baseBody.trim(),
        position: feedback.position,
      };

      const result = await gitlabApiFetch(url, config, {
        method: 'POST',
        body: JSON.stringify(inlinePayload),
      });

      // Mark as successfully posted inline
      return { ...result, postedAsInline: true };
    } catch (error) {
      // If inline comment fails, log the error and fallback to general comment
      console.warn(
        `Failed to post inline comment for ${feedback.filePath}:${feedback.lineNumber}. ` +
          `Retrying as general comment. Error: ${error instanceof Error ? error.message : String(error)}`
      );

      // Continue to fallback logic below
    }
  }

  // Fallback: Post as a general comment with file and line information in the body
  const fallbackBody =
    feedback.filePath && feedback.lineNumber > 0
      ? `
**${feedback.severity}: ${feedback.title}**

📍 **File:** \`${feedback.filePath}\` (line ${feedback.lineNumber})

${feedback.description}

*Powered by AI Code Reviewer*
    `
      : baseBody;

  const generalPayload = {
    body: fallbackBody.trim(),
    // No position for general comments
  };

  const result = await gitlabApiFetch(url, config, {
    method: 'POST',
    body: JSON.stringify(generalPayload),
  });

  // Mark as posted as general comment (fallback)
  return { ...result, postedAsInline: false };
};

/**
 * Fetches the main MR data with all related information
 */
export const fetchMrData = async (
  config: GitLabConfig,
  mrUrl: string
): Promise<GitLabMRDetails> => {
  const { projectPath, mrIid } = parseMrUrl(mrUrl, config.url);
  const encodedProjectPath = encodeURIComponent(projectPath);
  const baseUrl = `${config.url}/api/v4/projects/${encodedProjectPath}/merge_requests/${mrIid}`;

  // First get the MR details
  const mr = await gitlabApiFetch(baseUrl, config);

  // Then fetch versions, discussions, and approvals in parallel
  const [versions, discussions, approvals] = await Promise.all([
    gitlabApiFetch(`${baseUrl}/versions`, config),
    fetchMrDiscussions(config, mr.project_id, mrIid),
    gitlabApiFetch(`${baseUrl}/approvals`, config).catch(() => null), // Approvals might not be available in all GitLab versions
  ]);

  const latestVersion = versions[0];
  if (!latestVersion) {
    throw new Error('Could not retrieve merge request version details.');
  }

  // Try to fetch diffs with extended context, fallback to default if it fails
  let diffs: FileDiff[];
  try {
    // First attempt with 20 lines of context
    diffs = await gitlabApiFetch(`${baseUrl}/diffs?context_lines=20`, config);
  } catch (error) {
    console.warn(
      'Failed to fetch diffs with extended context, falling back to default context:',
      error
    );
    // Fallback to default GitLab context
    diffs = await gitlabApiFetch(`${baseUrl}/diffs`, config);
  }

  const fileContents = new Map<string, { oldContent?: string[]; newContent?: string[] }>();

  // Convert existing inline discussions to feedback items (only show inline comments with position)
  const existingFeedback = convertDiscussionsToFeedback(discussions);
  // Get unique file paths to avoid fetching the same file multiple times
  // (GitLab can have multiple diff entries for the same file in complex MRs)
  const uniqueFiles = new Map<string, { new_path: string; deleted_file: boolean }>();
  diffs.forEach((diff) => {
    if (!uniqueFiles.has(diff.new_path)) {
      uniqueFiles.set(diff.new_path, {
        new_path: diff.new_path,
        deleted_file: diff.deleted_file,
      });
    }
  });

  const contentPromises = Array.from(uniqueFiles.values()).map(async (file) => {
    // Fetch new file content for accurate line number mapping
    const newContent = !file.deleted_file
      ? await fetchFileContentAsLines(
          config,
          mr.project_id,
          file.new_path,
          latestVersion.head_commit_sha
        )
      : undefined;

    fileContents.set(file.new_path, { newContent });
  });
  await Promise.all(contentPromises);

  // Parse diffs with expanded context AFTER file contents are available
  const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs, fileContents);

  // Fill in the SHA values for existing feedback positions
  existingFeedback.forEach((feedback: ReviewFeedback) => {
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
    discussions, // Include discussions for reference
    existingFeedback, // Add existing feedback to the returned object
    approvals, // Include approval information
  };
};

/**
 * Fetches GitLab projects for the authenticated user
 */
export const fetchProjects = async (config: GitLabConfig): Promise<GitLabProject[]> => {
  const url = `${config.url}/api/v4/projects?membership=true&min_access_level=30&order_by=last_activity_at&sort=desc&per_page=100`;
  return gitlabApiFetch(url, config);
};

/**
 * Fetches merge requests for specific projects
 */
export const fetchMergeRequestsForProjects = async (
  config: GitLabConfig,
  projects: GitLabProject[],
  projectIds: number[]
): Promise<GitLabMergeRequest[]> => {
  const selectedProjects = projects.filter((p) => projectIds.includes(p.id));

  const allMrsPromises = selectedProjects.map((project) => {
    const url = `${config.url}/api/v4/projects/${project.id}/merge_requests?state=opened&scope=all&order_by=updated_at&sort=desc&per_page=20`;
    return gitlabApiFetch(url, config).then((mrs: GitLabMergeRequest[]) =>
      mrs.map((mr) => ({ ...mr, project_name: project.name_with_namespace }))
    );
  });

  const mrsByProject = await Promise.all(allMrsPromises);
  const allMrs = mrsByProject.flat();

  allMrs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return allMrs;
};

/**
 * Approves a merge request
 */
export const approveMergeRequest = async (
  config: GitLabConfig,
  projectId: number,
  mrIid: string
): Promise<void> => {
  const url = `${config.url}/api/v4/projects/${projectId}/merge_requests/${mrIid}/approve`;
  await gitlabApiFetch(url, config, {
    method: 'POST',
  });
};

/**
 * Tests the GitLab connection and authentication.
 * Fetches a simple endpoint (e.g., user projects) to verify credentials.
 */
export const testGitLabConnection = async (config: GitLabConfig): Promise<boolean> => {
  try {
    // Attempt to fetch a non-sensitive endpoint that requires authentication
    const url = `${config.url}/api/v4/projects?membership=true&per_page=1`;
    await gitlabApiFetch(url, config);
    return true;
  } catch (error) {
    console.error('GitLab connection test failed:', error);
    return false;
  }
};
