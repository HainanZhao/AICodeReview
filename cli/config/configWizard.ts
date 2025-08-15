import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import { AppConfig } from './configSchema.js';

/**
 * Tests GitLab connection with provided credentials
 */
async function testGitLabConnection(url: string, token: string): Promise<void> {
  const apiUrl = `${url.replace(/\/$/, '')}/api/v4/user`;

  const response = await fetch(apiUrl, {
    headers: {
      'PRIVATE-TOKEN': token,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid access token');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

export async function createConfigInteractively(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  console.log('🎉 Welcome to AI Code Review Setup Wizard!\n');

  try {
    // Server configuration
    console.log('📡 Server Configuration:');
    const port = (await question('Port (5960): ')) || '5960';
    const host = (await question('Host (localhost): ')) || 'localhost';
    console.log(
      'Sub-path: If you need to serve the app under a specific path (e.g., behind a proxy)'
    );
    const subPath = (await question('Sub-path (optional, e.g., /path/to): ')) || undefined;

    // LLM provider configuration
    console.log('\n🤖 LLM Provider Configuration:');
    console.log('Available providers:');
    console.log('  1. gemini-cli (uses local gemini command, recommended)');
    console.log('  2. gemini (Google Gemini API)');
    console.log('  3. anthropic (Claude API)');

    const providerChoice = (await question('Choose provider (1-3, default: 1): ')) || '1';

    let provider: string;
    let apiKey: string | undefined;
    let googleCloudProject: string | undefined;

    switch (providerChoice) {
      case '2':
        provider = 'gemini';
        apiKey = await question('Gemini API Key: ');
        break;
      case '3':
        provider = 'anthropic';
        apiKey = await question('Anthropic API Key: ');
        break;
      default:
        provider = 'gemini-cli';
        googleCloudProject = (await question('Google Cloud Project ID (optional): ')) || undefined;
        break;
    }

    // UI configuration
    console.log('\n🎨 UI Configuration:');
    const autoOpenInput = (await question('Auto-open browser? (y/N): ')) || 'y';
    const autoOpen = autoOpenInput.toLowerCase() === 'y' || autoOpenInput.toLowerCase() === 'yes';

    // GitLab configuration
    console.log('\n🦊 GitLab Configuration (for CLI review mode):');
    console.log('This allows you to review merge requests directly from the command line.');
    const configureGitlab = await question('Configure GitLab access? (Y/n): ');

    let gitlabConfig: { url: string; accessToken: string } | undefined;

    if (configureGitlab.toLowerCase() !== 'n' && configureGitlab.toLowerCase() !== 'no') {
      const gitlabUrl = await question('GitLab instance URL (e.g., https://gitlab.com): ');

      if (gitlabUrl) {
        console.log('\n📋 To create a Personal Access Token:');
        console.log('  1. Go to your GitLab instance → Settings → Access Tokens');
        console.log('  2. Create a token with "api" scope');
        console.log('  3. Copy the token (it will only be shown once)');

        const accessToken = await question('\nGitLab Personal Access Token: ');

        if (accessToken) {
          // Test GitLab connection
          console.log('\n🔍 Testing GitLab connection...');
          try {
            await testGitLabConnection(gitlabUrl, accessToken);
            console.log('✅ GitLab connection successful!');
            gitlabConfig = { url: gitlabUrl, accessToken };
          } catch (error) {
            console.warn(
              `⚠️  GitLab connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            const continueAnyway = await question(
              'Continue with this configuration anyway? (y/N): '
            );
            if (continueAnyway.toLowerCase() === 'y' || continueAnyway.toLowerCase() === 'yes') {
              gitlabConfig = { url: gitlabUrl, accessToken };
            }
          }
        }
      }
    }

    let autoReviewConfig:
      | {
          enabled: boolean;
          projects: number[];
          interval: number;
        }
      | undefined;

    if (gitlabConfig) {
      console.log('\n🤖 Automatic Review Configuration:');
      console.log('This mode will automatically review new MRs in configured projects.');
      const enableAutoReview = await question('Enable automatic MR review mode? (y/N): ');

      if (enableAutoReview.toLowerCase() === 'y') {
        const projectIdsStr = await question('Enter project IDs to monitor (comma-separated): ');
        const projectIds = projectIdsStr
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id));

        const intervalStr =
          (await question('Review interval in seconds (default: 300): ')) || '300';
        const interval = parseInt(intervalStr, 10);

        if (projectIds.length > 0) {
          autoReviewConfig = {
            enabled: true,
            projects: projectIds,
            interval: isNaN(interval) ? 300 : interval,
          };
        }
      }
    }

    // Create config object
    const config: AppConfig = {
      server: {
        port: parseInt(port, 10),
        host,
        ...(subPath && { subPath }),
      },
      llm: {
        provider: provider as 'gemini-cli' | 'gemini' | 'anthropic',
        ...(apiKey && { apiKey }),
        ...(googleCloudProject && { googleCloudProject }),
      },
      ui: {
        autoOpen,
      },
      ...(gitlabConfig && { gitlab: gitlabConfig }),
      ...(autoReviewConfig && { autoReview: autoReviewConfig }),
    };

    // Save to home directory
    const homeConfigDir = join(homedir(), '.aicodereview');
    if (!existsSync(homeConfigDir)) {
      mkdirSync(homeConfigDir, { recursive: true });
    }
    const configPath = join(homeConfigDir, 'config.json');

    // Write config file
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(`\n✅ Configuration saved to: ${configPath}`);
    console.log('\n🚀 You can now run: aicodereview');
  } finally {
    rl.close();
  }
}
