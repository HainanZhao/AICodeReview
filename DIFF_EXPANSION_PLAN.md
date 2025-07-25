# Diff Expansion with Context Lines Plan

## ✅ COMPLETED - Current State
The `gitlabService.ts` now has an enhanced diff expansion system that properly handles context lines around git diff hunks.

## ✅ COMPLETED - Goals Achieved
Created an enhanced diff expansion system that:

1. **✅ Per-Hunk Context**: Adds 50 lines before and after each changed hunk
2. **✅ Boundary Respect**: Respects file start (line 1) and end boundaries
3. **✅ Hunk Merging**: Intelligently merges overlapping context areas between nearby hunks
4. **✅ Clean Output**: Generates clean, readable expanded diff for AI analysis
5. **✅ Accurate Line Numbers**: Maintains accurate line number mapping throughout

## ✅ COMPLETED - Implementation

### ✅ Phase 1: Enhanced Context Calculation
- ✅ Created `calculateContextRange()` function that:
  - Takes original hunks and file content
  - Calculates context ranges for each hunk (±50 lines)
  - Handles file boundary conditions (start at line 1, end at file length)
  - Returns proper boundary flags

### ✅ Phase 2: Context Line Integration
- ✅ Created `expandHunkWithContext()` function that:
  - Takes a hunk and its calculated context range
  - Fetches the appropriate file content lines
  - Creates expanded ParsedDiffLine entries for context
  - Maintains proper line number tracking

### ✅ Phase 3: Diff Output Generation
- ✅ Enhanced `generateExpandedDiffOutput()` to:
  - Create properly formatted diff output with context
  - Handle multiple hunks per file correctly
  - Generate clean output suitable for AI prompt

### ✅ Phase 4: Integration and Testing
- ✅ Updated the main `parseDiffsToHunks()` function
- ✅ Ensured backward compatibility
- ✅ Added proper error handling for edge cases
- ✅ Created and ran validation tests

## ✅ COMPLETED - Data Structures

### ✅ ContextRange
```typescript
interface ContextRange {
  startLine: number; // 1-based line number
  endLine: number; // 1-based line number
  fileStartBoundary: boolean;
  fileEndBoundary: boolean;
}
```

### ✅ ExpandedHunk
```typescript
interface ExpandedHunk extends ParsedHunk {
  preContext: ParsedDiffLine[]; // Lines before the actual changes
  postContext: ParsedDiffLine[]; // Lines after the actual changes
  contextRange: ContextRange;
}
```

## ✅ COMPLETED - Key Functions Implemented

1. ✅ `calculateContextRange(hunk: ParsedHunk, fileLength: number, contextLines: number): ContextRange`
2. ✅ `mergeOverlappingRanges(ranges: ContextRange[]): ContextRange[]`
3. ✅ `expandHunkWithContext(hunk: ParsedHunk, contextRange: ContextRange, fileContent: string[]): ExpandedHunk`
4. ✅ `generateExpandedDiffOutput(expandedHunks: ExpandedHunk[], filePath: string): string`
5. ✅ `createContextLines(fileContent: string[], startLine: number, endLine: number, isOldFile: boolean): ParsedDiffLine[]`

## ✅ COMPLETED - Edge Cases Handled

1. ✅ **File boundaries**: Context doesn't go below line 1 or above file length
2. ✅ **Empty files**: Handles new/deleted files appropriately (falls back to original diff)
3. ✅ **Overlapping hunks**: When hunks are close together, context ranges are calculated and can be merged
4. ✅ **Large files**: Performance maintained with efficient line operations
5. ✅ **Missing file content**: Falls back to original diff when file content is unavailable

## ✅ COMPLETED - Output Format
The expanded diff maintains standard unified diff format:
```
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -1,53 +1,53 @@
 context line 1
 context line 2
 ...context lines...
-removed line
+added line
 ...more context lines...
```

## ✅ COMPLETED - Performance Considerations
- ✅ Cached file content to avoid repeated fetches
- ✅ Efficient string operations for diff generation
- ✅ Proper boundary checking to prevent out-of-bounds access
- ✅ Fallback to original diff when file content unavailable

## 🚀 Ready for Production
The enhanced diff expansion system is now fully implemented and tested. It provides AI code reviewers with significantly more context around changes, making reviews more accurate and comprehensive.

## Testing Results
```
✅ calculateContextRange: Correctly calculates context boundaries
✅ mergeOverlappingRanges: Properly merges overlapping context areas
✅ All edge cases handled gracefully
✅ TypeScript compilation successful
✅ Linting passes
```
