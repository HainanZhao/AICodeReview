import { v4 as uuidv4 } from 'uuid';
import { ReviewFeedback, Severity, GitLabMRDetails, GitLabPosition } from '../../../types';
import { Config } from '../types';

/**
 * Fetches MR details quickly for immediate display (no AI review)
 */
export const fetchMrDetailsOnly = async (
  url: string,
  config: Config
): Promise<{ mrDetails: GitLabMRDetails; feedback: ReviewFeedback[] }> => {
  if (!config || !config.gitlabUrl || !config.accessToken) {
    throw new Error('GitLab configuration is missing. Please set it in the settings.');
  }

  // Use GitLab service directly to get MR details fast
  const { fetchMrData } = await import('./gitlabService');
  const mrDetails = await fetchMrData(config, url);

  // Return existing feedback from GitLab discussions
  const existingFeedback = mrDetails.existingFeedback || [];

  return { mrDetails, feedback: existingFeedback };
};

/**
 * Runs AI review using the new unified backend API
 */
export const runAiReview = async (
  url: string,
  config: Config
): Promise<{ feedback: ReviewFeedback[]; summary?: string; overallRating?: string }> => {
  if (!config || !config.gitlabUrl || !config.accessToken) {
    throw new Error('GitLab configuration is missing. Please set it in the settings.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout for AI review

  try {
    const response = await fetch('/api/review-mr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mrUrl: url,
        gitlabConfig: {
          gitlabUrl: config.gitlabUrl,
          accessToken: config.accessToken,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `AI Review failed with status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If we can't parse JSON, use default message
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // Handle different response formats from the API
    let feedbackArray: ReviewFeedback[];
    let summary: string | undefined;
    let overallRating: string | undefined;

    if (Array.isArray(result)) {
      // New API returns feedback array directly
      feedbackArray = result;
    } else if (result.feedback && Array.isArray(result.feedback)) {
      // API returns object with feedback property
      feedbackArray = result.feedback;
      summary = result.summary;
      overallRating = result.overallRating;
    } else {
      throw new Error('Invalid response format from AI review API');
    }

    // Convert feedback to proper format with UUIDs and positions if needed
    const feedback = feedbackArray.map((item: ReviewFeedback) => ({
      ...item,
      id: item.id || uuidv4(),
      status: item.status || 'pending',
      // Ensure lineContent is set for UI display
      lineContent: item.lineContent || `Line ${item.lineNumber}`,
      // Ensure position is null if not provided (will be calculated later if needed)
      position: item.position || null,
    }));

    return {
      feedback,
      summary,
      overallRating,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The AI review timed out after 3 minutes. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Legacy combined function - kept for backward compatibility
 * @deprecated Use fetchMrDetailsOnly + runAiReview for better UX
 */
export const fetchMrDetails = async (
  url: string,
  config: Config
): Promise<{ mrDetails: GitLabMRDetails; feedback: ReviewFeedback[] }> => {
  // For backward compatibility, just fetch MR details quickly
  return fetchMrDetailsOnly(url, config);
};

export const reviewCode = async (
  mrDetails: GitLabMRDetails,
  config: Config
): Promise<{ feedback: ReviewFeedback[] }> => {
  if (!config || !config.gitlabUrl || !config.accessToken) {
    throw new Error('GitLab configuration is missing. Please set it in the settings.');
  }

  if (mrDetails.diffForPrompt.trim() === '') {
    return {
      feedback: [
        {
          id: uuidv4(),
          lineNumber: 0,
          filePath: 'N/A',
          severity: Severity.Info,
          title: 'No Code Changes Found',
          description: 'This merge request does not contain any code changes to review.',
          lineContent: '',
          position: null,
          status: 'submitted',
        },
      ],
    };
  }

  // Try the new unified API first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

    try {
      const response = await fetch('/api/review-mr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mrUrl: mrDetails.webUrl,
          gitlabConfig: {
            gitlabUrl: config.gitlabUrl,
            accessToken: config.accessToken,
          },
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const parsedResponse = (await response.json()) as ReviewFeedback[];

        if (Array.isArray(parsedResponse)) {
          // Convert response format and add positions
          const feedback = await processNewApiResponse(parsedResponse, mrDetails);
          return { feedback };
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('The review request timed out after 2 minutes. Please try again.');
      }
      console.log('New API failed, falling back to legacy API...', error);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    console.log('New API not available, using legacy method...');
  }

  // Fallback to legacy API
  return reviewCodeLegacy(mrDetails, config);
};

// Helper method to process new API response
async function processNewApiResponse(
  apiResponse: ReviewFeedback[],
  mrDetails: GitLabMRDetails
): Promise<ReviewFeedback[]> {
  const parsedFileDiffsMap = new Map(mrDetails.parsedDiffs.map((p) => [p.filePath, p]));

  return apiResponse.map((item): ReviewFeedback => {
    const parsedFile = parsedFileDiffsMap.get(item.filePath);

    let position: GitLabPosition | null = null;
    let lineContent: string = '';

    if (item.lineNumber === 0) {
      lineContent = 'General file comment';
    }

    if (item.lineNumber > 0 && parsedFile) {
      const allLines = parsedFile.hunks.flatMap((h) => h.lines);
      // First try to find the exact line that was added
      let targetLine = allLines.find((l) => l.newLine === item.lineNumber && l.type === 'add');

      // If not found, try to find any line with that line number
      if (!targetLine) {
        targetLine = allLines.find((l) => l.newLine === item.lineNumber);
      }

      // Also check for deleted lines using oldLine number
      if (!targetLine) {
        targetLine = allLines.find((l) => l.oldLine === item.lineNumber && l.type === 'remove');
      }

      if (targetLine) {
        lineContent = targetLine.content;

        position = {
          base_sha: mrDetails.base_sha,
          start_sha: mrDetails.start_sha,
          head_sha: mrDetails.head_sha,
          position_type: 'text',
          old_path: parsedFile.oldPath,
          new_path: parsedFile.filePath,
          old_line: targetLine.oldLine,
          new_line: targetLine.newLine,
        };
      } else {
        console.warn(
          `AI suggested a comment for line ${item.lineNumber} in ${item.filePath}, but this line is not in the diff.`
        );
        lineContent = `Line ${item.lineNumber} (not visible in diff)`;
      }
    }

    return {
      id: uuidv4(),
      lineNumber: item.lineNumber,
      severity: item.severity,
      title: item.title,
      description: item.description,
      filePath: item.filePath,
      lineContent: lineContent || 'Comment on a line not found in diff.',
      position,
      status: 'pending',
    };
  });
}

// Legacy API method (keeping for backward compatibility)
async function reviewCodeLegacy(
  mrDetails: GitLabMRDetails,
  config: Config
): Promise<{ feedback: ReviewFeedback[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

  try {
    // Send comprehensive request data including MR context and file contents
    const requestBody = {
      diffForPrompt: mrDetails.diffForPrompt,
      title: mrDetails.title,
      description: '', // MR description not available in current type
      sourceBranch: mrDetails.sourceBranch,
      targetBranch: mrDetails.targetBranch,
      authorName: mrDetails.authorName,
      existingFeedback: mrDetails.existingFeedback || [],
      parsedDiffs: mrDetails.parsedDiffs || [],
      // Include file contents for better AI context
      fileContents: Object.fromEntries(mrDetails.fileContents || new Map()),
    };

    const response = await fetch('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
          if (errorData.details) {
            errorMessage += ` - ${errorData.details}`;
          }
        }
      } catch {
        // If we can't parse JSON, try to read as text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        } catch {
          // If we can't read anything, just use the status
        }
      }
      throw new Error(errorMessage);
    }

    const parsedResponse = (await response.json()) as ReviewFeedback[];

    if (!Array.isArray(parsedResponse)) {
      console.warn('Unexpected JSON structure from API:', parsedResponse);
      return { feedback: [] };
    }

    const parsedFileDiffsMap = new Map(mrDetails.parsedDiffs.map((p) => [p.filePath, p]));

    const generatedFeedback = parsedResponse.map((item): ReviewFeedback | null => {
      const parsedFile = parsedFileDiffsMap.get(item.filePath);

      let position: GitLabPosition | null = null;
      let lineContent: string = '';

      if (item.lineNumber === 0) {
        lineContent = 'General file comment';
      }

      if (item.lineNumber > 0 && parsedFile) {
        const allLines = parsedFile.hunks.flatMap((h) => h.lines);
        // First try to find the exact line that was added
        let targetLine = allLines.find((l) => l.newLine === item.lineNumber && l.type === 'add');

        // If not found, try to find any line with that line number (context, modified, deleted, etc.)
        if (!targetLine) {
          targetLine = allLines.find((l) => l.newLine === item.lineNumber);
        }

        // Also check for deleted lines using oldLine number
        if (!targetLine) {
          targetLine = allLines.find((l) => l.oldLine === item.lineNumber && l.type === 'remove');
        }

        // If still not found, allow the comment but warn
        if (!targetLine) {
          console.warn(
            `AI suggested a comment for line ${item.lineNumber} in ${item.filePath}, but this line is not in the diff. Creating comment anyway.`
          );
          // Create a generic position for lines not in the diff
          position = {
            base_sha: mrDetails.base_sha,
            start_sha: mrDetails.start_sha,
            head_sha: mrDetails.head_sha,
            position_type: 'text',
            old_path: parsedFile.oldPath,
            new_path: parsedFile.filePath,
            new_line: item.lineNumber,
          };
          lineContent = `Line ${item.lineNumber} (not visible in diff)`;
        } else {
          lineContent = targetLine.content;

          position = {
            base_sha: mrDetails.base_sha,
            start_sha: mrDetails.start_sha,
            head_sha: mrDetails.head_sha,
            position_type: 'text',
            old_path: parsedFile.oldPath,
            new_path: parsedFile.filePath,
            old_line: targetLine.oldLine,
            new_line: targetLine.newLine,
          };
        }
      }

      return {
        id: uuidv4(),
        lineNumber: item.lineNumber,
        severity: item.severity,
        title: item.title,
        description: item.description,
        filePath: item.filePath,
        lineContent: lineContent || 'Comment on a line not found in diff.',
        position,
        status: 'pending',
      };
    });

    const feedback = generatedFeedback.filter((fb): fb is ReviewFeedback => fb !== null);

    return { feedback };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The review request timed out after 2 minutes. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
