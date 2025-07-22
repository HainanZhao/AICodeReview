import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPrompt, GeminiReviewRequest, GeminiReviewResponse } from '../services/geminiService';

export class GeminiController {
    private ai: GoogleGenerativeAI;

    constructor(apiKey: string) {
        this.ai = new GoogleGenerativeAI(apiKey);
    }

    public reviewCode = async (req: Request, res: Response): Promise<void> => {
        const { diffForPrompt } = req.body as GeminiReviewRequest;

        if (!diffForPrompt) {
            res.status(400).json({ error: "Missing diffForPrompt in request body." });
            return;
        }

        try {
            const model = this.ai.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent(buildPrompt(diffForPrompt));
            const response = await result.response;
            const text = response.text().trim();
            
            if (!text) {
                res.json([]);
                return;
            }

            const parsedResponse = JSON.parse(text);
            if (!Array.isArray(parsedResponse)) {
                console.warn("Unexpected JSON structure from API:", parsedResponse);
                res.status(500).json({ error: "Unexpected response format from Gemini API." });
                return;
            }

            // Validate the response matches our GeminiReviewResponse type
            const validatedResponse = parsedResponse.map((item: any): GeminiReviewResponse => ({
                filePath: String(item.filePath),
                lineNumber: Number(item.lineNumber),
                severity: item.severity as GeminiReviewResponse['severity'],
                title: String(item.title),
                description: String(item.description)
            }));

            res.json(validatedResponse);

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            res.status(500).json({ error: "Failed to get review from Gemini API." });
        }
    };
}
