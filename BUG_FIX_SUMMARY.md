# Critical Bug Fix: Diff Expansion Order Issue

## 🐛 Problem Identified
The frontend was receiving basic diffs instead of expanded context because `parseDiffsToHunks()` was called **before** file contents were fetched.

## 🔍 Root Cause Analysis

### Old Flow (Broken)
```typescript
// fetchMrData() function - OLD ORDER
const fileContents = new Map();
const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs, fileContents); // ❌ Empty map!

// ... later ...
const contentPromises = diffs.map(async (diff) => {
  // Fetch file contents and populate fileContents
});
await Promise.all(contentPromises); // ❌ Too late!

return { diffForPrompt, ... }; // ❌ Returns basic diff
```

### New Flow (Fixed)
```typescript
// fetchMrData() function - NEW ORDER
const fileContents = new Map();

// First: Fetch file contents
const contentPromises = diffs.map(async (diff) => {
  // Fetch and populate fileContents
});
await Promise.all(contentPromises); // ✅ Populated!

// Then: Parse with populated content
const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs, fileContents); // ✅ Has data!

return { diffForPrompt, ... }; // ✅ Returns expanded diff
```

## 🔧 The Fix

**File:** `services/gitlabService.ts`  
**Change:** Moved `parseDiffsToHunks()` call to **after** file content fetching

```diff
  const fileContents = new Map<string, { oldContent?: string[]; newContent?: string[] }>();
- const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs, fileContents);

  // Convert existing inline discussions to feedback items
  const existingFeedback = convertDiscussionsToFeedback(discussions);
  const contentPromises = diffs.map(async (diff) => {
    // ... fetch file contents ...
    fileContents.set(diff.new_path, { oldContent, newContent });
  });
  await Promise.all(contentPromises);

+ // Parse diffs with expanded context AFTER file contents are available
+ const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs, fileContents);
```

## 📊 Impact

### Before Fix
- Frontend received basic diffs like: `@@ -52,8 +52,14 @@`
- Limited context (only immediate lines around changes)
- AI had minimal understanding of code structure

### After Fix
- Frontend receives expanded diffs with 50+ lines of context
- Full class/function context available
- AI can make more informed, accurate reviews

## ✅ Verification

- All existing tests pass ✅
- Diff expansion tests cover the integration scenarios ✅
- No breaking changes to the API ✅
- Performance impact: Minimal (same operations, different order) ✅

## 🎯 Next Steps

The enhanced diff expansion system is now fully functional and will provide AI reviewers with comprehensive context for more accurate code reviews.

**Status: FIXED ✅**
