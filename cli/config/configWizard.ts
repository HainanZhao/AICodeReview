import { existsSync, mkdirSync, renameSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import { fetchProjects, gitlabApiFetch } from '../shared/services/gitlabCore.js';
import { GitLabConfig, GitLabMergeRequest, GitLabProject } from '../shared/types/gitlab.js';
import { Util } from '../shared/utils/Util.js';
import { loadLocalState, ReviewedMrState, saveSnippetState } from '../state/state.js';
import { ConfigLoader } from './configLoader.js';
import { AppConfig } from './configSchema.js';

/**
 * Helper function to fetch all merge requests from a project (including closed/merged)
 */
async function fetchAllMergeRequestsFromProject(
  config: GitLabConfig,
  projectId: number
): Promise<GitLabMergeRequest[]> {
  const url = `${config.url}/api/v4/projects/${projectId}/merge_requests?state=all&order_by=updated_at&sort=desc&per_page=100`;
  const mrs = (await gitlabApiFetch(url, config)) as GitLabMergeRequest[];
  return mrs;
}

async function migrateLocalStateToSnippets(
  gitlabConfig: GitLabConfig,
  question: (prompt: string) => Promise<string>,
  configuredProjects: GitLabProject[] = []
): Promise<void> {
  const localState = loadLocalState();
  if (Object.keys(localState).length === 0) {
    return; // No local state to migrate
  }

  console.log(helpText('Found existing local review state file.'));
  const confirm = await question('Do you want to migrate it to GitLab snippets? (Y/n): ');

  if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
    console.log('Skipping migration.');
    return;
  }

  console.log('🚀 Starting migration...');
  try {
    if (configuredProjects.length === 0) {
      console.warn('⚠️  No projects available for migration.');
      return;
    }

    console.log(`📋 Building MR mapping across ${configuredProjects.length} projects...`);

    // Build MR ID to project mapping by fetching all MRs from all configured projects
    const mrIdToProjectMap = new Map<number, { projectId: number; mrIid: number }>();

    for (const project of configuredProjects) {
      try {
        console.log(`Scanning project ${project.name_with_namespace}...`);
        const projectMrs = await fetchAllMergeRequestsFromProject(gitlabConfig, project.id);

        for (const mr of projectMrs) {
          mrIdToProjectMap.set(mr.id, {
            projectId: project.id,
            mrIid: mr.iid,
          });
        }

        console.log(`✅ Found ${projectMrs.length} MRs in project ${project.name_with_namespace}`);
      } catch (error) {
        console.warn(
          `⚠️  Error scanning project ${project.name_with_namespace}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    console.log(`✅ Built mapping for ${mrIdToProjectMap.size} total MRs`);

    // Group MRs by project using the prebuilt mapping
    const stateByProject: Record<string, Record<number, ReviewedMrState>> = {};

    for (const mrId in localState) {
      const reviewedMr = localState[mrId];
      let projectId: number | undefined;
      let mrIid: number | undefined;
      // Look up MR in the prebuilt mapping
      const mrIdNum = parseInt(mrId, 10);
      if (reviewedMr.project_id && reviewedMr.mr_iid) {
        // Use existing project ID and MR IID if available
        projectId = reviewedMr.project_id;
        mrIid = reviewedMr.mr_iid;
      } else {
        if (isNaN(mrIdNum)) {
          console.warn(`⚠️  Invalid MR ID format: ${mrId}, skipping.`);
          continue;
        }

        const mapping = mrIdToProjectMap.get(mrIdNum);
        if (mapping) {
          projectId = mapping.projectId;
          mrIid = mapping.mrIid;
          console.log(`✅ Found MR ${mrId} in project ${projectId} (IID: ${mrIid})`);
        }
      }

      if (projectId && mrIid) {
        if (!stateByProject[projectId]) {
          stateByProject[projectId] = {};
        }
        stateByProject[projectId][mrIdNum] = {
          head_sha: reviewedMr.head_sha,
          reviewed_at: reviewedMr.reviewed_at,
          project_id: projectId,
          mr_iid: mrIid,
        };
      } else {
        console.warn(`⚠️  Could not find project for MR ${mrId}, skipping.`);
      }
    }

    let allSucceeded = true;
    for (const projectIdStr in stateByProject) {
      const projectId = parseInt(projectIdStr, 10);
      const projectState = stateByProject[projectIdStr];
      console.log(`Migrating state for project ${projectId}...`);
      const success = await saveSnippetState(gitlabConfig, projectId, projectState);
      if (!success) {
        allSucceeded = false;
        console.warn(`⚠️  Could not migrate state for project ${projectId}.`);
      }
    }

    if (allSucceeded) {
      const stateFilePath = join(homedir(), '.aicodereview', 'review-state.json');
      renameSync(stateFilePath, `${stateFilePath}.migrated`);
      console.log(
        '✅ Migration successful! Renamed local state file to review-state.json.migrated'
      );
    } else {
      console.warn(
        '⚠️  Migration completed with some errors. The local state file has not been renamed.'
      );
    }
  } catch (error) {
    console.error(`❌ Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Normalizes project names by removing extra spaces around slashes
 * e.g., "group / subgroup / project" -> "group/subgroup/project"
 */
function normalizeProjectName(name: string): string {
  return name.replace(/\s*\/\s*/g, '/').trim();
}

/**
 * Formats help text with dimmed visual style
 */
const helpText = (text: string): string => `\x1b[2m    ‣ ${text}\x1b[0m`;

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

/**
 * Displays projects in a table format and returns selected project objects
 */
async function selectProjectsInteractively(
  gitlabConfig: { url: string; accessToken: string },
  question: (prompt: string) => Promise<string>,
  currentProjectNames?: string[]
): Promise<{ projects: GitLabProject[]; projectNames: string[] }> {
  try {
    console.log('\n🔍 Fetching your GitLab projects...');

    const projects = await fetchProjects(gitlabConfig);

    if (projects.length === 0) {
      console.log(
        '⚠️  No projects found. Make sure you have at least Developer access to some projects.'
      );
      return { projects: [], projectNames: [] };
    }

    console.log(`\n📋 Found ${projects.length} projects available.\n`);

    console.log(helpText('💡 Tips:'));
    console.log(helpText('Enter project names (not IDs) - partial names work too'));
    console.log(helpText('Use comma-separated names for multiple projects'));
    console.log(helpText('Examples: "my-api", "frontend,backend", "web-app"'));
    console.log(helpText("We'll show you matching projects for confirmation\n"));

    // Get current project names
    const currentProjectsList = currentProjectNames?.join(', ') || '';

    const projectNamesStr =
      (await question(
        `Enter project names to monitor ${
          currentProjectsList ? `(current: ${currentProjectsList})` : '(comma-separated)'
        }: `
      )) || currentProjectsList;

    if (!projectNamesStr.trim()) {
      console.log('⚠️  No project names entered.');
      return {
        projects: [],
        projectNames: currentProjectNames || [],
      };
    }

    // Parse and filter projects by names
    const searchNames = projectNamesStr
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0);

    const matchingProjects = projects.filter((project) => {
      const projectName = Util.normalizeProjectName(project.name);
      const projectNamespace = Util.normalizeProjectName(project.name_with_namespace);

      return searchNames.some(
        (searchName) => projectName.includes(searchName) || projectNamespace.includes(searchName)
      );
    });

    if (matchingProjects.length === 0) {
      console.log(`❌ No projects found matching: ${searchNames.join(', ')}`);
      console.log('Please try with different project names or partial names.');
      return { projects: [], projectNames: [] };
    }

    // Show filtered results for confirmation
    console.log(`\n✨ Found ${matchingProjects.length} matching project(s):\n`);

    console.log(
      '┌──────────┬─────────────────────────────────────────────────────────────┬────────────────────┐'
    );
    console.log(
      '│ ID       │ Project Name                                                │ Last Activity      │'
    );
    console.log(
      '├──────────┼─────────────────────────────────────────────────────────────┼────────────────────┤'
    );

    matchingProjects.forEach((project) => {
      const id = project.id.toString().padEnd(8);
      const name =
        project.name_with_namespace.length > 59
          ? project.name_with_namespace.substring(0, 56) + '...'
          : project.name_with_namespace.padEnd(59);
      const lastActivity = new Date(project.last_activity_at).toLocaleDateString();

      console.log(`│ ${id} │ ${name} │ ${lastActivity.padEnd(18)} │`);
    });

    console.log(
      '└──────────┴─────────────────────────────────────────────────────────────┴────────────────────┘\n'
    );

    // Confirm selection
    const confirm = await question(
      `Confirm monitoring these ${matchingProjects.length} project(s)? (Y/n): `
    );

    if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
      console.log('❌ Project selection cancelled.');
      return {
        projects: [],
        projectNames: currentProjectNames || [],
      };
    }

    const selectedProjectNames = matchingProjects.map((p) =>
      normalizeProjectName(p.name_with_namespace)
    );
    console.log(`✅ Selected ${selectedProjectNames.length} project(s) for monitoring.`);

    return {
      projects: matchingProjects,
      projectNames: selectedProjectNames,
    };
  } catch (error) {
    console.error(
      `❌ Failed to fetch projects: ${error instanceof Error ? error.message : String(error)}`
    );
    console.log('You can enter project names manually if needed.');

    const currentProjectsList = currentProjectNames?.join(', ') || '';
    const projectNamesStr =
      (await question(
        `Enter project names manually ${currentProjectsList ? `(current: ${currentProjectsList})` : '(comma-separated)'}: `
      )) || currentProjectsList;

    const manualProjectNames = projectNamesStr
      .split(',')
      .map((name: string) => name.trim())
      .filter((name: string) => name.length > 0);

    return {
      projects: [], // No project objects available in manual entry mode
      projectNames: manualProjectNames,
    };
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

  // Load existing configuration if available
  let existingConfig: AppConfig | null = null;
  try {
    const loader = new ConfigLoader();
    if (loader.hasConfig()) {
      existingConfig = ConfigLoader.loadConfig({});
      console.log('📋 Found existing configuration, values will be pre-populated.\n');
    }
  } catch {
    console.warn('⚠️  Could not load existing configuration, starting fresh.\n');
  }

  console.log('🎉 Welcome to AI Code Review Setup Wizard!\n');

  try {
    // Server configuration
    console.log('📡 Server Configuration:');
    const defaultPort = existingConfig?.server?.port?.toString() || '5960';
    const defaultHost = existingConfig?.server?.host || 'localhost';
    const defaultSubPath = existingConfig?.server?.subPath || '';

    const port = (await question(`Port (${defaultPort}): `)) || defaultPort;
    const host = (await question(`Host (${defaultHost}): `)) || defaultHost;
    console.log(
      helpText(
        'Sub-path: If you need to serve the app under a specific path (e.g., behind a proxy)'
      )
    );
    const subPath =
      (await question(
        `Sub-path (${defaultSubPath ? `current: ${defaultSubPath}` : 'optional, e.g., /path/to'}): `
      )) ||
      defaultSubPath ||
      undefined;

    // LLM provider configuration
    console.log('\n🤖 LLM Provider Configuration:');
    console.log(helpText('Available providers:'));
    console.log(helpText('1. gemini-cli (uses local gemini command, recommended)'));
    console.log(helpText('2. gemini (Google Gemini API)'));
    console.log(helpText('3. anthropic (Claude API)'));

    // Determine current provider choice
    let defaultProviderChoice = '1';
    if (existingConfig?.llm?.provider) {
      switch (existingConfig.llm.provider) {
        case 'gemini':
          defaultProviderChoice = '2';
          break;
        case 'anthropic':
          defaultProviderChoice = '3';
          break;
        default:
          defaultProviderChoice = '1';
      }
    }

    const providerChoice =
      (await question(`Choose provider (1-3, current: ${defaultProviderChoice}): `)) ||
      defaultProviderChoice;

    let provider: string;
    let apiKey: string | undefined;
    let googleCloudProject: string | undefined;

    switch (providerChoice) {
      case '2': {
        provider = 'gemini';
        const currentGeminiApiKey = existingConfig?.llm?.apiKey || '';
        const maskedGeminiKey = currentGeminiApiKey
          ? `${currentGeminiApiKey.substring(0, 8)}...`
          : '';
        apiKey =
          (await question(
            `Gemini API Key ${maskedGeminiKey ? `(current: ${maskedGeminiKey})` : ''}: `
          )) ||
          existingConfig?.llm?.apiKey ||
          '';
        break;
      }
      case '3': {
        provider = 'anthropic';
        const currentAnthropicApiKey = existingConfig?.llm?.apiKey || '';
        const maskedAnthropicKey = currentAnthropicApiKey
          ? `${currentAnthropicApiKey.substring(0, 8)}...`
          : '';
        apiKey =
          (await question(
            `Anthropic API Key ${maskedAnthropicKey ? `(current: ${maskedAnthropicKey})` : ''}: `
          )) ||
          existingConfig?.llm?.apiKey ||
          '';
        break;
      }
      default: {
        provider = 'gemini-cli';
        const currentProject = existingConfig?.llm?.googleCloudProject || '';
        googleCloudProject =
          (await question(
            `Google Cloud Project ID ${currentProject ? `(current: ${currentProject})` : '(optional)'}: `
          )) ||
          existingConfig?.llm?.googleCloudProject ||
          undefined;
        break;
      }
    }

    // UI configuration
    console.log('\n🎨 UI Configuration:');
    const currentAutoOpen = existingConfig?.ui?.autoOpen ? 'y' : 'n';
    const autoOpenInput =
      (await question(`Auto-open browser? (y/N, current: ${currentAutoOpen}): `)) ||
      currentAutoOpen;
    const autoOpen = autoOpenInput.toLowerCase() === 'y' || autoOpenInput.toLowerCase() === 'yes';

    // GitLab configuration
    console.log('\n🦊 GitLab Configuration (for CLI review mode):');
    console.log(
      helpText('This allows you to review merge requests directly from the command line.')
    );

    const hasExistingGitlab = existingConfig?.gitlab?.url && existingConfig?.gitlab?.accessToken;
    const defaultConfigureGitlab = hasExistingGitlab ? 'Y' : 'n';

    if (hasExistingGitlab) {
      console.log(helpText(`Current GitLab URL: ${existingConfig!.gitlab!.url}`));
    }

    const configureGitlab =
      (await question(`Configure GitLab access? (Y/n, current: ${defaultConfigureGitlab}): `)) ||
      defaultConfigureGitlab;

    let gitlabConfig: { url: string; accessToken: string } | undefined;

    if (configureGitlab.toLowerCase() !== 'n' && configureGitlab.toLowerCase() !== 'no') {
      const currentGitlabUrl = existingConfig?.gitlab?.url || '';
      const gitlabUrl =
        (await question(
          `GitLab instance URL ${currentGitlabUrl ? `(current: ${currentGitlabUrl})` : '(e.g., https://gitlab.com)'}: `
        )) || currentGitlabUrl;

      if (gitlabUrl) {
        console.log(helpText('To create a Personal Access Token:'));
        console.log(helpText('1. Go to your GitLab instance → Settings → Access Tokens'));
        console.log(helpText('2. Create a token with "api" scope'));
        console.log(helpText('3. Copy the token (it will only be shown once)'));

        const currentAccessToken = existingConfig?.gitlab?.accessToken || '';
        const maskedToken = currentAccessToken ? `${currentAccessToken.substring(0, 8)}...` : '';
        const accessToken =
          (await question(
            `\nGitLab Personal Access Token ${maskedToken ? `(current: ${maskedToken})` : ''}: `
          )) || currentAccessToken;

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
          projects: string[];
          interval: number;
          state?: { storage: 'local' | 'snippet' };
        }
      | undefined;

    if (gitlabConfig) {
      console.log('\n🤖 Automatic Review Configuration:');
      console.log(helpText('This mode will automatically review new MRs in configured projects.'));

      const hasExistingAutoReview = existingConfig?.autoReview?.enabled === true;
      const defaultEnableAutoReview = hasExistingAutoReview ? 'Y' : 'N';

      if (hasExistingAutoReview && existingConfig?.autoReview) {
        console.log(`Current projects: ${existingConfig.autoReview.projects.join(', ')}`);
        console.log(`Current interval: ${existingConfig.autoReview.interval} seconds`);
      }

      const enableAutoReview =
        (await question(
          `Enable automatic MR review mode? (y/N, current: ${defaultEnableAutoReview}): `
        )) || defaultEnableAutoReview;

      if (enableAutoReview.toLowerCase() === 'y' || enableAutoReview.toLowerCase() === 'yes') {
        // Show projects table and let user select
        const selectedProjects = await selectProjectsInteractively(
          gitlabConfig,
          question,
          existingConfig?.autoReview?.projects
        );

        const currentInterval = existingConfig?.autoReview?.interval?.toString() || '300';
        const intervalStr =
          (await question(`Review interval in seconds (current: ${currentInterval}): `)) ||
          currentInterval;
        const interval = parseInt(intervalStr, 10);

        if (selectedProjects.projectNames.length > 0) {
          // Ask for state storage type
          console.log('\n💾 State Storage Configuration:');
          console.log(helpText('This determines where to save the state of reviewed MRs.'));
          console.log(helpText('1. Local file (default, stored in ~/.aicodereview)'));
          console.log(
            helpText('2. GitLab snippet (stored in each project, allows for distributed use)')
          );

          const defaultStateStorage =
            existingConfig?.autoReview?.state?.storage === 'snippet' ? '2' : '1';
          const storageChoice =
            (await question(`Choose state storage (1-2, current: ${defaultStateStorage}): `)) ||
            defaultStateStorage;

          const storageType = storageChoice === '2' ? 'snippet' : 'local';

          autoReviewConfig = {
            enabled: true,
            projects: selectedProjects.projectNames,
            interval: isNaN(interval) ? 300 : interval,
            state: {
              storage: storageType,
            },
          };
          console.log(`✅ State storage set to: ${storageType}`);

          // If user chose snippet storage, check for local state and offer to migrate
          if (
            storageType === 'snippet' &&
            existingConfig?.autoReview?.state?.storage !== 'snippet'
          ) {
            // Pass the selected projects directly to avoid refetching
            await migrateLocalStateToSnippets(gitlabConfig, question, selectedProjects.projects);
          }
        } else {
          console.log('⚠️  No valid projects selected. Auto-review mode will be disabled.');
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
