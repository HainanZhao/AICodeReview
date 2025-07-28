# Refactoring Plan: Unified MR Processing Logic

## Current Architecture Issues

### 1. **Duplicated Logic**
- **Frontend** (`gitlabService.ts`): Fetches MR data, processes diffs, includes file content
- **CLI** (`gitlabCore.ts`): Nearly identical logic for MR data fetching and processing
- **Result**: Two maintenance points, potential inconsistencies

### 2. **Fat Frontend**
- Frontend performs heavy business logic:
  - GitLab API calls
  - File content fetching
  - Diff parsing
  - Context building for AI prompts
- **Result**: Complex frontend, harder to test, network overhead

### 3. **Inconsistent Interfaces**
- **Frontend → Backend**: Sends processed `diffForPrompt` + metadata
- **CLI**: Uses `AIReviewRequest` interface directly
- **Result**: Different data flows, harder to maintain

## Proposed Unified Architecture

### 1. **Thin Frontend**
```
Frontend → Backend: Only MR URL + GitLab config
```
- Frontend becomes just UI + configuration management
- All business logic moves to backend/CLI layer

### 2. **Unified Backend Processing**
```
Backend: MR URL → fetchMrData → AI Review → Response
CLI:    MR URL → fetchMrData → AI Review → Post to GitLab
```
- Both paths use identical processing logic
- Single source of truth for MR data fetching and AI prompt building

### 3. **New API Interface**
```typescript
// New simplified frontend request
POST /api/review
{
  mrUrl: string;
  gitlabConfig: {
    gitlabUrl: string;
    accessToken: string;
  }
}

// Response (same as current)
ReviewFeedback[]
```

## Implementation Steps

### Phase 1: Create Unified Core Service
1. **Enhance shared `gitlabCore.ts`**:
   - Merge the two `fetchMrData` implementations
   - Create unified `processMrForReview()` function
   - Handle both frontend Config and CLI GitLabConfig types

2. **Create new `mrReviewService.ts`**:
   - Combines MR fetching + AI review logic
   - Used by both CLI and server modes
   - Returns consistent `ReviewFeedback[]`

### Phase 2: Update Backend API
1. **Modify LLM Provider Interface**:
   - Change from `reviewCode(req, res)` to `reviewMr(mrUrl, gitlabConfig)`
   - Remove Express dependencies from core logic
   - Create new API endpoint that handles MR URL input

2. **Update Server Routes**:
   - New `/api/review-mr` endpoint for MR URL input
   - Keep existing `/api/review` for backward compatibility (deprecated)

### Phase 3: Simplify Frontend
1. **Update `aiReviewService.ts`**:
   - Remove `fetchMrData` dependency
   - Send only MR URL + config to backend
   - Simplify error handling

2. **Remove Frontend GitLab Logic**:
   - Delete heavy GitLab processing from `gitlabService.ts`
   - Keep only UI-specific utility functions

### Phase 4: Update CLI
1. **Simplify CLI Logic**:
   - Use the same `mrReviewService.ts` as backend
   - Remove duplicate processing code

## File Changes Required

### New Files
- `cli/shared/services/mrReviewService.ts` - Unified MR processing + AI review
- `cli/shared/types/unifiedConfig.ts` - Type adapters for config differences

### Modified Files
- `cli/shared/services/gitlabCore.ts` - Merged and enhanced
- `cli/services/llm/types.ts` - New interface for MR URL input
- `cli/services/llm/*Provider.ts` - Simplified to use new service
- `cli/server/standalone.ts` - New route handler
- `frontend/src/services/aiReviewService.ts` - Simplified frontend logic
- `cli/cli/reviewCommand.ts` - Use unified service

### Removed Files
- `frontend/src/services/gitlabService.ts` - Logic moved to backend

## Benefits

### 1. **DRY Principle**
- Single implementation of MR fetching and processing
- Consistent behavior between CLI and web modes

### 2. **Performance**
- Reduced frontend bundle size
- Fewer network requests from frontend
- Server-side processing of heavy GitLab operations

### 3. **Maintainability**
- Single place to update GitLab API integration
- Easier testing of business logic
- Consistent error handling

### 4. **Scalability**
- Backend can implement caching of MR data
- Easier to add features like batch processing
- Better resource utilization

## Migration Strategy

1. **Backward Compatibility**: Keep existing `/api/review` endpoint during transition
2. **Feature Flag**: Add config option to use new vs old flow
3. **Gradual Migration**: Update components one by one
4. **Testing**: Ensure both flows produce identical results before removing old code

## Risk Mitigation

1. **Configuration Differences**: 
   - Create adapter functions for Frontend Config ↔ CLI GitLabConfig
   - Ensure both config types can be handled uniformly

2. **Error Handling**:
   - Maintain existing error message formats
   - Ensure frontend can still display meaningful errors

3. **Network Timeouts**:
   - Backend needs to handle long-running GitLab API calls
   - Implement proper timeout and retry logic

4. **Large MRs**:
   - Backend processing of large MRs might timeout
   - Consider streaming or chunked processing for very large changes
