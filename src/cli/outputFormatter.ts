import { ReviewFeedback, Severity } from './types.js';

/**
 * Colors for console output
 */
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
} as const;

/**
 * Formats review output for console display
 */
export class CLIOutputFormatter {
  /**
   * Formats a complete review result for console output
   */
  static formatReview(feedback: ReviewFeedback[], mrUrl: string, isDryRun: boolean): string {
    const output: string[] = [];

    // Header
    output.push(this.formatHeader(mrUrl, isDryRun));
    output.push('');

    if (feedback.length === 0) {
      output.push(`${colors.green}✅ No issues found! The code looks good.${colors.reset}`);
      return output.join('\n');
    }

    // Group feedback by file
    const feedbackByFile = this.groupFeedbackByFile(feedback);

    // Format each file's feedback
    for (const [filePath, fileFeedback] of Object.entries(feedbackByFile)) {
      output.push(this.formatFileHeader(filePath, fileFeedback.length));
      output.push('');

      for (const item of fileFeedback) {
        output.push(this.formatFeedbackItem(item));
        output.push('');
      }
    }

    // Summary
    output.push(this.formatSummary(feedback, isDryRun));

    return output.join('\n');
  }

  /**
   * Formats the header section
   */
  private static formatHeader(mrUrl: string, isDryRun: boolean): string {
    const mode = isDryRun ? 'DRY RUN - ' : '';
    return `${colors.bold}🤖 AI Code Review ${mode}${colors.reset}
${colors.gray}Reviewing: ${mrUrl}${colors.reset}`;
  }

  /**
   * Formats a file header
   */
  private static formatFileHeader(filePath: string, issueCount: number): string {
    const issueText = issueCount === 1 ? 'issue' : 'issues';
    return `${colors.bold}📄 ${filePath}${colors.reset} ${colors.gray}(${issueCount} ${issueText})${colors.reset}`;
  }

  /**
   * Formats a single feedback item
   */
  private static formatFeedbackItem(feedback: ReviewFeedback): string {
    const severityIcon = this.getSeverityIcon(feedback.severity);
    const severityColor = this.getSeverityColor(feedback.severity);
    const lineInfo = feedback.lineNumber > 0 ? ` (Line ${feedback.lineNumber})` : '';

    const output: string[] = [];
    output.push(
      `  ${severityColor}${severityIcon} ${feedback.severity.toUpperCase()}${lineInfo}: ${feedback.title}${colors.reset}`
    );

    // Description with indentation
    const description = feedback.description
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n');
    output.push(`${colors.gray}${description}${colors.reset}`);

    // Line content if available
    if (feedback.lineContent && feedback.lineContent.trim()) {
      output.push(`    ${colors.gray}Code: ${feedback.lineContent.trim()}${colors.reset}`);
    }

    return output.join('\n');
  }

  /**
   * Formats the summary section
   */
  private static formatSummary(feedback: ReviewFeedback[], isDryRun: boolean): string {
    const severityCounts = this.countBySeverity(feedback);
    const total = feedback.length;

    const output: string[] = [];
    output.push(`${colors.bold}📊 Summary${colors.reset}`);
    output.push(`   Total issues found: ${total}`);

    if (severityCounts.Critical > 0) {
      output.push(`   ${colors.red}🔴 Critical: ${severityCounts.Critical}${colors.reset}`);
    }
    if (severityCounts.Warning > 0) {
      output.push(`   ${colors.yellow}🟡 Warning: ${severityCounts.Warning}${colors.reset}`);
    }
    if (severityCounts.Suggestion > 0) {
      output.push(`   ${colors.blue}🔵 Suggestion: ${severityCounts.Suggestion}${colors.reset}`);
    }
    if (severityCounts.Info > 0) {
      output.push(`   ${colors.gray}ℹ️  Info: ${severityCounts.Info}${colors.reset}`);
    }

    if (isDryRun) {
      output.push('');
      output.push(
        `${colors.yellow}⚠️  This was a dry run. No comments were posted to GitLab.${colors.reset}`
      );
      output.push(
        `${colors.gray}   Run without --dry-run to post these comments to the merge request.${colors.reset}`
      );
    } else if (total > 0) {
      output.push('');
      output.push(`${colors.green}✅ Comments posted to GitLab merge request.${colors.reset}`);
    }

    return output.join('\n');
  }

  /**
   * Groups feedback by file path
   */
  private static groupFeedbackByFile(feedback: ReviewFeedback[]): Record<string, ReviewFeedback[]> {
    const grouped: Record<string, ReviewFeedback[]> = {};

    for (const item of feedback) {
      const filePath = item.filePath || 'General';
      if (!grouped[filePath]) {
        grouped[filePath] = [];
      }
      grouped[filePath].push(item);
    }

    // Sort feedback within each file by line number
    for (const fileFeedback of Object.values(grouped)) {
      fileFeedback.sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));
    }

    return grouped;
  }

  /**
   * Gets the icon for a severity level
   */
  private static getSeverityIcon(severity: Severity): string {
    switch (severity) {
      case Severity.Critical:
        return '🔴';
      case Severity.Warning:
        return '🟡';
      case Severity.Suggestion:
        return '🔵';
      case Severity.Info:
        return 'ℹ️ ';
      default:
        return '•';
    }
  }

  /**
   * Gets the color for a severity level
   */
  private static getSeverityColor(severity: Severity): string {
    switch (severity) {
      case Severity.Critical:
        return colors.red;
      case Severity.Warning:
        return colors.yellow;
      case Severity.Suggestion:
        return colors.blue;
      case Severity.Info:
        return colors.gray;
      default:
        return colors.gray;
    }
  }

  /**
   * Counts feedback items by severity
   */
  private static countBySeverity(feedback: ReviewFeedback[]): Record<string, number> {
    const counts = {
      Critical: 0,
      Warning: 0,
      Suggestion: 0,
      Info: 0,
    };

    for (const item of feedback) {
      if (item.severity in counts) {
        counts[item.severity as keyof typeof counts]++;
      }
    }

    return counts;
  }

  /**
   * Formats a progress message
   */
  static formatProgress(message: string): string {
    return `${colors.blue}🔄 ${message}${colors.reset}`;
  }

  /**
   * Formats an error message
   */
  static formatError(message: string): string {
    return `${colors.red}❌ Error: ${message}${colors.reset}`;
  }

  /**
   * Formats a success message
   */
  static formatSuccess(message: string): string {
    return `${colors.green}✅ ${message}${colors.reset}`;
  }

  /**
   * Formats a warning message
   */
  static formatWarning(message: string): string {
    return `${colors.yellow}⚠️  ${message}${colors.reset}`;
  }
}
