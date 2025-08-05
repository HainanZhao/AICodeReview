import crypto from 'crypto';
import {
  getNewLineFromOldLine,
  getOldLineFromNewLine,
  gitlabApiFetch,
} from '../shared/services/gitlabCore.js';
import {
  GitLabConfig,
  GitLabDiscussion,
  GitLabMRDetails,
  GitLabPosition,
  LineMapping,
  ReviewFeedback,
} from '../shared/types/gitlab.js';

/**
 * Normalizes a GitLab position object and generates the line_code
 * This should be done once during fetchMrData to improve performance
 */
export const normalizePositionForFile = (
  position: GitLabPosition,
  filePath: string,
  lineMapping?: LineMapping
): GitLabPosition => {
  const normalizedPosition = { ...position };

  if (lineMapping) {
    // Use line mapping to fill in missing old_line or new_line
    if (position.new_line && !position.old_line) {
      const mappedOldLine = getOldLineFromNewLine(position.new_line, lineMapping);
      normalizedPosition.old_line = mappedOldLine ?? position.new_line;
    } else if (position.old_line && !position.new_line) {
      const mappedNewLine = getNewLineFromOldLine(position.old_line, lineMapping);
      normalizedPosition.new_line = mappedNewLine ?? position.old_line;
    }
  }

  // Generate the line_code that GitLab requires for inline comments
  const lineCode = generateLineCode(normalizedPosition, filePath, lineMapping);
  normalizedPosition.line_code = lineCode;

  return normalizedPosition;
};

/**
 * Generates a GitLab line_code for a position
 * Format: {file_sha}_{old_line}_{new_line}
 *
 * For newly added lines (old_line is null), GitLab uses the previous old line number
 * For deleted lines (new_line is null), GitLab uses the next new line number
 * For context lines, both old_line and new_line are the same
 */
const generateLineCode = (
  position: GitLabPosition,
  filePath: string,
  lineMapping?: LineMapping
): string => {
  // Calculate SHA1 hash of the file path (GitLab's approach)
  const fileSha = crypto.createHash('sha1').update(filePath).digest('hex');

  let oldLine: number;
  let newLine: number;

  if (
    position.old_line !== null &&
    position.old_line !== undefined &&
    position.new_line !== null &&
    position.new_line !== undefined
  ) {
    // Both lines exist (context line)
    oldLine = position.old_line;
    newLine = position.new_line;
  } else if (
    position.old_line !== null &&
    position.old_line !== undefined &&
    (position.new_line === null || position.new_line === undefined)
  ) {
    // Only old line exists (deleted line)
    oldLine = position.old_line;

    // For deleted lines, GitLab uses the next new line number
    // Try to find it from line mapping, or fallback to old_line + 1
    if (lineMapping) {
      // Look for the mapping of the next old line to get the correct new line
      const nextOldLine = position.old_line + 1;
      const mappedNewLine = lineMapping.oldToNew[nextOldLine];
      newLine = mappedNewLine ?? position.old_line + 1;
    } else {
      // Fallback: use old_line + 1 as the next new line
      newLine = position.old_line + 1;
    }
  } else if (
    position.new_line !== null &&
    position.new_line !== undefined &&
    (position.old_line === null || position.old_line === undefined)
  ) {
    // Only new line exists (newly added line)
    newLine = position.new_line;

    // For newly added lines, GitLab uses the previous old line number
    // Try to find it from line mapping, or fallback to new_line - 1
    if (lineMapping) {
      // Look for the mapping of the previous new line to get the correct old line
      const prevNewLine = position.new_line - 1;
      const mappedOldLine = lineMapping.newToOld[prevNewLine];
      oldLine = mappedOldLine ?? position.new_line - 1;
    } else {
      // Fallback: use new_line - 1 as the previous old line
      oldLine = position.new_line - 1;
    }
  } else {
    // Both are null/undefined - fallback
    oldLine = 0;
    newLine = 0;
  }

  return `${fileSha}_${oldLine}_${newLine}`;
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

  if (hasValidPosition && feedback.position) {
    try {
      // Normalize the position if it hasn't been pre-normalized
      let normalizedPosition = feedback.position;
      if (!feedback.position.line_code) {
        const lineMapping = mrDetails.lineMappings[feedback.filePath];
        normalizedPosition = normalizePositionForFile(
          feedback.position,
          feedback.filePath,
          lineMapping
        );
      }

      if (process.env.VERBOSE || process.env.DEBUG) {
        console.log('Using normalized position:', {
          original_old_line: feedback.position.old_line,
          original_new_line: feedback.position.new_line,
          normalized_old_line: normalizedPosition.old_line,
          normalized_new_line: normalizedPosition.new_line,
          filePath: feedback.filePath,
          lineNumber: feedback.lineNumber,
        });
      }

      const inlinePayload = {
        body: baseBody.trim(),
        position: {
          base_sha: normalizedPosition.base_sha,
          start_sha: normalizedPosition.start_sha,
          head_sha: normalizedPosition.head_sha,
          old_path: normalizedPosition.old_path,
          new_path: normalizedPosition.new_path,
          position_type: 'text',
          old_line: feedback.position.old_line ?? null,
          new_line: feedback.position.new_line ?? null,
        },
      };

      if (process.env.VERBOSE || process.env.DEBUG) {
        console.log('Sending inline payload:', JSON.stringify(inlinePayload, null, 2));
      }

      const result = await gitlabApiFetch(url, config, {
        method: 'POST',
        body: JSON.stringify(inlinePayload),
      });

      // Mark as successfully posted inline
      return result;
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
      ? (() => {
          // Create GitLab code link if we have line_code information
          let fileLocationText = `📍 **File:** \`${feedback.filePath}\` (line ${feedback.lineNumber})`;

          // Try to construct GitLab code link using line_code
          let lineCode = feedback.position?.line_code;

          // If line_code is missing but we have position info, generate it
          if (!lineCode && feedback.position && mrDetails.webUrl) {
            try {
              const lineMapping = mrDetails.lineMappings[feedback.filePath];
              const normalizedPosition = normalizePositionForFile(
                feedback.position,
                feedback.filePath,
                lineMapping
              );
              lineCode = normalizedPosition.line_code;
            } catch (error) {
              console.warn(`Failed to generate line_code for fallback link: ${error}`);
            }
          }

          if (lineCode && mrDetails.webUrl) {
            const codeLink = `${mrDetails.webUrl}/diffs#${lineCode}`;
            fileLocationText = `📍 **File:** [${feedback.filePath} (line ${feedback.lineNumber})](${codeLink})`;
          }

          return (
            `
**[AI]${feedback.severity}: ${feedback.title}**` +
            `
${fileLocationText}` +
            `

${feedback.description}`
          );
        })()
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
  return result;
};
