# AI Code Review

🤖 AI-powered code review tool with a focus on command-line interface (CLI) usage, supporting multiple LLM providers including Gemini CLI, Google Gemini API, and Anthropic Claude. It also offers a modern web interface for interactive reviews.

[![Version](https://img.shields.io/npm/v/aicodereview-cli)](https://www.npmjs.com/package/aicodereview-cli)
[![License](https://img.shields.io/npm/l/aicodereview-cli)](https://github.com/HainanZhao/AICodeReview/blob/master/LICENSE)
[![Node.js](https://img.shields.io/node/v/aicodereview-cli)](https://nodejs.org/)

## ✨ Features

- 🤖 **Fully Automatic Code Review Mode**: Set it and forget it! Continuously monitors GitLab projects for new/updated merge requests and reviews them automatically.
- 🎯 **Manual Code Review**: Leverage AI to analyze code quality, performance, security, and best practices on-demand.
- 🚀 **CLI-First Approach**: Seamless integration into your development workflow for quick reviews.
- 📦 **Smart Project Management**: Human-readable project names with intelligent caching for faster operations.
- 🤖 **Multiple AI Providers**: Support for Gemini CLI (default), Google Gemini API, and Anthropic Claude.
- 🌐 **Modern Web Interface**: A React-based UI for interactive review management with real-time updates.
- 💡 **AI Line Explanations & Chat**: Get instant explanations and engage in direct AI conversations about any line of code in the web interface.
- ↔️ **Flexible Diff Views**: Switch between split and inline views for code differences to suit your review style.
- ⚙️ **Flexible Configuration**: Configure via CLI arguments, interactive wizard, config files, or environment variables.
- 🔍 **Enhanced GitLab Integration**: Direct merge request analysis, comment posting, and project monitoring.

## 🚀 Quick Start

### Installation

```bash
# Install globally (recommended)
npm install -g aicodereview-cli

# Or run without installing
npx aicodereview-cli

# Verify installation
aicodereview --version
```

### Review a GitLab Merge Request (CLI Mode)

The most powerful way to use `aicodereview` is directly from your terminal to review GitLab Merge Requests.

```bash
# Review a GitLab Merge Request and post comments
aicodereview https://gitlab.example.com/your-group/your-project/-/merge_requests/123

# Review with a dry run (AI review generated, but no comments posted)
aicodereview https://gitlab.example.com/your-group/your-project/-/merge_requests/123 --dry-run



# Review using a specific LLM provider and API key
aicodereview https://gitlab.example.com/your-group/your-project/-/merge_requests/123 --provider gemini --api-key YOUR_GEMINI_API_KEY
```

### Interactive Setup (Recommended for first-time users)

```bash
aicodereview --init
```
This command will guide you through setting up your configuration interactively.

### Fully Automatic Mode (🆕 v1.5.0)

**Perfect for continuous integration and unattended code review!**

The tool can now run in fully automatic mode, continuously monitoring your GitLab projects and automatically reviewing new or updated merge requests. This is ideal for:
- **Continuous Integration**: Keep code quality high with automatic reviews
- **Team Productivity**: Never miss a merge request that needs review
- **24/7 Monitoring**: Automated code review even outside working hours

#### Quick Setup:

1. **Configure automatic mode**:
   ```bash
   aicodereview --init
   ```
   - Enable "Automatic Review Mode" in the wizard
   - Select projects to monitor (you can use project names or partial matches)
   - Set review interval (recommended: 300 seconds)

2. **Start automatic monitoring**:
   ```bash
   aicodereview --auto
   ```

The tool will now:
- ✅ Monitor specified projects every 5 minutes (or your configured interval)
- 🔍 Detect new and updated merge requests automatically
- 🤖 Generate AI-powered code reviews
- 💬 Post review comments directly to GitLab
- 📝 Track review state to avoid duplicate reviews
- 🔄 Continue running until manually stopped

#### Example Configuration:
```json
{
  "autoReview": {
    "enabled": true,
    "projects": [
      "mycompany/frontend-app",
      "mycompany/backend-api", 
      "mycompany/mobile-app"
    ],
    "interval": 300
  }
}
```

### Basic Web Interface Usage

If you prefer a web-based interface, simply run:

```bash
# Start with default settings (uses Gemini CLI, opens browser automatically)
aicodereview

# Use with custom port
aicodereview --port 8080
```
The tool will:
- 🌐 Start a web interface (default: http://localhost:5960)
- 🚀 Automatically open your browser
- ⚙️ Use Gemini CLI provider by default (no API key needed)

---

## 📋 Command Reference

```bash
aicodereview [options] [merge-request-url]

Options:
  -c, --config <path>               Path to configuration file
  -p, --port <number>               Port to run the server on (default: 5960)
  --host <host>                     Host to bind the server to (default: localhost)
  --sub-path <path>                 Serve application under a subpath (e.g., /path/to)
  --provider <provider>             LLM provider: gemini-cli, gemini, anthropic (default: gemini-cli)
  --api-key <key>                   API key for the LLM provider
  --google-cloud-project <project>  Google Cloud project ID for gemini-cli
  --no-open                         Do not automatically open browser when running web interface
  --api-only                        Run server in API-only mode (no web interface)
  --init                            Create a configuration file interactively
  --auto                            🆕 Run in fully automatic mode to monitor and review MRs continuously
  --list-projects                   🆕 List all available GitLab projects for configuration
  --dry-run                         Generate AI review but do not post comments (CLI mode only)
  
  -h, --help                        Display help
  -V, --version                     Show version
```

### Subpath Deployment

For deployment scenarios where the application needs to run under a subpath (e.g., behind a reverse proxy):

```bash
# Run with subpath
aicodereview --sub-path /path/to
```

**Example testing workflow:**

1. Start AI Code Review with subpath:
   ```bash
   aicodereview --sub-path /path/to
   ```

2. Start the proxy server:
   ```bash
   node debug/quick-proxy.cjs
   ```

3. Access through proxy:
   - **Direct**: `http://localhost:5960/path/to`
   - **Proxied**: `http://localhost:3000/path/to`
   - **Health check**: `http://localhost:3000/health`

---

## 🤖 LLM Providers

`aicodereview` supports multiple Large Language Model (LLM) providers.

### Gemini CLI (Default, Recommended)

Uses your local `gemini` command installation. No API key required.

**Setup:**
1. Install Google Cloud CLI and authenticate.
2. Install the `gemini` command.
3. Set your Google Cloud project ID.

**Usage:**
```bash
aicodereview --provider gemini-cli --google-cloud-project YOUR_PROJECT_ID
```

### Google Gemini API

Uses Google's Gemini API directly.

**Usage:**
```bash
aicodereview --provider gemini --api-key YOUR_GEMINI_API_KEY
```

### Anthropic Claude

Uses Anthropic's Claude API.

**Usage:**
```bash
aicodereview --provider anthropic --api-key YOUR_ANTHROPIC_API_KEY
```

---

## ⚙️ Configuration Methods

`aicodereview` offers flexible configuration options, processed in the following order of precedence (CLI arguments > Environment Variables > Config File > Defaults):

1.  **Command Line Arguments (Highest Precedence)**
    ```bash
    aicodereview --provider gemini --api-key sk-your-key --port 8080
    ```

2.  **Environment Variables**
    ```bash
    export LLM_PROVIDER=gemini
    export LLM_API_KEY=your-api-key
    export GOOGLE_CLOUD_PROJECT=your-project-id
    aicodereview
    ```

3.  **Configuration File**
    The tool looks for configuration files in this order:
    - `./aicodereview.config.json` (current directory)
    - `~/.aicodereview/config.json` (user home directory)
    - Custom path via `--config` flag

    Example `aicodereview.config.json`:
    ```json
    {
      "server": {
        "port": 5960,
        "host": "localhost"
      },
      "llm": {
        "provider": "gemini-cli",
        "apiKey": "your-api-key-here",
        "googleCloudProject": "your-project-id"
      },
      "ui": {
        "autoOpen": true
      },
      "gitlab": {
        "url": "https://gitlab.example.com/",
        "accessToken": "your-gitlab-token"
      },
      "autoReview": {
        "enabled": true,
        "projects": [
          "mycompany/frontend-app",
          "mycompany/backend-api"
        ],
        "interval": 300
      }
    }
    ```

4.  **Interactive Configuration (`aicodereview --init`)**
    As mentioned in Quick Start, this wizard helps you create a configuration file.

---

## 🐛 Troubleshooting

### Project Configuration Issues (🆕 v1.5.0)
If you're having trouble with project selection or automatic mode:
- **Use project names instead of IDs**: The tool now uses human-readable project names (e.g., "mycompany/project" instead of "123")
- **Project not found**: Use `aicodereview --list-projects` to see all available projects
- **Partial matching**: You can use partial project names during setup (e.g., "frontend" to match "mycompany/frontend-app")
- **Cache issues**: The tool caches project information for 24 hours. Delete `~/.aicodereview/projects-cache.json` to force refresh

### Automatic Review Mode Issues
- **Reviews not triggering**: Check that your projects are correctly configured and have open merge requests
- **Duplicate reviews**: The tool tracks review state in `~/.aicodereview/review-state.json` - delete this file to reset
- **GitLab permissions**: Ensure your access token has `api` scope for posting comments

### Port Already in Use
The tool automatically finds an available port if the specified port is busy.

### API Key Issues
Make sure your API key is valid and has proper permissions for the chosen provider.

### GitLab Connection Issues
If you encounter issues connecting to GitLab or fetching merge request data:
- Ensure your GitLab instance URL is correct and accessible.
- Verify your GitLab access token is valid and has the necessary `api` and `read_api` scopes.
- You can test your GitLab connection using the `--init` command or by manually checking your token's validity in GitLab.

### Gemini CLI Issues
Ensure the `gemini` command is installed and properly configured for your Google Cloud project:
```bash
# Check if gemini command is available
gemini --version

# Set up Google Cloud project if needed
gcloud config set project YOUR_PROJECT_ID
```

### Installation Issues
```bash
# If global installation fails, try with sudo (macOS/Linux)
sudo npm install -g aicodereview-cli

# Or use npx to run without installing
npx aicodereview-cli

# Clear npm cache if needed
npm cache clean --force
```

---

## 🔧 For Developers

If you want to contribute to this project or run it from source:

### Development Setup
```bash
# Clone the repository
git clone https://github.com/HainanZhao/AICodeReview.git
cd AICodeReview
npm install

# Run in development mode (hot reload)
npm run start

# Run frontend only
npm run start:frontend

# Run backend only
npm run start:backend
```

### Building from Source
```bash
# Build the project
npm run build

# Build individual components
npm run build:src        # Build server components
npm run build:frontend   # Build web interface
npm run build:backend    # Build backend services

# Test the CLI locally
node bin/cli.js

# Create and test npm package
npm run pack:test
```

### Project Structure
```
├── bin/cli.js              # CLI entry point
├── cli/                    # CLI application code
│   ├── config/            # Configuration handling
│   ├── server/            # Express server setup
│   └── utils/             # Utility functions
├── backend/               # Backend services
│   └── services/llm/      # LLM provider implementations
├── components/            # React components
├── services/              # Frontend services
├── shared/                # Shared types and utilities
└── dist/                  # Built files
    ├── public/            # Static web assets
    └── server/            # Compiled server files
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for better code reviews**