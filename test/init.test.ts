import { expect, test, beforeEach, afterEach } from "bun:test";
import initCommand from "../src/commands/init.js";
import * as fs from "node:fs";
import * as path from "node:path";

const testDir = path.join(process.cwd(), "test-tmp-init");
const configPath = path.join(testDir, "dprint.json");

beforeEach(() => {
  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  // Change to test directory
  process.chdir(testDir);
});

afterEach(() => {
  // Change back to project root
  process.chdir(path.join(testDir, ".."));
  // Clean up test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("creates dprint.json in current directory", async () => {
  const exitCode = await initCommand();

  expect(exitCode).toBe(0);
  expect(fs.existsSync(configPath)).toBe(true);
});

test("creates valid JSON configuration", async () => {
  await initCommand();

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  expect(config).toBeDefined();
  expect(config.$schema).toBeDefined();
  expect(config.includes).toBeDefined();
  expect(config.excludes).toBeDefined();
  expect(config.plugins).toBeDefined();
});

test("includes default plugins", async () => {
  await initCommand();

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  expect(config.plugins).toContain("@dprint/typescript");
  expect(config.plugins).toContain("@dprint/json");
  expect(config.plugins).toContain("@dprint/markdown");
});

test("includes default file patterns", async () => {
  await initCommand();

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  expect(config.includes).toBeDefined();
  expect(config.includes.length).toBeGreaterThan(0);
});

test("includes default exclude patterns", async () => {
  await initCommand();

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  expect(config.excludes).toContain("**/node_modules");
  expect(config.excludes).toContain("**/dist");
});

test("fails if dprint.json already exists", async () => {
  // Create config file first
  fs.writeFileSync(configPath, "{}", "utf-8");

  const exitCode = await initCommand();

  expect(exitCode).toBe(1);
});

test("formats configuration with proper indentation", async () => {
  await initCommand();

  const content = fs.readFileSync(configPath, "utf-8");

  // Check for proper JSON formatting (should have newlines and indentation)
  expect(content).toContain("\n");
  expect(content).toContain("  "); // 2-space indentation
});
