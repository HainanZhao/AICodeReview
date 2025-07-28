import { ReviewFeedback, Severity, ParsedFileDiff } from '../types/gitlab.js';

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
}

export interface AIReviewResponse {
  feedback: ReviewFeedback[];
  summary?: string;
  overallRating?: 'approve' | 'request_changes' | 'comment';
}

/**
 * Builds the AI review prompt based on MR data
 */
export const buildReviewPrompt = (request: AIReviewRequest): string => {
  const {
    title,
    description,
    sourceBranch,
    targetBranch,
    diffContent,
    existingFeedback,
    authorName,
  } = request;

  let prompt = `
You are an expert code reviewer. Please provide a thorough review of this merge request.

**Merge Request Details:**
- Title: ${title}
- Author: ${authorName}
- Source Branch: ${sourceBranch}
- Target Branch: ${targetBranch}
- Description: ${description || 'No description provided'}

**Code Changes:**
${diffContent}
`;

  if (existingFeedback && existingFeedback.length > 0) {
    prompt += `

**Existing Comments:**
The following comments have already been made on this MR:
${existingFeedback
  .map(
    (feedback) =>
      `- ${feedback.filePath}:${feedback.lineNumber} - ${feedback.severity}: ${feedback.title}\n  ${feedback.description}`
  )
  .join('\n')}

Please avoid duplicating these existing comments unless you have additional insights.
`;
  }

  prompt += `

**Review Guidelines:**
1. Focus on code quality, security, performance, and maintainability
2. Identify potential bugs, logical errors, or edge cases
3. Suggest improvements for readability and best practices
4. Check for proper error handling and input validation
5. Look for security vulnerabilities or data exposure risks
6. Consider scalability and performance implications
7. Verify proper testing coverage for new functionality
8. Check for consistent coding style and conventions

**CRITICAL LINE NUMBER INSTRUCTIONS:**
🔴 IMPORTANT: The code changes above include FULL FILE CONTENT with line numbers for context.
- When you see "=== FULL FILE CONTENT: filename ===" sections, these show the COMPLETE file AFTER all diff changes have been applied
- This is the LATEST VERSION of the file with the most current line numbers
- Use these EXACT line numbers in your feedback - they correspond to the actual file lines in the final state
- The git diff sections show what changed, but the FULL FILE CONTENT shows the final result

🎯 REVIEW FOCUS:
- ONLY review lines that are actual changes (marked with + or - in the git diff sections)
- Use the full file content for context and to understand the broader code structure
- Reference the exact line numbers as shown in the full file content sections (post-change line numbers)
- When you identify an issue, find that exact line in the "FULL FILE CONTENT" section to get the correct line number
- Remember: The full file content represents the state AFTER the merge request changes are applied

**Response Format:**
Please provide your review as a JSON object with the following structure:

{
  "summary": "A brief overall summary of the changes and your assessment",
  "overallRating": "approve|request_changes|comment",
  "feedback": [
    {
      "filePath": "path/to/file.ext",
      "lineNumber": 123,
      "severity": "error|warning|info|suggestion",
      "title": "Brief issue title",
      "description": "Detailed explanation of the issue and suggested fix",
      "lineContent": "The actual line of code being referenced"
    }
  ]
}

**Severity Guidelines:**
- "error": Critical issues that must be fixed (security vulnerabilities, bugs, breaking changes)
- "warning": Important issues that should be addressed (performance problems, bad practices)
- "info": General observations or minor improvements
- "suggestion": Optional improvements or alternative approaches

**FINAL REMINDER:** Use the exact line numbers shown in the "FULL FILE CONTENT" sections for accurate line references. These line numbers represent the final state of the file AFTER the merge request changes have been applied. Only include feedback items that add value. If the code looks good, provide a positive summary with an "approve" rating and an empty feedback array.`;

  return prompt;
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
