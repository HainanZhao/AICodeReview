#!/usr/bin/env node

import { Command } from 'commander';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import checkForUpdates from './services/updateNotifier.js';

// START: Timestamp and file logging
const logDir = join(homedir(), '.aicodereview', 'logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const getLogFile = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return join(logDir, `${year}-${month}-${day}.log`);
};

const formatTimestamp = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

const originalLog = console.log;
console.log = (...args: unknown[]) => {
  const timestamp = formatTimestamp(new Date());
  const message = `[${timestamp}] ${args.join(' ')}`;
  originalLog(message);
  appendFileSync(getLogFile(), message + '\n');
};

const originalError = console.error;
console.error = (...args: unknown[]) => {
  const timestamp = formatTimestamp(new Date());
  const message = `[${timestamp}] ${args.join(' ')}`;
  originalError(message);
  appendFileSync(getLogFile(), message + '\n');
};

// END: Timestamp and file logging

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const program = new Command();

program
  .name('aicodereview')
  .description('AI-powered code review tool with web interface')
  .version(packageJson.version)
  .argument('[mrUrls...]', 'GitLab merge request URLs for CLI review mode');

interface ProgramOptions {
  port?: string;
  host?: string;
  subPath?: string;
  provider?: string;
  apiKey?: string;
  googleCloudProject?: string;
  open?: boolean;
  apiOnly?: boolean;
  init?: string | boolean;
  listProjects?: boolean;
  auto?: boolean;
  dryRun?: boolean;
  mock?: boolean;
  verbose?: boolean;
  customPromptFile?: string;
  promptStrategy?: string;
}

program
  .option('-p, --port <number>', 'port to run the server on')
  .option('--host <host>', 'host to bind the server to')
  .option('--sub-path <path>', 'path to run the app on')
  .option('--provider <provider>', 'LLM provider (gemini-cli, gemini, anthropic)')
  .option('--api-key <key>', 'API key for the LLM provider')
  .option('--google-cloud-project <project>', 'Google Cloud project ID for gemini-cli')
  .option('--no-open', 'do not automatically open browser')
  .option('--api-only', 'run server in API-only mode (no web interface)')
  .option(
    '--init [section]',
    'create configuration interactively. Use --init for modern tabbed UI or --init <section> for legacy step-by-step mode (sections: llm, gitlab, autoReview)'
  )
  .option(
    '--list-projects',
    'list your GitLab projects and their IDs for auto-review configuration'
  )
  .option('--auto', 'run in fully automatic mode to monitor and review MRs continuously')
  .option('--dry-run', 'generate real AI review but do not post comments to GitLab (CLI mode only)')
  .option('--mock', 'use mock AI responses for testing without API calls (CLI mode only)')
  .option('--verbose', 'detailed operation logs (CLI mode only)')
  .option(
    '--custom-prompt-file <file>',
    'path to custom prompt file to use instead of default (CLI mode only)'
  )
  .option(
    '--prompt-strategy <strategy>',
    'how to merge custom prompt: append, prepend, or replace (default: append, CLI mode only)'
  )
  .action(async (mrUrls: string[], options: ProgramOptions) => {
    try {
      await checkForUpdates(packageJson.version);

      if (options.init !== undefined) {
        if (typeof options.init === 'string') {
          // Legacy mode: section-specific configuration
          const { createConfigInteractively } = await import('./config/configWizard.js');
          await createConfigInteractively(options.init);
        } else {
          // New mode: interactive tabbed UI
          const { createInteractiveConfig } = await import('./config/interactiveConfigWizard.js');
          await createInteractiveConfig();
        }
        return;
      }

      if (options.listProjects) {
        const { ListProjectsCommand } = await import('./cli/listProjectsCommand.js');
        await ListProjectsCommand.run();
        return;
      }

      if (options.auto) {
        const { AutoReviewCommand } = await import('./cli/autoReviewCommand.js');
        const command = new AutoReviewCommand();
        await command.run();
        return;
      }

      // Dual mode logic: CLI review if MR URLs provided, UI server otherwise
      if (mrUrls && mrUrls.length > 0) {
        // CLI Review Mode - no web UI
        const { CLIReviewCommand } = await import('./cli/reviewCommand.js');

        // Validate MR URL format for each provided URL
        for (const url of mrUrls) {
          if (!CLIReviewCommand.validateMrUrl(url)) {
            console.error(`❌ Error: Invalid GitLab merge request URL format: ${url}`);
            console.log('Expected format: https://gitlab.example.com/project/-/merge_requests/123');
            process.exit(1);
          }
        }

        await CLIReviewCommand.executeReview({
          mrUrl: mrUrls, // Pass the array of URLs
          dryRun: options.dryRun,
          mock: options.mock,
          verbose: options.verbose,
          customPromptFile: options.customPromptFile,
          promptStrategy: options.promptStrategy as 'append' | 'prepend' | 'replace' | undefined,
          provider: options.provider,
          apiKey: options.apiKey,
          googleCloudProject: options.googleCloudProject,
          port: options.port,
          host: options.host,
        });
      } else {
        // UI Mode - start web server
        // Check if config exists, if not, run init wizard
        const { ConfigLoader } = await import('./config/configLoader.js');
        const configLoader = new ConfigLoader();

        if (!configLoader.hasConfig()) {
          console.log('No configuration found. Running interactive setup wizard...');
          const { createInteractiveConfig } = await import('./config/interactiveConfigWizard.js');
          await createInteractiveConfig();
          console.log('Configuration created. Starting AI Code Review...\n');
        }

        // If --api-only is specified and no port was explicitly set via CLI, use port 5959
        const serverOptions = { ...options, apiOnly: options.apiOnly };

        // Check if port was explicitly provided via CLI
        const hasExplicitPortFromCLI =
          process.argv.includes('--port') || process.argv.includes('-p');
        if (options.apiOnly && !hasExplicitPortFromCLI) {
          serverOptions.port = '5959';
        }

        const { startServer } = await import('./server/standalone.js');
        await startServer(serverOptions);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error:', errorMessage);
      process.exit(1);
    }
  });

program.parse();
