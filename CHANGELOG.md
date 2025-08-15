# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-08-15

### Added
- **Fully Automatic Code Review Mode**: Revolutionary new feature that enables continuous, unattended code review
  - Automatically monitors specified GitLab projects for new and updated merge requests
  - Configurable review intervals with intelligent state tracking
  - Prevents duplicate reviews by tracking last reviewed commit SHAs
  - Interactive setup wizard for easy configuration of automatic mode
  - New `--auto` CLI flag to start automatic review mode
  - Comprehensive state management system with `.aicodereview_state.json`

- **Enhanced Project Management System**: Complete overhaul of project handling for better usability
  - **Project Cache Service**: New intelligent caching system with 24-hour automatic refresh
  - **Normalized Project Names**: Clean project names without extra spaces (e.g., "group/project" instead of "group / project")
  - **Smart Project Resolution**: Supports both normalized and original GitLab project name formats
  - **Efficient API Usage**: Cache-first approach reduces GitLab API calls significantly
  - **Backward Compatibility**: Seamless handling of existing configurations

- **Configuration Migration Service**: Automatic handling of configuration schema updates
  - Intelligent migration from project IDs to project names
  - Preserves existing configurations while upgrading functionality
  - Automatic detection and conversion of legacy configuration formats

### Enhanced
- **Project Selection Experience**: Dramatically improved project configuration workflow
  - Users can now use readable project names instead of cryptic project IDs
  - Partial name matching for easier project discovery
  - Enhanced project search and filtering capabilities
  - Better project display with normalized, readable names

- **GitLab Integration**: Strengthened GitLab service capabilities
  - New `fetchOpenMergeRequests()` function for automatic review mode
  - Improved project fetching with enhanced caching
  - Better error handling and connection management
  - Enhanced merge request filtering (open, non-draft only)

- **Configuration Schema**: Updated to support new automatic review features
  - New `autoReview` configuration section with projects, interval, and enabled flags
  - Changed project storage from numeric IDs to human-readable names
  - Enhanced validation and type safety for new configuration options

### Technical Improvements
- **State Management**: Robust state persistence system for automatic review mode
- **Error Handling**: Enhanced error handling throughout the automatic review pipeline
- **Performance**: Optimized project lookup and caching for faster operation
- **Code Quality**: Improved TypeScript types and interfaces for better maintainability

### Configuration Changes
- Project configuration now uses names instead of IDs in the `autoReview.projects` array
- Added new `autoReview` section to configuration schema
- Automatic migration of existing configurations with project IDs to project names
- Enhanced configuration wizard with automatic review setup

## [1.4.5] - 2025-08-15

### Enhanced
- **Improved AI Review Intelligence**: Enhanced AI review prompt system to avoid duplicate comments and prioritize actionable code suggestions
  - AI now checks existing comments and discussions to avoid repetition
  - Prioritizes providing concrete code suggestions over general comments
  - Added support for suggestion format: `\`\`\`suggestion:-X+Y` for specific code changes
  - Improved review quality by focusing on unique, actionable feedback

### Fixed
- **AI Chat Timeout Issues**: Resolved timeout problems in AI chat interface for better user experience
- **UI Improvements**: Removed redundant +/- signs from diff UI components for cleaner visual presentation
  - Cleaned up `DiffLine` and `SplitDiffLine` components
  - Improved diff visualization readability

## [1.4.4] - 2025-08-14

### Fixed
- **Review State Storage**: Changed review state persistence from localStorage to sessionStorage for improved privacy
  - Review state now automatically clears when browser tab closes
  - Better data privacy as state is session-scoped only
  - Added automatic cleanup of legacy localStorage review data
  - Maintains same functionality for recovering work within browser session

### Technical Changes
- Updated `reviewStateService.ts` to use sessionStorage instead of localStorage
- Updated all related tests to reflect sessionStorage usage
- Enhanced documentation to clarify session-based storage behavior

## [1.4.3] - 2025-08-14

### Added
- **Dynamic App Theming**: Revolutionary theming system that makes the entire application interface match the selected code syntax highlighting theme
  - Added comprehensive color extraction system for 13+ popular syntax themes (VS Code Dark+, Dracula, Night Owl, One Dark, etc.)
  - Real-time CSS custom property updates for seamless theme transitions
  - Theme-aware UI components with consistent color schemes across the entire application
  - "Theme:" label added to syntax theme dropdown for better user experience

### Enhanced
- **Improved Theme Integration**: The app now dynamically adapts its background, surfaces, text colors, and accents to match syntax highlighting themes
- **Simplified Configuration**: Removed legacy light/dark theme selection from CLI setup wizard, focusing on the advanced dynamic theming system
- **Better User Experience**: Theme dropdown now includes a clear label for improved usability

### Removed
- **Legacy Theme System**: Removed outdated light/dark theme toggle functionality
  - Removed theme configuration from CLI setup wizard (`--init`)
  - Removed theme-related configuration schema and default values
  - Removed manual theme localStorage persistence in favor of syntax-theme-based theming
  - Cleaned up legacy theme initialization scripts

### Technical Changes
- Added `THEME_COLOR_CONFIGS` with comprehensive color schemes for popular syntax themes
- Implemented `getThemeColors()` and `applyThemeColors()` functions for dynamic theme application
- Enhanced CSS custom properties system with `--app-*` variables for real-time theming
- Simplified theme change handlers to focus purely on syntax-theme-driven color updates
- Updated UI configuration schema to remove theme-related properties
- Removed `saveTheme()` and `loadTheme()` functions from config service


## [1.4.2] - 2025-08-13

### Fixed
- Fixed notification popup timer and auto-disappear functionality for historical review restoration
- Fixed approve button and MR approval status update in UI
- Fixed subpath configuration and related environment variable handling
- Fixed various UI and configuration issues

### Added
- Added GitHub Actions workflow for automated releases
- Added revoke function for improved access control

### Changed
- Improved release automation and CI/CD process

## [1.4.0] - 2025-08-11

### Added
- Enhanced AI explanation to a chat interface for more interactive code review
- Added support for running the application on a subpath

### Fixed
- Addressed hydration error and API 404 for chat feature
- Fixed lint and cosmetic issues
- Updated README and example config

## [1.3.0] - 2025-08-10

### Added
- Implemented syntax highlighting for code diffs
- Improved light and dark mode syntax highlighting contrast
- Added feature to save and restore review state

### Fixed
- Fixed inline/split icon position and style issues
- Fixed switch mode and review cleanup issues

## [1.2.0] - 2025-08-06

### Added
- **AI Line Explanations**: New interactive feature in the web interface that provides instant AI-powered explanations for any line of code
  - Hover over any line in the diff view to get contextual explanations
  - Smart detection of functions, code blocks, and single lines with appropriate explanation styles
  - Context-aware analysis using surrounding code for more accurate explanations
  - Diff-aware handling that correctly uses old file content for deleted lines and new file content for added lines
  - Works with all supported LLM providers (Gemini CLI, Gemini API, Anthropic Claude)

### Enhanced
- Updated web interface with improved user experience for code exploration
- Enhanced AI provider core with specialized explanation prompts
- Improved diff visualization with interactive explanation capabilities

### Technical Changes
- Added `explainLine` functionality to AI review service
- Enhanced `DiffLine` component with hover-based explanation triggers
- Updated `AIProviderCore` with dedicated explanation methods for different AI providers
- Improved prompt engineering for better code explanation quality

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