# Review State Persistence

This feature enhances the user experience by automatically saving and restoring the code review state when the page is refreshed.

## Features

### 1. Automatic State Saving
- **When**: State is saved whenever a review is loaded or feedback is modified
- **What**: Saves MR details, all feedback (AI + manual), and the MR URL
- **Where**: Local storage with key `ai-code-reviewer-review-state`

### 2. Automatic State Restoration
- **When**: On page load, if a valid saved state exists
- **Process**: 
  1. Checks if saved state exists and is not expired
  2. Restores MR details and feedback immediately
  3. Optionally refreshes MR details in background to get latest GitLab comments
  4. Shows notification to user that state was restored

### 3. State Expiry
- **Duration**: 1 week (7 days)
- **Behavior**: Old states are automatically discarded to avoid stale data
- **Cleanup**: Expired states are removed from localStorage

### 4. Manual Comments Preservation
- **AI Comments**: Distinguished from manual comments using `isExisting` flag
- **User Comments**: All manually added comments are preserved across sessions
- **Editing State**: In-progress edits are maintained

## Implementation Details

### Core Service: `reviewStateService.ts`

```typescript
interface ReviewState {
  mrDetails: GitLabMRDetails;
  feedback: ReviewFeedback[];
  timestamp: number;
  url: string;
}
```

### Key Functions:
- `saveReviewState()`: Saves current review state to localStorage
- `loadReviewState()`: Loads and validates saved state (handles expiry)
- `clearReviewState()`: Removes saved state
- `updateReviewStateFeedback()`: Updates only feedback portion of saved state
- `hasValidReviewState()`: Checks if valid state exists

### Integration Points:

1. **App Component**: 
   - New useEffect hook for state restoration on app load
   - Notification system for user feedback
   - All feedback modification handlers updated to persist changes

2. **Feedback Handlers**: All feedback modification functions now update localStorage:
   - `handleSetEditing()`
   - `handleDeleteFeedback()`
   - `handleUpdateFeedback()`
   - `handleToggleIgnoreFeedback()`
   - `handleAddCustomFeedback()`

3. **Review Flow**: 
   - `handleReviewRequest()`: Saves state when review is loaded
   - `handleNewReview()`: Clears state when starting new review
   - `handleRedoReview()`: Updates state with new AI feedback

## User Experience

### First Time Review
1. User enters MR URL and starts review
2. State is automatically saved as review loads
3. User can add manual comments, edit AI suggestions
4. All changes are persisted automatically

### Page Refresh
1. Page loads and detects saved state
2. Previous review is immediately restored
3. User sees notification: "Review state restored from previous session"
4. Background refresh updates GitLab comments while preserving manual work
5. User can continue where they left off seamlessly

### State Management
- **New Review**: Automatically clears previous state
- **Expired State**: Automatically discarded (older than 1 week)
- **Invalid State**: Gracefully handled with fallback to clean state

## Benefits

1. **Improved UX**: No loss of work on accidental page refresh
2. **Productivity**: Continue review sessions across browser restarts
3. **Data Safety**: Manual comments and edits are preserved
4. **Performance**: Instant restoration of previous state
5. **Reliability**: Automatic cleanup of stale data

## Technical Considerations

- **Storage Size**: State includes full MR details and feedback arrays
- **Privacy**: Data stored locally only, never sent to external servers
- **Performance**: Minimal impact - localStorage operations are synchronous but fast
- **Compatibility**: Works in all modern browsers with localStorage support
- **Error Handling**: Graceful degradation if localStorage is unavailable

## Future Enhancements

- Multiple review sessions (save multiple MRs)
- Sync state across browser tabs
- Export/import review state
- Review session analytics
