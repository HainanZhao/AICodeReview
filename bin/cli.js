#!/usr/bin/env node

// START: Timestamp console logs
const formatTimestamp = (date) => {
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
console.log = (...args) => {
  const timestamp = formatTimestamp(new Date());
  originalLog(`[${timestamp}]`, ...args);
};

const originalError = console.error;
console.error = (...args) => {
  const timestamp = formatTimestamp(new Date());
  originalError(`[${timestamp}]`, ...args);
};
// END: Timestamp console logs

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import checkForUpdates from '../dist/services/updateNotifier.js';

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
    'create a configuration file interactively, optionally for a specific section (server, llm, ui, gitlab, autoReview)'
  )
  .option(
    '--list-projects',
    'list your GitLab projects and their IDs for auto-review configuration'
  )
  .option('--auto', 'run in fully automatic mode to monitor and review MRs continuously')
  .option('--dry-run', 'generate real AI review but do not post comments to GitLab (CLI mode only)')
  .option('--mock', 'use mock AI responses for testing without API calls (CLI mode only)')
  .option('--verbose', 'detailed operation logs (CLI mode only)')
  .action(async (mrUrls, options) => {
    try {
      await checkForUpdates(packageJson.version);

      if (options.init !== undefined) {
        const { createConfigInteractively } = await import('../dist/config/configWizard.js');
        const section = typeof options.init === 'string' ? options.init : undefined;
        await createConfigInteractively(section);
        return;
      }

      if (options.listProjects) {
        const { ListProjectsCommand } = await import('../dist/cli/listProjectsCommand.js');
        await ListProjectsCommand.run();
        return;
      }

      if (options.auto) {
        const { AutoReviewCommand } = await import('../dist/cli/autoReviewCommand.js');
        const command = new AutoReviewCommand();
        await command.run();
        return;
      }

      // Dual mode logic: CLI review if MR URLs provided, UI server otherwise
      if (mrUrls && mrUrls.length > 0) {
        // CLI Review Mode - no web UI
        const { CLIReviewCommand } = await import('../dist/cli/reviewCommand.js');

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
          provider: options.provider,
          apiKey: options.apiKey,
          googleCloudProject: options.googleCloudProject,
          port: options.port,
          host: options.host,
        });
      } else {
        // UI Mode - start web server
        // Check if config exists, if not, run init wizard
        const { ConfigLoader } = await import('../dist/config/configLoader.js');
        const configLoader = new ConfigLoader();

        if (!configLoader.hasConfig()) {
          console.log('No configuration found. Running setup wizard...');
          const { createConfigInteractively } = await import('../dist/config/configWizard.js');
          await createConfigInteractively();
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

        const { startServer } = await import('../dist/server/standalone.js');
        await startServer(serverOptions);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
