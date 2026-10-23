import { spawn } from 'child_process';
import * as path from 'path';
import { IpcClient } from './IpcClient.js';
import { colors } from './formatters.js';

/**
 * Checks if the DualSurf browser controller is online.
 * If offline, automatically spawns the Electron main controller in headless mode.
 */
export async function autoStartControllerIfOffline(client: IpcClient): Promise<boolean> {
  const isOnline = await client.isControllerAvailable();
  if (isOnline) return true;

  console.log(`${colors.cyan}[DualSurf]${colors.reset} Browser controller not running. Auto-launching DualSurf in background...`);

  const rootDir = path.resolve(__dirname, '../../..');
  const mainScript = path.join(rootDir, 'apps', 'desktop', 'dist', 'electron', 'main.js');

  try {
    const electronBin: string = require('electron');
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/c', 'start', '""', '/b', electronBin, mainScript, '--headless'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          cwd: rootDir,
        })
      : spawn(electronBin, [mainScript, '--headless'], {
          detached: true,
          stdio: 'ignore',
          cwd: rootDir,
        });
    child.unref();
  } catch (err) {
    console.warn('[DualSurf] Could not auto-spawn electron:', err);
    return false;
  }

  // Poll until controller comes online (up to 7 seconds)
  const startTime = Date.now();
  while (Date.now() - startTime < 7000) {
    await new Promise((r) => setTimeout(r, 300));
    if (await client.isControllerAvailable()) {
      console.log(`${colors.green}[DualSurf]${colors.reset} Connected to DualSurf browser controller.\n`);
      return true;
    }
  }

  return false;
}
