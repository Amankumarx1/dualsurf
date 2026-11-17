import type { PluginManifest } from '@dualsurf/core';
import { headersAnalyzeCommand } from './headersAnalyze.js';

export * from './headersAnalyze.js';

export const blueSocPlugin: PluginManifest = {
  id: 'blue-soc',
  name: 'Blue Team & SOC Triage Suite',
  version: '1.0.0',
  permissions: ['network:read', 'storage'],
  activate: (ctx) => {
    ctx.registerCommand(headersAnalyzeCommand);
  },
};

/**
 * List of all blue-soc plugins exported for the app shell and CLI to load.
 */
export const blueSocPlugins: PluginManifest[] = [blueSocPlugin];

export default blueSocPlugin;
