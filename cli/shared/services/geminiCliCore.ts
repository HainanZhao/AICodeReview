import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GeminiCliItem {
  filePath: string;
  lineNumber: number;
  severity: string;
  title: string;
  description: string;
}

export interface GeminiCliOptions {
  verbose?: boolean;
}

export interface GeminiCliResult {
  stdout: string;
  stderr: string;
}

/**
 * Shared core functionality for executing Gemini CLI
 * Used by both CLI and backend implementations
 */
export class GeminiCliCore {
  /**
   * Check if gemini CLI is available on the system with comprehensive validation
   */
  public static async isAvailable(): Promise<boolean> {
    try {
      const command = process.platform === 'win32' ? 'where gemini' : 'command -v gemini';
      let geminiPath: string;
      try {
        const { stdout } = await execAsync(command);
        geminiPath = stdout.trim();
      } catch {
        return false; // gemini command not found in PATH
      }

      if (!geminiPath) {
        return false;
      }

      // Check if the resolved path for 'gemini' points to 'gcloud'
      if (geminiPath.includes('gcloud') || geminiPath.includes('google-cloud-sdk')) {
        throw new Error(
          'The "gemini" command in your PATH (' +
            geminiPath +
            ') appears to be part of ' +
            'the Google Cloud SDK or aliased to "gcloud". ' +
            'Please ensure you have the correct @google-ai/generative-ai-cli installed ' +
            'and that "gemini" is not conflicting with "gcloud".'
        );
      }

      // Further check: ensure it's the actual gemini CLI by checking its version output
      try {
        const { stdout: versionOutput } = await execAsync('gemini --version');
        if (versionOutput.includes('Google Cloud SDK') || versionOutput.includes('gcloud')) {
          throw new Error(
            'The "gemini" command appears to be aliased or linked to "gcloud". ' +
              'Please ensure you have the correct @google-ai/generative-ai-cli installed ' +
              'and that "gemini" is not conflicting with "gcloud".'
          );
        }
      } catch {
        // If 'gemini --version' fails, it might not be the correct gemini CLI
        throw new Error(
          'Could not verify the "gemini" CLI. It might be corrupted or not properly installed. ' +
            'Please ensure you have the correct @google-ai/generative-ai-cli installed.'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw specific errors related to gcloud conflict or verification failure
        if (
          error.message.includes('aliased or linked to "gcloud"') ||
          error.message.includes('part of the Google Cloud SDK') ||
          error.message.includes('Could not verify the "gemini" CLI')
        ) {
          throw error;
        }
      }
      return false; // Other generic errors (e.g., command not found initially)
    }
  }

  /**
   * Execute gemini CLI with stdin, with configurable logging
   */
  public static async executeGeminiWithStdin(
    prompt: string,
    options: GeminiCliOptions = {}
  ): Promise<GeminiCliResult> {
    const { verbose = false } = options;

    return new Promise((resolve, reject) => {
      const child = spawn('gemini', ['--yolo'], {
        stdio: 'pipe',
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        if (verbose) {
          process.stdout.write(chunk);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        if (verbose) {
          process.stderr.write(`[gemini stderr] ${chunk}`);
        }
      });

      child.on('close', (code: number | null) => {
        if (verbose) {
          console.log(`[gemini] Process exited with code ${code}`);
        }
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`gemini command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error: Error) => {
        if (verbose) {
          console.error(`[gemini] Process error:`, error);
        }
        reject(error);
      });

      // Send prompt via stdin
      if (verbose) {
        console.log(`[gemini] Sending prompt (${prompt.length} characters)...`);
      }
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  /**
   * Extract and parse JSON from gemini CLI output
   */
  public static async extractJsonFromOutput(
    output: string,
    options: GeminiCliOptions = {}
  ): Promise<GeminiCliItem[]> {
    const { verbose = false } = options;

    if (verbose) {
      console.log('📝 Raw Gemini CLI output received:', output.substring(0, 200) + '...');
    }

    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      if (verbose) {
        console.warn('⚠️  No JSON array found in output. Assuming no recommendations.');
      }
      return [];
    }

    try {
      const jsonContent = jsonMatch[0];
      if (verbose) {
        console.log('🔍 Extracted JSON string:', jsonContent.substring(0, 100) + '...');
      }

      const parsed = JSON.parse(jsonContent);
      if (!Array.isArray(parsed)) {
        if (verbose) {
          console.warn('⚠️  Parsed output is not an array. Assuming no recommendations.');
        }
        return [];
      }
      return parsed;
    } catch (error) {
      if (verbose) {
        console.warn('⚠️  Failed to parse JSON:', error);
        console.warn('Raw output was:', output);
      }
      return [];
    }
  }

  /**
   * Execute a complete gemini CLI review with prompt
   */
  public static async executeReview(
    prompt: string,
    options: GeminiCliOptions = {}
  ): Promise<GeminiCliItem[]> {
    const { verbose = false } = options;

    if (verbose) {
      console.log('🔄 Checking if gemini CLI is available...');
    }

    // Check if gemini CLI is available
    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      throw new Error(
        'Gemini CLI tool not found. Please install it first:\n' +
          '  npm install -g @google-ai/generative-ai-cli\n' +
          'Or ensure the "gemini" command is available in your PATH.'
      );
    }

    if (verbose) {
      console.log('✅ Gemini CLI found, executing with --yolo flag...');
    }

    try {
      const result = await this.executeGeminiWithStdin(prompt, options);

      if (result.stderr && verbose) {
        console.warn('⚠️  Gemini CLI warnings:', result.stderr);
      }

      // Parse and validate the response
      const parsedResponse = await this.extractJsonFromOutput(result.stdout, options);

      if (verbose) {
        console.log(`✅ Parsed ${parsedResponse.length} review items from gemini CLI`);
      }

      return parsedResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Gemini CLI execution failed: ${errorMessage}`);
    }
  }

  /**
   * Execute gemini CLI for line explanation
   */
  public static async executeExplanation(
    prompt: string,
    options: GeminiCliOptions = {}
  ): Promise<string> {
    const { verbose = false } = options;

    if (verbose) {
      console.log('🔄 Checking if gemini CLI is available...');
    }

    // Check if gemini CLI is available
    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      throw new Error(
        'Gemini CLI tool not found. Please install it first:\n' +
          '  npm install -g @google-ai/generative-ai-cli\n' +
          'Or ensure the "gemini" command is available in your PATH.'
      );
    }

    if (verbose) {
      console.log('✅ Gemini CLI found, executing explanation request...');
    }

    try {
      const result = await this.executeGeminiWithStdin(prompt, options);

      if (result.stderr && verbose) {
        console.warn('⚠️  Gemini CLI warnings:', result.stderr);
      }

      if (verbose) {
        console.log('✅ Explanation generated successfully');
      }

      return result.stdout.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Gemini CLI execution failed: ${errorMessage}`);
    }
  }
}
