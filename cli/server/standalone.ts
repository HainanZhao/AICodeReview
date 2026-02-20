import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { type CLIOptions, ConfigLoader } from '../config/configLoader.js';
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
  console.log('📋 Configuration loaded:');
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

  // Conditionally serve frontend based on mode
  if (!isApiOnly) {
    // Serve static files (built frontend) excluding index.html
    // Always look for frontend files in dist/public (consistent path for both dev and prod)
    const projectRoot = join(__dirname, '..', '..');
    const distPath = join(projectRoot, 'dist', 'public');
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
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // Don't log common browser 404s
      if ('status' in err && err.status === 404) {
        res.status(404).end();
        return;
      }

      // Log other errors
      console.error('Server error:', err);
      res.status(500).end();
    }
  );

  // Start server
  const server = app.listen(availablePort, config.server.host, async () => {
    const baseUrl = `http://${config.server.host}:${availablePort}`;
    const url = subPath ? `${baseUrl}/${subPath}` : baseUrl;

    if (isApiOnly) {
      console.log('\n✅ AI Code Review API Server is listening');
      console.log(`   🔗 API Base URL: ${url}`);
    } else {
      console.log('\n✅ AI Code Review Server is listening');
      console.log(`   🌐 Web interface: ${url}`);
    }

    // Initialize LLM provider in the background after server is listening
    try {
      let geminiSession: any = null;
      console.log('\n🤖 Initializing LLM provider...');

      if (config.llm.provider === 'gemini-cli') {
        const { GeminiACPSession } = await import('../services/GeminiACPSession.js');
        geminiSession = GeminiACPSession.getInstance();
        geminiSession.setBaseUrl(url);
        await geminiSession.start();
      }

      // Import the LLM provider factory from local services
      const { createLLMProvider } = await import('../services/llm/providerFactory.js');
      const llmProvider = await createLLMProvider(config.llm.provider, config.llm.apiKey);

      // Set up unified API route for MR URL-based reviews
      if (llmProvider.reviewMr) {
        router.post('/api/review-mr', llmProvider.reviewMr.bind(llmProvider));
      }

      // New endpoint to serve file content for Gemini CLI (ACP tool access)
      router.get('/api/files', async (req, res) => {
        const filePath = req.query.path as string;
        console.log(`🌐 Proxy request: Fetching file content for ${filePath}`);

        if (!filePath) {
          return res.status(400).json({ error: 'Missing path parameter' });
        }

        try {
          const { GeminiACPSession } = await import('../services/GeminiACPSession.js');
          const session = GeminiACPSession.getInstance();
          
          if (!session.mrContext) {
            return res.status(503).json({ error: 'MR context not yet initialized' });
          }

          const { projectId, headSha, gitlabConfig } = session.mrContext;
          const { fetchFileContentAsLines } = await import('../shared/services/gitlabCore.js');
          
          const lines = await fetchFileContentAsLines(
            gitlabConfig,
            projectId,
            filePath,
            headSha
          );
          
          if (lines) {
            res.set('Content-Type', 'text/plain');
            return res.send(lines.join('\n'));
          }
          
          res.status(404).json({ error: 'File not found in GitLab repository' });
        } catch (error) {
          console.error(`Failed to fetch file ${filePath} from GitLab:`, error);
          res.status(500).json({ error: 'Failed to fetch file from GitLab' });
        }
      });

      router.post('/api/post-discussion', async (req, res) => {
        try {
          const { gitlabConfig, mrDetails, feedbackItem } = req.body;

          if (!gitlabConfig || !mrDetails || !feedbackItem) {
            return res.status(400).json({ success: false, error: 'Missing parameters' });
          }

          if (!gitlabConfig.url || !gitlabConfig.accessToken) {
            return res.status(400).json({ success: false, error: 'GitLab config missing url or accessToken' });
          }

          const { postDiscussion } = await import('../services/gitlabService.js');
          const result = await postDiscussion(gitlabConfig, mrDetails, feedbackItem);

          res.json({ success: true, result });
        } catch (error) {
          console.error('Failed to post discussion:', error);
          res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });

      // Unified AI Chat endpoint
      router.post('/api/chat', async (req, res) => {
        try {
          const { messages, lineContent, filePath, lineNumber, fileContent, contextLines = 5 } = req.body;
          const isNewConversation = !messages || messages.length === 0;

          if (isNewConversation && !lineContent) {
            return res.status(400).json({ success: false, error: 'Missing lineContent for new conversation' });
          }

          if (!filePath) {
            return res.status(400).json({ success: false, error: 'Missing filePath parameter' });
          }

          const { AIProviderCore } = await import('../shared/services/aiProviderCore.js');
          let response: string;

          if (config.llm.provider === 'gemini-cli') {
            const { GeminiCliProvider } = await import('../services/llm/geminiCliProvider.js');
            const provider = new GeminiCliProvider();
            if (isNewConversation) {
              response = await provider.explainLine(lineContent, filePath, fileContent, contextLines, lineNumber);
            } else {
              response = await provider.continueChat(messages, filePath, fileContent, lineNumber);
            }
          } else if (config.llm.provider === 'gemini' && config.llm.apiKey) {
            if (isNewConversation) {
              response = await AIProviderCore.generateGeminiExplanation(config.llm.apiKey, lineContent, filePath, fileContent, contextLines, lineNumber);
            } else {
              response = await AIProviderCore.continueGeminiChat(config.llm.apiKey, messages, filePath, fileContent, lineNumber);
            }
          } else if (config.llm.provider === 'anthropic' && config.llm.apiKey) {
            if (isNewConversation) {
              response = await AIProviderCore.generateAnthropicExplanation(config.llm.apiKey, lineContent, filePath, fileContent, contextLines, lineNumber);
            } else {
              response = await AIProviderCore.continueAnthropicChat(config.llm.apiKey, messages, filePath, fileContent, lineNumber);
            }
          } else {
            return res.status(400).json({ success: false, error: `Unsupported LLM provider: ${config.llm.provider} or API key missing` });
          }

          res.json({ success: true, explanation: response });
        } catch (error) {
          console.error('AI chat/explain error:', error);
          res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });

      console.log('✅ LLM provider initialized successfully');

      if (!isApiOnly) {
        console.log('\n🚀 AI Code Review is fully ready!');
        if (config.ui.autoOpen) {
          try {
            await openBrowser(url);
          } catch {
            console.log('Could not automatically open browser');
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize LLM provider:', error);
      // We don't exit here as the server is already running and might be useful for other things (like config)
      // but the core features won't work.
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
