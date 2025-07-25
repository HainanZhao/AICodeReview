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

  return `You are a senior code reviewer. Review the code changes in this merge request.

The content below includes:
1. Full file content (for small files) with line numbers for context
2. Git diff showing the actual changes

${diff}

${discussionContext}

🔴 CRITICAL RULES - FOLLOW EXACTLY:

1. ✅ ONLY review lines that are ACTUAL CHANGES in the git diff:
   - Lines starting with '+' (added) - these are your main focus
   - Lines starting with '-' (removed) - review if problematic
2. ❌ DO NOT review context lines (lines starting with ' ' in the diff)
3. ❌ DO NOT review lines from the full file content section - those are for context only

📖 HOW TO USE THE PROVIDED CONTEXT:
- Full file content with line numbers: Use this to understand the broader code structure and context
- Git diff: This shows the actual changes - ONLY review these lines
- The line numbers in the full file content correspond directly to the actual file

🎯 FOCUS YOUR ANALYSIS ON:
1. Code quality issues in NEW/CHANGED code
2. Performance concerns in ACTUAL CHANGES  
3. Security vulnerabilities in MODIFIED code
4. Best practices in ADDED/CHANGED lines
5. Potential bugs in ACTUAL modifications

📝 RESPONSE FORMAT:
Return a JSON array where each item has:
- filePath: string (file being reviewed)
- lineNumber: number (line number from the file - use the line numbers shown in full file content)
- severity: "Critical" | "Warning" | "Suggestion" | "Info"  
- title: string (concise issue title)
- description: string (detailed explanation and suggestions)

⚠️ FINAL REMINDER: 
- Full file content = CONTEXT ONLY (do not review)
- Git diff lines with '+' or '-' = REVIEW THESE
- Use actual file line numbers (from full file content) in your response
- If all actual changes are good, return empty array []

Return only the JSON array, no additional text.`;
};
