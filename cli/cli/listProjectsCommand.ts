import { ConfigLoader } from '../config/configLoader.js';
import { fetchProjects } from '../shared/services/gitlabCore.js';
import { CLIOutputFormatter } from './outputFormatter.js';

export class ListProjectsCommand {
  public static async run(): Promise<void> {
    const config = ConfigLoader.loadConfig({});

    if (!config.gitlab) {
      console.log(
        CLIOutputFormatter.formatError(
          'GitLab configuration is missing. Please run `aicodereview --init` to configure GitLab access.'
        )
      );
      return;
    }

    try {
      console.log(CLIOutputFormatter.formatProgress('Fetching your GitLab projects...'));

      const projects = await fetchProjects(config.gitlab);

      if (projects.length === 0) {
        console.log(
          CLIOutputFormatter.formatWarning(
            'No projects found. Make sure you have at least Developer access to some projects.'
          )
        );
        return;
      }

      console.log(CLIOutputFormatter.formatSuccess(`Found ${projects.length} projects:\n`));

      // Display projects in a nice table format
      console.log(
        '┌──────────┬─────────────────────────────────────────────────────────────┬────────────────────┐'
      );
      console.log(
        '│ ID       │ Project Name                                                │ Last Activity      │'
      );
      console.log(
        '├──────────┼─────────────────────────────────────────────────────────────┼────────────────────┤'
      );

      projects.forEach((project) => {
        const id = project.id.toString().padEnd(8);
        const name =
          project.name_with_namespace.length > 59
            ? `${project.name_with_namespace.substring(0, 56)}...`
            : project.name_with_namespace.padEnd(59);
        const lastActivity = new Date(project.last_activity_at).toLocaleDateString();

        console.log(`│ ${id} │ ${name} │ ${lastActivity.padEnd(18)} │`);
      });

      console.log(
        '└──────────┴─────────────────────────────────────────────────────────────┴────────────────────┘'
      );

      console.log('\n💡 Tips:');
      console.log('  • Copy the ID numbers you want to monitor for automatic reviews');
      console.log('  • Use these IDs when configuring auto-review mode with --init');
      console.log('  • You need at least Developer access level to review merge requests');
    } catch (error) {
      console.error(
        CLIOutputFormatter.formatError(
          `Failed to fetch projects: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }
}
