import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@initia/initia.js") {
    const absolutePath = path.resolve(
      __dirname,
      "node_modules/@initia/initia.js/dist/index.cjs.js",
    );
    return {
      url: `file://${absolutePath}`,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.includes("@initia/initia.js/dist/index.cjs.js")) {
    return nextLoad(url, { ...context, format: "commonjs" });
  }
  return nextLoad(url, context);
}
