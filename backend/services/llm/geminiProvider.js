import { GoogleGenerativeAI } from '@google/generative-ai';
export class GeminiProvider {
    ai;
    constructor(apiKey) {
        this.ai = new GoogleGenerativeAI(apiKey);
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
    async reviewCode(req, res) {
        const { diffForPrompt } = req.body;
        if (!diffForPrompt) {
            res.status(400).json({ error: "Missing diffForPrompt in request body." });
            return;
        }
        try {
            const model = this.ai.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent(this.buildPrompt(diffForPrompt));
            const response = await result.response;
            const text = response.text().trim();
            if (!text) {
                res.json([]);
                return;
            }
            const parsedResponse = JSON.parse(text);
            if (!Array.isArray(parsedResponse)) {
                console.warn("Unexpected JSON structure from API:", parsedResponse);
                res.status(500).json({ error: "Unexpected response format from LLM API." });
                return;
            }
            const validatedResponse = parsedResponse.map((item) => ({
                filePath: String(item.filePath),
                lineNumber: Number(item.lineNumber),
                severity: item.severity,
                title: String(item.title),
                description: String(item.description)
            }));
            res.json(validatedResponse);
        }
        catch (error) {
            console.error("Error calling LLM API:", error);
            res.status(500).json({ error: "Failed to get review from LLM API." });
        }
    }
}
