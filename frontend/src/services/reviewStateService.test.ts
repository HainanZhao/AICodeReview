import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Severity, type GitLabMRDetails, type ReviewFeedback } from '../../../types';
import {
  clearReviewState,
  hasValidReviewState,
  loadReviewState,
  saveReviewState,
  updateReviewStateFeedback,
} from './reviewStateService';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock the global localStorage
vi.stubGlobal('localStorage', mockLocalStorage);

// Mock data for testing
const mockMrDetails: GitLabMRDetails = {
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

const mockFeedback: ReviewFeedback[] = [
  {
    id: 'feedback-1',
    lineNumber: 10,
    filePath: 'src/test.js',
    severity: Severity.Warning,
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

describe('reviewStateService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('saveReviewState and loadReviewState', () => {
    test('should save and load review state correctly', () => {
      // Mock localStorage to simulate successful storage
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'ai-code-reviewer-review-state-timestamp') {
          return Date.now().toString();
        }
        if (key === 'ai-code-reviewer-review-state') {
          return JSON.stringify({
            mrDetails: mockMrDetails,
            feedback: mockFeedback,
            timestamp: Date.now(),
            url: testUrl,
          });
        }
        return null;
      });

      // Save state
      saveReviewState(mockMrDetails, mockFeedback, testUrl);

      // Verify setItem was called correctly
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ai-code-reviewer-review-state-timestamp',
        expect.any(String)
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ai-code-reviewer-review-state',
        expect.stringContaining('"title":"Test MR Title"')
      );

      // Load state
      const loadedState = loadReviewState();

      // Verify loaded state
      expect(loadedState).not.toBeNull();
      expect(loadedState?.mrDetails.title).toBe(mockMrDetails.title);
      expect(loadedState?.feedback).toHaveLength(1);
      expect(loadedState?.url).toBe(testUrl);
    });

    test('should return null when no state exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const loadedState = loadReviewState();

      expect(loadedState).toBeNull();
    });

    test('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => saveReviewState(mockMrDetails, mockFeedback, testUrl)).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('hasValidReviewState', () => {
    test('should return true when valid state exists', () => {
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'ai-code-reviewer-review-state-timestamp') {
          return Date.now().toString();
        }
        if (key === 'ai-code-reviewer-review-state') {
          return JSON.stringify({
            mrDetails: mockMrDetails,
            feedback: mockFeedback,
            timestamp: Date.now(),
            url: testUrl,
          });
        }
        return null;
      });

      expect(hasValidReviewState()).toBe(true);
    });

    test('should return false when no state exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      expect(hasValidReviewState()).toBe(false);
    });
  });

  describe('clearReviewState', () => {
    test('should remove items from localStorage', () => {
      clearReviewState();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('ai-code-reviewer-review-state');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'ai-code-reviewer-review-state-timestamp'
      );
    });

    test('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Failed to remove item');
      });

      // Should not throw
      expect(() => clearReviewState()).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('state expiry', () => {
    test('should clear expired state (older than 1 week)', () => {
      const oneWeekAgo = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago

      // Reset mocks to normal behavior for this test
      mockLocalStorage.removeItem.mockImplementation(() => {});

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'ai-code-reviewer-review-state-timestamp') {
          return oneWeekAgo.toString();
        }
        if (key === 'ai-code-reviewer-review-state') {
          return JSON.stringify({
            mrDetails: mockMrDetails,
            feedback: mockFeedback,
            timestamp: oneWeekAgo,
            url: testUrl,
          });
        }
        return null;
      });

      const loadedState = loadReviewState();

      expect(loadedState).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('ai-code-reviewer-review-state');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'ai-code-reviewer-review-state-timestamp'
      );
    });
  });

  describe('updateReviewStateFeedback', () => {
    test('should update feedback in existing state', () => {
      // Set up existing state
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'ai-code-reviewer-review-state-timestamp') {
          return Date.now().toString();
        }
        if (key === 'ai-code-reviewer-review-state') {
          return JSON.stringify({
            mrDetails: mockMrDetails,
            feedback: mockFeedback,
            timestamp: Date.now(),
            url: testUrl,
          });
        }
        return null;
      });

      const updatedFeedback: ReviewFeedback[] = [
        ...mockFeedback,
        {
          id: 'feedback-2',
          lineNumber: 20,
          filePath: 'src/test2.js',
          severity: Severity.Info,
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

      updateReviewStateFeedback(updatedFeedback);

      // Should call setItem to save updated state
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ai-code-reviewer-review-state',
        expect.stringContaining('"feedback-2"')
      );
    });

    test('should do nothing when no existing state', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const updatedFeedback: ReviewFeedback[] = [...mockFeedback];
      updateReviewStateFeedback(updatedFeedback);

      // Should not call setItem since no existing state
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
