export class Util {
  /**
   * Normalizes project names by removing extra spaces around slashes
   * e.g., "group / subgroup / project" -> "group/subgroup/project"
   */
  static normalizeProjectName(name: string): string {
    return name.replace(/\s*\/\s*/g, '/').trim();
  }
}
