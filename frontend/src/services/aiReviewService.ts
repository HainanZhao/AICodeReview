import { v4 as uuidv4 } from 'uuid';
import { ReviewFeedback } from '../../../types';
import { Config, GitLabMRDetails, ChatMessage } from '../types';
import { fetchMrData } from './gitlabService';

/**
 * Loads MR details and existing feedback from GitLab
 */
export const loadMrDetails = async (
  url: string,
  config: Config
): Promise<{ mrDetails: GitLabMRDetails; feedback: ReviewFeedback[] }> => {
  if (!config || !config.url || !config.accessToken) {
    throw new Error('GitLab configuration is missing. Please set it in the settings.');
  }

  // Use GitLab service directly to get MR details fast
  const mrDetailsRaw = await fetchMrData(config, url);

  // Type assertion to handle minor type differences between CLI and frontend types
  const mrDetails = mrDetailsRaw as GitLabMRDetails;

  // Return existing feedback from GitLab discussions
  const existingFeedback = mrDetails.existingFeedback || [];

  return { mrDetails, feedback: existingFeedback };
};

/**
 * Fetches MR details quickly for immediate display (no AI review)
 */
export const fetchMrDetailsOnly = async (
  url: string,
  config: Config
): Promise<{ mrDetails: GitLabMRDetails; feedback: ReviewFeedback[] }> => {
  if (!config || !config.url || !config.accessToken) {
    throw new Error('GitLab configuration is missing. Please set it in the settings.');
  }

  // Use GitLab service directly to get MR details fast
  const mrDetailsRaw = await fetchMrData(config, url);

  // Type assertion to handle minor type differences between CLI and frontend types
  const mrDetails = mrDetailsRaw as GitLabMRDetails;

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
  if (!config || !config.url || !config.accessToken) {
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
          gitlabUrl: config.url,
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

/**
 * @deprecated Use runAiReview() for new unified API. This method is kept for backward compatibility only.
 */
export const reviewCode = async (
  code: string,
  config: Config
): Promise<{ feedback: ReviewFeedback[]; summary?: string; overallRating?: string }> => {
  if (!config || !config.url || !config.accessToken) {
    throw new Error('GitLab configuration is missing. Please set it in the settings.');
  }

  // This function is deprecated - return empty feedback for compatibility
  return { feedback: [] };
};

/**
 * Get AI explanation for a specific line of code
 */
export const explainLine = async (
  lineContent: string,
  filePath: string,
  lineNumber?: number,
  fileContent?: string,
  contextLines: number = 5
): Promise<string> => {
  if (!lineContent || !filePath) {
    throw new Error('Line content and file path are required for explanation.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

  try {
    const response = await fetch('/api/explain-line', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lineContent,
        lineNumber,
        filePath,
        fileContent,
        contextLines,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `AI Explain failed with status: ${response.status}`;
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

    if (!result.success) {
      throw new Error(result.error || 'AI Explain failed');
    }

    return result.explanation || 'No explanation available';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The AI explanation request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Start a new AI chat session for a specific line of code
 */
export const startChat = async (
  lineContent: string,
  filePath: string,
  lineNumber?: number,
  fileContent?: string,
  contextLines: number = 5
): Promise<{ sessionId: string; explanation: string; messages: ChatMessage[] }> => {
  if (!lineContent || !filePath) {
    throw new Error('Line content and file path are required to start chat.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

  try {
    const response = await fetch('/api/start-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lineContent,
        lineNumber,
        filePath,
        fileContent,
        contextLines,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `AI Chat failed with status: ${response.status}`;
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

    if (!result.success) {
      throw new Error(result.error || 'AI Chat failed');
    }

    return {
      sessionId: result.sessionId || '',
      explanation: result.explanation || 'No explanation available',
      messages: result.messages || [],
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The AI chat request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Continue an existing AI chat conversation
 */
export const continueChat = async (
  sessionId: string,
  message: string
): Promise<{ response: string; messages: ChatMessage[] }> => {
  if (!sessionId || !message?.trim()) {
    throw new Error('Session ID and message are required to continue chat.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        message: message.trim(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `AI Chat failed with status: ${response.status}`;
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

    if (!result.success) {
      throw new Error(result.error || 'AI Chat failed');
    }

    return {
      response: result.response || 'No response available',
      messages: result.messages || [],
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The AI chat request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Get chat messages for a session
 */
export const getChatMessages = async (
  sessionId: string
): Promise<{ messages: ChatMessage[]; lineContent: string; filePath: string }> => {
  if (!sessionId) {
    throw new Error('Session ID is required to get chat messages.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

  try {
    const response = await fetch(`/api/chat/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `Get chat messages failed with status: ${response.status}`;
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

    if (!result.success) {
      throw new Error(result.error || 'Get chat messages failed');
    }

    return {
      messages: result.messages || [],
      lineContent: result.lineContent || '',
      filePath: result.filePath || '',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The get chat messages request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
