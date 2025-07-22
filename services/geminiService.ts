import { GoogleGenAI, Type } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import { ReviewFeedback, Severity, Config, GitLabMRDetails, GitLabPosition } from '../types';
import { fetchMrData } from "./gitlabService";

// This will be populated by config.js at runtime in the browser
const apiKey = (window as any).GEMINI_API_KEY;

let ai: GoogleGenAI;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
} else {
    // Log an error but don't throw, to allow the UI to load and show an error message.
    // The reviewCode function will handle the case where 'ai' is not initialized.
    console.error("Gemini API Key is not configured. The application will not be able to perform reviews. Please ensure the API_KEY is set in your deployment environment.");
}

const responseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            filePath: {
                type: Type.STRING,
                description: "The full path of the file where the issue is located."
            },
            lineNumber: {
                type: Type.INTEGER,
                description: "The line number in the new file (+ lines) where the issue is found. Use 0 if it's a general comment."
            },
            severity: {
                type: Type.STRING,
                enum: [Severity.Critical, Severity.Warning, Severity.Suggestion, Severity.Info],
                description: "The severity of the issue."
            },
            title: {
                type: Type.STRING,
                description: "A short, concise title for the feedback item."
            },
            description: {
                type: Type.STRING,
                description: "A detailed explanation of the issue and suggestions for improvement based on the code changes."
            }
        },
        required: ["filePath", "lineNumber", "severity", "title", "description"]
    }
};

const buildPrompt = (diff: string): string => `
Please review the following code changes from a merge request.

\`\`\`diff
${diff}
\`\`\`
`;

export const reviewCode = async (url: string, config: Config): Promise<{mrDetails: GitLabMRDetails, feedback: ReviewFeedback[]}> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Please check your API key configuration.");
    }

    if (!config || !config.gitlabUrl || !config.accessToken) {
        throw new Error("GitLab configuration is missing. Please set it in the settings.");
    }
    
    const mrDetails = await fetchMrData(config, url);

    if (mrDetails.diffForPrompt.trim() === "") {
        return {
            mrDetails,
            feedback: [{
                id: uuidv4(),
                lineNumber: 0,
                filePath: "N/A",
                severity: Severity.Info,
                title: "No Code Changes Found",
                description: "This merge request does not contain any code changes to review.",
                lineContent: "",
                position: null,
                status: 'submitted',
            }]
        };
    }

    const systemInstruction = `
You are an expert code reviewer AI assistant specializing in reviewing GitLab Merge Requests.
Your purpose is to provide high-quality, constructive feedback on the provided code changes (in diff format).

Instructions:
1.  Analyze the provided code diff for issues related to quality, correctness, performance, security, style, and best practices. Focus on the changes introduced (lines starting with '+').
2.  Provide the file path for every comment. This must match one of the file paths in the diff.
3.  Your feedback must be in a structured JSON format, adhering to the provided schema. For each identified issue, create a distinct feedback item.
4.  If the code is exemplary, return an empty array.
5.  For general comments not specific to a line, use a lineNumber of 0.
6.  The feedback should be professional, clear, and helpful. Explain *why* something is an issue and suggest a better approach.
7.  Do not include any introductory text or pleasantries in your response, only the JSON array.
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: buildPrompt(mrDetails.diffForPrompt),
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2,
        }
    });
    
    const jsonText = response.text.trim();
    if (!jsonText) return { mrDetails, feedback: [] };

    const parsedResponse = JSON.parse(jsonText);
    if (!Array.isArray(parsedResponse)) {
        console.warn("Unexpected JSON structure from API:", parsedResponse);
        return { mrDetails, feedback: [] };
    }

    const parsedFileDiffsMap = new Map(mrDetails.parsedDiffs.map(p => [p.filePath, p]));

    const generatedFeedback = (parsedResponse as any[]).map((item): ReviewFeedback | null => {
        const parsedFile = parsedFileDiffsMap.get(item.filePath);
        
        let position: GitLabPosition | null = null;
        let lineContent: string = "";

        if (item.lineNumber === 0) {
            lineContent = "General file comment";
        }

        if (item.lineNumber > 0 && parsedFile) {
            const allLines = parsedFile.hunks.flatMap(h => h.lines);
            const targetLine = allLines.find(l => l.newLine === item.lineNumber && l.type === 'add');
            
            // Validation: Only create feedback for lines that were actually added in the diff.
            if (!targetLine) {
                console.warn(`AI suggested a comment for line ${item.lineNumber} in ${item.filePath}, but this is not an added line. Discarding.`);
                return null;
            }
            
            lineContent = targetLine.content;
            
            position = {
                base_sha: mrDetails.base_sha,
                start_sha: mrDetails.start_sha,
                head_sha: mrDetails.head_sha,
                position_type: 'text',
                old_path: parsedFile.oldPath,
                new_path: parsedFile.filePath,
                new_line: targetLine.newLine,
            };
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
            status: 'pending',
        };
    });

    const feedback = generatedFeedback.filter((fb): fb is ReviewFeedback => fb !== null);

    return { mrDetails, feedback };
};