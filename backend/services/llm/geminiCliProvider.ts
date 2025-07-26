import { LLMProvider, ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { ReviewPromptBuilder } from './promptBuilder.js';

const execAsync = promisify(exec);

interface GeminiItem {
  filePath: string;
  lineNumber: number;
  severity: ReviewResponse['severity'];
  title: string;
  description: string;
}

export class GeminiCliProvider implements LLMProvider {
  public static async isAvailable(): Promise<boolean> {
    try {
      // Use cross-platform command to check if gemini is available
      const command = process.platform === 'win32' ? 'where gemini' : 'command -v gemini';
      const { stdout } = await execAsync(command);
      return !!stdout;
    } catch {
      return false;
    }
  }

  private buildPrompt(diff: string): string {
    return ReviewPromptBuilder.buildPrompt(diff, { modelType: 'gemini' });
  }

  public async initializeWithCleanup(): Promise<void> {
    // No temporary files to clean up since we use stdin
    console.log('Temporary folder cleanup completed');
  }

  private async extractJsonFromOutput(output: string): Promise<GeminiItem[]> {
    // Log the raw output for debugging (no temp file needed)
    console.log('Raw Gemini output received:', output.substring(0, 200) + '...');

    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('No JSON array found in output. Assuming no recommendations.');
      return [];
    }

    try {
      const jsonContent = jsonMatch[0];
      console.log('Extracted JSON string:', jsonContent.substring(0, 100) + '...');

      const parsed = JSON.parse(jsonContent);
      if (!Array.isArray(parsed)) {
        console.warn('Parsed output is not an array. Assuming no recommendations.');
        return [];
      }
      return parsed;
    } catch {
      console.warn('Failed to parse JSON, assuming no recommendations.');
      return [];
    }
  }

  public async reviewCode(req: Request, res: Response): Promise<void> {
    const { diffForPrompt } = req.body as ReviewRequest;

    if (!diffForPrompt) {
      res.status(400).json({ error: 'Missing diffForPrompt in request body.' });
      return;
    }

    try {
      // Build the prompt
      const prompt = this.buildPrompt(diffForPrompt);

      try {
        // Execute gemini command with prompt via stdin (no temp files needed)
        const result = await this.executeGeminiWithStdin(prompt);

        if (result.stderr) {
          console.warn('gemini warnings/errors:', result.stderr);
        }

        // Parse and validate the response
        const parsedResponse = await this.extractJsonFromOutput(result.stdout);
        const validatedResponse = parsedResponse.map(
          (item: GeminiItem): ReviewResponse => ({
            filePath: String(item.filePath).replace(/\\/g, '/'), // Normalize path separators
            lineNumber: Number(item.lineNumber),
            severity: item.severity,
            title: String(item.title),
            description: String(item.description),
          })
        );

        // With the simplified approach, line numbers should be accurate from the start
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

  private executeGeminiWithStdin(prompt: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // On Windows, use shell: true to properly resolve npm global commands
      const spawnOptions = process.platform === 'win32'
        ? { stdio: ['pipe', 'pipe', 'pipe'], shell: true, cwd: process.cwd() }
        : { stdio: ['pipe', 'pipe', 'pipe'], cwd: process.cwd() };

      const child = spawn('gemini', ['--yolo'], spawnOptions as any);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: any) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: any) => {
        stderr += data.toString();
      });

      child.on('close', (code: any) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`gemini command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error: any) => {
        reject(error);
      });

      // Send prompt via stdin
      child.stdin?.write(prompt);
      child.stdin?.end();
    });
  }
}
