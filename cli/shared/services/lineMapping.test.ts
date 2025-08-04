import { describe, expect, test } from 'vitest';
import { ParsedFileDiff } from '../types/gitlab.js';
import {
  buildCompleteLineMapping,
  buildLineMapping,
  getNewLineFromOldLine,
  getOldLineFromNewLine,
  LineMapping,
} from './gitlabCore.js';

describe('Line Mapping Functions', () => {
  describe('buildLineMapping', () => {
    test('should build correct mapping for a simple diff with additions and deletions', () => {
      const parsedDiff: ParsedFileDiff = {
        filePath: 'test.ts',
        oldPath: 'test.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [
          {
            header: '@@ -10,6 +10,7 @@',
            oldStartLine: 10,
            oldLineCount: 6,
            newStartLine: 10,
            newLineCount: 7,
            lines: [
              { type: 'context', oldLine: 10, newLine: 10, content: 'function test() {' },
              { type: 'context', oldLine: 11, newLine: 11, content: '  console.log("hello");' },
              { type: 'remove', oldLine: 12, content: '  // old comment' },
              { type: 'add', newLine: 12, content: '  // new comment' },
              { type: 'add', newLine: 13, content: '  console.log("world");' },
              { type: 'context', oldLine: 13, newLine: 14, content: '  return true;' },
              { type: 'context', oldLine: 14, newLine: 15, content: '}' },
            ],
            isCollapsed: false,
          },
        ],
      };

      const mapping = buildLineMapping(parsedDiff);

      // Context lines should be mapped
      expect(mapping.newToOld.get(10)).toBe(10);
      expect(mapping.newToOld.get(11)).toBe(11);
      expect(mapping.newToOld.get(14)).toBe(13);
      expect(mapping.newToOld.get(15)).toBe(14);

      expect(mapping.oldToNew.get(10)).toBe(10);
      expect(mapping.oldToNew.get(11)).toBe(11);
      expect(mapping.oldToNew.get(13)).toBe(14);
      expect(mapping.oldToNew.get(14)).toBe(15);

      // Added/removed lines should not be mapped
      expect(mapping.newToOld.get(12)).toBeUndefined(); // Added line
      expect(mapping.newToOld.get(13)).toBeUndefined(); // Added line
      expect(mapping.oldToNew.get(12)).toBeUndefined(); // Removed line
    });

    test('should handle multiple hunks correctly', () => {
      const parsedDiff: ParsedFileDiff = {
        filePath: 'test.ts',
        oldPath: 'test.ts',
        isNew: false,
        isDeleted: false,

        isRenamed: false,
        hunks: [
          {
            header: '@@ -1,3 +1,3 @@',
            oldStartLine: 1,
            oldLineCount: 3,
            newStartLine: 1,
            newLineCount: 3,
            lines: [
              { type: 'context', oldLine: 1, newLine: 1, content: 'line 1' },
              { type: 'remove', oldLine: 2, content: 'old line 2' },
              { type: 'add', newLine: 2, content: 'new line 2' },
              { type: 'context', oldLine: 3, newLine: 3, content: 'line 3' },
            ],
            isCollapsed: false,
          },
          {
            header: '@@ -20,3 +20,4 @@',
            oldStartLine: 20,
            oldLineCount: 3,
            newStartLine: 20,
            newLineCount: 4,
            lines: [
              { type: 'context', oldLine: 20, newLine: 20, content: 'line 20' },
              { type: 'context', oldLine: 21, newLine: 21, content: 'line 21' },
              { type: 'add', newLine: 22, content: 'added line' },
              { type: 'context', oldLine: 22, newLine: 23, content: 'line 22' },
            ],
            isCollapsed: false,
          },
        ],
      };

      const mapping = buildLineMapping(parsedDiff);

      // First hunk mappings
      expect(mapping.newToOld.get(1)).toBe(1);
      expect(mapping.newToOld.get(3)).toBe(3);
      expect(mapping.oldToNew.get(1)).toBe(1);
      expect(mapping.oldToNew.get(3)).toBe(3);

      // Second hunk mappings
      expect(mapping.newToOld.get(20)).toBe(20);
      expect(mapping.newToOld.get(21)).toBe(21);
      expect(mapping.newToOld.get(23)).toBe(22);
      expect(mapping.oldToNew.get(20)).toBe(20);
      expect(mapping.oldToNew.get(21)).toBe(21);
      expect(mapping.oldToNew.get(22)).toBe(23);
    });

    test('should handle empty diff (no changes)', () => {
      const parsedDiff: ParsedFileDiff = {
        filePath: 'test.ts',
        oldPath: 'test.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [],
      };

      const mapping = buildLineMapping(parsedDiff);

      expect(mapping.newToOld.size).toBe(0);
      expect(mapping.oldToNew.size).toBe(0);
    });
  });

  describe('getOldLineFromNewLine', () => {
    test('should return correct old line number for mapped new line', () => {
      const mapping: LineMapping = {
        newToOld: new Map([
          [10, 15],
          [20, 25],
        ]),
        oldToNew: new Map([
          [15, 10],
          [25, 20],
        ]),
      };

      expect(getOldLineFromNewLine(10, mapping)).toBe(15);
      expect(getOldLineFromNewLine(20, mapping)).toBe(25);
      expect(getOldLineFromNewLine(999, mapping)).toBeUndefined();
    });
  });

  describe('getNewLineFromOldLine', () => {
    test('should return correct new line number for mapped old line', () => {
      const mapping: LineMapping = {
        newToOld: new Map([
          [10, 15],
          [20, 25],
        ]),
        oldToNew: new Map([
          [15, 10],
          [25, 20],
        ]),
      };

      expect(getNewLineFromOldLine(15, mapping)).toBe(10);
      expect(getNewLineFromOldLine(25, mapping)).toBe(20);
      expect(getNewLineFromOldLine(999, mapping)).toBeUndefined();
    });
  });

  describe('buildCompleteLineMapping', () => {
    test('should build complete mapping including untouched lines', () => {
      // Simulates a diff where:
      // - Lines 1-5 are untouched (not shown in diff)
      // - Lines 6-10 have changes (shown in diff)
      // - Lines 11-15 are untouched (not shown in diff)
      const parsedDiff: ParsedFileDiff = {
        filePath: 'test.ts',
        oldPath: 'test.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [
          {
            header: '@@ -6,5 +6,6 @@',
            oldStartLine: 6,
            oldLineCount: 5,
            newStartLine: 6,
            newLineCount: 6,
            lines: [
              { type: 'context', oldLine: 6, newLine: 6, content: 'line 6' },
              { type: 'remove', oldLine: 7, content: 'old line 7' },
              { type: 'add', newLine: 7, content: 'new line 7' },
              { type: 'add', newLine: 8, content: 'added line 8' },
              { type: 'context', oldLine: 8, newLine: 9, content: 'line 8/9' },
              { type: 'context', oldLine: 9, newLine: 10, content: 'line 9/10' },
              { type: 'context', oldLine: 10, newLine: 11, content: 'line 10/11' },
            ],
            isCollapsed: false,
          },
        ],
      };

      const mapping = buildCompleteLineMapping(parsedDiff, 15, 14);

      // Untouched lines before the diff (1-5)
      expect(mapping.newToOld.get(1)).toBe(1);
      expect(mapping.newToOld.get(2)).toBe(2);
      expect(mapping.newToOld.get(3)).toBe(3);
      expect(mapping.newToOld.get(4)).toBe(4);
      expect(mapping.newToOld.get(5)).toBe(5);

      // Context lines in the diff
      expect(mapping.newToOld.get(6)).toBe(6);
      expect(mapping.newToOld.get(9)).toBe(8);
      expect(mapping.newToOld.get(10)).toBe(9);
      expect(mapping.newToOld.get(11)).toBe(10);

      // Untouched lines after the diff (12-15 in new file map to 11-14 in old file)
      expect(mapping.newToOld.get(12)).toBe(11);
      expect(mapping.newToOld.get(13)).toBe(12);
      expect(mapping.newToOld.get(14)).toBe(13);
      expect(mapping.newToOld.get(15)).toBe(14);

      // Added lines should not have old line mapping
      expect(mapping.newToOld.get(7)).toBeUndefined(); // Added line
      expect(mapping.newToOld.get(8)).toBeUndefined(); // Added line
    });

    test('should handle file with only deletions', () => {
      const parsedDiff: ParsedFileDiff = {
        filePath: 'test.ts',
        oldPath: 'test.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [
          {
            header: '@@ -5,5 +5,3 @@',
            oldStartLine: 5,
            oldLineCount: 5,
            newStartLine: 5,
            newLineCount: 3,
            lines: [
              { type: 'context', oldLine: 5, newLine: 5, content: 'line 5' },
              { type: 'remove', oldLine: 6, content: 'deleted line 6' },
              { type: 'remove', oldLine: 7, content: 'deleted line 7' },
              { type: 'context', oldLine: 8, newLine: 6, content: 'line 8/6' },
              { type: 'context', oldLine: 9, newLine: 7, content: 'line 9/7' },
            ],
            isCollapsed: false,
          },
        ],
      };

      const mapping = buildCompleteLineMapping(parsedDiff, 10, 12);

      // Lines before the diff
      expect(mapping.newToOld.get(1)).toBe(1);
      expect(mapping.newToOld.get(2)).toBe(2);
      expect(mapping.newToOld.get(3)).toBe(3);
      expect(mapping.newToOld.get(4)).toBe(4);

      // Context lines in the diff
      expect(mapping.newToOld.get(5)).toBe(5);
      expect(mapping.newToOld.get(6)).toBe(8);
      expect(mapping.newToOld.get(7)).toBe(9);

      // Lines after the diff
      expect(mapping.newToOld.get(8)).toBe(10);
      expect(mapping.newToOld.get(9)).toBe(11);
      expect(mapping.newToOld.get(10)).toBe(12);
    });

    test('should handle file with only additions', () => {
      const parsedDiff: ParsedFileDiff = {
        filePath: 'test.ts',
        oldPath: 'test.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [
          {
            header: '@@ -3,3 +3,5 @@',
            oldStartLine: 3,
            oldLineCount: 3,
            newStartLine: 3,
            newLineCount: 5,
            lines: [
              { type: 'context', oldLine: 3, newLine: 3, content: 'line 3' },
              { type: 'add', newLine: 4, content: 'added line 4' },
              { type: 'add', newLine: 5, content: 'added line 5' },
              { type: 'context', oldLine: 4, newLine: 6, content: 'line 4/6' },
              { type: 'context', oldLine: 5, newLine: 7, content: 'line 5/7' },
            ],
            isCollapsed: false,
          },
        ],
      };

      const mapping = buildCompleteLineMapping(parsedDiff, 10, 8);

      // Lines before the diff
      expect(mapping.newToOld.get(1)).toBe(1);
      expect(mapping.newToOld.get(2)).toBe(2);

      // Context lines in the diff
      expect(mapping.newToOld.get(3)).toBe(3);
      expect(mapping.newToOld.get(6)).toBe(4);
      expect(mapping.newToOld.get(7)).toBe(5);

      // Lines after the diff
      expect(mapping.newToOld.get(8)).toBe(6);
      expect(mapping.newToOld.get(9)).toBe(7);
      expect(mapping.newToOld.get(10)).toBe(8);

      // Added lines should not have old line mapping
      expect(mapping.newToOld.get(4)).toBeUndefined();
      expect(mapping.newToOld.get(5)).toBeUndefined();
    });

    test('should handle multiple hunks with gaps', () => {
      const parsedDiff: ParsedFileDiff = {
        filePath: 'test.ts',
        oldPath: 'test.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [
          {
            header: '@@ -2,2 +2,2 @@',
            oldStartLine: 2,
            oldLineCount: 2,
            newStartLine: 2,
            newLineCount: 2,
            lines: [
              { type: 'remove', oldLine: 2, content: 'old line 2' },
              { type: 'add', newLine: 2, content: 'new line 2' },
              { type: 'context', oldLine: 3, newLine: 3, content: 'line 3' },
            ],
            isCollapsed: false,
          },
          {
            header: '@@ -8,2 +8,3 @@',
            oldStartLine: 8,
            oldLineCount: 2,
            newStartLine: 8,
            newLineCount: 3,
            lines: [
              { type: 'context', oldLine: 8, newLine: 8, content: 'line 8' },
              { type: 'add', newLine: 9, content: 'added line 9' },
              { type: 'context', oldLine: 9, newLine: 10, content: 'line 9/10' },
            ],
            isCollapsed: false,
          },
        ],
      };

      const mapping = buildCompleteLineMapping(parsedDiff, 12, 11);

      // Line 1 (before first hunk)
      expect(mapping.newToOld.get(1)).toBe(1);

      // First hunk context
      expect(mapping.newToOld.get(3)).toBe(3);

      // Gap between hunks (lines 4-7 map to 4-7)
      expect(mapping.newToOld.get(4)).toBe(4);
      expect(mapping.newToOld.get(5)).toBe(5);
      expect(mapping.newToOld.get(6)).toBe(6);
      expect(mapping.newToOld.get(7)).toBe(7);

      // Second hunk context
      expect(mapping.newToOld.get(8)).toBe(8);
      expect(mapping.newToOld.get(10)).toBe(9);

      // Lines after second hunk
      expect(mapping.newToOld.get(11)).toBe(10);
      expect(mapping.newToOld.get(12)).toBe(11);
    });

    test('should handle empty diff (complete 1:1 mapping)', () => {
      const parsedDiff: ParsedFileDiff = {
        filePath: 'test.ts',
        oldPath: 'test.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [],
      };

      const mapping = buildCompleteLineMapping(parsedDiff, 5, 5);

      // Should have 1:1 mapping for all lines
      expect(mapping.newToOld.get(1)).toBe(1);
      expect(mapping.newToOld.get(2)).toBe(2);
      expect(mapping.newToOld.get(3)).toBe(3);
      expect(mapping.newToOld.get(4)).toBe(4);
      expect(mapping.newToOld.get(5)).toBe(5);

      expect(mapping.oldToNew.get(1)).toBe(1);
      expect(mapping.oldToNew.get(2)).toBe(2);
      expect(mapping.oldToNew.get(3)).toBe(3);
      expect(mapping.oldToNew.get(4)).toBe(4);
      expect(mapping.oldToNew.get(5)).toBe(5);
    });
  });
});
