import * as fs from 'fs';
import { ParsedFileDiff, ReviewFeedback, Severity } from '../types/gitlab.js';

/**
 * Core AI review service functions that can be shared between UI and CLI
 *
 * Comment Posting Strategy:
 * - First attempts to post comments as inline comments at specific line positions
 * - If inline posting fails (due to wrong line numbers or other position issues),
 *   automatically falls back to posting as general MR comments with file/line info
 * - This ensures all AI feedback is captured even when line positioning is imperfect
 */

export interface AIReviewItem {
  filePath: string;
  lineNumber: number;
  severity: string;
  title: string;
  description: string;
  lineContent: string;
}

export interface AIReviewResponseRaw {
  summary?: string;
  overallRating?: string;
  feedback?: AIReviewItem[];
}

export interface AIReviewRequest {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  diffContent: string;
  parsedDiffs: ParsedFileDiff[];
  existingFeedback?: ReviewFeedback[];
  authorName: string;
  customPromptFile?: string; // Optional path to custom prompt file
}

export interface AIReviewResponse {
  feedback: ReviewFeedback[];
  summary?: string;
  overallRating?: 'approve' | 'request_changes' | 'comment';
}

/**
 * Reads a custom prompt file and returns its content
 * Returns empty string if file doesn't exist or can't be read
 */
const readCustomPromptFile = (promptFile: string): string => {
  try {
    if (!fs.existsSync(promptFile)) {
      console.warn(`⚠ Warning: Custom prompt file not found: ${promptFile}`);
      return '';
    }
    
    const content = fs.readFileSync(promptFile, 'utf-8').trim();
    if (!content) {
      console.warn(`⚠ Warning: Custom prompt file is empty: ${promptFile}`);
      return '';
    }
    
    console.log(`✅ Using custom prompt file: ${promptFile}`);
    return content;
  } catch (error) {
    console.warn(`⚠ Warning: Failed to read custom prompt file ${promptFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return '';
  }
};

/**
 * Builds the custom prompt section if a custom prompt file is provided
 */
const buildCustomPromptSection = (customPromptFile?: string): string => {
  if (!customPromptFile) {
    return '';
  }
  
  const customContent = readCustomPromptFile(customPromptFile);
  if (!customContent) {
    return '';
  }
  
  return `

**🎯 PROJECT-SPECIFIC REVIEW INSTRUCTIONS:**

${customContent}

**Note**: The above instructions are specific to this project and should be applied in addition to the general review guidelines.
`;
};

/**
 * Static instruction section that appears at the top of every prompt
 */
const STATIC_INSTRUCTIONS = `
You are a senior software engineer and expert code reviewer with years of experience in identifying critical issues, security vulnerabilities, and code quality improvements. Your reviews are known for being thorough, actionable, and focused on genuinely important issues.

**Your Mission:**
Provide a high-quality, focused review that adds real value. Prioritize critical bugs, security issues, and performance problems, while also ensuring code follows established standards and best practices.

**Review Standards:**
- Focus on issues that could cause bugs, security vulnerabilities, or performance problems
- Check adherence to coding standards, naming conventions, and architectural patterns
- Suggest concrete improvements with specific code examples when possible  
- Flag inconsistencies in code style that affect team collaboration or maintenance
- Avoid trivial formatting issues if they don't impact readability or team standards

**📋 Review Guidelines:**
1. Focus on code quality, security, performance, and maintainability
2. Identify potential bugs, logical errors, or edge cases  
3. Enforce coding standards: naming conventions, function/class structure, and architectural patterns
4. Check for proper error handling and input validation
5. Look for security vulnerabilities or data exposure risks
6. Consider scalability and performance implications
7. Verify proper testing coverage for new functionality
8. Ensure consistent code style and adherence to team conventions
9. Flag deviations from established patterns that could confuse future maintainers

**🚨 ANTI-DUPLICATE POLICY - MANDATORY COMPLIANCE:**

🔴 **STOP! READ THIS FIRST BEFORE ANY REVIEW:**
1. **MANDATORY**: Scroll down and read EVERY item in the "🔍 Existing Comments" section
2. **FORBIDDEN**: Creating feedback for ANY issue already mentioned below
3. **REQUIRED**: If existing comments cover all issues, return empty feedback array with "feedback": []
4. **ENFORCEMENT**: Duplicate feedback will be rejected - waste of resources

🚫 **WHAT COUNTS AS DUPLICATE (STRICTLY FORBIDDEN):**
- Same file + similar line numbers + similar topics (security, performance, style, etc.)
- Different wording but same underlying issue
- Generic suggestions already covered (error handling, validation, etc.)
- Any feedback that overlaps with existing discussion

✅ **ONLY ACCEPTABLE NEW FEEDBACK:**
- Completely different issues on different lines
- Technical bugs/errors not mentioned in existing comments
- Security vulnerabilities not already flagged
- Performance issues not already discussed

**💡 Code Suggestions Format:**
When suggesting code changes, use this EXACT format:
\`\`\`suggestion:-x+y
actual replacement code here
\`\`\`

**🔴 CRITICAL: GitLab Suggestion Syntax Explained**

**How suggestion:-x+y works:**
- **-x**: Number of lines to remove BEFORE the commented line (negative offset)
- **+y**: Number of lines to replace starting FROM the commented line (positive range)
- **The suggestion block content** replaces the entire range

**STEP-BY-STEP LOGIC:**
If you comment on line 100 with \`suggestion:-1+3\`:
1. **Start position**: Line 99 (100 - 1 = one line before comment)
2. **Range**: 3 lines total (lines 99, 100, 101)
3. **Result**: Lines 99-101 replaced with your suggestion content

**SIMPLE RULE**: If replacing only the commented line, omit -x+y entirely
**COMPLEX RULE**: Use -x+y only when you need to replace multiple lines or include context

**⚠️ SUGGESTION FORMAT WARNING:**
The suggestion:-x+y format is VERY sensitive to line counting errors. When in doubt:
- Provide clear code suggestions WITHOUT the -x+y format
- Use descriptive text like "Replace lines 45-47 with:" followed by code block
- This prevents code corruption from incorrect line counts

**📁 File Paths & Line Numbers:**
- Use EXACT file paths from section headers: "=== FULL FILE CONTENT: path/file.ext ===" → use "path/file.ext"
- Use EXACT line numbers from "FULL FILE CONTENT" sections (post-change line numbers)
- Only review actual changes (lines marked with + or - in git diff sections)
- Use full file content for context but reference the final line numbers

**🎯 Response Format:**
{
  "summary": "Brief assessment of changes",
  "overallRating": "approve|request_changes|comment",
  "feedback": [
    {
      "filePath": "exact/path/from/headers.ext",
      "lineNumber": 123,
      "severity": "error|warning|info|suggestion", 
      "title": "Brief issue title",
      "description": "Detailed explanation with specific code suggestions if applicable",
      "lineContent": "The actual line being referenced"
    }
  ]
}

**Severity Guidelines:**
- **error**: Critical issues (security, bugs, breaking changes)
- **warning**: Important issues (performance, bad practices)  
- **info**: General observations or minor improvements
- **suggestion**: Optional improvements or alternatives
`;

/**
 * Builds the dynamic header section with MR details
 */
const buildMRDetails = (request: AIReviewRequest): string => {
  const { title, description, sourceBranch, targetBranch, diffContent, authorName } = request;

  return `
**Merge Request Details:**
- Title: ${title}
- Author: ${authorName}
- Source Branch: ${sourceBranch}
- Target Branch: ${targetBranch}
- Description: ${description || 'No description provided'}

**Code Changes:**
${diffContent}`;
};

/**
 * Builds the existing feedback section
 */
const buildExistingFeedbackSection = (existingFeedback: ReviewFeedback[]): string => {
  if (!existingFeedback || existingFeedback.length === 0) {
    return '';
  }

  return `

**🔍 Existing Comments:**
The following comments have already been made on this MR:
${existingFeedback
  .map(
    (feedback) =>
      `- ${feedback.filePath}:${feedback.lineNumber} - ${feedback.severity}: ${feedback.title}\n  ${feedback.description}`
  )
  .join('\n')}

🚨 **CRITICAL**: Do NOT duplicate any of these existing comments. Only provide NEW insights not covered above.`;
};

/**
 * Critical instruction recap that appears at the end
 */
const CRITICAL_RECAP = `

🔴 **CRITICAL RECAP - FINAL VERIFICATION BEFORE SUBMITTING:**

**🎯 DECISION PROCESS (FOLLOW EXACTLY):**
For each potential feedback item, ask:
1. Is this exact issue already mentioned in existing comments? → SKIP IT
2. Is this similar to any existing comment topic? → SKIP IT  
3. Is this a genuinely new issue not covered above? → INCLUDE IT
4. When in doubt → SKIP IT (better safe than duplicate)

** Final Checklist (MANDATORY VERIFICATION):**
- ✅ **DUPLICATE CHECK**: Read existing comments and confirmed NO overlaps
- ✅ **ZERO TOLERANCE**: Removed any feedback similar to existing comments
- ✅ Used exact file paths from headers
- ✅ Used exact line numbers from FULL FILE CONTENT
- ✅ Counted suggestion lines correctly (-x+y)
- ✅ **QUALITY GATE**: Only included genuinely NEW and valuable feedback
- ✅ **FINAL DECISION**: If no new issues found, used empty feedback array

**REMEMBER: Empty feedback array with "Code looks good!" summary is PERFECT when existing comments are comprehensive**
`;

/**
 * Builds the AI review prompt based on MR data
 * Structure: Static Instructions → Custom Instructions → MR Details → Existing Comments → Critical Recap
 */
export const buildReviewPrompt = (request: AIReviewRequest): string => {
  const sections = [
    STATIC_INSTRUCTIONS,
    buildCustomPromptSection(request.customPromptFile),
    buildMRDetails(request),
    buildExistingFeedbackSection(request.existingFeedback || []),
    CRITICAL_RECAP,
  ];

  return sections.filter(Boolean).join('');
};

/**
 * Parses AI response text into structured review feedback
 */
export const parseAIResponse = (responseText: string): AIReviewResponse => {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and transform the response
    const feedback: ReviewFeedback[] = (parsed.feedback || []).map((item: AIReviewItem) => ({
      id: `ai-${Math.random().toString(36).substr(2, 9)}`,
      filePath: item.filePath || '',
      lineNumber: typeof item.lineNumber === 'number' ? item.lineNumber : 0,
      severity: validateSeverity(item.severity),
      title: item.title || 'AI Review Comment',
      description: item.description || '',
      lineContent: item.lineContent || '',
      position: null,
      status: 'pending' as const,
      isExisting: false,
    }));

    return {
      feedback,
      summary: parsed.summary || 'AI review completed',
      overallRating: validateOverallRating(parsed.overallRating),
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);

    // Fallback: create a simple feedback item with the raw response
    return {
      feedback: [
        {
          id: `ai-fallback-${Math.random().toString(36).substr(2, 9)}`,
          filePath: '',
          lineNumber: 0,
          severity: Severity.Info,
          title: 'AI Review Response',
          description: `Raw AI response (parsing failed):\n\n${responseText}`,
          lineContent: '',
          position: null,
          status: 'pending',
          isExisting: false,
        },
      ],
      summary: 'AI review completed (with parsing issues)',
      overallRating: 'comment',
    };
  }
};

/**
 * Validates and normalizes severity values
 */
const validateSeverity = (severity: string): Severity => {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'error':
      return Severity.Critical;
    case 'warning':
      return Severity.Warning;
    case 'info':
      return Severity.Info;
    case 'suggestion':
      return Severity.Suggestion;
    default:
      return Severity.Info;
  }
};

/**
 * Validates and normalizes overall rating values
 */
const validateOverallRating = (rating: string): 'approve' | 'request_changes' | 'comment' => {
  switch (rating?.toLowerCase()) {
    case 'approve':
      return 'approve';
    case 'request_changes':
      return 'request_changes';
    case 'comment':
    default:
      return 'comment';
  }
};

/**
 * Filters feedback to remove duplicates and low-value comments
 */
export const filterAndDeduplicateFeedback = (
  newFeedback: ReviewFeedback[],
  existingFeedback: ReviewFeedback[] = []
): ReviewFeedback[] => {
  const filtered = newFeedback.filter((feedback) => {
    // Remove empty or very short descriptions
    if (!feedback.description || feedback.description.trim().length < 10) {
      return false;
    }

    // Check for duplicates based on file path, line number, and similar content
    const isDuplicate = existingFeedback.some((existing) => {
      return (
        existing.filePath === feedback.filePath &&
        existing.lineNumber === feedback.lineNumber &&
        (existing.title.toLowerCase().includes(feedback.title.toLowerCase()) ||
          feedback.title.toLowerCase().includes(existing.title.toLowerCase()) ||
          existing.description.toLowerCase().includes(feedback.description.toLowerCase()) ||
          feedback.description.toLowerCase().includes(existing.description.toLowerCase()))
      );
    });

    return !isDuplicate;
  });

  // Sort by severity (critical first, then warnings, etc.)
  const severityOrder: Record<Severity, number> = {
    [Severity.Critical]: 0,
    [Severity.Warning]: 1,
    [Severity.Info]: 2,
    [Severity.Suggestion]: 3,
  };

  return filtered.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // If same severity, sort by file path then line number
    if (a.filePath !== b.filePath) {
      return a.filePath.localeCompare(b.filePath);
    }

    return a.lineNumber - b.lineNumber;
  });
};

/**
 * Creates a summary of review feedback
 */
export const createReviewSummary = (feedback: ReviewFeedback[], overallRating?: string): string => {
  if (feedback.length === 0) {
    return '✅ **Code looks good!** No issues found during the review.';
  }

  const counts = feedback.reduce(
    (acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const parts: string[] = [];

  if (counts[Severity.Critical]) {
    parts.push(
      `${counts[Severity.Critical]} critical issue${counts[Severity.Critical] > 1 ? 's' : ''}`
    );
  }
  if (counts[Severity.Warning]) {
    parts.push(`${counts[Severity.Warning]} warning${counts[Severity.Warning] > 1 ? 's' : ''}`);
  }
  if (counts[Severity.Info]) {
    parts.push(`${counts[Severity.Info]} info comment${counts[Severity.Info] > 1 ? 's' : ''}`);
  }
  if (counts[Severity.Suggestion]) {
    parts.push(
      `${counts[Severity.Suggestion]} suggestion${counts[Severity.Suggestion] > 1 ? 's' : ''}`
    );
  }

  const emoji = counts[Severity.Critical] ? '❌' : counts[Severity.Warning] ? '⚠️' : '💡';
  const summary = `${emoji} **Review completed:** Found ${parts.join(', ')}.`;

  if (overallRating === 'approve') {
    return `${summary}\n\n✅ **Overall: Approved** - Issues are minor and don't block merging.`;
  } else if (overallRating === 'request_changes') {
    return `${summary}\n\n🔄 **Overall: Changes Requested** - Please address the critical issues before merging.`;
  }

  return summary;
};
