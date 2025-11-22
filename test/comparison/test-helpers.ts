/**
 * Shared test utilities for comparison tests
 * Provides optimized setup, teardown, and helper functions
 */

import { $ } from "bun";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const projectRoot = process.cwd();

// Sample test data
export const testData = {
  malformattedTS: `const   x=1;const    y={a:1,b:2};function    foo(){return    x+y.a;}`,
  formattedTS: `const x = 1;\nconst y = { a: 1, b: 2 };\n`,
  malformattedJSON: `{"name":"test","nested":{"value":1,"items":["a","b","c"]}}`,
  formattedJSON: `{\n  "name": "test",\n  "nested": {\n    "value": 1,\n    "items": ["a", "b", "c"]\n  }\n}\n`,
  malformattedMD: `# Title\n\n\n-  Item 1\n-  Item 2\n\n\n**Bold**and*italic*`,
};

// Config templates
export const createOurConfig = (overrides = {}) => ({
  lineWidth: 80,
  indentWidth: 2,
  useTabs: false,
  incremental: false,
  includes: ["**/*.{ts,js,md}", "test.json", "file*.json"],
  excludes: ["**/node_modules", "dprint.json"],
  plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
  typescript: {},
  json: {},
  markdown: {},
  ...overrides,
});

export const createTheirConfig = (overrides = {}) => ({
  lineWidth: 80,
  indentWidth: 2,
  useTabs: false,
  incremental: false,
  includes: ["**/*.{ts,js,md}", "test.json", "file*.json"],
  excludes: ["**/node_modules", "dprint.json"],
  plugins: [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
    "https://plugins.dprint.dev/json-0.19.3.wasm",
    "https://plugins.dprint.dev/markdown-0.17.8.wasm",
  ],
  typescript: {},
  json: {},
  markdown: {},
  ...overrides,
});

// Test directory management
export interface TestDirs {
  testDir: string;
  oursDir: string;
  theirsDir: string;
}

export function createTestDirs(prefix: string): TestDirs {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), `dprint-test-${prefix}-`));
  const oursDir = path.join(testDir, "ours");
  const theirsDir = path.join(testDir, "theirs");

  fs.mkdirSync(oursDir, { recursive: true });
  fs.mkdirSync(theirsDir, { recursive: true });

  return { testDir, oursDir, theirsDir };
}

export function cleanupTestDirs(testDir: string) {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

export function setupConfigs(dirs: TestDirs, ourOverrides = {}, theirOverrides = {}) {
  const ourConfig = createOurConfig(ourOverrides);
  const theirConfig = createTheirConfig(theirOverrides);

  fs.writeFileSync(path.join(dirs.oursDir, "dprint.json"), JSON.stringify(ourConfig, null, 2));
  fs.writeFileSync(path.join(dirs.theirsDir, "dprint.json"), JSON.stringify(theirConfig, null, 2));
}

// File creation helpers
export function createTestFile(dir: string, filename: string, content: string) {
  fs.writeFileSync(path.join(dir, filename), content);
}

export function createTestFiles(dirs: TestDirs, files: Record<string, string>) {
  Object.entries(files).forEach(([filename, content]) => {
    createTestFile(dirs.oursDir, filename, content);
    createTestFile(dirs.theirsDir, filename, content);
  });
}

// Parallel execution helper
export async function runBothInParallel<T, U>(
  ourTask: () => Promise<T>,
  theirTask: () => Promise<U>,
): Promise<[T, U]> {
  return Promise.all([ourTask(), theirTask()]);
}

// Output parsing helpers
export function countFormattedFiles(output: string): number {
  const match = output.match(/Formatted (\d+) file\(s\)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function countSkippedFiles(output: string): number {
  const match = output.match(/skipped (\d+) file\(s\)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Copy fixtures helper
export function copyFixtures(targetDir: string, fixturesDir: string) {
  const fixtures = fs.readdirSync(fixturesDir);
  for (const fixture of fixtures) {
    if (fixture.includes(".actual.")) {
      const source = path.join(fixturesDir, fixture);
      const dest = path.join(targetDir, fixture);
      fs.copyFileSync(source, dest);
    }
  }
}

// Shared npx dprint runner with better error handling
export async function runDprintRust(args: string, cwd: string) {
  return $`npx dprint ${args}`.cwd(cwd).nothrow().quiet();
}
