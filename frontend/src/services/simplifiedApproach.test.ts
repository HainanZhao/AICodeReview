import { beforeEach, describe, expect, test } from 'vitest';
import type { FileDiff } from '../../../types';
import { parseDiffsToHunks } from './gitlabService';

/**
 * Comprehensive test suite for the simplified context building approach
 * Originally based on test-simplified-approach.js, now converted to proper Vitest tests
 */
describe('Simplified Context Building Approach', () => {
  let fileContents: Record<string, { oldContent?: string[]; newContent?: string[] }>;
  let smallFileDiff: FileDiff;
  let largeFileDiff: FileDiff;
  let packageLockDiff: FileDiff;
  let newFileDiff: FileDiff;
  let deletedFileDiff: FileDiff;

  beforeEach(() => {
    // Reset file contents object before each test
    fileContents = {};

    // Small file (should include full content)
    fileContents['small-file.js'] = {
      newContent: [
        'const express = require("express");',
        'const app = express();',
        '',
        'app.get("/api/users", (req, res) => {',
        '  // TODO: Add authentication',
        '  const users = getUsers();',
        '  res.json(users);',
        '});',
        '',
        'function getUsers() {',
        '  return ["user1", "user2"];',
        '}',
        '',
        'app.listen(3000, () => {',
        '  console.log("Server running on port 3000");',
        '});',
      ],
    };

    // Large file (should skip full content)
    const largeFileContent = Array(10001)
      .fill(0)
      .map((_, i) => `line ${i + 1}`);
    fileContents['large-file.js'] = {
      newContent: largeFileContent,
    };

    // Package lock file (should be excluded as non-meaningful)
    fileContents['package-lock.json'] = {
      newContent: Array(5000)
        .fill(0)
        .map((_, i) => `  "dependency-${i}": "1.0.0",`),
    };

    // Setup test diffs
    smallFileDiff = {
      old_path: 'small-file.js',
      new_path: 'small-file.js',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `--- a/small-file.js
+++ b/small-file.js
@@ -4,2 +4,3 @@
 app.get("/api/users", (req, res) => {
+  // TODO: Add authentication
   const users = getUsers();`,
    };

    largeFileDiff = {
      old_path: 'large-file.js',
      new_path: 'large-file.js',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `--- a/large-file.js
+++ b/large-file.js
@@ -5000,3 +5000,3 @@
 line 4999
-line 5000
+line 5000 modified
 line 5001`,
    };

    packageLockDiff = {
      old_path: 'package-lock.json',
      new_path: 'package-lock.json',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `--- a/package-lock.json
+++ b/package-lock.json
@@ -100,3 +100,3 @@
   "dependencies": {
-    "old-package": "1.0.0"
+    "new-package": "2.0.0"
   }`,
    };

    newFileDiff = {
      old_path: '',
      new_path: 'new-file.js',
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      diff: `--- /dev/null
+++ b/new-file.js
@@ -0,0 +1,3 @@
+const newFunction = () => {
+  return "hello world";
+};`,
    };

    deletedFileDiff = {
      old_path: 'deleted-file.js',
      new_path: 'deleted-file.js',
      new_file: false,
      renamed_file: false,
      deleted_file: true,
      diff: `--- a/deleted-file.js
+++ /dev/null
@@ -1,3 +0,0 @@
-const deletedFunction = () => {
-  return "goodbye world";
-};`,
    };
  });

  describe('Core Functionality Tests', () => {
    test('parseDiffsToHunks executes successfully', () => {
      const diffs = [smallFileDiff, largeFileDiff];

      expect(() => parseDiffsToHunks(diffs, fileContents)).not.toThrow();

      const result = parseDiffsToHunks(diffs, fileContents);
      expect(result).toBeDefined();
      expect(result.diffForPrompt).toBeDefined();
      expect(result.parsedDiffs).toBeDefined();
    });

    test('generates prompt with reasonable length', () => {
      const diffs = [smallFileDiff, largeFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      expect(diffForPrompt.length).toBeGreaterThan(0);
      expect(typeof diffForPrompt).toBe('string');

      // Should be substantial but not excessive
      expect(diffForPrompt.length).toBeGreaterThan(100);
      expect(diffForPrompt.length).toBeLessThan(50000); // Reasonable upper bound
    });

    test('parses correct number of file diffs', () => {
      const diffs = [smallFileDiff, largeFileDiff, packageLockDiff];
      const { parsedDiffs } = parseDiffsToHunks(diffs, fileContents);

      expect(parsedDiffs).toHaveLength(3);
      expect(parsedDiffs[0].filePath).toBe('small-file.js');
      expect(parsedDiffs[1].filePath).toBe('large-file.js');
      expect(parsedDiffs[2].filePath).toBe('package-lock.json');
    });
  });

  describe('File Content Inclusion Logic', () => {
    test('small file includes full content', () => {
      const diffs = [smallFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      expect(diffForPrompt).toContain('=== FULL FILE CONTENT: small-file.js ===');
      expect(diffForPrompt).toContain('=== END FILE CONTENT ===');

      // Check for line numbers and content
      expect(diffForPrompt).toContain('   1: const express = require("express");');
      expect(diffForPrompt).toContain('   2: const app = express();');
      expect(diffForPrompt).toContain('console.log("Server running on port 3000");');
    });

    test('large file correctly skips full content', () => {
      const diffs = [largeFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      expect(diffForPrompt).not.toContain('=== FULL FILE CONTENT: large-file.js ===');
      expect(diffForPrompt).toContain('=== GIT DIFF: large-file.js ===');
    });

    test('package-lock.json is treated as non-meaningful file', () => {
      const diffs = [packageLockDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      // Should skip full content even though it's under the line limit
      expect(diffForPrompt).not.toContain('=== FULL FILE CONTENT: package-lock.json ===');
      expect(diffForPrompt).toContain('=== GIT DIFF: package-lock.json ===');
    });

    test('deleted files skip full content', () => {
      const diffs = [deletedFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      expect(diffForPrompt).not.toContain('=== FULL FILE CONTENT: deleted-file.js ===');
      expect(diffForPrompt).toContain('=== GIT DIFF: deleted-file.js ===');
    });

    test('new files include full content when small', () => {
      fileContents['new-file.js'] = {
        newContent: ['const newFunction = () => {', '  return "hello world";', '};'],
      };

      const diffs = [newFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      expect(diffForPrompt).toContain('=== FULL FILE CONTENT: new-file.js ===');
      expect(diffForPrompt).toContain('   1: const newFunction = () => {');
    });
  });

  describe('Git Diff Sections', () => {
    test('both files include git diff sections', () => {
      const diffs = [smallFileDiff, largeFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      expect(diffForPrompt).toContain('=== GIT DIFF: small-file.js ===');
      expect(diffForPrompt).toContain('=== GIT DIFF: large-file.js ===');
      expect(diffForPrompt).toContain('=== END DIFF ===');
    });

    test('git diff contains original diff content', () => {
      const diffs = [smallFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      expect(diffForPrompt).toContain('--- a/small-file.js');
      expect(diffForPrompt).toContain('+++ b/small-file.js');
      expect(diffForPrompt).toContain('@@ -4,2 +4,3 @@');
      expect(diffForPrompt).toContain('+  // TODO: Add authentication');
    });
  });

  describe('Line Number Formatting', () => {
    test('full file content includes line numbers', () => {
      const diffs = [smallFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      // Check that line numbers are properly formatted with padding
      expect(diffForPrompt).toContain('   1: const express = require("express");');
      expect(diffForPrompt).toContain('   4: app.get("/api/users", (req, res) => {');
      expect(diffForPrompt).toContain('  10: function getUsers() {');
    });

    test('line numbers use consistent padding', () => {
      const diffs = [smallFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      // All line numbers should be padded to 4 characters
      const lineNumberMatches = diffForPrompt.match(/^\s+\d+:/gm);
      expect(lineNumberMatches).toBeTruthy();

      if (lineNumberMatches) {
        lineNumberMatches.forEach((match) => {
          // Each line number should have consistent padding format
          expect(match).toMatch(/^\s{2,4}\d+:$/);
        });
      }
    });
  });

  describe('Non-Meaningful File Detection', () => {
    const nonMeaningfulFiles = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'composer.lock',
      'Pipfile.lock',
      'poetry.lock',
      'Cargo.lock',
      'Gemfile.lock',
      'go.sum',
      'dist/bundle.min.js',
      'coverage/lcov.info',
    ];

    test.each(nonMeaningfulFiles)('should skip full content for %s', (fileName) => {
      const testContent = Array(100).fill('mock content');
      fileContents[fileName] = { newContent: testContent };

      const testDiff: FileDiff = {
        old_path: fileName,
        new_path: fileName,
        new_file: false,
        renamed_file: false,
        deleted_file: false,
        diff: `--- a/${fileName}\n+++ b/${fileName}\n@@ -1,1 +1,2 @@\n mock content\n+added line`,
      };

      const { diffForPrompt } = parseDiffsToHunks([testDiff], fileContents);

      expect(diffForPrompt).not.toContain(`=== FULL FILE CONTENT: ${fileName} ===`);
      expect(diffForPrompt).toContain(`=== GIT DIFF: ${fileName} ===`);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles empty diffs array', () => {
      const { diffForPrompt, parsedDiffs } = parseDiffsToHunks([], fileContents);

      expect(diffForPrompt).toBe('');
      expect(parsedDiffs).toEqual([]);
    });

    test('handles file without content in fileContents map', () => {
      const orphanDiff: FileDiff = {
        old_path: 'orphan.js',
        new_path: 'orphan.js',
        new_file: false,
        renamed_file: false,
        deleted_file: false,
        diff: `--- a/orphan.js\n+++ b/orphan.js\n@@ -1,1 +1,2 @@\n console.log("test");\n+console.log("added");`,
      };

      const { diffForPrompt, parsedDiffs } = parseDiffsToHunks([orphanDiff], fileContents);

      expect(parsedDiffs).toHaveLength(1);
      expect(diffForPrompt).toContain('=== GIT DIFF: orphan.js ===');
      expect(diffForPrompt).not.toContain('=== FULL FILE CONTENT: orphan.js ===');
    });

    test('handles malformed diff gracefully', () => {
      const malformedDiff: FileDiff = {
        old_path: 'test.js',
        new_path: 'test.js',
        new_file: false,
        renamed_file: false,
        deleted_file: false,
        diff: '--- a/test.js\n+++ b/test.js\nmalformed diff content without proper headers',
      };

      expect(() => parseDiffsToHunks([malformedDiff], fileContents)).not.toThrow();

      const { parsedDiffs } = parseDiffsToHunks([malformedDiff], fileContents);
      expect(parsedDiffs).toHaveLength(1);
    });
  });

  describe('Performance and Limits', () => {
    test('respects MAX_FILE_LINES limit (10,000 lines)', () => {
      const diffs = [largeFileDiff];
      const { diffForPrompt } = parseDiffsToHunks(diffs, fileContents);

      // Large file (10,001 lines) should not include full content
      expect(diffForPrompt).not.toContain('=== FULL FILE CONTENT: large-file.js ===');
      expect(diffForPrompt).toContain('=== GIT DIFF: large-file.js ===');
    });

    test('generates reasonable prompt length for multiple files', () => {
      const diffs = [smallFileDiff, largeFileDiff, packageLockDiff];
      const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs, fileContents);

      expect(diffForPrompt.length).toBeGreaterThan(0);
      expect(diffForPrompt.length).toBeLessThan(1000000); // Reasonable upper bound
      expect(parsedDiffs).toHaveLength(3);

      // Should contain exactly one full file section (only small-file.js qualifies)
      const fullContentSections = (diffForPrompt.match(/=== FULL FILE CONTENT:/g) || []).length;
      expect(fullContentSections).toBe(1);

      // Should contain three git diff sections
      const gitDiffSections = (diffForPrompt.match(/=== GIT DIFF:/g) || []).length;
      expect(gitDiffSections).toBe(3);
    });
  });

  describe('Integration Test - Complete Workflow', () => {
    test('complete simplified approach workflow works correctly', () => {
      const diffs = [smallFileDiff, largeFileDiff];
      const { diffForPrompt, parsedDiffs } = parseDiffsToHunks(diffs, fileContents);

      // Verify overall structure
      expect(diffForPrompt).toBeTruthy();
      expect(parsedDiffs).toHaveLength(2);

      // Verify small file handling
      expect(diffForPrompt).toContain('=== FULL FILE CONTENT: small-file.js ===');
      expect(diffForPrompt).toContain('   1: const express = require("express");');

      // Verify large file handling
      expect(diffForPrompt).not.toContain('=== FULL FILE CONTENT: large-file.js ===');

      // Verify both have git diffs
      expect(diffForPrompt).toContain('=== GIT DIFF: small-file.js ===');
      expect(diffForPrompt).toContain('=== GIT DIFF: large-file.js ===');

      // Verify prompt structure
      const sections = diffForPrompt.split('===');
      expect(sections.length).toBeGreaterThan(4); // Multiple sections present

      console.log('✅ Simplified approach workflow completed successfully');
      console.log(`✅ Generated prompt length: ${diffForPrompt.length} characters`);
      console.log(`✅ Parsed ${parsedDiffs.length} file diffs`);
    });
  });
});
