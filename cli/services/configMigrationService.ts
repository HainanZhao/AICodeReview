import { CLIOutputFormatter } from '../cli/outputFormatter.js';
import { ConfigLoader } from '../config/configLoader.js';
import { ProjectCacheService } from './projectCacheService.js';

export class ConfigMigrationService {
  private projectCacheService: ProjectCacheService;

  constructor() {
    this.projectCacheService = new ProjectCacheService();
  }

  /**
   * Checks if the configuration needs migration from project IDs to names
   */
  async needsMigration(): Promise<boolean> {
    try {
      const configLoader = new ConfigLoader();
      if (!configLoader.hasConfig()) {
        return false;
      }

      const config = ConfigLoader.loadConfig({});

      // Check if autoReview is configured and if projects are numbers (old format)
      if (config.autoReview?.projects && Array.isArray(config.autoReview.projects)) {
        const firstProject = config.autoReview.projects[0];
        // If the first project is a number, we need migration
        return typeof firstProject === 'number';
      }

      return false;
    } catch (error) {
      console.warn('Failed to check migration status:', error);
      return false;
    }
  }

  /**
   * Migrates configuration from project IDs to project names
   */
  async migrateConfig(): Promise<void> {
    try {
      const configLoader = new ConfigLoader();
      if (!configLoader.hasConfig()) {
        throw new Error('No configuration file found to migrate');
      }

      const config = ConfigLoader.loadConfig({});

      if (!config.gitlab) {
        throw new Error('GitLab configuration is required for migration');
      }

      if (!config.autoReview?.projects || !Array.isArray(config.autoReview.projects)) {
        console.log(CLIOutputFormatter.formatWarning('No auto-review projects found to migrate'));
        return;
      }

      // Check if migration is needed
      const firstProject = config.autoReview.projects[0];
      if (typeof firstProject !== 'number') {
        console.log(CLIOutputFormatter.formatWarning('Configuration already uses project names'));
        return;
      }

      console.log(CLIOutputFormatter.formatProgress('Migrating project IDs to project names...'));

      // Convert project IDs to project names
      const projectIds = config.autoReview.projects as number[];
      const projectInfo = await this.projectCacheService.getProjectNamesFromIds(
        projectIds,
        config.gitlab
      );

      if (projectInfo.length === 0) {
        throw new Error('Could not resolve any project IDs to project names');
      }

      if (projectInfo.length !== projectIds.length) {
        const foundIds = projectInfo.map((p) => p.id);
        const notFoundIds = projectIds.filter((id) => !foundIds.includes(id));
        console.log(
          CLIOutputFormatter.formatWarning(
            `Warning: Could not find names for project IDs: ${notFoundIds.join(', ')}`
          )
        );
      }

      // Update the configuration with project names
      const migratedConfig = {
        ...config,
        autoReview: {
          ...config.autoReview,
          projects: projectInfo.map((p) => p.name),
        },
      };

      // Save the updated configuration
      configLoader.saveConfig(migratedConfig);

      console.log(CLIOutputFormatter.formatSuccess('✅ Configuration migrated successfully!'));
      console.log(CLIOutputFormatter.formatProgress('Migrated projects:'));
      projectInfo.forEach((p) => {
        console.log(`  • ${p.name} (was ID: ${p.id})`);
      });

      if (projectInfo.length !== projectIds.length) {
        console.log(
          '\n' +
            CLIOutputFormatter.formatWarning(
              'Some project IDs could not be migrated. Please review your configuration with `aicodereview --init`'
            )
        );
      }
    } catch (error) {
      console.error(
        CLIOutputFormatter.formatError(
          `Migration failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      throw error;
    }
  }

  /**
   * Performs automatic migration check and prompts user if needed
   */
  async autoMigrate(): Promise<void> {
    if (await this.needsMigration()) {
      console.log(CLIOutputFormatter.formatProgress('🔄 Configuration migration detected...'));
      console.log(
        CLIOutputFormatter.formatProgress(
          'Your configuration uses project IDs. We now use project names for better readability.'
        )
      );

      await this.migrateConfig();
    }
  }
}
