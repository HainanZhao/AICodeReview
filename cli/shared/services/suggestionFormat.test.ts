import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from './aiReviewCore.js';
import type { AIReviewRequest } from './aiReviewCore.js';

describe('Suggestion Format Update', () => {
  it('should include GitLab native suggestion format instructions', () => {
    const mockRequest: AIReviewRequest = {
      title: 'Test MR',
      description: 'Test description',
      sourceBranch: 'feature',
      targetBranch: 'main',
      diffContent: 'test diff',
      parsedDiffs: [],
      existingFeedback: [],
      authorName: 'Test Author',
    };

    const prompt = buildReviewPrompt(mockRequest);

    // Verify the old problematic format is removed
    expect(prompt).not.toContain('suggestion:-X+Y');
    expect(prompt).not.toContain('Where X is lines to remove and Y is lines to add');

    // Verify the new GitLab native format is present
    expect(prompt).toContain('```suggestion');
    expect(prompt).toContain('exact code that should replace the existing line(s)');
    expect(prompt).toContain('GitLab will automatically determine what to replace');
    expect(prompt).toContain(
      'Do NOT include line numbers, diff markers (+/-), or specify how many lines to remove'
    );
    expect(prompt).toContain(
      'The suggestion block should contain clean, properly formatted code ready to be applied'
    );
  });

  it('should include proper examples for single and multi-line suggestions', () => {
    const mockRequest: AIReviewRequest = {
      title: 'Test MR',
      description: 'Test description',
      sourceBranch: 'feature',
      targetBranch: 'main',
      diffContent: 'test diff',
      parsedDiffs: [],
      existingFeedback: [],
      authorName: 'Test Author',
    };

    const prompt = buildReviewPrompt(mockRequest);

    // Check for single-line example
    expect(prompt).toContain("const newCode = 'better implementation';");

    // Check for multi-line example
    expect(prompt).toContain('if (condition) {');
    expect(prompt).toContain('return processData(input);');
  });
});
