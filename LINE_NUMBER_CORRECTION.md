# Line Number Correction for Expanded Context

## Problem

When we added 50-line context expansion to diffs, the AI models started receiving expanded diffs with many more context lines. This caused two main issues:

1. **Wrong Line Numbers**: AI returns line numbers based on the expanded diff position, not the original file position
2. **Context Line Reviews**: AI sometimes reviews context lines (prefixed with space) instead of only actual changes (+ or -)

## Solution

We implemented a comprehensive line number correction system with three components:

### 1. DiffLineMapper (`diffLineMapper.ts`)

Creates a mapping between expanded diff line numbers and original file line numbers:

```typescript
// Maps each line in the expanded diff to its original file position
const mappings = DiffLineMapper.createLineMapping(expandedDiff);

// Maps AI line number back to original file
const originalLine = DiffLineMapper.mapToOriginalLineNumber(filePath, aiLineNumber, mappings);
```

**Key Features:**
- Tracks which lines are actual changes (+ or -) vs context lines (space)
- Maps expanded diff positions to original file line numbers
- Provides utilities to find nearest change lines

### 2. Enhanced Prompt (`promptBuilder.ts`)

Updated the AI prompt with:

- **Visual indicators** (🔴, ❌, ✅) to clearly distinguish rules
- **Explicit line number guidance** explaining original file vs diff positions
- **Line mapping information** showing which lines are actual changes
- **Stronger restrictions** against reviewing context lines

**Before:**
```
IMPORTANT INSTRUCTIONS:
1. ONLY review lines that are ACTUAL CHANGES...
```

**After:**
```
🔴 CRITICAL RULES - FOLLOW EXACTLY:
1. ❌ DO NOT review lines starting with ' ' (space) - these are CONTEXT LINES
2. ✅ ONLY review lines starting with '+' (added) or '-' (removed)

📍 LINE NUMBER GUIDANCE:
- Use ORIGINAL FILE line numbers, not diff line positions
- The @@ headers show original file positions
```

### 3. Response Processor (`reviewResponseProcessor.ts`)

Post-processes AI responses to correct line numbers:

```typescript
// Validates and corrects AI responses
const correctedResponse = ReviewResponseProcessor.processReviewResponse(
  aiResponse,
  expandedDiff
);
```

**Correction Logic:**
1. **Valid change line** → Keep as-is
2. **Context line reference** → Map to nearest actual change line
3. **Invalid line** → Add warning and keep with note
4. **Filter option** → Remove context line reviews entirely

### 4. Integration in LLM Providers

All three providers now use the correction system:

```typescript
// In geminiProvider.ts, anthropicProvider.ts, geminiCliProvider.ts
const correctedResponse = ReviewResponseProcessor.processReviewResponse(
  validatedResponse,
  diffForPrompt
);
```

## Usage Examples

### Basic Correction
```typescript
const response = await llmProvider.review(expandedDiff);
// Response automatically has corrected line numbers
```

### Manual Validation
```typescript
const isValid = ReviewResponseProcessor.validateLineNumber(
  'src/file.ts', 
  lineNumber, 
  lineMappings
);
```

### Statistics
```typescript
const stats = ReviewResponseProcessor.getLineNumberAccuracyStats(response, diff);
console.log(`Accuracy: ${stats.accurate}/${stats.total}`);
```

## Benefits

1. **Accurate Line Numbers**: AI comments appear on correct lines in UI
2. **No Context Reviews**: Prevents AI from reviewing unchanged code
3. **Automatic Correction**: Transparent to end users
4. **Debug Information**: Logs show when corrections are made
5. **Backward Compatible**: Works with existing API contracts

## Testing

Comprehensive test suite in `lineNumberCorrection.test.ts`:

- Line mapping accuracy
- Response correction logic  
- Context line filtering
- Accuracy statistics
- Edge case handling

## Future Improvements

1. **Model-specific tuning**: Different correction strategies per LLM
2. **Confidence scoring**: Rate accuracy of AI line number predictions
3. **Learning system**: Improve corrections based on patterns
4. **User feedback**: Allow users to report incorrect line mappings
