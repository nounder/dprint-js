import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Shared test file content
export const malformattedTS = `const   x=1;const    y={a:1,b:2};function    foo(){return    x+y.a;}`;
export const formattedTS = `const x = 1;\nconst y = { a: 1, b: 2 };\nfunction foo() {\n  return x + y.a;\n}\n`;

export const malformattedJSON = `{"name":"test","nested":{"value":1,"items":["a","b","c"]}}`;
export const formattedJSON = `{\n  "name": "test",\n  "nested": {\n    "value": 1,\n    "items": [\n      "a",\n      "b",\n      "c"\n    ]\n  }\n}\n`;

export const malformattedMD = `# Title\n\n\n-  Item 1\n-  Item 2\n\n\n**Bold**and*italic*`;
export const formattedMD = `# Title\n\n- Item 1\n- Item 2\n\n**Bold**and*italic*\n`;

// Shared config creation
export function createNpmConfig(options: {
  incremental?: boolean;
  includes?: string[];
  excludes?: string[];
} = {}) {
  return {
    lineWidth: 80,
    indentWidth: 2,
    useTabs: false,
    incremental: options.incremental ?? false,
    includes: options.includes ?? ["**/*.{ts,js,md}", "test.json", "file*.json"],
    excludes: options.excludes ?? ["**/node_modules", "dprint.json"],
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  };
}

export function createUrlConfig(options: {
  incremental?: boolean;
  includes?: string[];
  excludes?: string[];
} = {}) {
  return {
    lineWidth: 80,
    indentWidth: 2,
    useTabs: false,
    incremental: options.incremental ?? false,
    includes: options.includes ?? ["**/*.{ts,js,md}", "test.json", "file*.json"],
    excludes: options.excludes ?? ["**/node_modules", "dprint.json"],
    plugins: [
      "https://plugins.dprint.dev/typescript-0.93.0.wasm",
      "https://plugins.dprint.dev/json-0.19.3.wasm",
      "https://plugins.dprint.dev/markdown-0.17.8.wasm",
    ],
    typescript: {},
    json: {},
    markdown: {},
  };
}

// Create test directory with config
export function createTestDir(prefix: string, configOptions?: Parameters<typeof createNpmConfig>[0]) {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const configPath = path.join(testDir, "dprint.json");
  fs.writeFileSync(configPath, JSON.stringify(createNpmConfig(configOptions), null, 2));
  return { testDir, configPath };
}

// Create comparison test directories (both ours and theirs)
export function createComparisonDirs(prefix: string, configOptions?: Parameters<typeof createNpmConfig>[0]) {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const oursDir = path.join(testDir, "ours");
  const theirsDir = path.join(testDir, "theirs");

  fs.mkdirSync(oursDir, { recursive: true });
  fs.mkdirSync(theirsDir, { recursive: true });

  // Create configs
  fs.writeFileSync(
    path.join(oursDir, "dprint.json"),
    JSON.stringify(createNpmConfig(configOptions), null, 2),
  );
  fs.writeFileSync(
    path.join(theirsDir, "dprint.json"),
    JSON.stringify(createUrlConfig(configOptions), null, 2),
  );

  return { testDir, oursDir, theirsDir };
}

// Cleanup directory
export function cleanupDir(dir: string) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Create test files in a directory
export function createTestFiles(dir: string, files: { name: string; content: string }[]) {
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    fs.writeFileSync(filePath, file.content);
  }
}

// Helper to count formatted files from output
export function countFormattedFiles(output: string): number {
  const match = output.match(/Formatted (\d+) file\(s\)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Helper to count skipped files from output
export function countSkippedFiles(output: string): number {
  const match = output.match(/skipped (\d+) file\(s\)/);
  return match ? parseInt(match[1], 10) : 0;
}
