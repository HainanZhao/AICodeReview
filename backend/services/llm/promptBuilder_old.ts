/**
 * Centralized prompt builder for code review
 * This ensures DRY principle and consistent prompts across all LLM providers
 */

import { DiffLineMapper } from './diffLineMapper.js';

export interface PromptOptions {
  modelType?: 'gemini' | 'claude' | 'default';
  maxTokens?: number;
  includeLineMapping?: boolean;
}

export class ReviewPromptBuilder {
  public static buildPrompt(diff: string, options: PromptOptions = {}): string {
    const { modelType = 'default', includeLineMapping = true } = options;

    // Create line mapping information if requested
    let lineMappingInfo = '';
    if (includeLineMapping) {
      const lineMappings = DiffLineMapper.createLineMapping(diff);
      lineMappingInfo = this.generateLineMappingInfo(lineMappings);
    }

    // Base prompt that works for all models
    const basePrompt = `You are a senior code reviewer. Review ONLY the actual changes in this merge request diff.

\`\`\`diff
${diff}
\`\`\`

${lineMappingInfo}

🔴 CRITICAL RULES - FOLLOW EXACTLY:

1. ❌ DO NOT review lines starting with ' ' (space) - these are CONTEXT LINES for reference only
2. ✅ ONLY review lines starting with '+' (added) or '-' (removed) - these are ACTUAL CHANGES
3. ❌ NEVER generate comments for context lines that start with space
4. ✅ Use context lines to understand the surrounding code but DO NOT comment on them

� LINE NUMBER GUIDANCE:
- When referencing a line with '+' (added): Use the line number from the NEW file where this change appears
- When referencing a line with '-' (removed): Use the line number from the OLD file where this line was removed
- DO NOT use line numbers from context lines (those with ' ' prefix)
- The line numbers in the @@ headers indicate the original file positions, not the diff line positions

�📋 WHAT TO REVIEW (actual changes only):
- Lines starting with '+' (new code added)
- Lines starting with '-' (code removed, if problematic)

📖 WHAT CONTEXT LINES ARE FOR (do not review these):
- Understanding the function/class structure
- Seeing how changes fit into existing code
- Getting broader context for better analysis
- Lines starting with ' ' (space) are NEVER to be reviewed

🎯 FOCUS YOUR ANALYSIS ON:
1. Code quality issues in NEW/CHANGED code
2. Performance concerns in ACTUAL CHANGES
3. Security vulnerabilities in MODIFIED code
4. Best practices in ADDED/CHANGED lines
5. Potential bugs in ACTUAL modifications

📝 RESPONSE FORMAT:
Return a JSON array where each item has:
- filePath: string (file being reviewed)
- lineNumber: number (ORIGINAL FILE line number where the change occurs - NOT the diff line number)
- severity: "Critical" | "Warning" | "Suggestion" | "Info"  
- title: string (concise issue title)
- description: string (detailed explanation and suggestions)

⚠️ FINAL REMINDER: 
- Context lines (prefix: ' ') = DO NOT REVIEW
- Changed lines (prefix: '+' or '-') = REVIEW THESE
- Use ORIGINAL FILE line numbers, not diff line positions
- If all actual changes are good, return empty array []

Return only the JSON array, no additional text.`;

    // Model-specific adjustments if needed
    switch (modelType) {
      case 'claude':
        return (
          basePrompt +
          '\n\nNote: Be especially precise about line targeting and use original file line numbers.'
        );
      case 'gemini':
        return (
          basePrompt +
          '\n\nNote: Focus on actionable feedback for developers using original file line numbers.'
        );
      default:
        return basePrompt;
    }
  }

  private static generateLineMappingInfo(
    lineMappings: Map<string, import('./diffLineMapper.js').DiffLineMap>
  ): string {
    if (lineMappings.size === 0) return '';

    let mappingInfo = '\n🗺️ LINE NUMBER REFERENCE:\n';
    mappingInfo +=
      'The diff above includes expanded context. Here are the original file line numbers for actual changes:\n\n';

    for (const [filePath, fileMapping] of lineMappings) {
      const changeLines = fileMapping.mappings.filter((m) => m.isChange);
      if (changeLines.length > 0) {
        mappingInfo += `📁 ${filePath}:\n`;
        changeLines.forEach((mapping) => {
          const symbol = mapping.changeType === 'add' ? '+' : '-';
          mappingInfo += `  ${symbol} Line ${mapping.originalLineNumber} (${mapping.changeType})\n`;
        });
        mappingInfo += '\n';
      }
    }

    mappingInfo +=
      '⚠️ IMPORTANT: Use these original file line numbers in your response, not the position in the diff above.\n';

    return mappingInfo;
  }

  /**
   * Validates if a line number corresponds to an actual change
   * This can be used for additional validation
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
