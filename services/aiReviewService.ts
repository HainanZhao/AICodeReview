import { v4 as uuidv4 } from 'uuid';
import { ReviewFeedback, Severity, Config, GitLabMRDetails, GitLabPosition } from '../types';
import type { GeminiReviewResponse } from '@aireview/shared';
import { fetchMrData } from "./gitlabService";

// Helper function to check if two pieces of text are similar
function isSimilarText(text1: string, text2: string): boolean {
    // Convert to lowercase and remove punctuation for comparison
    const normalize = (text: string) => 
        text.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .replace(/\s+/g, " ")
            .trim();

    const normalizedText1 = normalize(text1);
    const normalizedText2 = normalize(text2);

    // Check if one text contains most of the other
    return normalizedText1.includes(normalizedText2) || 
           normalizedText2.includes(normalizedText1) ||
           // Or if they're very similar (sharing most words)
           (normalizedText1.split(" ").filter(word => 
               normalizedText2.split(" ").includes(word)
           ).length / normalizedText1.split(" ").length > 0.7);
}

export const fetchMrDetails = async (
  url: string,
  config: Config
): Promise<{ mrDetails: GitLabMRDetails; feedback: ReviewFeedback[] }> => {
  if (!config || !config.gitlabUrl || !config.accessToken) {
    throw new Error(
      "GitLab configuration is missing. Please set it in the settings."
    );
  }

  const mrDetails = await fetchMrData(config, url);

  // Return existing feedback from GitLab discussions
  const existingFeedback = mrDetails.existingFeedback || [];

  return { mrDetails, feedback: existingFeedback };
};

export const reviewCode = async (
  mrDetails: GitLabMRDetails,
  config: Config
): Promise<{ feedback: ReviewFeedback[] }> => {
  if (!config || !config.gitlabUrl || !config.accessToken) {
    throw new Error(
      "GitLab configuration is missing. Please set it in the settings."
    );
  }

  if (mrDetails.diffForPrompt.trim() === "") {
    return {
      feedback: [
        {
          id: uuidv4(),
          lineNumber: 0,
          filePath: "N/A",
          severity: Severity.Info,
          title: "No Code Changes Found",
          description:
            "This merge request does not contain any code changes to review.",
          lineContent: "",
          position: null,
          status: "submitted",
        },
      ],
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

  try {
    const response = await fetch("/api/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ diffForPrompt: mrDetails.diffForPrompt }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const parsedResponse = (await response.json()) as GeminiReviewResponse[];

    if (!Array.isArray(parsedResponse)) {
      console.warn("Unexpected JSON structure from API:", parsedResponse);
      return { feedback: [] };
    }

    const parsedFileDiffsMap = new Map(
      mrDetails.parsedDiffs.map((p) => [p.filePath, p])
    );

    const generatedFeedback = (parsedResponse as any[]).map(
      (item): ReviewFeedback | null => {
        const parsedFile = parsedFileDiffsMap.get(item.filePath);

        let position: GitLabPosition | null = null;
        let lineContent: string = "";

        if (item.lineNumber === 0) {
          lineContent = "General file comment";
        }

        if (item.lineNumber > 0 && parsedFile) {
          const allLines = parsedFile.hunks.flatMap((h) => h.lines);
          // First try to find the exact line that was added
          let targetLine = allLines.find(
            (l) => l.newLine === item.lineNumber && l.type === "add"
          );
          
          // If not found, try to find any line with that line number (context, modified, deleted, etc.)
          if (!targetLine) {
            targetLine = allLines.find((l) => l.newLine === item.lineNumber);
          }
          
          // Also check for deleted lines using oldLine number
          if (!targetLine) {
            targetLine = allLines.find((l) => l.oldLine === item.lineNumber && l.type === "remove");
          }

          // If still not found, allow the comment but warn
          if (!targetLine || !targetLine.newLine) {
            console.warn(
              `AI suggested a comment for line ${item.lineNumber} in ${item.filePath}, but this line is not in the diff. Creating comment anyway.`
            );
            // Create a generic position for lines not in the diff
            position = {
              base_sha: mrDetails.base_sha,
              start_sha: mrDetails.start_sha,
              head_sha: mrDetails.head_sha,
              position_type: "text",
              old_path: parsedFile.oldPath,
              new_path: parsedFile.filePath,
              new_line: item.lineNumber,
            };
            lineContent = `Line ${item.lineNumber} (not visible in diff)`;
          } else {
            lineContent = targetLine.content;

            // Handle position differently for deleted lines
            if (targetLine.type === "remove") {
              position = {
                base_sha: mrDetails.base_sha,
                start_sha: mrDetails.start_sha,
                head_sha: mrDetails.head_sha,
                position_type: "text",
                old_path: parsedFile.oldPath,
                new_path: parsedFile.filePath,
                old_line: targetLine.oldLine,
                // Don't include new_line for deleted lines
              };
            } else {
              position = {
                base_sha: mrDetails.base_sha,
                start_sha: mrDetails.start_sha,
                head_sha: mrDetails.head_sha,
                position_type: "text",
                old_path: parsedFile.oldPath,
                new_path: parsedFile.filePath,
                new_line: targetLine.newLine,
              };
            }
          }
        }

        return {
          id: uuidv4(),
          lineNumber: item.lineNumber,
          severity: item.severity,
          title: item.title,
          description: item.description,
          filePath: item.filePath,
          lineContent: lineContent || "Comment on a line not found in diff.",
          position,
          status: "pending",
        };
      }
    );

    const feedback = generatedFeedback.filter(
      (fb): fb is ReviewFeedback => fb !== null
    );
    
    return { feedback };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "The review request timed out after 2 minutes. Please try again."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
