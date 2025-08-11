import express from 'express';
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

  // Find available port - but be strict about port if we're in API-only mode for frontend proxy
  let availablePort: number;
  const isStrictPort = isApiOnly && config.server.port === 5959; // Likely being used with frontend proxy
  
  if (isStrictPort) {
    // Check if exact port is available, don't auto-adjust for frontend proxy compatibility
    const isAvailable = await import('../utils/portUtils.js').then(m => 
      m.isPortAvailable(config.server.port, config.server.host)
    );
    if (!isAvailable) {
      console.error(`❌ Port ${config.server.port} is already in use and required for frontend proxy.`);
      console.log(`   Please stop other services on port ${config.server.port} or use a different port.`);
      process.exit(1);
    }
    availablePort = config.server.port;
  } else {
    // Normal auto-adjustment for standalone mode
    availablePort = await findAvailablePort(config.server.port, config.server.host);
  }
  
  if (availablePort !== config.server.port) {
    console.log(`   • Port: ${config.server.port} → ${availablePort} (auto-adjusted)`);
  } else {
    console.log(`   • Port: ${config.server.port}`);
  }

  const app = express();
  // Increase body size limit to handle large merge requests (default is ~100kb)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Set security header for Private Network Access
  app.use((req, res, next) => {
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
  app.post('/api/config', configService.getConfigHandler());

  // Initialize LLM provider - import from local services
  try {
    console.log('\n🤖 Initializing LLM provider...');

    // Import the LLM provider factory from local services
    const { createLLMProvider } = await import('../services/llm/providerFactory.js');

    const llmProvider = await createLLMProvider(config.llm.provider, config.llm.apiKey);

    // Set up unified API route for MR URL-based reviews
    if (llmProvider.reviewMr) {
      app.post('/api/review-mr', llmProvider.reviewMr.bind(llmProvider));
    }

    app.post('/api/post-discussion', async (req, res) => {
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

    // AI Explain Line endpoint (legacy, maintained for backward compatibility)
    app.post('/api/explain-line', async (req, res) => {
      try {
        const { lineContent, lineNumber, filePath, fileContent, contextLines = 5 } = req.body;

        // Validate required parameters
        if (!lineContent) {
          return res.status(400).json({
            success: false,
            error: 'Missing lineContent parameter',
          });
        }

        if (!filePath) {
          return res.status(400).json({
            success: false,
            error: 'Missing filePath parameter',
          });
        }

        // Import AI provider core for explanation
        const { AIProviderCore } = await import('../shared/services/aiProviderCore.js');

        let explanation: string;

        // Use mock provider for testing with test-key
        if (config.llm.apiKey === 'test-key') {
          const { MockLLMProvider } = await import('../services/mockLLMProvider.js');
          explanation = await MockLLMProvider.explainLine(
            lineContent,
            filePath,
            fileContent,
            contextLines,
            lineNumber
          );
        } else if (config.llm.provider === 'gemini-cli') {
          // Use the gemini-cli provider
          const { GeminiCliProvider } = await import('../services/llm/geminiCliProvider.js');
          const provider = new GeminiCliProvider();
          explanation = await provider.explainLine(
            lineContent,
            filePath,
            fileContent,
            contextLines,
            lineNumber
          );
        } else if (config.llm.provider === 'gemini' && config.llm.apiKey) {
          explanation = await AIProviderCore.generateGeminiExplanation(
            config.llm.apiKey,
            lineContent,
            filePath,
            fileContent,
            contextLines,
            lineNumber
          );
        } else if (config.llm.provider === 'anthropic' && config.llm.apiKey) {
          explanation = await AIProviderCore.generateAnthropicExplanation(
            config.llm.apiKey,
            lineContent,
            filePath,
            fileContent,
            contextLines,
            lineNumber
          );
        } else {
          return res.status(400).json({
            success: false,
            error: `Unsupported LLM provider: ${config.llm.provider} or API key missing`,
          });
        }

        res.json({
          success: true,
          explanation,
        });
      } catch (error) {
        console.error('Failed to explain line:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Import chat session store
    const { chatSessionStore } = await import('../services/chatSessionStore.js');

    // Start AI Chat Session endpoint
    app.post('/api/start-chat', async (req, res) => {
      try {
        const { lineContent, lineNumber, filePath, fileContent, contextLines = 5 } = req.body;

        // Validate required parameters
        if (!lineContent) {
          return res.status(400).json({
            success: false,
            error: 'Missing lineContent parameter',
          });
        }

        if (!filePath) {
          return res.status(400).json({
            success: false,
            error: 'Missing filePath parameter',
          });
        }

        // Create new chat session
        const sessionId = chatSessionStore.createSession(
          lineContent,
          filePath,
          lineNumber,
          fileContent,
          contextLines
        );

        // Generate initial explanation
        const { AIProviderCore } = await import('../shared/services/aiProviderCore.js');
        let explanation: string;

        // Use mock provider for testing with test-key
        if (config.llm.apiKey === 'test-key') {
          const { MockLLMProvider } = await import('../services/mockLLMProvider.js');
          explanation = await MockLLMProvider.explainLine(
            lineContent,
            filePath,
            fileContent,
            contextLines,
            lineNumber
          );
        } else if (config.llm.provider === 'gemini-cli') {
          const { GeminiCliProvider } = await import('../services/llm/geminiCliProvider.js');
          const provider = new GeminiCliProvider();
          explanation = await provider.explainLine(
            lineContent,
            filePath,
            fileContent,
            contextLines,
            lineNumber
          );
        } else if (config.llm.provider === 'gemini' && config.llm.apiKey) {
          explanation = await AIProviderCore.generateGeminiExplanation(
            config.llm.apiKey,
            lineContent,
            filePath,
            fileContent,
            contextLines,
            lineNumber
          );
        } else if (config.llm.provider === 'anthropic' && config.llm.apiKey) {
          explanation = await AIProviderCore.generateAnthropicExplanation(
            config.llm.apiKey,
            lineContent,
            filePath,
            fileContent,
            contextLines,
            lineNumber
          );
        } else {
          return res.status(400).json({
            success: false,
            error: `Unsupported LLM provider: ${config.llm.provider} or API key missing`,
          });
        }

        // Add initial explanation as assistant message
        chatSessionStore.addMessage(sessionId, 'assistant', explanation);

        res.json({
          success: true,
          sessionId,
          explanation,
          messages: chatSessionStore.getMessages(sessionId),
        });
      } catch (error) {
        console.error('Failed to start chat:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Continue AI Chat endpoint
    app.post('/api/chat', async (req, res) => {
      try {
        const { sessionId, message } = req.body;

        // Validate required parameters
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'Missing sessionId parameter',
          });
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Missing or empty message parameter',
          });
        }

        // Get session
        const session = chatSessionStore.getSession(sessionId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Chat session not found or expired',
          });
        }

        // Add user message
        chatSessionStore.addMessage(sessionId, 'user', message.trim());

        // Build conversation context for AI
        const conversationHistory = session.messages
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');

        const contextPrompt = `File: ${session.filePath}
Line: ${session.lineContent}
${session.lineNumber ? `Line number: ${session.lineNumber}` : ''}

Previous conversation:
${conversationHistory}

User's new question: ${message.trim()}

Please respond to the user's question in the context of the code line and previous conversation. Keep your response helpful and concise.`;

        // Generate AI response
        const { AIProviderCore } = await import('../shared/services/aiProviderCore.js');
        let response: string;

        // Use mock provider for testing with test-key
        if (config.llm.apiKey === 'test-key') {
          const { MockLLMProvider } = await import('../services/mockLLMProvider.js');
          response = await MockLLMProvider.generateChatResponse(
            conversationHistory,
            message.trim(),
            session.lineContent,
            session.filePath
          );
        } else if (config.llm.provider === 'gemini-cli') {
          const { GeminiCliProvider } = await import('../services/llm/geminiCliProvider.js');
          const provider = new GeminiCliProvider();
          response = await provider.explainLine(
            contextPrompt,
            session.filePath,
            session.fileContent,
            session.contextLines
          );
        } else if (config.llm.provider === 'gemini' && config.llm.apiKey) {
          response = await AIProviderCore.generateGeminiExplanation(
            config.llm.apiKey,
            contextPrompt,
            session.filePath,
            session.fileContent,
            session.contextLines
          );
        } else if (config.llm.provider === 'anthropic' && config.llm.apiKey) {
          response = await AIProviderCore.generateAnthropicExplanation(
            config.llm.apiKey,
            contextPrompt,
            session.filePath,
            session.fileContent,
            session.contextLines
          );
        } else {
          return res.status(400).json({
            success: false,
            error: `Unsupported LLM provider: ${config.llm.provider} or API key missing`,
          });
        }

        // Add AI response to session
        chatSessionStore.addMessage(sessionId, 'assistant', response);

        res.json({
          success: true,
          sessionId,
          response,
          messages: chatSessionStore.getMessages(sessionId),
        });
      } catch (error) {
        console.error('Failed to continue chat:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get Chat Messages endpoint
    app.get('/api/chat/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;

        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'Missing sessionId parameter',
          });
        }

        const session = chatSessionStore.getSession(sessionId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Chat session not found or expired',
          });
        }

        res.json({
          success: true,
          sessionId,
          messages: session.messages,
          lineContent: session.lineContent,
          filePath: session.filePath,
        });
      } catch (error) {
        console.error('Failed to get chat messages:', error);
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
      console.log(`   • POST ${url}/api/review-mr - Unified MR review endpoint`);
      console.log(`   • POST ${url}/api/config - Configuration endpoint`);
      console.log(`   • POST ${url}/api/post-discussion - Post GitLab discussion endpoint`);
      console.log(`   • POST ${url}/api/explain-line - AI explain code line endpoint (legacy)`);
      console.log(`   • POST ${url}/api/start-chat - Start AI chat session for code line`);
      console.log(`   • POST ${url}/api/chat - Continue AI chat conversation`);
      console.log(`   • GET ${url}/api/chat/:sessionId - Get chat messages`);
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
