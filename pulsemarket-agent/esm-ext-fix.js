/**
 * esm-ext-fix.js  — loader shim for Node 22+
 *
 * @initia/initia.js (and its .proto sub-package) import files without the
 * mandatory `.js` extension required by strict ESM resolution (Node ≥ 17).
 * This custom loader re-appends `.js` when the bare import resolves to an
 * existing `.js` file inside node_modules.
 */

import { createRequire } from "module";
import { existsSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const require = createRequire(import.meta.url);

export function resolve(specifier, context, nextResolve) {
  // Only intercept bare module-internal paths that look like they're missing
  // the extension (no `.js`, `.mjs`, `.cjs`, `.json` at the end).
  if (
    context.parentURL?.includes("node_modules") &&
    !specifier.startsWith("node:") &&
    !specifier.startsWith("file:") &&
    !/\.[cm]?js$/.test(specifier) &&
    !specifier.endsWith(".json")
  ) {
    try {
      // Let the default resolver try with .js appended
      return nextResolve(specifier + ".js", context);
    } catch {
      // fall through to default
    }
  }
  return nextResolve(specifier, context);
}
