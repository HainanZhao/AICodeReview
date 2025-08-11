// Test file to verify reviewStateService functionality
// This file can be run in browser console to test localStorage persistence

import {
  clearReviewState,
  hasValidReviewState,
  loadReviewState,
  saveReviewState,
  updateReviewStateFeedback,
} from './reviewStateService';

// Mock data for testing
const mockMrDetails = {
  projectPath: 'test/project',
  mrIid: '123',
  projectId: 456,
  title: 'Test MR Title',
  authorName: 'Test Author',
  webUrl: 'https://gitlab.example.com/test/project/-/merge_requests/123',
  sourceBranch: 'feature-branch',
  targetBranch: 'main',
  base_sha: 'abc123',
  start_sha: 'def456',
  head_sha: 'ghi789',
  fileDiffs: [],
  diffForPrompt: '',
  parsedDiffs: [],
  fileContents: {},
  discussions: [],
  existingFeedback: [],
  lineMappings: {},
};

const mockFeedback = [
  {
    id: 'feedback-1',
    lineNumber: 10,
    filePath: 'src/test.js',
    severity: 'Warning',
    title: 'Test Warning',
    description: 'This is a test warning',
    lineContent: 'console.log("test");',
    position: null,
    status: 'pending',
    isEditing: false,
    isIgnored: false,
    isNewlyAdded: true,
  },
];

const testUrl = 'https://gitlab.example.com/test/project/-/merge_requests/123';

// Test functions
export const testSaveAndLoad = () => {
  console.log('Testing save and load...');

  // Clear any existing state
  clearReviewState();

  // Verify no state exists
  console.log('Has valid state (should be false):', hasValidReviewState());

  // Save state
  saveReviewState(mockMrDetails, mockFeedback, testUrl);

  // Verify state exists
  console.log('Has valid state (should be true):', hasValidReviewState());

  // Load state
  const loadedState = loadReviewState();
  console.log('Loaded state:', loadedState);

  // Verify data integrity
  const isValid =
    loadedState &&
    loadedState.mrDetails.title === mockMrDetails.title &&
    loadedState.feedback.length === mockFeedback.length &&
    loadedState.url === testUrl;

  console.log('Data integrity check:', isValid ? 'PASSED' : 'FAILED');

  return isValid;
};

export const testExpiry = () => {
  console.log('Testing state expiry...');

  // Clear any existing state
  clearReviewState();

  // Save state with modified timestamp (simulate old state)
  const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
  localStorage.setItem('ai-code-reviewer-review-state-timestamp', oldTimestamp.toString());
  localStorage.setItem(
    'ai-code-reviewer-review-state',
    JSON.stringify({
      mrDetails: mockMrDetails,
      feedback: mockFeedback,
      timestamp: oldTimestamp,
      url: testUrl,
    })
  );

  // Try to load expired state (should return null)
  const expiredState = loadReviewState();
  console.log('Expired state (should be null):', expiredState);

  // Verify state was cleared
  const hasState = hasValidReviewState();
  console.log('Has state after expiry (should be false):', hasState);

  return expiredState === null && !hasState;
};

export const testUpdateFeedback = () => {
  console.log('Testing feedback update...');

  // Start with fresh state
  clearReviewState();
  saveReviewState(mockMrDetails, mockFeedback, testUrl);

  // Add new feedback
  const updatedFeedback = [
    ...mockFeedback,
    {
      id: 'feedback-2',
      lineNumber: 20,
      filePath: 'src/test2.js',
      severity: 'Info',
      title: 'Test Info',
      description: 'This is test info',
      lineContent: 'return true;',
      position: null,
      status: 'pending',
      isEditing: false,
      isIgnored: false,
      isNewlyAdded: true,
    },
  ];

  // Update feedback
  updateReviewStateFeedback(updatedFeedback);

  // Load and verify
  const loadedState = loadReviewState();
  const isValid = loadedState && loadedState.feedback.length === 2;

  console.log('Updated feedback count:', loadedState?.feedback.length);
  console.log('Update test:', isValid ? 'PASSED' : 'FAILED');

  return isValid;
};

export const runAllTests = () => {
  console.log('=== Running Review State Service Tests ===');

  const test1 = testSaveAndLoad();
  const test2 = testExpiry();
  const test3 = testUpdateFeedback();

  const allPassed = test1 && test2 && test3;

  console.log('=== Test Results ===');
  console.log('Save/Load test:', test1 ? 'PASSED' : 'FAILED');
  console.log('Expiry test:', test2 ? 'PASSED' : 'FAILED');
  console.log('Update feedback test:', test3 ? 'PASSED' : 'FAILED');
  console.log('Overall result:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');

  // Clean up
  clearReviewState();

  return allPassed;
};

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - expose to window for manual testing
  window.reviewStateTests = {
    testSaveAndLoad,
    testExpiry,
    testUpdateFeedback,
    runAllTests,
  };

  console.log('Review state tests loaded. Run window.reviewStateTests.runAllTests() to test.');
}
