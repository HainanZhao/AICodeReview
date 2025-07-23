import { createInterface } from 'readline';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { AppConfig } from './configSchema.js';

export async function createConfigInteractively(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
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
    const port = await question('Port (3000): ') || '3000';
    const host = await question('Host (localhost): ') || 'localhost';

    // LLM provider configuration
    console.log('\n🤖 LLM Provider Configuration:');
    console.log('Available providers:');
    console.log('  1. gemini-cli (uses local gemini command, recommended)');
    console.log('  2. gemini (Google Gemini API)');
    console.log('  3. anthropic (Claude API)');
    
    const providerChoice = await question('Choose provider (1-3, default: 1): ') || '1';
    
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
        googleCloudProject = await question('Google Cloud Project ID (optional): ') || undefined;
        break;
    }

    // UI configuration
    console.log('\n🎨 UI Configuration:');
    const theme = await question('Theme (light/dark/auto, default: light): ') || 'light';
    const autoOpenInput = await question('Auto-open browser? (y/N): ') || 'y';
    const autoOpen = autoOpenInput.toLowerCase() === 'y' || autoOpenInput.toLowerCase() === 'yes';

    // Create config object
    const config: AppConfig = {
      server: {
        port: parseInt(port, 10),
        host
      },
      llm: {
        provider: provider as any,
        ...(apiKey && { apiKey }),
        ...(googleCloudProject && { googleCloudProject })
      },
      ui: {
        theme: theme as any,
        autoOpen
      }
    };

    // Ask where to save
    console.log('\n💾 Save Configuration:');
    console.log('1. Current directory (./aicodereview.config.json)');
    console.log('2. User home directory (~/.aicodereview/config.json)');
    
    const saveChoice = await question('Where to save? (1-2, default: 1): ') || '1';
    
    let configPath: string;
    if (saveChoice === '2') {
      const homeConfigDir = join(homedir(), '.aicodereview');
      if (!existsSync(homeConfigDir)) {
        mkdirSync(homeConfigDir, { recursive: true });
      }
      configPath = join(homeConfigDir, 'config.json');
    } else {
      configPath = join(process.cwd(), 'aicodereview.config.json');
    }

    // Write config file
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(`\n✅ Configuration saved to: ${configPath}`);
    console.log('\n🚀 You can now run: aicodereview');
    
  } finally {
    rl.close();
  }
}
