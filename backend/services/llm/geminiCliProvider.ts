import { LLMProvider, ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);interface GeminiItem {
    filePath: string;
    lineNumber: number;
    severity: ReviewResponse['severity'];
    title: string;
    description: string;
}

export class GeminiCliProvider implements LLMProvider {
    public static async isAvailable(): Promise<boolean> {
        try {
            const { stdout } = await execAsync('command -v gemini');
            return !!stdout;
        } catch {
            return false;
        }
    }

    private buildPrompt(diff: string): string {
        return `Please review the following code changes from a merge request.

\`\`\`diff
${diff}
\`\`\`

Analyze the code changes for:
1. Code quality issues
2. Performance concerns
3. Security vulnerabilities
4. Style and best practices
5. Potential bugs or errors

Focus on the changes introduced (lines starting with '+'). Format your response as a JSON array of review items, where each item has:
- filePath: string (must match one of the files in the diff)
- lineNumber: number (line number in new file, use 0 for general comments)
- severity: "Critical" | "Warning" | "Suggestion" | "Info"
- title: string (short, concise title)
- description: string (detailed explanation and suggestions)

Return an empty array if the code is exemplary. No pleasantries or extra text, just the JSON array.`;
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
                console.warn("Parsed output is not an array. Assuming no recommendations.");
                return [];
            }
            return parsed;
        } catch (error) {
            console.warn('Failed to parse JSON, assuming no recommendations.');
            return [];
        }
    }

    public async reviewCode(req: Request, res: Response): Promise<void> {
        const { diffForPrompt } = req.body as ReviewRequest;

        if (!diffForPrompt) {
            res.status(400).json({ error: "Missing diffForPrompt in request body." });
            return;
        }

        try {
            // Build the prompt
            const prompt = this.buildPrompt(diffForPrompt);

            try {
                // Execute gemini command with prompt via stdin (no temp files needed)
                const result = await this.executeGeminiWithStdin(prompt);

                if (result.stderr) {
                    console.warn("gemini warnings/errors:", result.stderr);
                }

                // Parse and validate the response
                const parsedResponse = await this.extractJsonFromOutput(result.stdout);
                const validatedResponse = parsedResponse.map((item: GeminiItem): ReviewResponse => ({
                    filePath: String(item.filePath),
                    lineNumber: Number(item.lineNumber),
                    severity: item.severity,
                    title: String(item.title),
                    description: String(item.description)
                }));

                res.json(validatedResponse);
            } catch (execError) {
                console.error("Error executing gemini:", execError);
                // Return empty array for execution errors
                res.json([]);
            }
        } catch (error) {
            console.error("Error preparing prompt:", error);
            // Return empty array for preparation errors
            res.json([]);
        }
    }

    private executeGeminiWithStdin(prompt: string): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const child = spawn('gemini', ['--yolo'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd() // Use current working directory where CLI was invoked
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`gemini command failed with exit code ${code}: ${stderr}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });

            // Send prompt via stdin
            child.stdin.write(prompt);
            child.stdin.end();
        });
    }
}
