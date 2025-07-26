import { describe, it, expect } from 'vitest';
import { parseDiffsToHunks } from './gitlabService';
import { FileDiff } from '../../../types';

describe('parseDiffsToHunks', () => {
  const mockFileContents = new Map<string, { oldContent?: string[]; newContent?: string[] }>();
  mockFileContents.set('file.txt', {
    oldContent: [
      'line 1 old',
      'line 2 old',
      'line 3 old',
      'line 4 old',
      'line 5 old',
      'line 6 old',
      'line 7 old',
      'line 8 old',
      'line 9 old',
      'line 10 old',
      // ... many more lines for context
      ...Array(40).fill('context old line'),
      'changed line old',
      'line after change old',
      ...Array(40).fill('context old line after'),
    ],
    newContent: [
      'line 1 new',
      'line 2 new',
      'line 3 new',
      'line 4 new',
      'line 5 new',
      'line 6 new',
      'line 7 new',
      'line 8 new',
      'line 9 new',
      'line 10 new',
      // ... many more lines for context
      ...Array(40).fill('context new line'),
      'changed line new',
      'line after change new',
      ...Array(40).fill('context new line after'),
    ],
  });

  it('should include full file content and git diff for small files', () => {
    const diffs: FileDiff[] = [
      {
        old_path: 'file.txt',
        new_path: 'file.txt',
        new_file: false,
        renamed_file: false,
        deleted_file: false,
        diff: `--- a/file.txt
+++ b/file.txt
@@ -50,3 +50,3 @@
 context old line
-changed line old
+changed line new
 line after change old`,
      },
    ];

    const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs, mockFileContents);

    // Should include full file content section
    expect(diffForPrompt).toContain('=== FULL FILE CONTENT: file.txt ===');
    expect(diffForPrompt).toContain('=== END FILE CONTENT ===');

    // Should include numbered lines from full file content
    expect(diffForPrompt).toContain('   1: line 1 new');
    expect(diffForPrompt).toContain('  51: changed line new');

    // Should include git diff section
    expect(diffForPrompt).toContain('=== GIT DIFF: file.txt ===');
    expect(diffForPrompt).toContain('=== END DIFF ===');
    expect(diffForPrompt).toContain('--- a/file.txt');
    expect(diffForPrompt).toContain('+++ b/file.txt');
    expect(diffForPrompt).toContain('@@ -50,3 +50,3 @@');
    expect(diffForPrompt).toContain('-changed line old');
    expect(diffForPrompt).toContain('+changed line new');

    // Assert parsedDiffs structure remains the same
    expect(parsedDiffs).toHaveLength(1);
    expect(parsedDiffs[0].filePath).toBe('file.txt');
    expect(parsedDiffs[0].hunks).toHaveLength(1);
    expect(parsedDiffs[0].hunks[0].lines).toHaveLength(4); // 2 context, 1 remove, 1 add
  });

  it('should skip full file content for large files', () => {
    // Create a large file (over 10,000 lines)
    const largeFileContent = Array(10001)
      .fill(0)
      .map((_, i) => `line ${i + 1}`);

    const mockLargeFileContents = new Map<
      string,
      { oldContent?: string[]; newContent?: string[] }
    >();
    mockLargeFileContents.set('large-file.txt', {
      oldContent: largeFileContent,
      newContent: largeFileContent,
    });

    const diffs: FileDiff[] = [
      {
        old_path: 'large-file.txt',
        new_path: 'large-file.txt',
        new_file: false,
        renamed_file: false,
        deleted_file: false,
        diff: `--- a/large-file.txt
+++ b/large-file.txt
@@ -5000,3 +5000,3 @@
 line 4999
-line 5000
+line 5000 changed
 line 5001`,
      },
    ];

    const { diffForPrompt } = parseDiffsToHunks(diffs, mockLargeFileContents);

    // Should NOT include full file content section for large files
    expect(diffForPrompt).not.toContain('=== FULL FILE CONTENT: large-file.txt ===');

    // Should still include git diff section
    expect(diffForPrompt).toContain('=== GIT DIFF: large-file.txt ===');
    expect(diffForPrompt).toContain('--- a/large-file.txt');
    expect(diffForPrompt).toContain('+line 5000 changed');
  });

  it('should handle deleted files correctly', () => {
    const diffs: FileDiff[] = [
      {
        old_path: 'deleted-file.txt',
        new_path: 'deleted-file.txt',
        new_file: false,
        renamed_file: false,
        deleted_file: true,
        diff: `--- a/deleted-file.txt
+++ /dev/null
@@ -1,3 +0,0 @@
-line 1
-line 2
-line 3`,
      },
    ];

    const { diffForPrompt } = parseDiffsToHunks(diffs, mockFileContents);

    // Should NOT include full file content for deleted files
    expect(diffForPrompt).not.toContain('=== FULL FILE CONTENT: deleted-file.txt ===');

    // Should include git diff section
    expect(diffForPrompt).toContain('=== GIT DIFF: deleted-file.txt ===');
    expect(diffForPrompt).toContain('--- a/deleted-file.txt');
  });
});
