import * as fs from 'node:fs';
import type { LineMapping } from '../types/gitlab.js';
import { type ParsedFileDiff, type ReviewFeedback, Severity } from '../types/gitlab.js';
import { STATIC_INSTRUCTIONS } from './prompts/index.js';

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
  suggestion?: string; // Optional field some models might produce
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
  projectName?: string; // Project name to look up project-specific prompts
  customPromptFile?: string; // Optional path to custom prompt file (for CLI overrides)
  promptStrategy?: 'append' | 'prepend' | 'replace'; // How to merge custom prompt with default
  projectPrompts?: Record<
    string,
    {
      promptFile?: string;
      promptStrategy?: 'append' | 'prepend' | 'replace';
    }
  >; // Available per-project prompts configuration
  changedFiles?: string[]; // List of changed file paths for unambiguous reference
  projectId?: number; // Optional GitLab project ID
  headSha?: string; // Optional GitLab head SHA
  gitlabConfig?: { url: string; accessToken: string }; // Optional GitLab config
  provider?: string; // Optional LLM provider name
  lineMappings?: Record<string, LineMapping>; // Line mappings for translating between git diff and full file line numbers
}

export interface AIReviewResponse {
  feedback: ReviewFeedback[];
  summary?: string;
  overallRating?: 'approve' | 'request_changes' | 'comment';
}

/**
 * Validates a custom prompt file and returns validation errors if any
 */
const validateCustomPromptFile = (promptFile: string): string[] => {
  const errors: string[] = [];

  if (!fs.existsSync(promptFile)) {
    errors.push(`Custom prompt file does not exist: ${promptFile}`);
    return errors;
  }

  try {
    const stats = fs.statSync(promptFile);

    if (!stats.isFile()) {
      errors.push(`Custom prompt path is not a file: ${promptFile}`);
    }

    if (stats.size === 0) {
      errors.push(`Custom prompt file is empty: ${promptFile}`);
    }

    if (stats.size > 100 * 1024) {
      // 100KB limit
      errors.push(
        `Custom prompt file is too large (max 100KB): ${promptFile} (${Math.round(stats.size / 1024)}KB)`
      );
    }

    // Try to read the file to check encoding
    const content = fs.readFileSync(promptFile, 'utf-8');

    if (content.trim().length === 0) {
      errors.push(`Custom prompt file contains no meaningful content: ${promptFile}`);
    }

    // Check for potential encoding issues or binary content
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(content)) {
      errors.push(
        `Custom prompt file may contain binary data or invalid characters: ${promptFile}`
      );
    }

    // Warn if file is suspiciously small
    if (content.trim().length < 10) {
      errors.push(`Custom prompt file is very short (less than 10 characters): ${promptFile}`);
    }
  } catch (error) {
    errors.push(
      `Failed to access custom prompt file ${promptFile}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return errors;
};

/**
 * Resolves the custom prompt configuration for a specific project
 */
const resolveProjectPromptConfig = (
  projectName?: string,
  projectPrompts?: Record<
    string,
    {
      promptFile?: string;
      promptStrategy?: 'append' | 'prepend' | 'replace';
    }
  >,
  fallbackPromptFile?: string,
  fallbackStrategy?: 'append' | 'prepend' | 'replace'
): { promptFile?: string; strategy: 'append' | 'prepend' | 'replace' } => {
  // If we have a project name and project prompts configured, look for project-specific config
  if (projectName && projectPrompts) {
    console.log(`🔍 Looking for project prompt config for: "${projectName}"`);
    console.log(`   Available configs: ${Object.keys(projectPrompts).join(', ')}`);

    // Direct match first
    const directConfig = projectPrompts[projectName];
    if (directConfig) {
      console.log(`📝 Using project-specific prompt for: ${projectName} (direct match)`);
      return {
        promptFile: directConfig.promptFile,
        strategy: directConfig.promptStrategy || 'append',
      };
    }

    // Try partial matching for project names with better GitLab path handling
    const matchingProjectKey = Object.keys(projectPrompts).find((configProjectName) => {
      const configLower = configProjectName.toLowerCase();
      const projectLower = projectName.toLowerCase();

      // Normalize spaces around slashes for both config and project names
      const normalizeSpaces = (str: string) => str.replace(/\s*\/\s*/g, '/');
      const configNormalized = normalizeSpaces(configLower);
      const projectNormalized = normalizeSpaces(projectLower);

      // Direct match after normalization
      if (configNormalized === projectNormalized) {
        return true;
      }

      // Direct substring matching (existing logic)
      if (projectLower.includes(configLower) || configLower.includes(projectLower)) {
        return true;
      }

      // Also try normalized substring matching
      if (
        projectNormalized.includes(configNormalized) ||
        configNormalized.includes(projectNormalized)
      ) {
        return true;
      }

      // GitLab project path matching: handle cases like "gt/js/jsgh-lib" vs "ghpr-tech/js/jsgh-lib"
      // Extract the repo part (last segment) and compare
      const configRepoPart = configLower.split('/').pop() || '';
      const projectRepoPart = projectLower.split('/').pop() || '';

      if (configRepoPart && projectRepoPart && configRepoPart === projectRepoPart) {
        return true;
      }

      // Also try matching the last 2 segments (group/repo) if both have them
      const configParts = configLower.split('/');
      const projectParts = projectLower.split('/');

      if (configParts.length >= 2 && projectParts.length >= 2) {
        const configLastTwo = configParts.slice(-2).join('/');
        const projectLastTwo = projectParts.slice(-2).join('/');

        if (configLastTwo === projectLastTwo) {
          return true;
        }
      }

      return false;
    });

    if (matchingProjectKey) {
      const matchingConfig = projectPrompts[matchingProjectKey];
      console.log(
        `📝 Using project-specific prompt for: "${projectName}" (matched config: "${matchingProjectKey}")`
      );
      return {
        promptFile: matchingConfig.promptFile,
        strategy: matchingConfig.promptStrategy || 'append',
      };
    }
    console.log(`❌ No matching project prompt config found for: "${projectName}"`);
  }

  // Fall back to global prompt configuration
  if (fallbackPromptFile) {
    console.log(`📝 Using global fallback prompt for: ${projectName || 'unknown project'}`);
  }

  return {
    promptFile: fallbackPromptFile,
    strategy: fallbackStrategy || 'append',
  };
};

/**
 * Reads a custom prompt file and returns its content
 * Returns empty string if file doesn't exist or can't be read
 */
const readCustomPromptFile = (promptFile: string): string => {
  // Validate the file first
  const validationErrors = validateCustomPromptFile(promptFile);

  if (validationErrors.length > 0) {
    console.warn('⚠ Custom prompt file validation failed:');
    validationErrors.forEach((error) => console.warn(`  - ${error}`));
    return '';
  }

  try {
    const content = fs.readFileSync(promptFile, 'utf-8').trim();
    console.log(
      `✅ Using custom prompt file: ${promptFile} (${Math.round((content.length / 1024) * 100) / 100}KB)`
    );
    return content;
  } catch (error) {
    console.warn(
      `⚠ Warning: Failed to read custom prompt file ${promptFile}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return '';
  }
};

/**
 * Builds the custom prompt section if a custom prompt file is provided
 */
const buildCustomPromptSection = (
  customPromptFile?: string,
  strategy: 'append' | 'prepend' | 'replace' = 'append'
): string => {
  if (!customPromptFile) {
    return '';
  }

  const customContent = readCustomPromptFile(customPromptFile);
  if (!customContent) {
    return '';
  }

  // For 'replace' strategy, return only the custom content
  if (strategy === 'replace') {
    return `\n\n${customContent}\n`;
  }

  // For 'append' and 'prepend', add project-specific header
  return `

**🎯 PROJECT-SPECIFIC REVIEW INSTRUCTIONS:**

${customContent}

**Note**: The above instructions are specific to this project and should be applied in addition to the general review guidelines.
`;
};

/**
 * Builds the dynamic header section with MR details
 */
const buildMRDetails = (request: AIReviewRequest): string => {
  const { title, description, sourceBranch, targetBranch, diffContent, authorName, changedFiles } = request;

  let details = `
**Merge Request Details:**
- Title: ${title}
- Author: ${authorName}
- Source Branch: ${sourceBranch}
- Target Branch: ${targetBranch}
- Description: ${description || 'No description provided'}

${changedFiles && changedFiles.length > 0 ? `**Changed Files (Full Paths):**\n${changedFiles.map(f => `- ${f}`).join('\n')}` : ''}

**Code Changes:**
${diffContent}`;

  return details;
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
 * Builds generic instructions for AI agents (e.g. for on-demand file fetching)
 */
const buildGenericInstructions = (request: AIReviewRequest): string => {
  try {
    const { GeminiACPSession } = require('../../services/GeminiACPSession.js');
    const baseUrl = GeminiACPSession.getInstance().baseUrl;
    if (baseUrl) {
      const fetchUrl = `${baseUrl}/api/files?path=<file_path>`;
      return `
**🛠️ Tool Instructions:**
If the git diff alone is insufficient, you MUST retrieve full file contents or list directories by using your built-in tools (e.g. \`fs.read_file\`, \`fs.list_directory\`) or by calling the local proxy endpoint:
\`curl "${fetchUrl}"\`

Example: \`curl "${baseUrl}/api/files?path=src/utils.ts"\`
The file path should be EXACTLY as shown in the "Changed Files (Full Paths)" list.
`;
    }
  } catch (e) {
    // Fallback if session is not available
  }
  return '';
};

/**
 * Builds the AI review prompt based on MR data
 * Structure varies based on promptStrategy:
 * - append (default): Static Instructions → Generic Instructions → MR Details → Custom Instructions → Existing Comments
 * - prepend: Custom Instructions → Static Instructions → Generic Instructions → MR Details → Existing Comments
 * - replace: Custom Instructions → MR Details → Existing Comments
 */
export const buildReviewPrompt = (request: AIReviewRequest): string => {
  if (request.changedFiles && request.changedFiles.length > 0) {
    console.log('📄 List of changed files for AI review:\n' + request.changedFiles.map(f => `  - ${f}`).join('\n'));
  }

  // Resolve the correct prompt configuration for this project
  const promptConfig = resolveProjectPromptConfig(
    request.projectName,
    request.projectPrompts,
    request.customPromptFile, // Fallback to CLI override or global config
    request.promptStrategy
  );

  const customSection = buildCustomPromptSection(promptConfig.promptFile, promptConfig.strategy);
  const genericInstructions = buildGenericInstructions(request);
  const mrDetails = buildMRDetails(request);
  const existingFeedback = buildExistingFeedbackSection(request.existingFeedback || []);

  // Build sections array based on strategy
  let sections: string[];

  switch (promptConfig.strategy) {
    case 'prepend':
      sections = [customSection, STATIC_INSTRUCTIONS, genericInstructions, mrDetails, existingFeedback];
      break;

    case 'replace':
      sections = [customSection, mrDetails, existingFeedback];
      break;
    default:
      sections = [STATIC_INSTRUCTIONS, customSection, genericInstructions, mrDetails, existingFeedback];
      break;
  }

  const prompt = sections.filter(Boolean).join('');
  console.log(`📊 Total AI prompt length: ${prompt.length} characters`);
  return prompt;
};

/**
 * Parses AI response text into structured review feedback
 * Supports Markdown format only (no YAML fallback)
 */
export const parseAIResponse = (responseText: string): AIReviewResponse => {
  // Log the start of the response for debugging
  const preview = responseText.length > 2000 
    ? responseText.substring(0, 2000) + '...' 
    : responseText;
  console.log(`📝 AI Response Preview: ${preview}`);

  try {
    // Try to parse as Markdown (preferred format)
    const markdownResult = parseMarkdownResponse(responseText);
    if (markdownResult) {
      return markdownResult;
    }

    // If Markdown parsing fails, throw error
    throw new Error('Could not parse AI response in Markdown format');
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    
    // Log full response on failure for debugging
    console.log('📄 Full unparseable AI response:', responseText);

    // Fallback: create a simple feedback item with the raw response
    return {
      feedback: [
        {
          id: `ai-fallback-${Math.random().toString(36).substr(2, 9)}`,
          filePath: '',
          lineNumber: 0,
          severity: Severity.Info,
          title: 'AI Review Response (Parsing Failed)',
          description: `The AI response could not be parsed. Expected Markdown format. Error: ${error instanceof Error ? error.message : String(error)}\n\nRaw response preview:\n${responseText.substring(0, 500)}...`,
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
 * Parses AI response in Markdown format
 * Format:
 * ## Summary
 * ...
 * ## Overall Rating
 * approve | request_changes | comment
 * ## Feedback
 * - **file**: path/to/file.ts
 * - **line**: 123
 * - **severity**: warning
 * - **title**: Title
 * - **description**: Description
 * - **lineContent**: code
 * ---
 */
const parseMarkdownResponse = (responseText: string): AIReviewResponse | null => {
  try {
    const feedback: ReviewFeedback[] = [];
    let summary = '';
    let overallRating: 'approve' | 'request_changes' | 'comment' = 'comment';

    // Extract summary section
    const summaryMatch = responseText.match(/##\s*Summary\s*\n*([\s\S]*?)(?=##\s*Overall|$)/i);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    // Extract overall rating
    const ratingMatch = responseText.match(/##\s*Overall\s*Rating\s*\n*(\w+)/i);
    if (ratingMatch) {
      const rating = ratingMatch[1].toLowerCase().trim();
      if (rating === 'approve' || rating === 'request_changes' || rating === 'comment') {
        overallRating = rating;
      }
    }

    // Extract feedback section
    const feedbackSectionMatch = responseText.match(/##\s*Feedback\s*([\s\S]*)$/i);
    if (!feedbackSectionMatch) {
      return null; // Not in Markdown format
    }

    const feedbackSection = feedbackSectionMatch[1];
    
    // Split by "---" to separate feedback items
    const feedbackBlocks = feedbackSection.split(/\n---\s*\n/);
    
    for (const block of feedbackBlocks) {
      if (!block.trim()) continue;
      
      // Parse each field from the block
      const fileMatch = block.match(/\*\*file\*\*:\s*([^\n]+)/i);
      const lineMatch = block.match(/\*\*line\*\*:\s*(\d+)/i);
      const severityMatch = block.match(/\*\*severity\*\*:\s*(\w+)/i);
      const titleMatch = block.match(/\*\*title\*\*:\s*([^\n]+)/i);
      const descriptionMatch = block.match(/\*\*description\*\*:\s*([\s\S]*?)(?=\*\*lineContent|$)/i);
      const lineContentMatch = block.match(/\*\*lineContent\*\*:\s*([\s\S]*?)$/i);

      if (fileMatch && lineMatch) {
        const filePath = fileMatch[1].trim();
        const lineNumber = parseInt(lineMatch[1], 10);
        const severity = severityMatch ? severityMatch[1].trim().toLowerCase() : 'info';
        const title = titleMatch ? titleMatch[1].trim() : 'AI Review Comment';
        
        // Get description, handling multiline content
        let description = '';
        if (descriptionMatch) {
          description = descriptionMatch[1].trim();
          // Clean up any leading markers
          description = description.replace(/^-\s*\*\*/g, '').trim();
        }
        
        // Get lineContent
        let lineContent = '';
        if (lineContentMatch) {
          lineContent = lineContentMatch[1].trim();
          lineContent = lineContent.replace(/^-\s*\*\*/g, '').trim();
        }

        feedback.push({
          id: `ai-${Math.random().toString(36).substr(2, 9)}`,
          filePath,
          lineNumber,
          severity: validateSeverity(severity),
          title,
          description,
          lineContent,
          position: null,
          status: 'pending' as const,
          isExisting: false,
        });
      }
    }

    if (feedback.length > 0 || summary) {
      return { feedback, summary, overallRating };
    }

    return null;
  } catch (error) {
    console.error('Failed to parse Markdown response:', error);
    return null;
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
  }
  if (overallRating === 'request_changes') {
    return `${summary}\n\n🔄 **Overall: Changes Requested** - Please address the critical issues before merging.`;
  }

  return summary;
};
