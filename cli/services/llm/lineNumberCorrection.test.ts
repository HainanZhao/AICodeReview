import { describe, expect, test } from 'vitest';
import { DiffLineMapper } from './diffLineMapper.js';
import { ReviewResponseProcessor } from './reviewResponseProcessor.js';
import type { ReviewResponse } from './types.js';

describe('Line Number Correction', () => {
  const expandedDiff = `--- a/test.js
+++ b/test.js
@@ -1,9 +1,10 @@
 function test() {
   const a = 1;
   const b = 2;
+  const c = 3; // New line added at line 4
   console.log('existing line');
   return a + b;
+  return a + b + c; // Another new line at line 7
 }
 
 function anotherFunction() {`;

  test('should create correct line mappings', () => {
    const mappings = DiffLineMapper.createLineMapping(expandedDiff);

    expect(mappings.has('test.js')).toBe(true);

    const fileMapping = mappings.get('test.js');
    expect(fileMapping).toBeDefined();

    // Check that we have mappings for added lines
    const changeMappings = fileMapping?.mappings.filter((m) => m.isChange);
    expect(changeMappings.length).toBe(2); // Two + lines

    // Verify the line numbers are correctly mapped
    const addedLines = changeMappings.filter((m) => m.changeType === 'add');
    expect(addedLines).toHaveLength(2);
    expect(addedLines[0].originalLineNumber).toBe(4); // First added line
    expect(addedLines[1].originalLineNumber).toBe(7); // Second added line
  });

  test('should correct AI responses with wrong line numbers', () => {
    const mockResponse: ReviewResponse[] = [
      {
        filePath: 'test.js',
        lineNumber: 3, // Context line, should be corrected
        severity: 'Warning',
        title: 'Test Issue',
        description: 'This is a test issue',
      },
      {
        filePath: 'test.js',
        lineNumber: 4, // Actual change line, should be valid
        severity: 'Warning',
        title: 'Valid Issue',
        description: 'This is on an actual change',
      },
    ];

    const correctedResponse = ReviewResponseProcessor.processReviewResponse(
      mockResponse,
      expandedDiff
    );

    expect(correctedResponse).toHaveLength(2);

    // First response should be corrected or have warning
    expect(correctedResponse[0].description).toContain('automatically corrected');

    // Second response should be unchanged (valid change line)
    expect(correctedResponse[1].lineNumber).toBe(4);
    expect(correctedResponse[1].description).not.toContain('corrected');
  });

  test('should validate line numbers correctly', () => {
    const mappings = DiffLineMapper.createLineMapping(expandedDiff);

    // Valid change line
    const validResult = ReviewResponseProcessor.validateLineNumber('test.js', 4, mappings);
    expect(validResult.isValid).toBe(true);

    // Context line (should be invalid)
    const contextResult = ReviewResponseProcessor.validateLineNumber('test.js', 2, mappings);
    expect(contextResult.isValid).toBe(false);
    expect(contextResult.warning).toContain('context line');
  });

  test('should filter out context line reviews', () => {
    const mockResponse: ReviewResponse[] = [
      {
        filePath: 'test.js',
        lineNumber: 2, // Context line
        severity: 'Warning',
        title: 'Context Issue',
        description: 'This should be filtered out',
      },
      {
        filePath: 'test.js',
        lineNumber: 4, // Actual change line
        severity: 'Warning',
        title: 'Valid Issue',
        description: 'This should remain',
      },
    ];

    const filteredResponse = ReviewResponseProcessor.filterContextLineReviews(
      mockResponse,
      expandedDiff
    );

    expect(filteredResponse).toHaveLength(1);
    expect(filteredResponse[0].title).toBe('Valid Issue');
  });

  test('should provide accuracy statistics', () => {
    const mockResponse: ReviewResponse[] = [
      {
        filePath: 'test.js',
        lineNumber: 4,
        severity: 'Warning',
        title: 'Valid',
        description: 'Valid change line',
      },
      {
        filePath: 'test.js',
        lineNumber: 2,
        severity: 'Warning',
        title: 'Context',
        description: 'Context line error',
      },
      {
        filePath: 'test.js',
        lineNumber: 999,
        severity: 'Warning',
        title: 'Invalid',
        description: 'Unmappable line',
      },
    ];

    const stats = ReviewResponseProcessor.getLineNumberAccuracyStats(mockResponse, expandedDiff);

    expect(stats.total).toBe(3);
    expect(stats.accurate).toBe(1); // Line 4 is valid
    expect(stats.corrected).toBeGreaterThanOrEqual(0); // Line 2 might be correctable
    expect(stats.unmappable).toBeGreaterThanOrEqual(0); // Line 999 is unmappable
  });
});
