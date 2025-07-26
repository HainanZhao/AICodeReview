import express from 'express';
import dotenv from 'dotenv';
import { createLLMProvider } from './services/llm/providerFactory';
import { GitLabConfig } from '../types';

dotenv.config();

const app = express();
// Increase body size limit to handle large merge requests (default is ~100kb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const llmType = process.env.LLM_PROVIDER || 'gemini-cli';
const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY; // Support legacy env var

// Load GitLab configuration
const gitlabConfig: GitLabConfig = {
  url: process.env.GITLAB_URL || '',
  accessToken: process.env.GITLAB_ACCESS_TOKEN || '',
};

if (llmType === 'gemini-cli' && !process.env.GOOGLE_CLOUD_PROJECT) {
  console.error(
    'GOOGLE_CLOUD_PROJECT is not configured in the backend. Please set the GOOGLE_CLOUD_PROJECT environment variable.'
  );
  process.exit(1);
}

// Only check for API key if not using gemini-cli
if (llmType !== 'gemini-cli' && !apiKey) {
  console.error(
    'LLM API Key is not configured in the backend. Please set the LLM_API_KEY environment variable.'
  );
  process.exit(1);
}

async function startServer() {
  try {
    const llmProvider = await createLLMProvider(llmType, apiKey);
    app.post('/api/review', llmProvider.reviewCode.bind(llmProvider));

    // New endpoint to expose GitLab configuration
    app.get('/api/config', (req, res) => {
      res.json({
        gitlabUrl: gitlabConfig.url,
        // Do NOT send accessToken to frontend for security reasons
      });
    });

    const PORT = process.env.PORT || 5959;
    app.listen(PORT, () => {
      console.log(`Backend server listening on port ${PORT} using ${llmType} provider`);
    });
  } catch (error) {
    console.error('Failed to initialize LLM provider:', error);
    process.exit(1);
  }
}

startServer();
