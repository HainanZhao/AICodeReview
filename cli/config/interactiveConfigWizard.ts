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
} from './configSchema.js';

/**
 * Normalizes project names by removing spaces around slashes
 * to ensure consistent matching between config keys and project names
 */
function normalizeProjectName(projectName: string): string {
  return projectName.replace(/\s*\/\s*/g, '/');
}

// Helper functions for common operations
function setContext(currentContext: string | null, context: string): string {
  return context;
}

function checkGitLabRequired(config: Partial<AppConfig>): boolean {
  if (!config.gitlab) {
    p.log.error('GitLab configuration is required for auto-review mode');
    p.log.info('Please configure GitLab integration first');
    return false;
  }
  return true;
}

function checkAutoReviewConfigured(config: Partial<AppConfig>): boolean {
  if (!config.autoReview) {
    p.log.warn('Auto-review mode is not configured');
    p.log.info('Please configure auto-review mode first');
    return false;
  }
  return true;
}

function updateServerConfig(
  existing: ServerConfig | undefined,
  updates: Partial<ServerConfig>
): ServerConfig {
  return {
    host: updates.host || existing?.host || 'localhost',
    port: updates.port || existing?.port || 5960,
    subPath: updates.subPath !== undefined ? updates.subPath : existing?.subPath,
  };
}

function ensureAutoReviewConfig(existing?: AutoReviewConfig): AutoReviewConfig {
  return (
    existing || {
      enabled: false,
      projects: [],
      interval: 120,
    }
  );
}

/**
 * Interactive Configuration Wizard using modern CLI UI
 * Provides tabbed navigation between different configuration sections
 */
export async function createInteractiveConfig(): Promise<void> {
  console.clear();

  p.intro('*** Welcome to AI Code Review Interactive Setup ***');

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
    let currentContext: string | null = null; // Track which sub-menu we're in
    const config: Partial<AppConfig> = existingConfig ? { ...existingConfig } : {};

    while (shouldContinue) {
      // Build dynamic menu options with current values
      const currentServer = config.server
        ? `${config.server.host}:${config.server.port}`
        : 'Not configured';
      const currentLLM = config.llm?.provider || 'Not configured';
      const currentGitLab = config.gitlab?.url
        ? new URL(config.gitlab.url).hostname
        : 'Not configured';
      const currentProjects = config.autoReview?.projects?.length || 0;
      const currentInterval = config.autoReview?.interval || 'Not set';
      const currentAutoReview = config.autoReview?.enabled ? 'Enabled' : 'Disabled';
      const currentUI = config.ui?.autoOpen ? 'Auto-open enabled' : 'Auto-open disabled';

      // Skip main menu if we're in a specific context (sub-menu)
      let category: string;
      if (currentContext) {
        category = currentContext;
      } else {
        const categoryResult = await p.select({
          message: 'What would you like to configure?',
          options: [
            {
              value: 'llm',
              label: '🤖 LLM Provider',
              hint: `Currently: ${currentLLM}`,
            },
            {
              value: 'integration',
              label: '🔗 Integrations',
              hint: `GitLab: ${currentGitLab}`,
            },
            {
              value: 'automation',
              label: '🔍 Auto Review',
              hint: `${currentAutoReview} - ${currentProjects} projects, ${currentInterval}s`,
            },
            {
              value: 'uisettings',
              label: '🎨 UI Settings',
              hint: `Server: ${currentServer} | UI: ${currentUI}`,
            },
            {
              value: 'review',
              label: '✅ Review & Save',
              hint: 'Review all settings and save configuration',
            },
            {
              value: 'exit',
              label: '🚪 Exit',
              hint: 'Exit without saving changes',
            },
          ],
        });

        if (p.isCancel(categoryResult)) {
          p.cancel('Configuration cancelled');
          return;
        }

        category = categoryResult;
      }

      // Handle category selection
      let action: string | symbol;

      switch (category) {
        case 'llm': {
          // Direct LLM configuration - no sub-menu needed
          action = 'llm';
          break;
        }
        case 'integration': {
          action = await p.select({
            message: '🔗 Integrations - Choose what to configure:',
            options: [
              {
                value: 'gitlab',
                label: '🦊 GitLab Integration',
                hint: `Currently: ${currentGitLab}`,
              },
              { value: 'back', label: '◀◀ Back to main menu', hint: '' },
            ],
          });
          break;
        }
        case 'automation': {
          // Count existing project prompts for display
          const projectPromptsCount = config.autoReview?.projectPrompts
            ? Object.keys(config.autoReview.projectPrompts).length
            : 0;

          action = await p.select({
            message: '🔍 Auto Review - Choose what to configure:',
            options: [
              {
                value: 'autoReviewEnabled',
                label: '🔘 Enable/Disable Auto Review',
                hint: `Currently: ${currentAutoReview}`,
              },
              {
                value: 'autoReviewProjects',
                label: '📁 Review Projects',
                hint: `Quick edit: ${currentProjects} projects selected`,
              },
              {
                value: 'customPrompts',
                label: '📝 Custom Prompts',
                hint: `Per-project prompts: ${projectPromptsCount} configured`,
              },
              {
                value: 'autoReviewInterval',
                label: '⏰ Review Interval',
                hint: `Quick edit: Current interval ${currentInterval} seconds`,
              },
              {
                value: 'autoReviewStorage',
                label: '💾 State Storage',
                hint: `Method: ${config.autoReview?.state?.storage || 'local'}`,
              },
              { value: 'back', label: '◀◀ Back to main menu', hint: '' },
            ],
          });
          break;
        }
        case 'uisettings': {
          action = await p.select({
            message: '🎨 UI Settings - Choose what to configure:',
            options: [
              {
                value: 'serverPort',
                label: '🔌 Server Port',
                hint: `Currently: ${config.server?.port || 5960}`,
              },
              {
                value: 'serverHost',
                label: '🖥️ Server Host',
                hint: `Currently: ${config.server?.host || 'localhost'}`,
              },
              {
                value: 'serverSubPath',
                label: '🛤️ Server Sub-path',
                hint: `Currently: ${config.server?.subPath || 'root path'}`,
              },
              {
                value: 'autoOpenBrowser',
                label: '🌐 Auto-open Browser',
                hint: `Currently: ${(config.ui?.autoOpen ?? true) ? 'enabled' : 'disabled'}`,
              },
              { value: 'back', label: '◀◀ Back to main menu', hint: '' },
            ],
          });
          break;
        }
        case 'review': {
          // Direct review action - no sub-menu needed
          action = 'review';
          break;
        }
        case 'exit': {
          // Direct exit action - no sub-menu needed
          action = 'exit';
          break;
        }
        default:
          action = 'back';
      }

      if (p.isCancel(action)) {
        p.cancel('Configuration cancelled');
        return;
      }

      // Handle back navigation
      if (action === 'back') {
        currentContext = null; // Reset context to go back to main menu
        continue;
      }

      // Convert to string for switch statement
      const actionStr = action as string;

      switch (actionStr) {
        case 'serverPort': {
          const port = await p.text({
            message: 'Server port',
            defaultValue: config.server?.port?.toString() || '5960',
            placeholder: config.server?.port?.toString() || '5960',
            validate: (value) => {
              // If value is empty, allow it (user pressed Enter to use default)
              if (!value.trim()) return undefined;
              const num = parseInt(value);
              if (isNaN(num) || num < 1 || num > 65535) return 'Port must be between 1 and 65535';
              return undefined;
            },
          });
          if (!p.isCancel(port)) {
            config.server = updateServerConfig(config.server, { port: parseInt(port) });
            p.log.success(`Server port updated to ${port}`);
          }
          currentContext = setContext(currentContext, 'uisettings');
          break;
        }

        case 'serverHost': {
          const host = await p.text({
            message: 'Server host',
            defaultValue: config.server?.host || 'localhost',
            placeholder: config.server?.host || 'localhost',
          });
          if (!p.isCancel(host)) {
            config.server = updateServerConfig(config.server, { host });
            p.log.success(`Server host updated to ${host}`);
          }
          currentContext = setContext(currentContext, 'uisettings');
          break;
        }

        case 'serverSubPath': {
          const subPath = await p.text({
            message: 'Sub-path (optional)',
            defaultValue: config.server?.subPath || '',
            placeholder: config.server?.subPath
              ? `Currently: ${config.server.subPath}`
              : 'Leave empty for root path',
          });
          if (!p.isCancel(subPath)) {
            config.server = updateServerConfig(config.server, { subPath });
            p.log.success(`Server sub-path updated to ${subPath || 'root path'}`);
          }
          currentContext = setContext(currentContext, 'uisettings');
          break;
        }

        case 'autoOpenBrowser': {
          const autoOpen = await p.confirm({
            message: 'Automatically open browser when starting web interface?',
            initialValue: config.ui?.autoOpen ?? true,
          });
          if (!p.isCancel(autoOpen)) {
            config.ui = { ...config.ui, autoOpen };
            p.log.success(`Auto-open browser ${autoOpen ? 'enabled' : 'disabled'}`);
          }
          currentContext = setContext(currentContext, 'uisettings');
          break;
        }
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
        case 'autoReviewEnabled': {
          if (!checkGitLabRequired(config)) {
            currentContext = 'automation';
            continue;
          }

          const enabled = await p.confirm({
            message: 'Enable automatic merge request review?',
            initialValue: config.autoReview?.enabled || false,
          });

          if (!p.isCancel(enabled)) {
            config.autoReview = { ...ensureAutoReviewConfig(config.autoReview), enabled };
            p.log.success(`Auto review ${enabled ? 'enabled' : 'disabled'}`);
          }
          currentContext = setContext(currentContext, 'automation');
          break;
        }
        case 'autoReviewStorage': {
          if (!checkAutoReviewConfigured(config)) {
            currentContext = 'automation';
            continue;
          }

          const storage = await p.select({
            message: 'State storage method',
            options: [
              {
                value: 'local',
                label: 'Local Storage',
                hint: 'Store state locally on this machine',
              },
              {
                value: 'snippet',
                label: 'GitLab Snippets',
                hint: 'Store state in private GitLab snippets',
              },
            ],
            initialValue: config.autoReview!.state?.storage || 'local',
          });

          if (!p.isCancel(storage)) {
            config.autoReview = {
              ...config.autoReview!,
              state: { ...config.autoReview!.state, storage },
            };
            p.log.success(`State storage method updated to ${storage}`);
          }
          currentContext = setContext(currentContext, 'automation');
          break;
        }
        case 'autoReviewProjects': {
          if (!checkGitLabRequired(config)) {
            currentContext = 'automation';
            continue;
          }

          const updatedProjects = await configureProjectsOnly(config.autoReview, config.gitlab);
          if (updatedProjects) {
            config.autoReview = {
              ...ensureAutoReviewConfig(config.autoReview),
              projects: updatedProjects,
              enabled: true,
            };
            p.log.success(`Updated auto-review projects: ${updatedProjects.length} selected`);
          }
          currentContext = setContext(currentContext, 'automation');
          break;
        }
        case 'customPrompts': {
          if (!config.autoReview?.projects?.length) {
            p.log.error('No projects configured for auto-review mode');
            p.log.info('Please configure auto-review projects first');
            currentContext = 'automation';
            continue;
          }

          const updatedConfig = await configureCustomPrompts(config.autoReview);
          if (updatedConfig) {
            config.autoReview = updatedConfig;
          }
          currentContext = setContext(currentContext, 'automation');
          break;
        }
        case 'autoReviewInterval': {
          if (!checkAutoReviewConfigured(config)) {
            currentContext = 'automation';
            continue;
          }

          const interval = await p.text({
            message: 'Review interval (seconds)',
            defaultValue: config.autoReview!.interval?.toString() || '120',
            placeholder: config.autoReview!.interval?.toString() || '120',
            validate: (value) => {
              if (!value.trim()) return undefined;
              const num = parseInt(value);
              if (isNaN(num) || num < 30) return 'Interval must be at least 30 seconds';
              return undefined;
            },
          });

          if (!p.isCancel(interval)) {
            config.autoReview!.interval = parseInt(interval);
            p.log.success(`Review interval updated to ${interval} seconds`);
          }
          currentContext = setContext(currentContext, 'automation');
          break;
        }
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

    p.outro('*** Configuration completed successfully! ***');
  } catch (error) {
    p.log.error('An error occurred during configuration');
    p.log.error(error instanceof Error ? error.message : 'Unknown error');
    p.cancel('Configuration failed');
  }
}

async function configureLLM(existing?: LLMConfig): Promise<LLMConfig> {
  p.log.step('[AI] Configuring LLM Provider');

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
      ? 'Google Gemini API key (press Enter to keep existing ***masked***)'
      : 'Google Gemini API key';
    const apiKey = await p.password({ message });
    if (p.isCancel(apiKey)) throw new Error('Cancelled');
    config.apiKey = apiKey || existing?.apiKey;
  }

  if (provider === 'anthropic') {
    const message = existing?.apiKey
      ? 'Anthropic API key (press Enter to keep existing ***masked***)'
      : 'Anthropic API key';
    const apiKey = await p.password({ message });
    if (p.isCancel(apiKey)) throw new Error('Cancelled');
    config.apiKey = apiKey || existing?.apiKey;
  }

  if (provider === 'gemini-cli') {
    const projectId = await p.text({
      message: 'Google Cloud Project ID (optional)',
      defaultValue: existing?.googleCloudProject || '',
      placeholder: existing?.googleCloudProject
        ? existing.googleCloudProject
        : 'Leave empty to use default',
    });
    if (p.isCancel(projectId)) throw new Error('Cancelled');
    if (projectId) {
      config.googleCloudProject = projectId;
    }
  }

  return config;
}

async function configureGitLab(existing?: GitLabConfig): Promise<GitLabConfig | null> {
  p.log.step('[GL] Configuring GitLab Integration');

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
    placeholder: existing?.url ? existing.url : 'https://gitlab.example.com',
  });

  if (p.isCancel(url)) throw new Error('Cancelled');

  const message = existing?.accessToken
    ? 'GitLab Access Token (press Enter to keep existing ***masked***)'
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

async function configureProjectsOnly(
  existing?: AutoReviewConfig,
  gitlabConfig?: GitLabConfig
): Promise<string[] | null> {
  p.log.step('[PR] Configuring Review Projects');

  // Fetch available projects
  const projectsSpinner = p.spinner();
  projectsSpinner.start('Fetching GitLab projects...');

  let availableProjects: GitLabProject[] = [];
  try {
    availableProjects = await fetchProjects(gitlabConfig!);
    projectsSpinner.stop(`Found ${availableProjects.length} projects`);
  } catch (error) {
    projectsSpinner.stop('❌ Failed to fetch projects');

    // Provide detailed error information
    p.log.error('Could not fetch GitLab projects');
    p.log.error(`GitLab URL: ${gitlabConfig?.url || 'not configured'}`);
    p.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('authentication')) {
        p.log.error('🔑 Authentication failed - please check your Personal Access Token');
      } else if (error.message.includes('fetch failed') || error.message.includes('network')) {
        p.log.error('🌐 Network error - please check your connection and GitLab URL');
      } else if (error.message.includes('timeout')) {
        p.log.error('⏱️  Request timeout - GitLab server might be slow or unreachable');
      }
    }

    // Ask if user wants to proceed with manual entry
    const useManualEntry = await p.confirm({
      message: 'Would you like to enter project names manually instead?',
      initialValue: false,
    });

    if (p.isCancel(useManualEntry) || !useManualEntry) {
      return null;
    }

    // Manual project entry fallback
    const manualProjects = await p.text({
      message: 'Enter project names (comma-separated)',
      placeholder: existing?.projects?.length
        ? existing.projects.join(', ')
        : 'e.g., my-org/project1, my-org/project2',
      defaultValue: existing?.projects?.join(', ') || '',
    });

    if (p.isCancel(manualProjects) || !manualProjects.trim()) {
      return null;
    }

    const projectNames = manualProjects
      .split(',')
      .map((name: string) => normalizeProjectName(name.trim()))
      .filter((name: string) => name.length > 0);

    return projectNames;
  }

  if (availableProjects.length === 0) {
    p.log.warn('No GitLab projects found');
    return null;
  }

  // Select projects to monitor
  const projectOptions = availableProjects
    .sort((a, b) => a.name_with_namespace.localeCompare(b.name_with_namespace))
    .map((project) => ({
      value: project.name_with_namespace,
      label: project.name_with_namespace,
      hint: `ID: ${project.id}`,
    }));

  // Find projects that should be pre-selected based on existing config
  const existingProjectNames = existing?.projects || [];
  const preSelectedProjects = projectOptions
    .filter((option) => {
      return existingProjectNames.some((existingName) => {
        // Exact match
        if (existingName === option.value) return true;

        // Normalized comparison (handle variations in project names)
        const normalizedExisting = existingName.toLowerCase().replace(/[\s/-]/g, '');
        const normalizedOption = option.value.toLowerCase().replace(/[\s/-]/g, '');

        return normalizedExisting === normalizedOption;
      });
    })
    .map((option) => option.value);

  if (preSelectedProjects.length > 0) {
    p.log.info(`Pre-selecting ${preSelectedProjects.length} previously configured projects`);
  }

  const selectedProjects = await p.multiselect({
    message: 'Select projects to monitor',
    options: projectOptions,
    initialValues: preSelectedProjects,
  });

  if (p.isCancel(selectedProjects)) return null;

  // Normalize project names before saving
  return selectedProjects.map((project: string) => normalizeProjectName(project));
}

async function configureCustomPrompts(
  existing?: AutoReviewConfig
): Promise<AutoReviewConfig | null> {
  if (!existing?.projects?.length) {
    p.log.error('No projects available for custom prompt configuration');
    return null;
  }

  p.log.step('[CM] Configuring Custom Prompts');

  // Show current project list
  p.log.info(`Configuring prompts for ${existing.projects.length} projects`);

  const projectPrompts = existing.projectPrompts || {};

  // Initialize with normalized keys to ensure consistency
  const updatedProjectPrompts: Record<
    string,
    { promptFile?: string; promptStrategy?: 'append' | 'prepend' | 'replace' }
  > = {};
  Object.entries(projectPrompts).forEach(([key, value]) => {
    const normalizedKey = normalizeProjectName(key);
    updatedProjectPrompts[normalizedKey] = value;
  });

  while (true) {
    // Show menu of projects to configure
    const projectOptions = existing.projects.map((project) => {
      const normalizedProject = normalizeProjectName(project);

      // Find prompt config by checking both normalized key and any existing key that normalizes to match
      let promptConfig = updatedProjectPrompts[normalizedProject];
      if (!promptConfig) {
        // Check if any existing key normalizes to match this project
        const matchingKey = Object.keys(updatedProjectPrompts).find(
          (key) => normalizeProjectName(key) === normalizedProject
        );
        if (matchingKey) {
          promptConfig = updatedProjectPrompts[matchingKey];
        }
      }

      const hasPrompt = promptConfig?.promptFile;
      const strategy = promptConfig?.promptStrategy || 'Not set';
      return {
        value: project,
        label: project,
        hint: hasPrompt ? `Prompt: ${strategy}` : 'No custom prompt',
      };
    });

    projectOptions.push({ value: 'back', label: '◀◀ Back to auto review menu', hint: '' });

    const selectedProject = await p.select({
      message: 'Select a project to configure custom prompts:',
      options: projectOptions,
    });

    if (p.isCancel(selectedProject)) {
      // Return the updated configuration even when cancelled
      const result: AutoReviewConfig = {
        enabled: existing?.enabled ?? false,
        projects: existing?.projects ?? [],
        interval: existing?.interval ?? 120,
        state: existing?.state,
        projectPrompts:
          Object.keys(updatedProjectPrompts).length > 0 ? updatedProjectPrompts : undefined,
      };

      return result;
    }

    if (selectedProject === 'back') {
      // Return the updated configuration even when going back
      const result: AutoReviewConfig = {
        enabled: existing?.enabled ?? false,
        projects: existing?.projects ?? [],
        interval: existing?.interval ?? 120,
        state: existing?.state,
        projectPrompts:
          Object.keys(updatedProjectPrompts).length > 0 ? updatedProjectPrompts : undefined,
      };

      return result;
    }

    // Configure prompt for the selected project
    const projectName = normalizeProjectName(selectedProject as string);

    // Find current prompt config by checking both normalized key and any existing key that normalizes to match
    let currentPrompt = updatedProjectPrompts[projectName];
    let existingKey = projectName;
    if (!currentPrompt) {
      // Check if any existing key normalizes to match this project
      const matchingKey = Object.keys(updatedProjectPrompts).find(
        (key) => normalizeProjectName(key) === projectName
      );
      if (matchingKey) {
        currentPrompt = updatedProjectPrompts[matchingKey];
        existingKey = matchingKey;
      }
    }

    p.log.info(`Configuring custom prompt for: ${projectName}`);

    const action = await p.select({
      message: 'What would you like to do?',
      options: [
        {
          value: 'set',
          label: '➕ Set/Update Custom Prompt',
          hint: currentPrompt?.promptFile ? 'Update existing' : 'Create new',
        },
        {
          value: 'remove',
          label: '❌ Remove Custom Prompt',
          hint: currentPrompt?.promptFile ? 'Remove existing' : 'No prompt to remove',
        },
        { value: 'back', label: '◀◀ Back to project list', hint: '' },
      ],
    });

    if (p.isCancel(action) || action === 'back') {
      continue;
    }

    if (action === 'remove') {
      let removed = false;

      // Remove from the existing key (which could be normalized or unnormalized)
      if (updatedProjectPrompts[existingKey]) {
        delete updatedProjectPrompts[existingKey];
        removed = true;
      }

      // Also remove from the original project name if it's different
      const originalProjectName = selectedProject as string;
      if (originalProjectName !== existingKey && updatedProjectPrompts[originalProjectName]) {
        delete updatedProjectPrompts[originalProjectName];
        removed = true;
      }

      if (removed) {
        p.log.success(`Removed custom prompt for ${projectName}`);
      } else {
        p.log.warn(`No custom prompt configured for ${projectName}`);
      }
      continue;
    }

    if (action === 'set') {
      // Get prompt file path
      const promptFile = await p.text({
        message: 'Prompt file path (absolute path)',
        defaultValue: currentPrompt?.promptFile || '',
        placeholder: currentPrompt?.promptFile
          ? currentPrompt.promptFile
          : 'e.g., /path/to/your/custom-prompt.md',
        validate: (value) => {
          // If the value is empty but we have a default, allow it (user pressed Enter to keep existing)
          if (!value.trim()) {
            if (currentPrompt?.promptFile) {
              return undefined; // Allow empty input when there's an existing value
            }
            return 'Prompt file path is required';
          }
          // Validate that it's an absolute path
          if (!value.startsWith('/') && !value.match(/^[A-Za-z]:/)) {
            return 'Please provide an absolute path (starting with / or C:)';
          }
          return undefined;
        },
      });

      if (p.isCancel(promptFile)) {
        continue;
      }

      // Get prompt strategy
      const strategy = await p.select({
        message: 'How should this prompt be used?',
        options: [
          {
            value: 'replace',
            label: '🔄 Replace',
            hint: 'Use only this custom prompt',
          },
          {
            value: 'prepend',
            label: '⬆️  Prepend',
            hint: 'Add before default prompt',
          },
          {
            value: 'append',
            label: '⬇️  Append',
            hint: 'Add after default prompt',
          },
        ],
        initialValue: currentPrompt?.promptStrategy || 'append',
      });

      if (p.isCancel(strategy)) {
        continue;
      }

      // Save the configuration
      // Remove any existing entry (could be under a different key) to avoid duplicates
      if (existingKey !== projectName && updatedProjectPrompts[existingKey]) {
        delete updatedProjectPrompts[existingKey];
      }

      // Also check original project name from selection in case it's different
      const originalProjectName = selectedProject as string;
      if (
        originalProjectName !== projectName &&
        originalProjectName !== existingKey &&
        updatedProjectPrompts[originalProjectName]
      ) {
        delete updatedProjectPrompts[originalProjectName];
      }

      updatedProjectPrompts[projectName] = {
        promptFile,
        promptStrategy: strategy as 'append' | 'prepend' | 'replace',
      };

      p.log.success(`Custom prompt configured for ${projectName}`);
      p.log.info(`File: ${promptFile}`);
      p.log.info(`Strategy: ${strategy}`);
    }
  }

  // Return updated configuration
  const result: AutoReviewConfig = {
    enabled: existing?.enabled ?? false,
    projects: existing?.projects ?? [],
    interval: existing?.interval ?? 120,
    state: existing?.state,
    projectPrompts:
      Object.keys(updatedProjectPrompts).length > 0 ? updatedProjectPrompts : undefined,
  };

  return result;
}

async function reviewAndSave(config: Partial<AppConfig>): Promise<boolean> {
  p.log.step('✅ Configuration Review');

  // Show comprehensive configuration summary
  process.stdout.write('\n✅ Configuration Summary:\n');

  // Server Configuration
  if (config.server) {
    const subPath = config.server.subPath ? config.server.subPath : '';
    process.stdout.write(
      `🌐 Server: ${config.server.host}:${config.server.port}${subPath ? '/' + subPath : ''}\n`
    );
  } else {
    process.stdout.write('🌐 Server: localhost:5960 (default)\n');
  }

  // LLM Configuration
  if (config.llm) {
    const apiKeyStatus = config.llm.apiKey ? ' (with API key)' : '';
    const projectInfo = config.llm.googleCloudProject
      ? ` [Project: ${config.llm.googleCloudProject}]`
      : '';
    process.stdout.write(`🤖 LLM: ${config.llm.provider}${apiKeyStatus}${projectInfo}\n`);
  } else {
    process.stdout.write('🤖 LLM: gemini-cli (default)\n');
  }

  // GitLab Integration
  if (config.gitlab) {
    const hostname = new URL(config.gitlab.url).hostname;
    process.stdout.write(`📦 GitLab: ${hostname} (${config.gitlab.url})\n`);
    process.stdout.write(
      `📦 Access Token: ${config.gitlab.accessToken ? '***configured***' : 'Not set'}\n`
    );
  } else {
    process.stdout.write('📦 GitLab: Not configured\n');
  }

  // Auto Review Configuration
  if (config.autoReview) {
    const projectCount = config.autoReview.projects?.length ?? 0;
    const interval = config.autoReview.interval ?? 120;
    const enabled = config.autoReview.enabled ? 'Enabled' : 'Disabled';
    const storage = config.autoReview.state?.storage || 'local';

    process.stdout.write(`🔄 Auto Review: ${enabled}\n`);
    if (projectCount > 0) {
      process.stdout.write(`🔄 Projects (${projectCount}):\n`);
      config.autoReview.projects?.forEach((project, index) => {
        process.stdout.write(`     ${index + 1}. ${project}\n`);
      });
      process.stdout.write(`🔄 Review Interval: ${interval} seconds\n`);
      process.stdout.write(`🔄 State Storage: ${storage}\n`);

      // Custom Prompts Summary
      if (
        config.autoReview.projectPrompts &&
        Object.keys(config.autoReview.projectPrompts).length > 0
      ) {
        const promptCount = Object.keys(config.autoReview.projectPrompts).length;
        process.stdout.write(`📝 Custom Prompts: ${promptCount} project(s) configured\n`);
        Object.entries(config.autoReview.projectPrompts).forEach(([project, promptConfig]) => {
          const strategy = promptConfig.promptStrategy || 'append';
          const file = promptConfig.promptFile || 'Not set';
          process.stdout.write(`     - ${project}: ${strategy} (${file})\n`);
        });
      } else {
        process.stdout.write('📝 Custom Prompts: None configured\n');
      }
    } else {
      process.stdout.write('🔄 Projects: None configured\n');
    }
  } else {
    process.stdout.write('🔄 Auto Review: Not configured\n');
  }

  // UI Configuration
  if (config.ui) {
    process.stdout.write(`🖥️  Auto-open Browser: ${config.ui.autoOpen ? 'Enabled' : 'Disabled'}\n`);
  } else {
    process.stdout.write('🖥️  Auto-open Browser: Enabled (default)\n');
  }

  process.stdout.write('\n'); // Empty line for better spacing

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
