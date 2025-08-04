# Complete Line Number Mapping for GitLab Comments

## Problem
When posting inline comments on GitLab merge requests, the API requires both `old_line` and `new_line` to be set in the position object, along with a valid `line_code`. The original issue was that for lines not directly visible in the diff (untouched parts of the file), the line mapping was incomplete, causing 400 errors when trying to post comments.

## Solution Overview
We implemented a comprehensive line number mapping system that can handle comments on any line in a file, including:
- **Lines in the diff** (added, removed, context)
- **Untouched lines** (not shown in the diff)
- **Multiple hunks** with gaps between them
- **Files with only additions or deletions**

## Implementation

### 1. Line Mapping Interface
```typescript
export interface LineMapping {
  newToOld: Map<number, number>; // Map new line numbers to old line numbers
  oldToNew: Map<number, number>; // Map old line numbers to new line numbers
}
```

### 2. Basic Line Mapping (`buildLineMapping`)
Maps only lines explicitly shown in the diff:
- **Context lines**: Exist in both old and new files
- **Added lines**: Only exist in new file (not mapped)
- **Deleted lines**: Only exist in old file (not mapped)

### 3. Complete Line Mapping (`buildCompleteLineMapping`)
Builds a full file mapping by reconstructing the entire file structure:

#### Algorithm:
1. **Start with 1:1 mapping** for lines before the first hunk
2. **Process each hunk** in chronological order:
   - Fill in untouched lines before the hunk
   - Map context lines from the hunk
   - Track position changes due to additions/deletions
3. **Fill remaining lines** after all hunks

#### Key Features:
- **Handles gaps**: Maps untouched lines between hunks
- **Tracks offset**: Accounts for line number shifts due to additions/deletions
- **File boundaries**: Uses file line counts when available
- **Multiple hunks**: Processes complex diffs with multiple change regions

### 4. GitLab Position Normalization
In `postDiscussion()`:
```typescript
// Get file line counts from file contents
const fileContent = mrDetails.fileContents.get(feedback.filePath);
const newFileLineCount = fileContent?.newContent?.length;
const oldFileLineCount = fileContent?.oldContent?.length;

// Build complete line mapping
const lineMapping = buildCompleteLineMapping(
  relevantParsedDiff,
  newFileLineCount,
  oldFileLineCount
);

// Use mapping to fill in missing old_line or new_line
if (feedback.position.new_line && !feedback.position.old_line) {
  const mappedOldLine = getOldLineFromNewLine(feedback.position.new_line, lineMapping);
  normalizedPosition.old_line = mappedOldLine ?? feedback.position.new_line;
}
```

## Test Coverage

### Basic Line Mapping Tests
- ✅ Simple diff with additions and deletions
- ✅ Multiple hunks
- ✅ Empty diff (no changes)

### Complete Line Mapping Tests
- ✅ Untouched lines before/after diff
- ✅ Files with only deletions
- ✅ Files with only additions
- ✅ Multiple hunks with gaps
- ✅ Empty diff (complete 1:1 mapping)

### Helper Function Tests
- ✅ `getOldLineFromNewLine()`
- ✅ `getNewLineFromOldLine()`

## Example Scenarios

### Scenario 1: Comment on Untouched Line
```
File has 100 lines, diff only shows lines 50-60
AI wants to comment on line 25 (not in diff)
→ Complete mapping ensures line 25 maps to line 25
→ Position gets both old_line: 25, new_line: 25
→ Comment posts successfully
```

### Scenario 2: Comment After Additions
```
Lines 10-15 have 2 new lines added
AI wants to comment on line 80 (after the changes)
→ Complete mapping accounts for +2 offset
→ Line 80 in new file maps to line 78 in old file
→ Position gets old_line: 78, new_line: 80
```

### Scenario 3: Multiple Hunks
```
Changes at lines 10-15 and 50-55
AI wants to comment on line 30 (between hunks)
→ Complete mapping fills the gap
→ Line 30 maps 1:1 since no changes affected it
→ Position gets old_line: 30, new_line: 30
```

## Benefits

1. **Complete Coverage**: Can comment on any line in any file
2. **Accurate Mapping**: Accounts for all line number shifts
3. **Robust**: Handles complex diffs with multiple hunks
4. **Efficient**: Uses existing parsed diff data
5. **Well-Tested**: Comprehensive test suite covering edge cases
6. **Debuggable**: Clear logging for position normalization

## Performance
- **O(n)** complexity where n = number of lines in hunks
- **Memory efficient**: Reuses existing parsed diff data
- **No redundant parsing**: Uses `ParsedFileDiff[]` from `mrDetails`

This solution ensures that AI code review comments can be posted on any line in any file, regardless of whether that line is visible in the GitLab merge request diff view.
