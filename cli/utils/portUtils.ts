import { createServer } from 'node:net';

export function isPortAvailable(port: number, host = 'localhost'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.listen(port, host, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

export async function findAvailablePort(
  startPort: number,
  host = 'localhost',
  maxAttempts = 10
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }

  throw new Error(
    `Could not find an available port starting from ${startPort} after ${maxAttempts} attempts`
  );
}
