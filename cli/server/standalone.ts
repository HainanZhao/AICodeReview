import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ConfigLoader, CLIOptions } from '../config/configLoader.js';
import { findAvailablePort } from '../utils/portUtils.js';
import { openBrowser } from '../utils/browserUtils.js';
import { createConfigService } from '../shared/services/configService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function startServer(cliOptions: CLIOptions = {}): Promise<void> {
  const isApiOnly = cliOptions.apiOnly || process.env.AI_CODEREVIEW_MODE === 'api-only';

  console.log(`🚀 Starting AI Code Review in ${isApiOnly ? 'API-only' : 'standalone'} mode...\n`);

  // Load configuration
  const config = ConfigLoader.loadConfig(cliOptions);
  console.log(`📋 Configuration loaded:`);
  console.log(`   • Provider: ${config.llm.provider}`);
  console.log(`   • Host: ${config.server.host}`);
  console.log(`   • Mode: ${isApiOnly ? 'API-only' : 'Standalone with Web UI'}`);

  // Find available port
  const availablePort = await findAvailablePort(config.server.port, config.server.host);
  if (availablePort !== config.server.port) {
    console.log(`   • Port: ${config.server.port} → ${availablePort} (auto-adjusted)`);
  } else {
    console.log(`   • Port: ${config.server.port}`);
  }

  const app = express();
  // Increase body size limit to handle large merge requests (default is ~100kb)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Set up environment variables for backend compatibility
  process.env.LLM_PROVIDER = config.llm.provider;
  if (config.llm.apiKey) {
    process.env.LLM_API_KEY = config.llm.apiKey;
  }
  if (config.llm.googleCloudProject) {
    process.env.GOOGLE_CLOUD_PROJECT = config.llm.googleCloudProject;
  }

  // Create shared configuration service for API endpoints
  const configService = createConfigService({ isStandalone: true });

  // Add GitLab configuration endpoint using shared service
  app.post('/api/config', configService.getConfigHandler());

  // Initialize LLM provider - import from local services
  try {
    console.log('\n🤖 Initializing LLM provider...');

    // Import the LLM provider factory from local services
    const { createLLMProvider } = await import('../services/llm/providerFactory.js');

    const llmProvider = await createLLMProvider(config.llm.provider, config.llm.apiKey);

    // Set up API routes
    app.post('/api/review', llmProvider.reviewCode.bind(llmProvider));
    console.log('✅ LLM provider initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize LLM provider:', error);
    process.exit(1);
  }

  // Conditionally serve frontend based on mode
  if (!isApiOnly) {
    // Serve static files (built frontend)
    const distPath = join(__dirname, '..', 'public');
    app.use(express.static(distPath));

    // Handle common browser requests that we expect to fail silently
    app.get('/favicon.ico', (_req: express.Request, res: express.Response) =>
      res.status(204).end()
    );
    app.get('/robots.txt', (_req: express.Request, res: express.Response) => res.status(204).end());
    app.get('/manifest.json', (_req: express.Request, res: express.Response) =>
      res.status(204).end()
    );

    // Serve index.html for all non-API routes (SPA routing)
    app.get('/', (_req: express.Request, res: express.Response) => {
      res.sendFile(join(distPath, 'index.html'), (err: NodeJS.ErrnoException | null) => {
        if (err) {
          res.status(404).end();
        }
      });
    });

    // Handle all other non-API routes for SPA
    app.get(/^(?!\/api).*$/, (_req: express.Request, res: express.Response) => {
      res.sendFile(join(distPath, 'index.html'), (err: NodeJS.ErrnoException | null) => {
        if (err) {
          res.status(404).end();
        }
      });
    });
  }

  // Global error handler to suppress common 404 errors
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Don't log common browser 404s
    if ('status' in err && err.status === 404) {
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

    if (isApiOnly) {
      console.log('\n✅ AI Code Review API Server is ready!');
      console.log(`   🔗 API Base URL: ${url}`);
      console.log(`   📋 Available endpoints:`);
      console.log(`   • POST ${url}/api/review - Code review endpoint`);
      console.log(`   • POST ${url}/api/config - Configuration endpoint`);
      console.log(`   🛑 Press Ctrl+C to stop\n`);
    } else {
      console.log('\n✅ AI Code Review is ready!');
      console.log(`   🌐 Web interface: ${url}`);
      console.log(`   🔗 API Base URL: ${url}`);
      console.log(`   🛑 Press Ctrl+C to stop\n`);

      // Auto-open browser only in standalone mode
      if (config.ui.autoOpen) {
        try {
          await openBrowser(url);
        } catch {
          // Browser opening is optional, don't fail the server start
          console.log('Could not automatically open browser');
        }
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

  // Remove any existing signal handlers to prevent duplicates
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');

  // Add our signal handlers
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
