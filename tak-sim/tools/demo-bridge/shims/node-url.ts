/** DEMONSTRATION ONLY: `node:url` in the demo bridge's browser build (`build.ts` aliases it): a URL's path, for module-level constants. */

export const fileURLToPath = (url: string | URL): string => new URL(String(url)).pathname;
export const pathToFileURL = (path: string): URL => new URL(`file://${path}`);
