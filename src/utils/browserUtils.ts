import { exec } from 'child_process';
import { platform } from 'os';

export function openBrowser(url: string): Promise<void> {
  return new Promise((resolve) => {
    const commands = {
      darwin: `open "${url}"`,
      win32: `start "" "${url}"`,
      linux: `xdg-open "${url}"`
    };

    const command = commands[platform() as keyof typeof commands];
    
    if (!command) {
      console.log(`Please open your browser and navigate to: ${url}`);
      resolve();
      return;
    }

    exec(command, (error) => {
      if (error) {
        console.log(`Could not automatically open browser. Please navigate to: ${url}`);
        resolve(); // Don't reject, just inform user
      } else {
        resolve();
      }
    });
  });
}
