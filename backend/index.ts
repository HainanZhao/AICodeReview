import express from 'express';
import dotenv from 'dotenv';
import { GeminiController } from './controllers/geminiController';

dotenv.config();

const app = express();
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Gemini API Key is not configured in the backend. Please set the GEMINI_API_KEY environment variable.");
    process.exit(1);
}

const geminiController = new GeminiController(apiKey);

app.post('/api/gemini/review', geminiController.reviewCode);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});