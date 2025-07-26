import express from 'express';
import dotenv from 'dotenv';
import { createLLMProvider } from './services/llm/providerFactory';
import { GitLabConfig } from '../types';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

dotenv.config();

const app = express();
// Increase body size limit to handle large merge requests (default is ~100kb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const llmType = process.env.LLM_PROVIDER || 'gemini-cli';
const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY; // Support legacy env var

// Function to load CLI config from ~/.aicodereview/config.json
function loadCLIConfig(): { gitlab?: { url: string; accessToken: string } } | null {
  try {
    const configPath = join(homedir(), '.aicodereview', 'config.json');
    if (existsSync(configPath)) {
      const configData = readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.warn('Failed to load CLI config:', error);
  }
  return null;
}

// Load GitLab configuration from CLI config first, then fall back to environment variables
const cliConfig = loadCLIConfig();
const gitlabConfig: GitLabConfig = {
  url: cliConfig?.gitlab?.url || process.env.GITLAB_URL || '',
  accessToken: cliConfig?.gitlab?.accessToken || process.env.GITLAB_ACCESS_TOKEN || '',
};

// Log config source for debugging
if (cliConfig?.gitlab) {
  console.log(
    'Loaded GitLab config from CLI config file:',
    gitlabConfig.url ? `URL: ${gitlabConfig.url}` : 'No URL'
  );
} else if (process.env.GITLAB_URL || process.env.GITLAB_ACCESS_TOKEN) {
  console.log(
    'Loaded GitLab config from environment variables:',
    gitlabConfig.url ? `URL: ${gitlabConfig.url}` : 'No URL'
  );
} else {
  console.log('No GitLab configuration found in CLI config or environment variables');
}

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

    // Enhanced endpoint to expose GitLab configuration
    app.post('/api/config', (req, res) => {
      const response: {
        gitlabUrl: string;
        hasGitlabUrl: boolean;
        hasAccessToken: boolean;
        configSource: string;
        accessToken?: string;
      } = {
        gitlabUrl: gitlabConfig.url,
        hasGitlabUrl: Boolean(gitlabConfig.url),
        hasAccessToken: Boolean(gitlabConfig.accessToken),
        configSource: cliConfig?.gitlab ? 'cli-config' : 'backend-env',
      };

      // If config comes from CLI (user's local config), include the access token
      // since the user has already configured it locally
      if (cliConfig?.gitlab && gitlabConfig.accessToken) {
        response.accessToken = gitlabConfig.accessToken;
      }

      res.json(response);
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
