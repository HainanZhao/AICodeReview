# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2025-07-27

### Changed
- Simplified README.md, promoting CLI usage and moving relevant sections to the forefront.
- Removed `--verbose` and `--mock` mode documentation from README.md.

## [1.1.3] - 2025-07-26

### Fixed
- Fixed Windows compatibility for Gemini CLI provider
- Updated command availability check to use `where` on Windows instead of `command -v`
- Added `shell: true` option for Windows npm global command execution
- Resolved "gemini command is not installed" error on Windows systems with proper npm global installation

### Technical Changes
- Enhanced `GeminiCliProvider.isAvailable()` with cross-platform command detection
- Improved `executeGeminiWithStdin()` method to properly handle Windows npm global binaries
- Added proper Windows shell execution support for spawn operations

## [1.1.1] - 2025-07-26

### Fixed
- Fixed PayloadTooLargeError by increasing request body size limit from 100KB to 50MB in standalone server
- Resolved issue where large merge requests (>100KB) would fail with "request entity too large" error

### Technical Changes
- Updated `cli/server/standalone.ts` to include proper Express JSON and URL-encoded body size limits
- Added consistent 50MB payload limits across both backend and standalone servers

## [1.1.0] - 2025-07-26

### Added
- Enhanced CLI functionality with improved configuration management
- Support for multiple LLM providers (Gemini CLI, Gemini API, Anthropic Claude)
- Interactive configuration wizard for first-time setup
- Automatic configuration detection and initialization

### Improved
- Better error handling and user feedback
- Enhanced server startup process with configuration validation
- Improved port management with auto-detection of available ports

## [1.0.2] - 2025-07-26

### Fixed
- Various bug fixes and stability improvements
- Enhanced error handling for configuration issues

## [1.0.1] - 2025-07-26

### Fixed
- Initial bug fixes and improvements
- Package distribution optimizations

## [1.0.0] - 2025-07-26

### Added
- Initial release of AI Code Review CLI tool
- Web-based interface for code review
- Integration with multiple AI providers:
  - Google Gemini (CLI and API)
  - Anthropic Claude
- Support for GitLab merge request analysis
- Real-time code review with AI-powered suggestions
- File tree navigation and diff visualization
- Configurable review parameters
- Modern React-based web interface

### Features
- **CLI Tool**: Easy-to-use command-line interface
- **Web Interface**: Intuitive web-based code review interface
- **Multi-Provider Support**: Choose between different AI providers
- **GitLab Integration**: Seamless integration with GitLab merge requests
- **Code Analysis**: Comprehensive code review with suggestions
- **Responsive Design**: Works on desktop and mobile devices
- **Configuration Management**: Flexible configuration options

### Technical Details
- Built with TypeScript and React
- Express.js backend server
- Vite for fast development and building
- ESLint and Prettier for code quality
- Comprehensive test suite with Vitest
- Node.js 16+ compatibility
- MIT License

---

## Release Notes

### Installation
```bash
npm install -g aicodereview-cli
```

### Usage
```bash
aicodereview
```

### Configuration
The tool supports interactive configuration setup on first run, or you can use the `--init` flag to reconfigure at any time.

### Supported Providers
- **Gemini CLI**: Uses Google Cloud CLI authentication
- **Gemini API**: Direct API access with API key
- **Anthropic**: Claude API with API key

For more information, see the [README.md](./README.md) file.