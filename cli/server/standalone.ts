import express from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CLIOptions, ConfigLoader } from '../config/configLoader.js';
import { createConfigService } from '../shared/services/configService.js';
import { openBrowser } from '../utils/browserUtils.js';
import { findAvailablePort } from '../utils/portUtils.js';

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
  // Sanitize the sub-path
  const subPath = (config.server.subPath || '').replace(/^\/|\/$/, '');

  const app = express();
  const router = express.Router();

  // Increase body size limit to handle large merge requests (default is ~100kb)
  router.use(express.json({ limit: '50mb' }));
  router.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Set security header for Private Network Access
  router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    // Allow all origins for development/testing. In production, restrict to specific origins.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

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
  router.post('/api/config', configService.getConfigHandler());

  // Initialize LLM provider - import from local services
  try {
    console.log('\n🤖 Initializing LLM provider...');

    // Import the LLM provider factory from local services
    const { createLLMProvider } = await import('../services/llm/providerFactory.js');

    const llmProvider = await createLLMProvider(config.llm.provider, config.llm.apiKey);

    // Set up unified API route for MR URL-based reviews
    if (llmProvider.reviewMr) {
      router.post('/api/review-mr', llmProvider.reviewMr.bind(llmProvider));
    }

    router.post('/api/post-discussion', async (req, res) => {
      try {
        const { gitlabConfig, mrDetails, feedbackItem } = req.body;

        // Validate required parameters
        if (!gitlabConfig) {
          return res.status(400).json({
            success: false,
            error: 'Missing gitlabConfig parameter',
          });
        }

        if (!mrDetails) {
          return res.status(400).json({
            success: false,
            error: 'Missing mrDetails parameter',
          });
        }

        if (!feedbackItem) {
          return res.status(400).json({
            success: false,
            error: 'Missing feedbackItem parameter',
          });
        }

        // Validate GitLab config has required fields
        if (!gitlabConfig.url || !gitlabConfig.accessToken) {
          return res.status(400).json({
            success: false,
            error: 'GitLab config missing url or accessToken',
          });
        }

        // Map to the expected format for postDiscussion
        const mappedGitlabConfig = {
          url: gitlabConfig.url,
          accessToken: gitlabConfig.accessToken,
        };

        const { postDiscussion } = await import('../services/gitlabService.js');
        const result = await postDiscussion(mappedGitlabConfig, mrDetails, feedbackItem);

        res.json({ success: true, result });
      } catch (error) {
        console.error('Failed to post discussion:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Unified AI Chat endpoint
    router.post('/api/chat', async (req, res) => {
      try {
        const {
          messages,
          lineContent,
          filePath,
          lineNumber,
          fileContent,
          contextLines = 5,
        } = req.body;

        const isNewConversation = !messages || messages.length === 0;

        if (isNewConversation && !lineContent) {
          return res.status(400).json({
            success: false,
            error: 'Missing lineContent for new conversation',
          });
        }

        if (!filePath) {
          return res.status(400).json({
            success: false,
            error: 'Missing filePath parameter',
          });
        }

        const { AIProviderCore } = await import('../shared/services/aiProviderCore.js');
        let response: string;

        if (config.llm.provider === 'gemini-cli') {
          const { GeminiCliProvider } = await import('../services/llm/geminiCliProvider.js');
          const provider = new GeminiCliProvider();
          if (isNewConversation) {
            response = await provider.explainLine(
              lineContent,
              filePath,
              fileContent,
              contextLines,
              lineNumber
            );
          } else {
            response = await provider.continueChat(messages, filePath, fileContent, lineNumber);
          }
        } else if (config.llm.provider === 'gemini' && config.llm.apiKey) {
          if (isNewConversation) {
            response = await AIProviderCore.generateGeminiExplanation(
              config.llm.apiKey,
              lineContent,
              filePath,
              fileContent,
              contextLines,
              lineNumber
            );
          } else {
            response = await AIProviderCore.continueGeminiChat(
              config.llm.apiKey,
              messages,
              filePath,
              fileContent,
              lineNumber
            );
          }
        } else if (config.llm.provider === 'anthropic' && config.llm.apiKey) {
          if (isNewConversation) {
            response = await AIProviderCore.generateAnthropicExplanation(
              config.llm.apiKey,
              lineContent,
              filePath,
              fileContent,
              contextLines,
              lineNumber
            );
          } else {
            response = await AIProviderCore.continueAnthropicChat(
              config.llm.apiKey,
              messages,
              filePath,
              fileContent,
              lineNumber
            );
          }
        } else {
          return res.status(400).json({
            success: false,
            error: `Unsupported LLM provider: ${config.llm.provider} or API key missing`,
          });
        }

        res.json({
          success: true,
          explanation: response, // Keep 'explanation' for consistency with frontend parsing
        });
      } catch (error) {
        console.error('AI chat/explain error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    console.log('✅ LLM provider initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize LLM provider:', error);
    process.exit(1);
  }

  // Conditionally serve frontend based on mode
  if (!isApiOnly) {
    // Serve static files (built frontend) excluding index.html
    const distPath = join(__dirname, '..', 'public');
    router.use(
      express.static(distPath, {
        index: false, // Don't serve index.html automatically
      })
    );

    // Handle common browser requests that we expect to fail silently
    router.get('/favicon.ico', (_req: express.Request, res: express.Response) =>
      res.status(204).end()
    );
    router.get('/robots.txt', (_req: express.Request, res: express.Response) =>
      res.status(204).end()
    );
    router.get('/manifest.json', (_req: express.Request, res: express.Response) =>
      res.status(204).end()
    );

    const indexPath = join(distPath, 'index.html');
    const indexContent = readFileSync(indexPath, 'utf-8');
    let modifiedIndex = indexContent.replace(
      '</head>',
      `  <script>
    window.AICR_SUB_PATH = '${subPath}';
  </script>
</head>`
    );

    // Update asset paths to include subpath
    if (subPath) {
      modifiedIndex = modifiedIndex
        .replace(/src="\/assets\//g, `src="/${subPath}/assets/`)
        .replace(/href="\/assets\//g, `href="/${subPath}/assets/`);
    }

    // Serve index.html for all non-API routes (SPA routing)
    router.get('/', (_req: express.Request, res: express.Response) => {
      res.send(modifiedIndex);
    });

    // Handle all other non-API routes for SPA
    router.get(/^(?!\/api).*$/, (_req: express.Request, res: express.Response) => {
      res.send(modifiedIndex);
    });
  }

  app.use(`/${subPath}`, router);

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
    const baseUrl = `http://${config.server.host}:${availablePort}`;
    const url = subPath ? `${baseUrl}/${subPath}` : baseUrl;

    if (isApiOnly) {
      console.log('\n✅ AI Code Review API Server is ready!');
      console.log(`   🔗 API Base URL: ${url}`);
      console.log(`   📋 Available endpoints:`);
      console.log(`   • POST ${url}/api/review-mr - Unified MR review endpoint`);
      console.log(`   • POST ${url}/api/config - Configuration endpoint`);
      console.log(`   • POST ${url}/api/post-discussion - Post GitLab discussion endpoint`);
      console.log(`   • POST ${url}/api/chat - Unified AI chat and explain endpoint`);
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
