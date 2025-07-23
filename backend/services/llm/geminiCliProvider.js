import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
const execAsync = promisify(exec);
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export class GeminiCliProvider {
    static async cleanupTmpFolder(tmpPath) {
        try {
            const files = await fs.readdir(tmpPath);
            const now = Date.now();
            for (const file of files) {
                const filePath = join(tmpPath, file);
                try {
                    const stats = await fs.stat(filePath);
                    // Remove files older than 24 hours
                    if (now - stats.mtimeMs > ONE_DAY_IN_MS) {
                        await fs.unlink(filePath);
                        console.log(`Cleaned up old temporary file: ${file}`);
                    }
                }
                catch (error) {
                    console.warn(`Failed to process file ${file}:`, error);
                }
            }
            console.log('Temporary folder cleanup completed');
        }
        catch (error) {
            console.warn('Failed to clean up temporary folder:', error);
        }
    }
    static async isAvailable() {
        try {
            const { stdout } = await execAsync('command -v gemini');
            return !!stdout;
        }
        catch {
            return false;
        }
    }
    buildPrompt(diff) {
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
    getTmpDir() {
        const tmpPath = join(dirname(dirname(dirname(__dirname))), 'backend', 'tmp');
        // Ensure the tmp directory exists
        fs.mkdir(tmpPath, { recursive: true }).catch(err => {
            console.warn('Failed to create tmp directory:', err);
        });
        return tmpPath;
    }
    async initializeWithCleanup() {
        const tmpPath = this.getTmpDir();
        await GeminiCliProvider.cleanupTmpFolder(tmpPath);
    }
    async extractJsonFromOutput(output) {
        // Save a copy of the raw output we're trying to parse
        const debugFile = join(this.getTmpDir(), `gemini-parse-attempt-${Date.now()}.txt`);
        await fs.writeFile(debugFile, `Raw output being parsed:\n${output}`, 'utf8');
        const jsonMatch = output.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.warn(`No JSON array found in output. Assuming no recommendations. Full output saved to: ${debugFile}`);
            return [];
        }
        try {
            const jsonContent = jsonMatch[0];
            // Save the extracted JSON string
            await fs.appendFile(debugFile, `\n\nExtracted JSON string:\n${jsonContent}`, 'utf8');
            const parsed = JSON.parse(jsonContent);
            if (!Array.isArray(parsed)) {
                console.warn("Parsed output is not an array. Assuming no recommendations.");
                return [];
            }
            return parsed;
        }
        catch (error) {
            console.warn(`Failed to parse JSON, assuming no recommendations. Debug file: ${debugFile}`);
            return [];
        }
    }
    async reviewCode(req, res) {
        const { diffForPrompt } = req.body;
        if (!diffForPrompt) {
            res.status(400).json({ error: "Missing diffForPrompt in request body." });
            return;
        }
        const tempFile = join(this.getTmpDir(), `prompt-${Date.now()}.txt`);
        try {
            // Write prompt to file
            const prompt = this.buildPrompt(diffForPrompt);
            await fs.writeFile(tempFile, prompt, 'utf8');
            try {
                // Execute gemini command with prompt file
                const { stdout, stderr } = await execAsync(`gemini --yolo --prompt @"${tempFile}"`);
                if (stderr) {
                    console.warn("gemini warnings/errors:", stderr);
                }
                // Save raw output to a debug file
                const debugFile = join(this.getTmpDir(), `gemini-output-${Date.now()}.txt`);
                await fs.writeFile(debugFile, stdout, 'utf8');
                console.log(`Raw Gemini output saved to: ${debugFile}`);
                // Parse and validate the response
                const parsedResponse = await this.extractJsonFromOutput(stdout);
                const validatedResponse = parsedResponse.map((item) => ({
                    filePath: String(item.filePath),
                    lineNumber: Number(item.lineNumber),
                    severity: item.severity,
                    title: String(item.title),
                    description: String(item.description)
                }));
                res.json(validatedResponse);
            }
            catch (execError) {
                console.error("Error executing gemini:", execError);
                // Return empty array for execution errors
                res.json([]);
            }
        }
        catch (error) {
            console.error("Error preparing prompt:", error);
            // Return empty array for preparation errors
            res.json([]);
        }
        finally {
            if (tempFile) {
                try {
                    await fs.access(tempFile).then(() => fs.unlink(tempFile));
                }
                catch (cleanupError) {
                    // Only log if it's not a "file not found" error
                    if (cleanupError.code !== 'ENOENT') {
                        console.warn("Failed to clean up temporary file:", cleanupError);
                    }
                }
            }
        }
    }
}
