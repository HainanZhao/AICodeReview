# Build System Improvements

## Overview

The build system has been improved to properly handle the shared workspace dependency and provide a better development experience.

## Key Improvements

### 1. **Proper Build Order**
- **Before**: `build:src` would fail because `aicodereview-shared` wasn't built
- **After**: `build:shared` runs first, ensuring dependencies are available

### 2. **Automatic Installation**
- **`postinstall`**: Automatically builds the shared module after `npm install`
- **Dependencies**: Properly configured workspace dependencies

### 3. **Comprehensive Clean Scripts**
- **`clean`**: Cleans all build artifacts across all modules
- **Individual clean scripts**: `clean:shared`, `clean:src`, `clean:frontend`, `clean:backend`

### 4. **Development Workflow**
- **`dev`**: Builds shared module and starts all development servers
- **`dev:shared`**: Watches for changes in shared module

## Available Scripts

### Production Build
```bash
npm run build          # Full production build (includes prebuild clean)
npm run build:shared   # Build shared module only
npm run build:src      # Build CLI source only
npm run build:frontend # Build React frontend only
npm run build:backend  # Build Express backend only
```

### Development
```bash
npm run dev            # Start all development servers with shared module watching
npm start              # Start frontend and backend (requires shared to be built)
npm run dev:shared     # Watch shared module for changes
```

### Maintenance
```bash
npm run clean          # Clean all build artifacts
npm run clean:shared   # Clean shared module dist
npm run clean:src      # Clean CLI dist
npm run clean:frontend # Clean frontend dist
npm run clean:backend  # Clean backend dist
```

### Testing & Linting
```bash
npm test               # Run tests
npm run lint           # Lint all files
npm run lint:fix       # Fix linting issues
```

### Publishing
```bash
npm run pack:test      # Create package and install globally for testing
npm run prepublishOnly # Runs automatically before publishing
```

## Build Process Flow

```
1. npm install
   └── postinstall → build:shared

2. npm run build
   └── prebuild → clean → clean:shared + clean:src + clean:frontend + clean:backend
   └── build → build:shared → build:src → build:frontend → build:backend

3. npm run dev
   └── build:shared → dev:shared (watch) + start:frontend + start:backend
```

## Workspace Structure

```
project/
├── package.json           # Main package with workspace configuration
├── shared/                # Shared types and utilities
│   ├── package.json       # aicodereview-shared
│   ├── cli/              # CLI source files
│   └── dist/             # Built files (generated)
├── backend/              # Express server
│   ├── package.json      # Backend dependencies
│   └── dist/             # Built files (generated)
├── cli/                  # CLI source
└── dist/                 # CLI built files (generated)
```

## Package Dependencies

### Main Package
- Uses workspace dependency: `"aicodereview-shared": "workspace:*"`
- Includes shared dist in published files

### Backend Package
- Uses local file dependency: `"aicodereview-shared": "file:../shared"`
- Ensures TypeScript can resolve types properly

### Shared Package
- No external dependencies
- Exports built types and JavaScript

## Installation Process

### Fresh Install
1. `npm install` downloads all dependencies
2. `postinstall` runs `build:shared` automatically
3. Ready for development or production build

### Clean Development Setup
```bash
git clone <repo>
cd <repo>
npm install        # Automatically builds shared module
npm run dev        # Start development with file watching
```

### Production Build
```bash
npm run build      # Full clean build of all modules
npm start          # Start production servers
```

## Benefits

### ✅ **Reliability**
- Build order ensures dependencies are always available
- Clean scripts prevent stale build artifacts
- Postinstall ensures shared module is ready after installation

### ✅ **Developer Experience**
- Single `npm run dev` command starts everything
- Automatic rebuilding of shared module during development
- Clear separation of concerns between modules

### ✅ **Maintainability**
- Individual build/clean scripts for debugging
- Consistent workspace dependency management
- Proper TypeScript resolution across modules

### ✅ **CI/CD Ready**
- `npm run build` works reliably in any environment
- `npm install` prepares the environment automatically
- All artifacts included in published package

## Troubleshooting

### "Cannot find module 'aicodereview-shared'"
```bash
npm run build:shared  # Build the shared module
# or
npm install           # Rebuilds shared via postinstall
```

### Stale build artifacts
```bash
npm run clean         # Clean everything
npm run build         # Fresh build
```

### Development not updating
```bash
npm run dev           # Includes shared module watching
# or manually restart if needed
```
