/**
 * Centralized prompt builder for code review
 * This ensures DRY principle and consistent prompts across all LLM providers
 */

export interface PromptOptions {
  modelType?: 'gemini' | 'claude' | 'default';
  maxTokens?: number;
}

export class ReviewPromptBuilder {
  public static buildPrompt(diff: string, options: PromptOptions = {}): string {
    const { modelType = 'default' } = options;

    // Simplified base prompt for the new format
    const basePrompt = `You are a senior code reviewer. Review the code changes in this merge request.

The content below includes:
1. Full file content (for small files) with line numbers for context
2. Git diff showing the actual changes

${diff}

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

    // Model-specific adjustments if needed
    switch (modelType) {
      case 'claude':
        return (
          basePrompt +
          '\n\nNote: Be especially precise about line targeting and use actual file line numbers.'
        );
      case 'gemini':
        return (
          basePrompt +
          '\n\nNote: Focus on actionable feedback for developers using actual file line numbers.'
        );
      default:
        return basePrompt;
    }
  }

  /**
   * Validates if a line number corresponds to an actual change in the diff
   */
  public static isChangeLineNumber(diff: string, lineNumber: number): boolean {
    const lines = diff.split('\n');
    let currentNewLine = 0;
    let currentOldLine = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          currentOldLine = parseInt(match[1], 10);
          currentNewLine = parseInt(match[2], 10);
        }
        continue;
      }

      if (line.startsWith('+')) {
        if (currentNewLine === lineNumber) {
          return true;
        }
        currentNewLine++;
      } else if (line.startsWith('-')) {
        if (currentOldLine === lineNumber) {
          return true;
        }
        currentOldLine++;
      } else if (line.startsWith(' ')) {
        currentOldLine++;
        currentNewLine++;
      }
    }

    return false;
  }
}
