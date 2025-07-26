#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

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
  .argument('[mrUrl]', 'GitLab merge request URL for CLI review mode');

program
  .option('-p, --port <number>', 'port to run the server on', '5960')
  .option('--host <host>', 'host to bind the server to', 'localhost')
  .option('--provider <provider>', 'LLM provider (gemini-cli, gemini, anthropic)', 'gemini-cli')
  .option('--api-key <key>', 'API key for the LLM provider')
  .option('--google-cloud-project <project>', 'Google Cloud project ID for gemini-cli')
  .option('--no-open', 'do not automatically open browser')
  .option('--init', 'create a configuration file interactively')
  .option('--dry-run', 'generate real AI review but do not post comments to GitLab (CLI mode only)')
  .option('--mock', 'use mock AI responses for testing without API calls (CLI mode only)')
  .option('--verbose', 'detailed operation logs (CLI mode only)')
  .action(async (mrUrl, options) => {
    try {
      if (options.init) {
        const { createConfigInteractively } = await import('../dist/config/configWizard.js');
        await createConfigInteractively();
        return;
      }

      // Dual mode logic: CLI review if MR URL provided, UI server otherwise
      if (mrUrl) {
        // CLI Review Mode - no web UI
        const { CLIReviewCommand } = await import('../dist/cli/reviewCommand.js');

        // Validate MR URL format
        if (!CLIReviewCommand.validateMrUrl(mrUrl)) {
          console.error('❌ Error: Invalid GitLab merge request URL format.');
          console.log('Expected format: https://gitlab.example.com/project/-/merge_requests/123');
          process.exit(1);
        }

        await CLIReviewCommand.executeReview({
          mrUrl,
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

        const { startServer } = await import('../dist/server/standalone.js');
        await startServer(options);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
