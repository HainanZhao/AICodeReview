/**
 * Post-processing utilities for AI review responses
 * Validates and corrects line numbers based on diff line mappings
 */

import { DiffLineMapper, type DiffLineMap } from './diffLineMapper.js';
import type { ReviewResponse } from './types.js';

export interface LineNumberValidationResult {
  isValid: boolean;
  correctedLineNumber?: number;
  warning?: string;
}

export class ReviewResponseProcessor {
  /**
   * Validates and potentially corrects line numbers in AI review responses
   */
  public static processReviewResponse(response: ReviewResponse[], diff: string): ReviewResponse[] {
    const lineMappings = DiffLineMapper.createLineMapping(diff);

    return response.map((review) => this.processIndividualReview(review, lineMappings));
  }

  private static processIndividualReview(
    review: ReviewResponse,
    lineMappings: Map<string, DiffLineMap>
  ): ReviewResponse {
    const validation = this.validateLineNumber(review.filePath, review.lineNumber, lineMappings);

    if (validation.isValid) {
      return review;
    }

    // Try to correct the line number
    if (validation.correctedLineNumber) {
      console.warn(
        `AI Review: Correcting line number from ${review.lineNumber} to ${validation.correctedLineNumber} for ${review.filePath}`
      );
      return {
        ...review,
        lineNumber: validation.correctedLineNumber,
        description: `${review.description}\n\n⚠️ Note: Line number was automatically corrected from AI response.`,
      };
    }

    // If we can't correct it, find the nearest change line
    const nearestChange = DiffLineMapper.findNearestChangeLine(
      review.filePath,
      review.lineNumber,
      lineMappings
    );

    if (nearestChange) {
      console.warn(
        `AI Review: Mapping line ${review.lineNumber} to nearest change at line ${nearestChange.originalLineNumber} for ${review.filePath}`
      );
      return {
        ...review,
        lineNumber: nearestChange.originalLineNumber,
        description: `${review.description}\n\n⚠️ Note: Line number was mapped to nearest actual change.`,
      };
    }

    // Last resort: keep original but add warning
    console.warn(
      `AI Review: Could not validate line number ${review.lineNumber} for ${review.filePath}`
    );
    return {
      ...review,
      description: `${review.description}\n\n⚠️ Warning: Line number may be inaccurate due to expanded context.`,
    };
  }

  /**
   * Validates if a line number corresponds to an actual change in the diff
   */
  public static validateLineNumber(
    filePath: string,
    lineNumber: number,
    lineMappings: Map<string, DiffLineMap>
  ): LineNumberValidationResult {
    const fileMapping = lineMappings.get(filePath);

    if (!fileMapping) {
      return {
        isValid: false,
        warning: `No mapping found for file ${filePath}`,
      };
    }

    // Check if this line number corresponds to an actual change
    const changeMapping = fileMapping.mappings.find(
      (mapping) => mapping.isChange && mapping.originalLineNumber === lineNumber
    );

    if (changeMapping) {
      return { isValid: true };
    }

    // Check if it's a context line that AI incorrectly referenced
    const contextMapping = fileMapping.mappings.find(
      (mapping) => !mapping.isChange && mapping.originalLineNumber === lineNumber
    );

    if (contextMapping) {
      // Find the nearest actual change
      const nearestChange = DiffLineMapper.findNearestChangeLine(
        filePath,
        lineNumber,
        lineMappings
      );
      return {
        isValid: false,
        correctedLineNumber: nearestChange?.originalLineNumber,
        warning: 'AI referenced a context line instead of a change line',
      };
    }

    return {
      isValid: false,
      warning: 'Line number does not correspond to any line in the diff',
    };
  }

  /**
   * Filters out any reviews that reference context lines
   */
  public static filterContextLineReviews(
    response: ReviewResponse[],
    diff: string
  ): ReviewResponse[] {
    const lineMappings = DiffLineMapper.createLineMapping(diff);

    return response.filter((review) => {
      const validation = this.validateLineNumber(review.filePath, review.lineNumber, lineMappings);
      if (!validation.isValid && validation.warning?.includes('context line')) {
        console.warn(
          `Filtered out AI review for context line ${review.lineNumber} in ${review.filePath}: ${review.title}`
        );
        return false;
      }
      return true;
    });
  }

  /**
   * Gets statistics about the AI's line number accuracy
   */
  public static getLineNumberAccuracyStats(
    response: ReviewResponse[],
    diff: string
  ): {
    total: number;
    accurate: number;
    corrected: number;
    contextLineErrors: number;
    unmappable: number;
  } {
    const lineMappings = DiffLineMapper.createLineMapping(diff);

    const stats = {
      total: response.length,
      accurate: 0,
      corrected: 0,
      contextLineErrors: 0,
      unmappable: 0,
    };

    response.forEach((review) => {
      const validation = this.validateLineNumber(review.filePath, review.lineNumber, lineMappings);

      if (validation.isValid) {
        stats.accurate++;
      } else if (validation.correctedLineNumber) {
        stats.corrected++;
        if (validation.warning?.includes('context line')) {
          stats.contextLineErrors++;
        }
      } else {
        stats.unmappable++;
      }
    });

    return stats;
  }
}
