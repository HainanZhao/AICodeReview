# Plan: Move postDiscussion Logic to Backend

## Problem Statement

The frontend currently imports `postDiscussion` directly from `cli/shared/services/gitlabCore.ts`, which uses Node.js's `crypto` module. This causes the error:

```
Error fetching MR details: TypeError: D1.createHash is not a function
```

The issue occurs because Node.js's `crypto` module is not available in browser environments, but the frontend bundle includes this code.

## Current Architecture Issues

1. **Browser Compatibility**: `crypto.createHash()` from Node.js doesn't exist in browsers
2. **Tight Coupling**: Frontend directly imports server-side GitLab logic
3. **Security**: GitLab tokens exposed to frontend
4. **Bundle Size**: Unnecessary Node.js code in frontend bundle

## Solution Overview

Move all GitLab API interactions to the backend by creating a new REST API endpoint `/api/post-discussion` that handles comment posting server-side.

## Implementation Plan

### Phase 1: Backend API Endpoint

#### 1.1 Add New Endpoint in `cli/server/standalone.ts`

Add the following endpoint after existing API routes:

```typescript
app.post('/api/post-discussion', async (req, res) => {
  try {
    const { gitlabConfig, mrDetails, feedbackItem } = req.body;
    
    // Validate required parameters
    if (!gitlabConfig || !mrDetails || !feedbackItem) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: gitlabConfig, mrDetails, feedbackItem' 
      });
    }
    
    // Import and use the existing postDiscussion logic
    const { postDiscussion } = await import('../shared/services/gitlabCore.js');
    
    const result = await postDiscussion(gitlabConfig, mrDetails, feedbackItem);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Failed to post discussion:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});
```

#### 1.2 Add Endpoint Documentation

Update the server startup logs to include the new endpoint:

```typescript
console.log(`   📋 Available endpoints:`);
console.log(`   • POST ${url}/api/review-mr - Unified MR review endpoint`);
console.log(`   • POST ${url}/api/config - Configuration endpoint`);
console.log(`   • POST ${url}/api/post-discussion - Post GitLab discussion endpoint`);
```

### Phase 2: Frontend Service Layer

#### 2.1 Update `frontend/src/services/gitlabService.ts`

Replace the direct import with an API-based implementation:

```typescript
// Remove postDiscussion from re-exports
export {
  fetchMrData,
  // postDiscussion, // Remove this line
  fetchProjects,
  fetchMergeRequestsForProjects,
  approveMergeRequest,
  parseDiffsToHunks,
} from '../../../cli/shared/services/gitlabCore.js';

// Add new API-based method
export const postDiscussion = async (
  gitlabConfig: any, 
  mrDetails: any, 
  feedbackItem: any
): Promise<any> => {
  const response = await fetch('/api/post-discussion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gitlabConfig,
      mrDetails,
      feedbackItem,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.result; // Return the actual result, not the wrapper
};
```

#### 2.2 Add Type Safety

Create proper TypeScript interfaces in `frontend/src/types.ts`:

```typescript
export interface PostDiscussionRequest {
  gitlabConfig: GitLabConfig;
  mrDetails: MRDetails;
  feedbackItem: FeedbackItem;
}

export interface PostDiscussionResponse {
  success: boolean;
  result?: any;
  error?: string;
}
```

### Phase 3: Error Handling & Testing

#### 3.1 Enhanced Error Handling

Add better error handling in the frontend:

```typescript
export const postDiscussion = async (
  gitlabConfig: any, 
  mrDetails: any, 
  feedbackItem: any
): Promise<any> => {
  try {
    const response = await fetch('/api/post-discussion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gitlabConfig,
        mrDetails,
        feedbackItem,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown server error');
    }
    
    return result.result;
  } catch (error) {
    // Re-throw with better context
    if (error instanceof Error) {
      throw new Error(`Failed to post discussion: ${error.message}`);
    }
    throw new Error('Failed to post discussion: Unknown error');
  }
};
```

#### 3.2 Backend Validation

Add parameter validation in the backend:

```typescript
app.post('/api/post-discussion', async (req, res) => {
  try {
    const { gitlabConfig, mrDetails, feedbackItem } = req.body;
    
    // Validate required parameters
    if (!gitlabConfig) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing gitlabConfig parameter' 
      });
    }
    
    if (!mrDetails) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing mrDetails parameter' 
      });
    }
    
    if (!feedbackItem) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing feedbackItem parameter' 
      });
    }
    
    // Validate GitLab config has required fields
    if (!gitlabConfig.baseUrl || !gitlabConfig.token) {
      return res.status(400).json({ 
        success: false, 
        error: 'GitLab config missing baseUrl or token' 
      });
    }
    
    const { postDiscussion } = await import('../shared/services/gitlabCore.js');
    const result = await postDiscussion(gitlabConfig, mrDetails, feedbackItem);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Failed to post discussion:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});
```

### Phase 4: Testing & Verification

#### 4.1 Test Backend Endpoint

Test the new endpoint directly:

```bash
curl -X POST http://localhost:3000/api/post-discussion \
  -H "Content-Type: application/json" \
  -d '{
    "gitlabConfig": {"baseUrl": "...", "token": "..."},
    "mrDetails": {...},
    "feedbackItem": {...}
  }'
```

#### 4.2 Test Frontend Integration

1. Start the server: `npm run start:api`
2. Open the frontend and try posting a comment
3. Verify the comment appears in GitLab
4. Check browser console for any remaining crypto errors

#### 4.3 Regression Testing

Ensure CLI functionality still works:

```bash
npm run build:cli
./bin/cli.js review --url="..." --auto-post
```

### Phase 5: Cleanup & Future Improvements

#### 5.1 Remove Unused Dependencies

- Check if any frontend dependencies can be removed
- Ensure the crypto utils we created are no longer needed

#### 5.2 Consider Additional GitLab Endpoints

This pattern can be extended to other GitLab operations:
- `/api/approve-mr` - Move `approveMergeRequest` to backend
- `/api/fetch-mr-data` - Move `fetchMrData` to backend
- `/api/fetch-projects` - Move `fetchProjects` to backend

#### 5.3 Add Authentication

Consider adding authentication to the API endpoints if needed:
- API key validation
- Rate limiting
- Request logging

## Benefits

1. **Browser Compatibility**: Eliminates Node.js crypto dependency in frontend
2. **Security**: GitLab tokens only handled server-side
3. **Separation of Concerns**: Frontend focuses on UI, backend handles external APIs
4. **Maintainability**: Single source of truth for GitLab API logic
5. **Future-Proof**: Easy to add caching, rate limiting, authentication
6. **Performance**: Smaller frontend bundle size

## Migration Checklist

- [ ] Implement backend `/api/post-discussion` endpoint
- [ ] Add parameter validation and error handling
- [ ] Update frontend service to use API endpoint
- [ ] Test backend endpoint independently
- [ ] Test frontend integration end-to-end
- [ ] Verify CLI functionality still works
- [ ] Update server startup logs
- [ ] Remove unused frontend crypto code
- [ ] Update documentation

## Risk Mitigation

1. **Backward Compatibility**: Keep CLI functionality unchanged
2. **Error Handling**: Ensure errors are properly propagated to frontend
3. **Testing**: Comprehensive testing of both API and frontend
4. **Rollback Plan**: Keep the old code until fully tested

## Timeline

- **Phase 1-2**: 2-3 hours (Backend endpoint + Frontend service)
- **Phase 3**: 1 hour (Error handling)
- **Phase 4**: 1-2 hours (Testing)
- **Phase 5**: 30 minutes (Cleanup)

**Total Estimated Time**: 4-6 hours
