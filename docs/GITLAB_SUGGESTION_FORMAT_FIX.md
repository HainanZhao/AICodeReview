# GitLab Suggestion Format Fix

## Problem
The AI code review agent was using a custom suggestion format that caused issues when users clicked "Apply suggestion" in GitLab merge requests. The original format:

```
```suggestion:-X+Y
actual code changes here
```
```

This format instructed the AI to specify how many lines to remove (`X`) and add (`Y`), which often resulted in over-deletion of code when applied in GitLab.

## Solution
Updated the prompt to use GitLab's native suggestion format:

```
```suggestion
exact code that should replace the existing line(s)
```
```

## Key Changes
1. **Removed problematic `-X+Y` format** that was causing over-deletion
2. **Adopted GitLab's native suggestion format** that automatically determines what to replace
3. **Added clear instructions** about suggestion content being clean, ready-to-apply code
4. **Provided better examples** for single-line and multi-line replacements
5. **Emphasized avoiding line numbers, diff markers, and deletion counts**

## Benefits
- No more over-deletion when applying suggestions in GitLab
- Suggestions work seamlessly with GitLab's "Apply suggestion" feature
- Cleaner, more precise code replacements
- Better user experience for merge request reviewers

## Files Modified
- `cli/shared/services/aiReviewCore.ts` - Updated the prompt template
- `cli/shared/services/suggestionFormat.test.ts` - Added tests to verify the changes