# Split View Implementation Plan

## Overview
Add a split view mode for file diffs that shows the original file on the left and the new file on the right, similar to GitLab's side-by-side diff view. This will be implemented alongside the existing inline diff view.

## ✅ Implementation Completed

### 1. ✅ View Mode Toggle
- ✅ Created `ViewModeToggle.tsx` component with inline and split view icons
- ✅ Added toggle button in the FileDiffCard header
- ✅ Component state manages view mode preference
- ✅ Clean, accessible toggle with proper styling

### 2. ✅ Split View Components
- ✅ Created `SplitDiffView.tsx` - Main split view layout component
- ✅ Created `SplitDiffLine.tsx` - Individual line component for split view
- ✅ Components handle:
  - ✅ Line numbers for both original and new files
  - ✅ Different line types (added, removed, context, modified)
  - ✅ Comment anchoring functionality
  - ✅ AI feedback card positioning
  - ✅ AI explain functionality

### 3. ✅ FileDiffCard Integration
- ✅ Added view mode state management
- ✅ Conditional rendering between inline and split views
- ✅ Toggle button properly integrated in header
- ✅ All existing props and functionality maintained
- ✅ Responsive design considerations

### 4. ✅ Line Mapping and Comments
- ✅ Comment positioning works correctly in split view
- ✅ Line numbers correctly mapped between original and new files
- ✅ Handles cases for added, removed, and modified lines
- ✅ AI feedback cards appear in the correct position
- ✅ Smart line pairing algorithm for optimal display

### 5. ✅ Styling and Layout
- ✅ Clean CSS/styling for split view layout
- ✅ Responsive design implementation
- ✅ Maintains readability in split view
- ✅ Proper handling of edge cases
- ✅ Consistent theming with existing UI

### 6. ✅ Integration Points
- ✅ `FeedbackCard` component works seamlessly with split view
- ✅ `ExplanationPopup` positioning works correctly
- ✅ All existing keyboard shortcuts and interactions preserved
- ✅ Syntax highlighting functionality maintained
- ✅ Gap expansion functionality works in both views

## ✅ Technical Implementation Details

### Line Mapping Strategy (Implemented)
- Original file lines on the left, new file lines on the right
- For added lines: empty space on left, new line on right
- For removed lines: original line on left, empty space on right
- For modified lines: original on left, modified on right
- For context lines: same line on both sides
- Smart pairing algorithm groups related changes

### Comment and Feedback Positioning (Implemented)
- ✅ Comments span across both panes for maximum visibility and readability
- ✅ AI feedback cards position themselves using full width in split view
- ✅ Deduplication logic prevents duplicate feedback for context lines
- ✅ Maintains all existing comment functionality
- ✅ Consistent with inline view comment behavior

### State Management (Implemented)
- ✅ View mode preference is now global and applies to all files
- ✅ Managed at the FeedbackPanel component level instead of individual FileDiffCard level
- ✅ Safe localStorage access with fallback handling
- ✅ Preference restored on component mount and page reload
- ✅ No interference with existing functionality
- ✅ Seamless switching between view modes affects all files simultaneously
- ✅ All existing features work in both modes

## Files Created/Modified

### ✅ New Files Created:
1. ✅ `frontend/src/components/SplitDiffView.tsx` - Main split view component
2. ✅ `frontend/src/components/SplitDiffLine.tsx` - Split view line component
3. ✅ `frontend/src/components/ViewModeToggle.tsx` - View mode toggle component
4. ✅ `frontend/src/utils/viewModeStorage.ts` - localStorage utility for view mode persistence

### ✅ Modified Files:
1. ✅ `frontend/src/components/FileDiffCard.tsx` - Added view mode toggle and conditional rendering, updated to receive view mode as props
2. ✅ `frontend/src/components/FeedbackPanel.tsx` - Added global view mode state management

## ✅ Testing Results
- ✅ Build completed successfully without errors
- ✅ All TypeScript compilation passes
- ✅ All linting rules satisfied
- ✅ API server starts correctly
- ✅ Web interface loads and displays properly

## ✅ Implementation Summary

The split view feature has been successfully implemented with the following key features:

1. **Toggle Functionality**: Users can seamlessly switch between inline and split view modes using the toggle button in the file header.

2. **Persistent User Preference**: The view mode preference is saved to localStorage and restored automatically when:
   - Opening a new MR
   - Reloading the page
   - Navigating between different files
   - Starting a new session

3. **Complete Feature Parity**: All existing functionality works in both view modes:
   - AI feedback cards (now span across both panes in split view for better visibility)
   - Comment functionality 
   - AI explain feature
   - Syntax highlighting
   - Gap expansion
   - Hunk collapsing

4. **Smart Line Pairing**: The split view intelligently pairs lines to show:
   - Removed lines on the left side only
   - Added lines on the right side only
   - Modified lines on both sides
   - Context lines on both sides

5. **Responsive Design**: The layout adapts well to different screen sizes while maintaining readability.

6. **Improved Button Positioning**: In split view, action buttons (like the "+" add comment button) have better spacing and left margin for improved visual alignment.

6. **Consistent UI**: The split view maintains the same visual language and theming as the existing inline view.

7. **Safe localStorage Handling**: Includes proper error handling and fallbacks for environments where localStorage might not be available.

8. **Full-Width Comments**: In split view, comments and feedback cards span across both panes for better visibility and readability, rather than being constrained to individual columns.

9. **Improved Button Spacing**: Action buttons (add comment, AI explain) have better positioning with increased left margin for improved visual alignment in split view.

10. **Global View Mode**: The view mode setting is now global and applies to all files in the MR, rather than being per-file. When a user switches to split view, all files will display in split view.

The implementation maintains backward compatibility while adding the new split view functionality, giving users the choice between the traditional inline diff view and the new side-by-side comparison view with persistent preferences.
