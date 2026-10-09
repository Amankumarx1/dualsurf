import type { DualSurfAPI } from '../electron/preload';

declare global {
  interface Window {
    dualsurf: DualSurfAPI;
  }
}

export {};
