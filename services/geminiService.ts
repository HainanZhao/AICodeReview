import { v4 as uuidv4 } from 'uuid';
import { ReviewFeedback, Severity, Config, GitLabMRDetails, GitLabPosition, GeminiReviewResponse } from '@aireview/shared';
import { fetchMrData } from "./gitlabService";

export const reviewCode = async (url: string, config: Config): Promise<{mrDetails: GitLabMRDetails, feedback: ReviewFeedback[]}> => {
    if (!config || !config.gitlabUrl || !config.accessToken) {
        throw new Error("GitLab configuration is missing. Please set it in the settings.");
    }
    
    const mrDetails = await fetchMrData(config, url);

    if (mrDetails.diffForPrompt.trim() === "") {
        return {
            mrDetails,
            feedback: [{
                id: uuidv4(),
                lineNumber: 0,
                filePath: "N/A",
                severity: Severity.Info,
                title: "No Code Changes Found",
                description: "This merge request does not contain any code changes to review.",
                lineContent: "",
                position: null,
                status: 'submitted',
            }]
        };
    }

        const response = await fetch('/api/gemini/review', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ diffForPrompt: mrDetails.diffForPrompt }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const parsedResponse = await response.json() as GeminiReviewResponse[];

    if (!Array.isArray(parsedResponse)) {
        console.warn("Unexpected JSON structure from API:", parsedResponse);
        return { mrDetails, feedback: [] };
    }

    const parsedFileDiffsMap = new Map(mrDetails.parsedDiffs.map(p => [p.filePath, p]));

    const generatedFeedback = (parsedResponse as any[]).map((item): ReviewFeedback | null => {
        const parsedFile = parsedFileDiffsMap.get(item.filePath);
        
        let position: GitLabPosition | null = null;
        let lineContent: string = "";

        if (item.lineNumber === 0) {
            lineContent = "General file comment";
        }

        if (item.lineNumber > 0 && parsedFile) {
            const allLines = parsedFile.hunks.flatMap(h => h.lines);
            const targetLine = allLines.find(l => l.newLine === item.lineNumber && l.type === 'add');
            
            // Validation: Only create feedback for lines that were actually added in the diff.
            if (!targetLine) {
                console.warn(`AI suggested a comment for line ${item.lineNumber} in ${item.filePath}, but this is not an added line. Discarding.`);
                return null;
            }
            
            lineContent = targetLine.content;
            
            position = {
                base_sha: mrDetails.base_sha,
                start_sha: mrDetails.start_sha,
                head_sha: mrDetails.head_sha,
                position_type: 'text',
                old_path: parsedFile.oldPath,
                new_path: parsedFile.filePath,
                new_line: targetLine.newLine,
            };
        }
        
        return {
            id: uuidv4(),
            lineNumber: item.lineNumber,
            severity: item.severity,
            title: item.title,
            description: item.description,
            filePath: item.filePath,
            lineContent: lineContent || "Comment on a line not found in diff.",
            position,
            status: 'pending',
        };
    });

    const feedback = generatedFeedback.filter((fb): fb is ReviewFeedback => fb !== null);

    return { mrDetails, feedback };
};