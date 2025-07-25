import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ConfigLoader, CLIOptions } from '../config/configLoader.js';
import { findAvailablePort } from '../utils/portUtils.js';
import { openBrowser } from '../utils/browserUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function startServer(cliOptions: CLIOptions = {}): Promise<void> {
  console.log('🚀 Starting AI Code Review...\n');

  // Load configuration
  const config = ConfigLoader.loadConfig(cliOptions);
  console.log(`📋 Configuration loaded:`);
  console.log(`   • Provider: ${config.llm.provider}`);
  console.log(`   • Host: ${config.server.host}`);

  // Find available port
  const availablePort = await findAvailablePort(config.server.port, config.server.host);
  if (availablePort !== config.server.port) {
    console.log(`   • Port: ${config.server.port} → ${availablePort} (auto-adjusted)`);
  } else {
    console.log(`   • Port: ${config.server.port}`);
  }

  const app = express();
  app.use(express.json());

  // Set up environment variables for backend compatibility
  process.env.LLM_PROVIDER = config.llm.provider;
  if (config.llm.apiKey) {
    process.env.LLM_API_KEY = config.llm.apiKey;
  }
  if (config.llm.googleCloudProject) {
    process.env.GOOGLE_CLOUD_PROJECT = config.llm.googleCloudProject;
  }

  // Initialize LLM provider - dynamically import from backend
  try {
    console.log('\n🤖 Initializing LLM provider...');

    // Import the backend module using dynamic import for ES module compatibility
    const backendPath = join(
      __dirname,
      '..',
      '..',
      'backend',
      'dist',
      'backend',
      'services',
      'llm',
      'providerFactory.js'
    );
    const { createLLMProvider } = await import(backendPath);

    const llmProvider = await createLLMProvider(config.llm.provider, config.llm.apiKey);

    // Set up API routes
    app.post('/api/review', llmProvider.reviewCode.bind(llmProvider));
    console.log('✅ LLM provider initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize LLM provider:', error);
    process.exit(1);
  }

  // Serve static files (built frontend)
  const distPath = join(__dirname, '..', 'public');
  app.use(express.static(distPath));

  // Handle common browser requests that we expect to fail silently
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.get('/robots.txt', (_req, res) => res.status(204).end());
  app.get('/manifest.json', (_req, res) => res.status(204).end());

  // Serve index.html for all non-API routes (SPA routing)
  app.get('/', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).end();
      }
    });
  });

  // Handle all other non-API routes for SPA
  app.get(/^(?!\/api).*$/, (_req, res) => {
    res.sendFile(join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).end();
      }
    });
  });

  // Global error handler to suppress common 404 errors
  app.use((err: any, req: any, res: any, next: any) => {
    // Don't log common browser 404s
    if (err.status === 404 || err.statusCode === 404) {
      res.status(404).end();
      return;
    }

    // Log other errors
    console.error('Server error:', err);
    res.status(500).end();
  });

  // Start server
  const server = app.listen(availablePort, config.server.host, async () => {
    const url = `http://${config.server.host}:${availablePort}`;

    console.log('\n✅ AI Code Review is ready!');
    console.log(`   🌐 Web interface: ${url}`);
    console.log(`   🛑 Press Ctrl+C to stop\n`);

    // Auto-open browser
    if (config.ui.autoOpen) {
      try {
        await openBrowser(url);
      } catch (error) {
        // Browser opening is optional, don't fail the server start
        console.log('Could not automatically open browser');
      }
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down AI Code Review...');
    server.close(() => {
      console.log('✅ Server stopped gracefully');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
