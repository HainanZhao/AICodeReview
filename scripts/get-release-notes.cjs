/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
let changelog;
try {
  changelog = fs.readFileSync(changelogPath, 'utf8');
} catch (err) {
  console.error('CHANGELOG.md not found in project root');
  process.exit(1);
}

const releaseNotesRegex = /## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}([\s\S]*?)(?=## \[|$)/;
const match = changelog.match(releaseNotesRegex);

if (match && match[1]) {
  console.log(match[1].trim());
} else {
  console.log('Could not find release notes.');
}
