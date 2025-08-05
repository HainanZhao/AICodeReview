import { Request, Response } from 'express';
import {
    GeminiCliCore,
    GeminiCliItem,
    buildReviewPrompt,
    type AIReviewRequest,
} from '../../shared/index.js';
import { BaseLLMProvider } from './baseLLMProvider.js';
import { ReviewRequest, ReviewResponse } from './types.js';

export class GeminiCliProvider extends BaseLLMProvider {
  readonly providerName = 'gemini-cli';

  constructor() {
    super(); // No API key needed for CLI provider
  }
  public static async isAvailable(): Promise<boolean> {
    try {
      return await GeminiCliCore.isAvailable();
    } catch {
      return false;
    }
  }

  private buildPrompt(request: ReviewRequest): string {
    // Convert ReviewRequest to AIReviewRequest format
    const aiRequest: AIReviewRequest = {
      title: request.title || 'Code Review',
      description: request.description || '',
      sourceBranch: request.sourceBranch || 'feature-branch',
      targetBranch: request.targetBranch || 'main',
      diffContent: request.diffForPrompt, // This already includes file contents when appropriate
      parsedDiffs: request.parsedDiffs || [],
      existingFeedback: request.existingFeedback || [],
      authorName: request.authorName || 'Unknown',
    };

    return buildReviewPrompt(aiRequest);
  }

  public async initializeWithCleanup(): Promise<void> {
    // No temporary files to clean up since we use stdin
    console.log('Temporary folder cleanup completed');
  }

  public async reviewCode(req: Request, res: Response): Promise<void> {
    const requestData = req.body as ReviewRequest;

    if (!requestData.diffForPrompt) {
      res.status(400).json({ error: 'Missing diffForPrompt in request body.' });
      return;
    }

    try {
      // Build the prompt using the better prompt builder
      const prompt = this.buildPrompt(requestData);

      try {
        // Use shared core for execution with backend-appropriate options
        const parsedResponse = await GeminiCliCore.executeReview(prompt, { verbose: false });

        // Convert to backend response format
        const validatedResponse = parsedResponse.map(
          (item: GeminiCliItem): ReviewResponse => ({
            filePath: String(item.filePath).replace(/\\/g, '/'), // Normalize path separators
            lineNumber: Number(item.lineNumber),
            severity: item.severity as ReviewResponse['severity'],
            title: String(item.title),
            description: String(item.description),
          })
        );

        res.json(validatedResponse);
      } catch (execError) {
        console.error('Error executing gemini:', execError);
        // Return empty array for execution errors
        res.json([]);
      }
    } catch (error) {
      console.error('Error preparing prompt:', error);
      // Return empty array for preparation errors
      res.json([]);
    }
  }

  /**
   * Generate explanation for a specific line of code using Gemini CLI
   */
  public async explainLine(
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines: number = 3,
    lineNumber?: number
  ): Promise<string> {
    try {
      const prompt = this.createExplanationPrompt(
        lineContent,
        filePath,
        fileContent,
        contextLines,
        lineNumber
      );
      const rawOutput = await GeminiCliCore.executeExplanation(prompt, { verbose: false });
      
      // Try to extract JSON from the output first
      const jsonExplanation = this.extractJsonExplanation(rawOutput);
      if (jsonExplanation) {
        return jsonExplanation;
      }
      
      // Fallback to raw output if no JSON found
      return rawOutput.trim();
    } catch (error) {
      throw new Error(
        `Gemini CLI error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract JSON explanation from AI output, handling mixed content
   */
  private extractJsonExplanation(output: string): string | null {
    try {
      // Look for JSON object in the output
      const jsonMatch = output.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonContent = jsonMatch[0];
        const parsed = JSON.parse(jsonContent);
        
        // Check if it has an explanation field
        if (parsed.explanation && typeof parsed.explanation === 'string') {
          return parsed.explanation;
        }
      }
      
      // Look for JSON with different structure
      const arrayMatch = output.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        const jsonContent = arrayMatch[0];
        const parsed = JSON.parse(jsonContent);
        
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].explanation) {
          return parsed[0].explanation;
        }
      }
      
      return null;
    } catch {
      // JSON parsing failed, return null to use fallback
      return null;
    }
  }

  /**
   * Create a prompt for explaining a specific line of code
   */
  private createExplanationPrompt(
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines: number = 3,
    lineNumber?: number
  ): string {
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const language = this.getLanguageFromExtension(fileExtension);

    let prompt = `You are a helpful code assistant. Please explain what the following line of code does in a clear, concise manner.

**File:** ${filePath}
**Language:** ${language}
**Line of code:** \`${lineContent}\``;

    if (lineNumber) {
      prompt += `\n**Line number:** ${lineNumber}`;
    }

    prompt += '\n\n';

    if (fileContent) {
      // If we have full file content, try to extract context around the line
      const lines = fileContent.split('\n');
      let targetLineIndex = -1;
      
      // Try to find the line by line number first (more reliable)
      if (lineNumber && lineNumber > 0 && lineNumber <= lines.length) {
        targetLineIndex = lineNumber - 1; // Convert to 0-based index
      } else {
        // Fallback to content match
        targetLineIndex = lines.findIndex((line) => line.trim() === lineContent.trim());
      }

      if (targetLineIndex >= 0) {
        const start = Math.max(0, targetLineIndex - contextLines);
        const end = Math.min(lines.length, targetLineIndex + contextLines + 1);
        const contextCode = lines
          .slice(start, end)
          .map((line, index) => {
            const lineNumber = start + index + 1;
            const isTargetLine = start + index === targetLineIndex;
            return `${lineNumber.toString().padStart(3, ' ')}: ${
              isTargetLine ? '>>> ' : '    '
            }${line}`;
          })
          .join('\n');

        prompt += `**Context (lines ${start + 1}-${end}):**
\`\`\`${language}
${contextCode}
\`\`\`

`;
      }
    }

    prompt += `Please provide a brief explanation focusing on:
1. What this line does
2. Its purpose in the context
3. Any important technical details

Keep the explanation concise but informative, suitable for a developer reviewing the code.

IMPORTANT: Return your response as a JSON object with the following format:
{
  "explanation": "Your detailed explanation here..."
}

Make sure to return only valid JSON with no additional text before or after.`;

    return prompt;
  }

  /**
   * Get programming language from file extension
   */
  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      kt: 'kotlin',
      swift: 'swift',
      scala: 'scala',
      sh: 'shell',
      bash: 'shell',
      ps1: 'powershell',
      sql: 'sql',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      dockerfile: 'dockerfile',
    };

    return languageMap[extension] || extension || 'text';
  }
}
