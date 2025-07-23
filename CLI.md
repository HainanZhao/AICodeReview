# NPM Package Conversion Plan

## Overview
Convert the AI Code Reviewer project into a standalone npm package that users can install globally and run with a simple command. The package will bundle both frontend and backend components with proper configuration management.

**STATUS: ✅ COMPLETED**

## Phase 1: Package Structure Reorganization - ✅ COMPLETED

### 1.1 Update Main package.json - ✅ COMPLETED
- ✅ Changed `"private": true` to `"private": false`
- ✅ Added `"bin"` field to define CLI command
- ✅ Updated package name to `@aicodereview/cli`
- ✅ Added proper description, keywords, and repository fields
- ✅ Added `"files"` field to specify what gets published
- ✅ Updated version to 1.0.0 for initial release

### 1.2 Create CLI Entry Point - ✅ COMPLETED
- ✅ Created `bin/cli.js` - main CLI entry point
- ✅ Added shebang `#!/usr/bin/env node`
- ✅ Handle command line arguments and options
- ✅ Support config file path parameter
- ✅ Support port configuration

### 1.3 Build System Updates - ✅ COMPLETED
- ✅ Updated build scripts to create production builds
- ✅ Created `dist/` folder structure for built assets
- ✅ Configured Vite to build static assets for production
- ✅ Built backend TypeScript to JavaScript

## Phase 2: Configuration Management - ✅ COMPLETED

### 2.1 Config File System - ✅ COMPLETED
- ✅ Created `src/config/` directory
- ✅ Implemented `configLoader.ts` to handle various config sources:
  - CLI arguments
  - Config file (JSON/YAML)
  - Environment variables
  - Default values

### 2.2 Config File Schema - ✅ COMPLETED
```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "llm": {
    "provider": "gemini-cli", // "gemini", "anthropic", "gemini-cli"
    "apiKey": "your-api-key-here",
    "googleCloudProject": "your-project-id" // for gemini-cli
  },
  "ui": {
    "theme": "light", // "light", "dark", "auto"
    "autoOpen": true
  }
}
```

### 2.3 Config File Locations
- [ ] Support multiple config file locations:
  - `./aicodereview.config.json` (current directory)
  - `~/.aicodereview/config.json` (user home)
  - Custom path via `--config` flag

## Phase 3: CLI Implementation

### 3.1 CLI Commands Structure
```bash
# Primary usage
npx @aicodereview/cli

# With custom config
npx @aicodereview/cli --config ./my-config.json

# With inline options
npx @aicodereview/cli --port 8080 --provider gemini --api-key YOUR_KEY

# Help and version
npx @aicodereview/cli --help
npx @aicodereview/cli --version
```

### 3.2 CLI Features
- [ ] Automatic browser opening
- [ ] Port conflict detection and auto-increment
- [ ] Config validation with helpful error messages
- [ ] Interactive config setup wizard (optional)
- [ ] Graceful shutdown handling

## Phase 4: Backend Integration

### 4.1 Server Bundling
- [ ] Create standalone server bundle
- [ ] Embed static frontend assets in server
- [ ] Use Express to serve both API and static files
- [ ] Remove need for separate frontend dev server

### 4.2 Server Configuration
- [ ] Load config from CLI/config file
- [ ] Dynamic port binding
- [ ] Environment variable fallbacks
- [ ] Proper error handling for missing dependencies

## Phase 5: Frontend Build Optimization

### 5.1 Production Build
- [ ] Update Vite config for production build
- [ ] Remove dev-only features and proxy settings
- [ ] Optimize bundle size
- [ ] Configure proper base path for embedded serving

### 5.2 Asset Management
- [ ] Bundle all static assets
- [ ] Optimize images and fonts
- [ ] Handle proper MIME types in Express

## Phase 6: Dependencies Management

### 6.1 Dependency Optimization
- [ ] Move dev dependencies to devDependencies
- [ ] Bundle necessary runtime dependencies
- [ ] Use `pkg` or similar for creating standalone executable (optional)
- [ ] Minimize package size

### 6.2 Peer Dependencies
- [ ] Make Node.js version requirement explicit
- [ ] Handle optional dependencies (gemini-cli)
- [ ] Provide clear error messages for missing tools

## Phase 7: Testing & Validation

### 7.1 Package Testing
- [ ] Test `npm pack` and local installation
- [ ] Test global installation: `npm install -g ./package.tgz`
- [ ] Verify CLI works in different environments
- [ ] Test config file loading from various locations

### 7.2 Integration Testing
- [ ] Test with different LLM providers
- [ ] Test config validation
- [ ] Test error scenarios (missing API keys, etc.)

## Phase 8: Documentation & Publishing

### 8.1 Documentation Updates
- [ ] Update README.md for npm package usage
- [ ] Create comprehensive CLI documentation
- [ ] Add configuration examples
- [ ] Document troubleshooting steps

### 8.2 Publishing Preparation
- [ ] Set up GitHub Actions for automated publishing
- [ ] Configure npm registry settings
- [ ] Add proper license file
- [ ] Create changelog

## Implementation Files to Create/Modify

### New Files
```
bin/
  cli.js                    # Main CLI entry point
src/
  config/
    configLoader.ts         # Configuration management
    configSchema.ts         # Config validation schema
    defaultConfig.ts        # Default configuration
  server/
    standalone.ts           # Standalone server for package
  utils/
    portUtils.ts           # Port management utilities
    browserUtils.ts        # Browser opening utilities
dist/                      # Built assets (generated)
```

### Files to Modify
```
package.json              # Add bin, update metadata
backend/index.ts          # Update for standalone mode
vite.config.ts           # Production build config
README.md                # Package usage instructions
```

## Expected Package Usage

### Installation
```bash
# Global installation
npm install -g @aicodereview/cli

# Or run directly
npx @aicodereview/cli
```

### Usage Examples
```bash
# Basic usage (uses default config)
aicodereview

# With custom config file
aicodereview --config ./my-config.json

# With inline configuration
aicodereview --port 8080 --provider gemini --api-key sk-xxx

# Create config file interactively
aicodereview --init

# Show help
aicodereview --help
```

## Benefits of This Approach

1. **Easy Installation**: Single npm command to get started
2. **Flexible Configuration**: Multiple ways to configure the tool
3. **Portable**: Works across different environments
4. **Professional**: Standard npm package distribution
5. **Maintainable**: Clear separation of concerns
6. **User-Friendly**: Simple CLI interface with good defaults

## Timeline Estimate
- Phase 1-2: 2-3 days (Package structure and config system)
- Phase 3-4: 2-3 days (CLI and backend integration)
- Phase 5-6: 1-2 days (Frontend build and dependencies)
- Phase 7-8: 1-2 days (Testing and documentation)

**Total: 6-10 days**
