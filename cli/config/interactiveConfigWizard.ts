import * as p from '@clack/prompts';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { fetchProjects } from '../shared/services/gitlabCore.js';
import { GitLabProject } from '../shared/types/gitlab.js';
import { ConfigLoader } from './configLoader.js';
import {
  AppConfig,
  AutoReviewConfig,
  GitLabConfig,
  LLMConfig,
  ServerConfig,
  UIConfig,
} from './configSchema.js';

/**
 * Interactive Configuration Wizard using modern CLI UI
 * Provides tabbed navigation between different configuration sections
 */
export async function createInteractiveConfig(): Promise<void> {
  console.clear();

  p.intro('🎉 Welcome to AI Code Review Interactive Setup');

  try {
    // Load existing configuration
    let existingConfig: AppConfig | null = null;
    try {
      const loader = new ConfigLoader();
      if (loader.hasConfig()) {
        existingConfig = ConfigLoader.loadConfig({});
        p.log.info('Found existing configuration, values will be pre-populated');
      }
    } catch {
      p.log.warn('Could not load existing configuration, starting fresh');
    }

    // Main menu loop
    let shouldContinue = true;
    const config: Partial<AppConfig> = existingConfig ? { ...existingConfig } : {};

    while (shouldContinue) {
      const action = await p.select({
        message: 'What would you like to configure?',
        options: [
          {
            value: 'server',
            label: '🖥️  Server Settings',
            hint: 'Port, host, and web interface options',
          },
          {
            value: 'llm',
            label: '🤖 LLM Provider',
            hint: 'AI model configuration (Gemini, Claude, etc.)',
          },
          { value: 'gitlab', label: '🦊 GitLab Integration', hint: 'GitLab URL and access token' },
          {
            value: 'autoReview',
            label: '⚡ Auto Review Mode',
            hint: 'Automatic MR monitoring and review',
          },
          { value: 'ui', label: '🎨 UI Preferences', hint: 'User interface settings' },
          {
            value: 'review',
            label: '📋 Review & Save',
            hint: 'Review all settings and save configuration',
          },
          { value: 'exit', label: '❌ Exit', hint: 'Exit without saving changes' },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel('Configuration cancelled');
        return;
      }

      switch (action) {
        case 'server':
          config.server = await configureServer(config.server);
          break;
        case 'llm':
          config.llm = await configureLLM(config.llm);
          break;
        case 'gitlab': {
          const gitlabConfig = await configureGitLab(config.gitlab);
          if (gitlabConfig) {
            config.gitlab = gitlabConfig;
          }
          break;
        }
        case 'autoReview': {
          if (!config.gitlab) {
            p.log.error('GitLab configuration is required for auto-review mode');
            p.log.info('Please configure GitLab integration first');
            continue;
          }
          const autoReviewConfig = await configureAutoReview(config.autoReview, config.gitlab);
          if (autoReviewConfig) {
            config.autoReview = autoReviewConfig;
          }
          break;
        }
        case 'ui':
          config.ui = await configureUI(config.ui);
          break;
        case 'review': {
          const shouldSave = await reviewAndSave(config);
          if (shouldSave) {
            shouldContinue = false;
          }
          break;
        }
        case 'exit': {
          const confirmExit = await p.confirm({
            message: 'Exit without saving changes?',
            initialValue: false,
          });
          if (!p.isCancel(confirmExit) && confirmExit) {
            p.cancel('Configuration cancelled');
            return;
          }
          break;
        }
      }
    }

    p.outro('✅ Configuration completed successfully!');
  } catch (error) {
    p.log.error('An error occurred during configuration');
    p.log.error(error instanceof Error ? error.message : 'Unknown error');
    p.cancel('Configuration failed');
  }
}

async function configureServer(existing?: ServerConfig): Promise<ServerConfig> {
  p.log.step('🖥️  Configuring Server Settings');

  const port = await p.text({
    message: 'Server port',
    defaultValue: existing?.port?.toString() || '5960',
    validate: (value) => {
      const num = parseInt(value);
      if (isNaN(num) || num < 1 || num > 65535) {
        return 'Port must be between 1 and 65535';
      }
    },
  });

  if (p.isCancel(port)) throw new Error('Cancelled');

  const host = await p.text({
    message: 'Server host',
    defaultValue: existing?.host || 'localhost',
  });

  if (p.isCancel(host)) throw new Error('Cancelled');

  const subPath = await p.text({
    message: 'Sub-path (optional)',
    defaultValue: existing?.subPath || '',
    placeholder: 'Leave empty for root path',
  });

  if (p.isCancel(subPath)) throw new Error('Cancelled');

  return {
    port: parseInt(port),
    host,
    ...(subPath && { subPath }),
  };
}

async function configureLLM(existing?: LLMConfig): Promise<LLMConfig> {
  p.log.step('🤖 Configuring LLM Provider');

  const provider = await p.select({
    message: 'Select AI provider',
    options: [
      { value: 'gemini-cli', label: 'Gemini CLI', hint: 'Uses local gemini command (recommended)' },
      { value: 'gemini', label: 'Google Gemini API', hint: 'Requires API key' },
      { value: 'anthropic', label: 'Anthropic Claude', hint: 'Requires API key' },
    ],
    initialValue: existing?.provider || 'gemini-cli',
  });

  if (p.isCancel(provider)) throw new Error('Cancelled');

  const config: LLMConfig = { provider };

  if (provider === 'gemini') {
    const message = existing?.apiKey
      ? 'Google Gemini API key (press Enter to keep existing)'
      : 'Google Gemini API key';
    const apiKey = await p.password({ message });
    if (p.isCancel(apiKey)) throw new Error('Cancelled');
    config.apiKey = apiKey || existing?.apiKey;
  }

  if (provider === 'anthropic') {
    const message = existing?.apiKey
      ? 'Anthropic API key (press Enter to keep existing)'
      : 'Anthropic API key';
    const apiKey = await p.password({ message });
    if (p.isCancel(apiKey)) throw new Error('Cancelled');
    config.apiKey = apiKey || existing?.apiKey;
  }

  if (provider === 'gemini-cli') {
    const projectId = await p.text({
      message: 'Google Cloud Project ID (optional)',
      defaultValue: existing?.googleCloudProject || '',
      placeholder: 'Leave empty to use default',
    });
    if (p.isCancel(projectId)) throw new Error('Cancelled');
    if (projectId) {
      config.googleCloudProject = projectId;
    }
  }

  return config;
}

async function configureGitLab(existing?: GitLabConfig): Promise<GitLabConfig | null> {
  p.log.step('🦊 Configuring GitLab Integration');

  const shouldConfigure = await p.confirm({
    message: 'Configure GitLab integration?',
    initialValue: !!existing,
  });

  if (p.isCancel(shouldConfigure) || !shouldConfigure) {
    return null;
  }

  const url = await p.text({
    message: 'GitLab URL',
    defaultValue: existing?.url || 'https://gitlab.com',
    placeholder: 'https://gitlab.example.com',
  });

  if (p.isCancel(url)) throw new Error('Cancelled');

  const message = existing?.accessToken
    ? 'GitLab Access Token (press Enter to keep existing)'
    : 'GitLab Access Token';
  const accessToken = await p.password({ message });

  if (p.isCancel(accessToken)) throw new Error('Cancelled');
  const finalAccessToken = accessToken || existing?.accessToken;

  if (!finalAccessToken) {
    p.log.error('Access token is required');
    return null;
  }

  // Test GitLab connection
  const testSpinner = p.spinner();
  testSpinner.start('Testing GitLab connection...');

  try {
    await fetchProjects({ url, accessToken: finalAccessToken });
    testSpinner.stop('✅ GitLab connection successful');
  } catch {
    testSpinner.stop('❌ GitLab connection failed');
    const continueAnyway = await p.confirm({
      message: 'Continue with this configuration anyway?',
      initialValue: false,
    });
    if (p.isCancel(continueAnyway) || !continueAnyway) {
      return null;
    }
  }

  return { url, accessToken: finalAccessToken };
}

async function configureAutoReview(
  existing?: AutoReviewConfig,
  gitlabConfig?: GitLabConfig
): Promise<AutoReviewConfig | null> {
  p.log.step('⚡ Configuring Auto Review Mode');

  const enabled = await p.confirm({
    message: 'Enable automatic merge request review?',
    initialValue: existing?.enabled || false,
  });

  if (p.isCancel(enabled) || !enabled) {
    return null;
  }

  // Fetch available projects
  const projectsSpinner = p.spinner();
  projectsSpinner.start('Fetching GitLab projects...');

  let availableProjects: GitLabProject[] = [];
  try {
    availableProjects = await fetchProjects(gitlabConfig!);
    projectsSpinner.stop(`Found ${availableProjects.length} projects`);
  } catch {
    projectsSpinner.stop('❌ Failed to fetch projects');
    p.log.error('Could not fetch GitLab projects. Please check your GitLab configuration.');
    return null;
  }

  if (availableProjects.length === 0) {
    p.log.warn('No GitLab projects found');
    return null;
  }

  // Select projects to monitor
  const projectOptions = availableProjects.map((project) => ({
    value: project.name_with_namespace,
    label: project.name_with_namespace,
    hint: `ID: ${project.id}`,
  }));

  const selectedProjects = await p.multiselect({
    message: 'Select projects to monitor',
    options: projectOptions,
    initialValues: existing?.projects || [],
  });

  if (p.isCancel(selectedProjects)) throw new Error('Cancelled');

  const interval = await p.text({
    message: 'Review interval (seconds)',
    defaultValue: existing?.interval?.toString() || '120',
    validate: (value) => {
      const num = parseInt(value);
      if (isNaN(num) || num < 30) {
        return 'Interval must be at least 30 seconds';
      }
    },
  });

  if (p.isCancel(interval)) throw new Error('Cancelled');

  const storage = await p.select({
    message: 'State storage method',
    options: [
      { value: 'local', label: 'Local Storage', hint: 'Store state locally on this machine' },
      {
        value: 'snippet',
        label: 'GitLab Snippets',
        hint: 'Store state in private GitLab snippets',
      },
    ],
    initialValue: existing?.state?.storage || 'local',
  });

  if (p.isCancel(storage)) throw new Error('Cancelled');

  return {
    enabled: true,
    projects: selectedProjects,
    interval: parseInt(interval),
    state: { storage },
  };
}

async function configureUI(existing?: UIConfig): Promise<UIConfig> {
  p.log.step('🎨 Configuring UI Preferences');

  const autoOpen = await p.confirm({
    message: 'Automatically open browser when starting web interface?',
    initialValue: existing?.autoOpen ?? true,
  });

  if (p.isCancel(autoOpen)) throw new Error('Cancelled');

  return { autoOpen };
}

async function reviewAndSave(config: Partial<AppConfig>): Promise<boolean> {
  p.log.step('📋 Configuration Review');

  // Show configuration summary
  console.log('\n📋 Configuration Summary:');

  if (config.server) {
    console.log(
      `🖥️  Server: ${config.server.host}:${config.server.port}${config.server.subPath || ''}`
    );
  }

  if (config.llm) {
    console.log(`🤖 LLM: ${config.llm.provider}${config.llm.apiKey ? ' (with API key)' : ''}`);
  }

  if (config.gitlab) {
    console.log(`🦊 GitLab: ${config.gitlab.url}`);
  }

  if (config.autoReview) {
    console.log(
      `⚡ Auto Review: ${config.autoReview.projects.length} projects, ${config.autoReview.interval}s interval`
    );
  }

  if (config.ui) {
    console.log(`🎨 UI: Auto-open ${config.ui.autoOpen ? 'enabled' : 'disabled'}`);
  }

  const shouldSave = await p.confirm({
    message: 'Save this configuration?',
    initialValue: true,
  });

  if (p.isCancel(shouldSave) || !shouldSave) {
    return false;
  }

  // Ensure required sections have defaults
  if (!config.server) {
    config.server = { port: 5960, host: 'localhost' };
  }
  if (!config.llm) {
    config.llm = { provider: 'gemini-cli' };
  }
  if (!config.ui) {
    config.ui = { autoOpen: true };
  }

  // Save configuration
  const homeConfigDir = join(homedir(), '.aicodereview');
  if (!existsSync(homeConfigDir)) {
    mkdirSync(homeConfigDir, { recursive: true });
  }
  const configPath = join(homeConfigDir, 'config.json');

  writeFileSync(configPath, JSON.stringify(config as AppConfig, null, 2));

  p.log.success(`Configuration saved to: ${configPath}`);
  return true;
}
