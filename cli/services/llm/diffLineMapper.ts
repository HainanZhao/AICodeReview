/**
 * Line mapping utilities for expanded diffs
 * Maps line numbers between expanded diff context and original file positions
 */

export interface LineMapping {
  expandedLineNumber: number;
  originalLineNumber: number;
  isChange: boolean; // true if it's a + or - line, false if context
  changeType: 'add' | 'remove' | 'context';
}

export interface DiffLineMap {
  filePath: string;
  mappings: LineMapping[];
}

export class DiffLineMapper {
  /**
   * Creates a mapping between expanded diff line numbers and original file line numbers
   */
  public static createLineMapping(diff: string): Map<string, DiffLineMap> {
    const lines = diff.split('\n');
    const fileMappings = new Map<string, DiffLineMap>();

    let currentFile = '';
    let expandedLineNum = 0;
    let oldLineNum = 0;
    let newLineNum = 0;
    let currentMappings: LineMapping[] = [];

    for (const line of lines) {
      expandedLineNum++;

      // Track file headers
      if (line.startsWith('--- a/')) {
        // Starting a new file
        if (currentFile && currentMappings.length > 0) {
          fileMappings.set(currentFile, {
            filePath: currentFile,
            mappings: currentMappings,
          });
        }
        currentFile = line.substring(6); // Remove '--- a/'
        currentMappings = [];
        continue;
      }

      if (line.startsWith('+++ b/')) {
        currentFile = line.substring(6); // Remove '+++ b/'
        continue;
      }

      // Parse hunk headers to get starting line numbers
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          oldLineNum = parseInt(match[1], 10);
          newLineNum = parseInt(match[2], 10);
        }
        continue;
      }

      // Map diff content lines
      if (line.startsWith('+')) {
        // Added line
        currentMappings.push({
          expandedLineNumber: expandedLineNum,
          originalLineNumber: newLineNum,
          isChange: true,
          changeType: 'add',
        });
        newLineNum++;
      } else if (line.startsWith('-')) {
        // Removed line
        currentMappings.push({
          expandedLineNumber: expandedLineNum,
          originalLineNumber: oldLineNum,
          isChange: true,
          changeType: 'remove',
        });
        oldLineNum++;
      } else if (line.startsWith(' ')) {
        // Context line
        currentMappings.push({
          expandedLineNumber: expandedLineNum,
          originalLineNumber: newLineNum, // Use new file line number for context
          isChange: false,
          changeType: 'context',
        });
        oldLineNum++;
        newLineNum++;
      }
    }

    // Don't forget the last file
    if (currentFile && currentMappings.length > 0) {
      fileMappings.set(currentFile, {
        filePath: currentFile,
        mappings: currentMappings,
      });
    }

    return fileMappings;
  }

  /**
   * Maps an AI-returned line number from expanded diff to original file line number
   */
  public static mapToOriginalLineNumber(
    filePath: string,
    expandedLineNumber: number,
    lineMappings: Map<string, DiffLineMap>
  ): number | null {
    const fileMapping = lineMappings.get(filePath);
    if (!fileMapping) {
      return null;
    }

    // Find the mapping for this expanded line number
    const mapping = fileMapping.mappings.find((m) => m.expandedLineNumber === expandedLineNumber);
    return mapping ? mapping.originalLineNumber : null;
  }

  /**
   * Finds the closest change line to a given expanded line number
   * Useful when AI references a context line but we want to map to the nearest actual change
   */
  public static findNearestChangeLine(
    filePath: string,
    expandedLineNumber: number,
    lineMappings: Map<string, DiffLineMap>
  ): { originalLineNumber: number; changeType: 'add' | 'remove' } | null {
    const fileMapping = lineMappings.get(filePath);
    if (!fileMapping) {
      return null;
    }

    // Find the closest change line
    let closestChange: { originalLineNumber: number; changeType: 'add' | 'remove' } | null = null;
    let minDistance = Infinity;

    for (const mapping of fileMapping.mappings) {
      if (mapping.isChange) {
        const distance = Math.abs(mapping.expandedLineNumber - expandedLineNumber);
        if (distance < minDistance) {
          minDistance = distance;
          closestChange = {
            originalLineNumber: mapping.originalLineNumber,
            changeType: mapping.changeType as 'add' | 'remove',
          };
        }
      }
    }

    return closestChange;
  }

  /**
   * Gets all change lines for a file (useful for validation)
   */
  public static getChangeLinesForFile(
    filePath: string,
    lineMappings: Map<string, DiffLineMap>
  ): number[] {
    const fileMapping = lineMappings.get(filePath);
    if (!fileMapping) {
      return [];
    }

    return fileMapping.mappings.filter((m) => m.isChange).map((m) => m.originalLineNumber);
  }
}
