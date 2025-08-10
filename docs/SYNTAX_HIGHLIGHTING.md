# Syntax Highlighting Feature

This document describes the syntax highlighting feature implemented for the AI Code Review tool.

## Overview

The AI Code Review tool now includes syntax highlighting for code diffs, making it easier to read and review code changes. The syntax highlighting automatically detects the programming language based on the file extension and applies appropriate color coding.

## Supported Languages

The following programming languages are currently supported:

### Primary Languages
- **TypeScript**: `.ts`, `.tsx` files
- **JavaScript**: `.js`, `.jsx`, `.mjs`, `.cjs` files
- **Python**: `.py`, `.pyw`, `.py3` files
- **Rust**: `.rs` files
- **C/C++**: `.c`, `.cpp`, `.cc`, `.cxx`, `.c++`, `.h`, `.hpp`, `.hxx`, `.h++` files
- **HTML**: `.html`, `.htm` files
- **CSS**: `.css`, `.scss`, `.sass`, `.less` files

### Additional Languages
- **Java**: `.java` files
- **Go**: `.go` files
- **PHP**: `.php` files
- **Ruby**: `.rb` files
- **C#**: `.cs` files
- **Swift**: `.swift` files
- **Kotlin**: `.kt` files
- **Scala**: `.scala` files

### Data/Config Formats
- **JSON**: `.json` files
- **YAML**: `.yaml`, `.yml` files
- **TOML**: `.toml` files
- **INI**: `.ini`, `.cfg`, `.conf` files
- **Markdown**: `.md`, `.markdown` files

### Scripts and Shell
- **Bash**: `.sh`, `.bash` files
- **Zsh**: `.zsh` files
- **PowerShell**: `.ps1` files
- **Batch**: `.bat`, `.cmd` files

### Special Files
- **Dockerfile**: `dockerfile`, `Dockerfile` files
- **Makefile**: `makefile`, `Makefile` files
- **SQL**: `.sql` files

## How It Works

### Language Detection
The system automatically detects the programming language using the file path:

```typescript
import { detectLanguageFromPath } from './utils/languageDetection';

const language = detectLanguageFromPath('src/components/App.tsx');
// Returns: 'tsx'
```

### Syntax Highlighting Component
The `SyntaxHighlightedCode` component handles the actual syntax highlighting:

```typescript
import { SyntaxHighlightedCode } from './components/SyntaxHighlightedCode';

<SyntaxHighlightedCode
  code={codeContent}
  filePath={filePath}
  isDarkMode={isDarkMode}
  className="whitespace-pre-wrap break-words"
/>
```

### Integration with Diff View
Syntax highlighting is seamlessly integrated into the diff view through the `DiffLine` component. It preserves all existing functionality including:

- Diff line prefixes (+, -, space)
- Add/remove/context line styling
- Line numbers
- Interactive features (comments, AI explanations)

## Theme Support

The syntax highlighting automatically adapts to the current theme:

- **Light Theme**: Uses the `prism` color scheme for optimal readability
- **Dark Theme**: Uses the `oneDark` color scheme with enhanced font rendering for crisp text display

The theme is automatically detected from the document's dark mode class. Font rendering is optimized to prevent blurry text in dark mode.

## Technical Implementation

### Dependencies
- `react-syntax-highlighter`: Main syntax highlighting library
- `@types/react-syntax-highlighter`: TypeScript definitions

### Key Files
- `frontend/src/utils/languageDetection.ts`: Language detection utility
- `frontend/src/components/SyntaxHighlightedCode.tsx`: Syntax highlighting component
- `frontend/src/components/DiffLine.tsx`: Updated to use syntax highlighting

### Testing
Comprehensive tests are included for language detection:
- File extension mapping
- Special file detection (Dockerfile, Makefile)
- Case-insensitive detection
- Fallback behavior for unsupported files

## Usage Examples

### TypeScript Code
```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

const createUser = (data: Partial<User>): User => {
  return {
    id: Date.now(),
    name: data.name || 'Anonymous',
    ...data
  };
};
```

### Python Code
```python
def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

class DataProcessor:
    def __init__(self, data: list):
        self.data = data
    
    def process(self) -> dict:
        return {"processed": True, "count": len(self.data)}
```

### Rust Code
```rust
use std::collections::HashMap;

#[derive(Debug)]
struct User {
    id: u32,
    name: String,
    email: Option<String>,
}

impl User {
    fn new(id: u32, name: String) -> Self {
        Self { id, name, email: None }
    }
}
```

## Performance Considerations

- Language detection is lightweight and uses simple string operations
- Syntax highlighting is applied only to visible code
- Graceful fallback to plain text for unsupported languages
- Bundle size impact is minimal due to dynamic imports

## Future Enhancements

Potential improvements for future versions:

1. **Additional Languages**: Support for more programming languages
2. **Custom Themes**: User-customizable color schemes
3. **Line-by-Line Highlighting**: Syntax highlighting for individual diff lines
4. **Performance Optimization**: Virtual scrolling for large files
5. **Language Hints**: Manual language selection for ambiguous files

## Troubleshooting

### Language Not Detected
If syntax highlighting doesn't appear for a supported language:
1. Check the file extension is supported
2. Verify the file path is correct
3. Ensure the language is in the extension mapping

### Performance Issues
If syntax highlighting causes performance problems:
1. Check if the file is very large
2. Consider disabling highlighting for large files
3. Report the issue for optimization

### Theme Issues
If colors don't look right:
1. Verify the theme detection is working
2. Check if custom CSS is interfering
3. Try toggling the theme manually

### Font Rendering Issues
If text appears blurry or has shadows in dark mode:
1. The system automatically applies font-smoothing optimizations
2. Text shadows are disabled for all syntax highlighting tokens
3. If issues persist, check browser font rendering settings
4. Try refreshing the page to ensure CSS changes are applied