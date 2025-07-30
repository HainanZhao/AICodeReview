import https from 'https';
import semver from 'semver';

const checkForUpdates = (currentVersion: string): Promise<void> => {
  return new Promise((resolve) => {
    const req = https.get('https://registry.npmjs.org/aicodereview-cli/latest', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const latestVersion = JSON.parse(data).version;
          if (semver.lt(currentVersion, latestVersion)) {
            console.log(
              `\n[UPDATE] A new version of aicodereview-cli is available! (${currentVersion} -> ${latestVersion})`
            );
            console.log(`To update, run: npm install -g aicodereview-cli@latest\n`);
          }
        } catch (error) {
          // Ignore errors, e.g., parsing JSON
        }
        resolve();
      });
    });

    req.on('error', () => {
      // Ignore errors, e.g., network issues
      resolve();
    });

    // Set a timeout for the request to prevent hangs
    req.setTimeout(2000, () => {
      req.destroy();
      resolve();
    });
  });
};

export default checkForUpdates;
