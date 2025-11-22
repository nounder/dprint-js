import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import configCommand from "../../src/commands/config.js";

const projectRoot = process.cwd();

let testDir;
let oursDir;
let theirsDir;

t.beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-comparison-config-"));
  oursDir = path.join(testDir, "ours");
  theirsDir = path.join(testDir, "theirs");

  fs.mkdirSync(oursDir, { recursive: true });
  fs.mkdirSync(theirsDir, { recursive: true });
});

t.afterEach(() => {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("config without subcommand returns exit code 10", async () => {
  const ourExitCode = await configCommand([], { cwd: oursDir });
  const theirResult = await $`npx dprint config`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourExitCode).toBe(10);
  t.expect(theirResult.exitCode).toBe(10);
});

// Skip interactive config init test - requires user input in real dprint
// t.it("config init creates configuration file", async () => {
//   This test is skipped because the real dprint config init is interactive
//   and requires user input (plugin selection), which cannot be automated easily
// });

t.it("config add adds plugin to configuration", async () => {
  // Create initial config
  const config = {
    plugins: [],
  };
  fs.writeFileSync(path.join(oursDir, "dprint.json"), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), JSON.stringify(config, null, 2));

  // Add plugin
  const pluginUrl = "https://plugins.dprint.dev/typescript-0.93.0.wasm";
  const ourResult = await $`bun run ${
    path.join(projectRoot, "bin/dprint")
  } config add ${pluginUrl}`.cwd(oursDir).nothrow().quiet();
  const theirResult = await $`npx dprint config add ${pluginUrl}`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);

  // Both configs should have the plugin
  const ourConfig = JSON.parse(fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"));
  const theirConfig = JSON.parse(fs.readFileSync(path.join(theirsDir, "dprint.json"), "utf-8"));

  t.expect(ourConfig.plugins).toContain(pluginUrl);
  t.expect(theirConfig.plugins).toContain(pluginUrl);
});
