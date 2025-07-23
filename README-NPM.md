# AI Code Reviewer CLI

AI-powered code review tool with web interface. Supports multiple LLM providers including Gemini CLI, Google Gemini API, and Anthropic Claude.

## Installation

### Global Installation
```bash
npm install -g @aicodereview/cli
```

### Run Without Installation
```bash
npx @aicodereview/cli
```

## Usage

### Basic Usage
```bash
# Run with default settings
aicodereview

# Or using npx
npx @aicodereview/cli
```

### Configuration Options

#### Command Line Arguments
```bash
aicodereview --port 8080 --provider gemini --api-key YOUR_API_KEY
```

Available options:
- `--config <path>` - Path to configuration file
- `--port <number>` - Port to run the server on (default: 3000)
- `--host <host>` - Host to bind to (default: localhost)
- `--provider <provider>` - LLM provider: `gemini-cli`, `gemini`, `anthropic` (default: gemini-cli)
- `--api-key <key>` - API key for the LLM provider
- `--google-cloud-project <project>` - Google Cloud project ID for gemini-cli
- `--no-open` - Don't automatically open browser
- `--init` - Create configuration file interactively

#### Configuration File
Create a configuration file for persistent settings:

```bash
aicodereview --init
```

This creates a configuration file in JSON format. Example:

```json
{
  "server": {
    "port": 3000,
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

Configuration file locations (checked in order):
1. `./aicodereview.config.json` (current directory)
2. `~/.aicodereview/config.json` (user home directory)
3. Custom path via `--config` flag

#### Environment Variables
You can also use environment variables:
- `LLM_PROVIDER` - LLM provider
- `LLM_API_KEY` or `GEMINI_API_KEY` - API key
- `GOOGLE_CLOUD_PROJECT` - Google Cloud project ID
- `PORT` - Server port
- `HOST` - Server host

## LLM Providers

### Gemini CLI (Default, Recommended)
Uses your local `gemini` command installation. No API key required.

```bash
aicodereview --provider gemini-cli --google-cloud-project YOUR_PROJECT_ID
```

### Google Gemini API
Uses Google's Gemini API directly.

```bash
aicodereview --provider gemini --api-key YOUR_GEMINI_API_KEY
```

### Anthropic Claude
Uses Anthropic's Claude API.

```bash
aicodereview --provider anthropic --api-key YOUR_ANTHROPIC_API_KEY
```

## Examples

### Interactive Setup
```bash
aicodereview --init
```

### Quick Start with Gemini API
```bash
aicodereview --provider gemini --api-key sk-your-key-here --port 8080
```

### Using Configuration File
```bash
# First, create config
aicodereview --init

# Then run with config
aicodereview
```

### Custom Configuration File
```bash
aicodereview --config ./my-config.json
```

## Features

- 🤖 Multiple LLM provider support
- 🌐 Web-based interface
- ⚙️ Flexible configuration options  
- 🚀 Easy CLI installation and usage
- 🔧 Interactive configuration wizard
- 🎨 Theme support
- 📱 Auto-browser opening
- 🔒 Secure API key handling

## Requirements

- Node.js 16.0.0 or higher
- For Gemini CLI provider: `gemini` command installed and configured

## Troubleshooting

### Port Already in Use
The tool automatically finds an available port if the specified port is busy.

### API Key Issues
Make sure your API key is valid and has proper permissions for the chosen provider.

### Gemini CLI Issues
Ensure the `gemini` command is installed and properly configured for your Google Cloud project.

## License

MIT
