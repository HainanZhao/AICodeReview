import { parseDiffsToHunks } from './gitlabService';
import { FileDiff, ParsedFileDiff, ParsedHunk } from '../types';

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

  it('should correctly parse diffs and include context for prompt', () => {
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

    // Assert diffForPrompt contains expected context
    expect(diffForPrompt).toContain('--- a/file.txt');
    expect(diffForPrompt).toContain('+++ b/file.txt');
    expect(diffForPrompt).toContain('@@ -50,3 +50,3 @@');
    expect(diffForPrompt).toContain('-changed line old');
    expect(diffForPrompt).toContain('+changed line new');
    expect(diffForPrompt).toContain(' line after change old'); // Context line

    // Check for pre-context lines (e.g., 'context new line')
    expect(diffForPrompt).toContain(' context new line');
    // Check for post-context lines (e.g., 'context new line after')
    expect(diffForPrompt).toContain(' context new line after');

    // Assert parsedDiffs structure
    expect(parsedDiffs).toHaveLength(1);
    expect(parsedDiffs[0].filePath).toBe('file.txt');
    expect(parsedDiffs[0].hunks).toHaveLength(1);
    expect(parsedDiffs[0].hunks[0].lines).toHaveLength(4); // 2 context, 1 remove, 1 add
  });

  // Add more test cases for edge cases:
  // - Diff at the beginning of the file
  // - Diff at the end of the file
  // - Multiple hunks
  // - New file, deleted file, renamed file
  // - No changes (empty diff)
});
