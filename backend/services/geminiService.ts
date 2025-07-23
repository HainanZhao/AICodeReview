import { GeminiReviewRequest, GeminiReviewResponse } from '../../src/types/shared.js';

export { GeminiReviewRequest, GeminiReviewResponse };
export const buildPrompt = (diff: string, discussions: any[]): string => {
    let discussionContext = '';
    if (discussions && discussions.length > 0) {
        discussionContext = '\n\nExisting Discussions:\n';
        discussions.forEach(discussion => {
            discussion.notes.forEach((note: any) => {
                if (note.position && note.position.new_path && note.position.new_line) {
                    discussionContext += `File: ${note.position.new_path}, Line: ${note.position.new_line}, Comment: ${note.body}\n`;
                } else {
                    discussionContext += `General Comment: ${note.body}\n`;
                }
            });
        });
    }

    return `Please review the following code changes from a merge request.

\`\`\`diff
${diff}
\`\`\`

${discussionContext}

Analyze the code changes for:
1. Code quality issues
2. Performance concerns
3. Security vulnerabilities
4. Style and best practices
5. Potential bugs or errors

Focus on the changes introduced (lines starting with '+'). Format your response as a JSON array of review items, where each item has:
- filePath: string (must match one of the files in the diff)
- lineNumber: number (line number in new file, use 0 for general comments)
- severity: "Critical" | "Warning" | "Suggestion" | "Info"
- title: string (short, concise title)
- description: string (detailed explanation and suggestions)

Return an empty array if the code is exemplary. No pleasantries or extra text, just the JSON array.`;
};
