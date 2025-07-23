# AI Code Reviewer

AI-powered code review tool with web interface supporting multiple LLM providers including Gemini CLI, Google Gemini API, and Anthropic Claude.

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g @aicodereview/cli

# Or run without installing
npx @aicodereview/cli
```

### Basic Usage

```bash
# Start with default settings (uses Gemini CLI, opens browser automatically)
aicodereview

# Use with custom port
aicodereview --port 8080

# Use different LLM provider
aicodereview --provider gemini --api-key YOUR_GEMINI_API_KEY

# Use Gemini CLI with Google Cloud project
aicodereview --provider gemini-cli --google-cloud-project YOUR_PROJECT_ID

# Interactive setup wizard
aicodereview --init
```

The tool will:
- 🌐 Start a web interface (default: http://localhost:5960)
- 🚀 Automatically open your browser
- ⚙️ Use Gemini CLI provider by default (no API key needed)

---

## 📋 Command Reference

```bash
aicodereview [options]

Options:
  -c, --config <path>               Path to configuration file
  -p, --port <number>               Port to run the server on (default: 5960)
  --host <host>                     Host to bind the server to (default: localhost)
  --provider <provider>             LLM provider: gemini-cli, gemini, anthropic (default: gemini-cli)
  --api-key <key>                   API key for the LLM provider
  --google-cloud-project <project>  Google Cloud project ID for gemini-cli
  --no-open                         Do not automatically open browser
  --init                            Create a configuration file interactively
  -h, --help                        Display help
  -V, --version                     Show version
```

---

### Configuration Methods

#### 1. Command Line Arguments (Quick & Easy)
```bash
aicodereview --provider gemini --api-key sk-your-key --port 8080
```

#### 2. Interactive Configuration (Recommended)
```bash
aicodereview --init
```
This creates a configuration file with a step-by-step wizard.

#### 3. Configuration File
The tool looks for configuration files in this order:
- `./aicodereview.config.json` (current directory)
- `~/.aicodereview/config.json` (user home directory)
- Custom path via `--config` flag

Example configuration file:
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
    "theme": "light",
    "autoOpen": true
  }
}
```

#### 4. Environment Variables
```bash
export LLM_PROVIDER=gemini
export LLM_API_KEY=your-api-key
export GOOGLE_CLOUD_PROJECT=your-project-id
export PORT=5960
aicodereview
```

## 🤖 LLM Providers

### Gemini CLI (Default, Recommended)
Uses your local `gemini` command installation. No API key required.

**Setup:**
1. Install Google Cloud CLI and authenticate
2. Install the gemini command
3. Set your Google Cloud project ID

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

## � Examples

### Quick Start Examples
```bash
# Basic usage with defaults
aicodereview

# Custom port without browser opening
aicodereview --port 8080 --no-open

# Use Gemini API
aicodereview --provider gemini --api-key sk-your-key

# Use Claude API
aicodereview --provider anthropic --api-key sk-ant-your-key

# Interactive setup (recommended for first-time users)
aicodereview --init

# Use custom configuration file
aicodereview --config /path/to/my-config.json
```

### Advanced Usage
```bash
# Run on different host and port
aicodereview --host 0.0.0.0 --port 3000

# Use Gemini CLI with specific Google Cloud project
aicodereview --provider gemini-cli --google-cloud-project my-project-123

# Disable auto-browser opening for server environments
aicodereview --no-open
```

## 🔍 Troubleshooting

### Common Issues Fixed ✅

The following ES module issues have been resolved in the latest version:
- ✅ `ERR_REQUIRE_ESM` errors when running the CLI
- ✅ Module resolution issues in global npm installations
- ✅ Development mode compatibility with ES modules
- ✅ Static file serving in production builds

### Port Already in Use
The tool automatically finds an available port if the specified port is busy.

### API Key Issues
Make sure your API key is valid and has proper permissions for the chosen provider.

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
sudo npm install -g @aicodereview/cli

# Or use npx to run without installing
npx @aicodereview/cli

# Clear npm cache if needed
npm cache clean --force
```

## 🆘 Getting Help

```bash
# Show help
aicodereview --help

# Show version
aicodereview --version

# Interactive setup wizard
aicodereview --init
```

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
├── src/                    # Server-side TypeScript
│   ├── config/            # Configuration handling
│   ├── server/            # Express server setup
│   └── utils/             # Utility functions
├── backend/               # Backend services
│   └── services/llm/      # LLM provider implementations
├── components/            # React components
├── services/              # Frontend services
└── dist/                  # Built files
    ├── public/            # Static web assets
    └── server/            # Compiled server files
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
