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
  .version(packageJson.version);

program
  .option('-c, --config <path>', 'path to configuration file')
  .option('-p, --port <number>', 'port to run the server on', '5960')
  .option('--host <host>', 'host to bind the server to', 'localhost')
  .option('--provider <provider>', 'LLM provider (gemini-cli, gemini, anthropic)', 'gemini-cli')
  .option('--api-key <key>', 'API key for the LLM provider')
  .option('--google-cloud-project <project>', 'Google Cloud project ID for gemini-cli')
  .option('--no-open', 'do not automatically open browser')
  .option('--init', 'create a configuration file interactively')
  .action(async (options) => {
    try {
      if (options.init) {
        const { createConfigInteractively } = await import('../dist/config/configWizard.js');
        await createConfigInteractively();
        return;
      }

      const { startServer } = await import('../dist/server/standalone.js');
      await startServer(options);
    } catch (error) {
      console.error('Error starting AI Code Review:', error.message);
      process.exit(1);
    }
  });

program.parse();
