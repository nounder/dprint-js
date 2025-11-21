import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import initCommand from "../src/commands/init.js";

let testDir;
let configPath;

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-init-"));
  configPath = path.join(testDir, "dprint.json");
});

t.afterEach(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("creates dprint.json in current directory", async () => {
  const exitCode = await initCommand({ cwd: testDir });

  t.expect(exitCode).toBe(0);
  t.expect(fs.existsSync(configPath)).toBe(true);
});

t.it("creates valid JSON configuration", async () => {
  await initCommand({ cwd: testDir });

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  t.expect(config).toBeDefined();
  t.expect(config.$schema).toBeDefined();
  t.expect(config.includes).toBeDefined();
  t.expect(config.excludes).toBeDefined();
  t.expect(config.plugins).toBeDefined();
});

t.it("includes default plugins", async () => {
  await initCommand({ cwd: testDir });

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  t.expect(config.plugins).toContain("@dprint/typescript");
  t.expect(config.plugins).toContain("@dprint/json");
  t.expect(config.plugins).toContain("@dprint/markdown");
});

t.it("includes default file patterns", async () => {
  await initCommand({ cwd: testDir });

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  t.expect(config.includes).toBeDefined();
  t.expect(config.includes.length).toBeGreaterThan(0);
});

t.it("includes default exclude patterns", async () => {
  await initCommand({ cwd: testDir });

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  t.expect(config.excludes).toContain("**/node_modules");
  t.expect(config.excludes).toContain("**/dist");
});

t.it("fails if dprint.json already exists", async () => {
  // Create config file first
  fs.writeFileSync(configPath, "{}", "utf-8");

  const exitCode = await initCommand({ cwd: testDir });

  t.expect(exitCode).toBe(1);
});

t.it("formats configuration with proper indentation", async () => {
  await initCommand({ cwd: testDir });

  const content = fs.readFileSync(configPath, "utf-8");

  // Check for proper JSON formatting (should have newlines and indentation)
  t.expect(content).toContain("\n");
  t.expect(content).toContain("  "); // 2-space indentation
});
