import {
  GeminiReviewRequest,
  GeminiReviewResponse,
  GitLabDiscussion,
} from '../../shared/src/types.js';

export { GeminiReviewRequest, GeminiReviewResponse };
export const buildPrompt = (diff: string, discussions: GitLabDiscussion[]): string => {
  let discussionContext = '';
  if (discussions && discussions.length > 0) {
    discussionContext = '\n\nExisting Discussions:\n';
    discussions.forEach((discussion) => {
      discussion.notes.forEach((note: GitLabDiscussion['notes'][0]) => {
        if (note.position && note.position.new_path && note.position.new_line) {
          // Normalize path separators for cross-platform compatibility
          const normalizedPath = note.position.new_path.replace(/\\/g, '/');
          discussionContext += `File: ${normalizedPath}, Line: ${note.position.new_line}, Comment: ${note.body}\n`;
        } else {
          discussionContext += `General Comment: ${note.body}\n`;
        }
      });
    });
  }

  return `Please review the following code changes from a merge request.\n\n\`\`\`diff\n${diff}\n\`\`\`\n\n${discussionContext}\n\nAnalyze the code changes for:\n1. Code quality issues\n2. Performance concerns\n3. Security vulnerabilities\n4. Style and best practices\n5. Potential bugs or errors\n\nFocus on the changes introduced (lines starting with '+'). Format your response as a JSON array of review items, where each item has:\n- filePath: string (must match one of the files in the diff)\n- lineNumber: number (line number in new file, use 0 for general comments)\n- severity: "Critical" | "Warning" | "Suggestion" | "Info"\n- title: string (short, concise title)\n- description: string (detailed explanation and suggestions)\n\nReturn an empty array if the code is exemplary. No pleasantries or extra text, just the JSON array.`;
};
