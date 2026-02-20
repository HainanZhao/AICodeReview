import type { Request, Response } from 'express';
import { ConfigLoader } from '../../config/configLoader.js';
import { GeminiCliCore, type GeminiCliItem, parseAIResponse } from '../../shared/index.js';
import { BaseLLMProvider } from './baseLLMProvider.js';
import type { ReviewRequest, ReviewResponse } from './types.js';

export class GeminiCliProvider extends BaseLLMProvider {
  readonly providerName = 'gemini-cli';

  private async getTimeout(): Promise<number> {
    try {
      const config = ConfigLoader.loadConfig();
      return config.llm?.timeout ?? 600000; // Default to 10 minutes
    } catch {
      return 600000; // Default to 10 minutes if config can't be loaded
    }
  }
  public static async isAvailable(): Promise<boolean> {
    try {
      return await GeminiCliCore.isAvailable();
    } catch {
      return false;
    }
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
      // Build the prompt using the base class builder
      const prompt = await this.buildPrompt(requestData);

      // Get configurable timeout
      const timeout = await this.getTimeout();

      try {
        // Use shared core for execution with backend-appropriate options
        const { GeminiACPSession } = await import('../GeminiACPSession.js');
        const session = GeminiACPSession.getInstance();

        // Set MR context if available for subsequent file fetching requests
        if (requestData.projectId && requestData.headSha && requestData.gitlabConfig) {
          session.mrContext = {
            projectId: requestData.projectId,
            headSha: requestData.headSha,
            gitlabConfig: requestData.gitlabConfig,
          };
        }

        const rawOutput = await session.chat(prompt);

        const aiReviewResponse = parseAIResponse(rawOutput);

        // Convert to backend response format (ReviewResponse array)
        const validatedResponse: ReviewResponse[] = aiReviewResponse.feedback.map((item) => ({
          filePath: item.filePath,
          lineNumber: item.lineNumber,
          severity: item.severity as ReviewResponse['severity'],
          title: item.title,
          description: item.description,
        }));

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
   * Continue a chat conversation using Gemini CLI
   */
  public async continueChat(
    messages: { author: 'user' | 'ai'; content: string }[],
    filePath: string,
    fileContent?: string,
    lineNumber?: number
  ): Promise<string> {
    try {
      const prompt = this.createChatPrompt(messages, filePath, fileContent, lineNumber);
      const { GeminiACPSession } = await import('../GeminiACPSession.js');
      const rawOutput = await GeminiACPSession.getInstance().chat(prompt);

      const jsonExplanation = this.extractJsonExplanation(rawOutput);
      if (jsonExplanation) {
        return jsonExplanation;
      }

      return rawOutput.trim();
    } catch (error) {
      throw new Error(
        `Gemini CLI error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate explanation for a specific line of code using Gemini CLI
   */
  public async explainLine(
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines = 5,
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
      const { GeminiACPSession } = await import('../GeminiACPSession.js');
      const rawOutput = await GeminiACPSession.getInstance().chat(prompt);

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
      const jsonRegex = /```json\s*(\{[\s\S]+?\})\s*```|(\{[\s\S]+\})/;
      const match = output.match(jsonRegex);

      if (match) {
        const jsonString = match[1] || match[2];
        if (jsonString) {
          const parsed = JSON.parse(jsonString);
          if (parsed.explanation && typeof parsed.explanation === 'string') {
            return parsed.explanation;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create a prompt for explaining a specific line of code with enhanced context awareness
   */
  private createExplanationPrompt(
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines = 5,
    lineNumber?: number
  ): string {
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const language = this.getLanguageFromExtension(fileExtension);

    let prompt = `You are a helpful code assistant. When explaining code, prioritize context and broader understanding over line-by-line analysis.

**File:** ${filePath}
**Language:** ${language}
**Target line:** \`${lineContent}\``;

    if (lineNumber) {
      prompt += `\n**Line number:** ${lineNumber}`;
    }

    prompt += '\n\n';

    let contextCode = '';
    let hasContext = false;

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
        contextCode = lines
          .slice(start, end)
          .map((line, index) => {
            const lineNumber = start + index + 1;
            const isTargetLine = start + index === targetLineIndex;
            return `${lineNumber.toString().padStart(3, ' ')}: ${
              isTargetLine ? '>>> ' : '    '
            }${line}`;
          })
          .join('\n');

        hasContext = true;
        prompt += `**Code context (lines ${start + 1}-${end}):**
\`\`\`${language}
${contextCode}
\`\`\`

`;
      }
    }

    if (hasContext) {
      prompt += `**Instructions:**
Analyze the code context above and provide an explanation that prioritizes broader understanding:

1. **Context Analysis**: First, identify what broader code structure this line belongs to (e.g., SQL query, function definition, loop, conditional block, class method, etc.)

2. **Primary Explanation**: 
   - If this line is part of a larger logical unit (like a multi-line SQL query, function body, or complex expression), explain the overall purpose and functionality of that unit
   - If this line is standalone, explain what it does and why

3. **Specific Line Details**: Then provide details about the specific line's role within that broader context

4. **Technical Context**: Include any important technical details about how this fits into the overall logic

**For SQL queries specifically**: Explain what data is being retrieved/modified and the business purpose, not just the syntax.
**For function calls**: Explain what the function accomplishes and how this line contributes.
**For complex expressions**: Break down the logic and the intended outcome.

Prioritize usefulness to a developer trying to understand the code's purpose over detailed syntax explanation.`;
    } else {
      prompt += `**Instructions:**
Since limited context is available, provide the best explanation possible for this line:

1. **What it does**: Explain the line's functionality
2. **Likely purpose**: Based on the content, infer the probable purpose or business logic
3. **Technical details**: Any important implementation details

Focus on helping a developer understand both the "what" and the "why" of this code.`;
    }

    prompt += `

IMPORTANT: Return your response as a JSON object with the following format:
{
  "explanation": "Your detailed explanation here..."
}

Make sure to return only valid JSON with no additional text before or after.`;

    return prompt;
  }

  private createChatPrompt(
    messages: { author: 'user' | 'ai'; content: string }[],
    filePath: string,
    fileContent?: string,
    lineNumber?: number
  ): string {
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const language = this.getLanguageFromExtension(fileExtension);

    const initialMessage = messages[0]?.content || '';
    const followUpMessages = messages.slice(1);

    let prompt = `You are a helpful code assistant continuing a conversation about a piece of code.

**File:** ${filePath}
**Language:** ${language}
`;

    if (lineNumber) {
      prompt += `**Line number:** ${lineNumber}\n`;
    }

    if (fileContent) {
      prompt += `\n**Full File Content:**\n\`\`\`${language}\n${fileContent}\n\`\`\`\n`;
    }

    prompt += `
The user was initially asking about a line of code, and you provided the following explanation:
---
${initialMessage}
---

Now, the user has follow-up questions. Here is the conversation history:
`;

    followUpMessages.forEach((message) => {
      prompt += `**${message.author === 'user' ? 'User' : 'AI'}:** ${message.content}\n`;
    });

    prompt += `
**Instructions:**
Based on the full file content and the conversation history, please provide a concise and helpful response to the last user message.
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
