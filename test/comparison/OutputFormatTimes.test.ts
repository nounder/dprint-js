import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as OutputFormatTimesCommand from "../../src/commands/OutputFormatTimesCommand.js";

const projectRoot = process.cwd();

let testDir;
let oursDir;
let theirsDir;

const sampleTS = `const x = 1;\n`;

t.beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-comparison-output-format-times-"));
  oursDir = path.join(testDir, "ours");
  theirsDir = path.join(testDir, "theirs");

  fs.mkdirSync(oursDir, { recursive: true });
  fs.mkdirSync(theirsDir, { recursive: true });

  const ourConfig = {
    lineWidth: 80,
    includes: ["**/*.ts"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(path.join(oursDir, "dprint.json"), JSON.stringify(ourConfig, null, 2));

  const theirConfig = {
    lineWidth: 80,
    includes: ["**/*.ts"],
    plugins: ["https://plugins.dprint.dev/typescript-0.93.0.wasm"],
    typescript: {},
  };
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), JSON.stringify(theirConfig, null, 2));
});

t.afterEach(() => {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("outputs timing for formatted files", async () => {
  fs.writeFileSync(path.join(oursDir, "test.ts"), sampleTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), sampleTS);

  const ourResult = await $`bun run ${path.join(projectRoot, "bin/dprint")} output-format-times`.cwd(oursDir)
    .nothrow().quiet();
  const theirResult = await $`npx dprint output-format-times`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);

  // Check that output contains timing info (format: "Xms - /path/to/file")
  const ourOutput = ourResult.stdout.toString();
  const theirOutput = theirResult.stdout.toString();

  t.expect(ourOutput).toMatch(/\d+ms - .*test\.ts/);
  t.expect(theirOutput).toMatch(/\d+ms - .*test\.ts/);
});

t.it("returns same exit code when no files found", async () => {
  const ourExitCode = await OutputFormatTimesCommand.run({ logLevel: "silent", cwd: oursDir });
  const theirResult = await $`npx dprint output-format-times --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // output-format-times returns 14 when no files (unlike output-file-paths)
  t.expect(ourExitCode).toBe(14);
  t.expect(theirResult.exitCode).toBe(14);
});

t.it("returns same exit code when config is missing", async () => {
  fs.unlinkSync(path.join(oursDir, "dprint.json"));
  fs.unlinkSync(path.join(theirsDir, "dprint.json"));

  const ourExitCode = await OutputFormatTimesCommand.run({
    logLevel: "silent",
    configDiscovery: false,
    cwd: oursDir,
  });
  const theirResult = await $`npx dprint output-format-times --log-level silent --config dprint.json`.cwd(
    theirsDir,
  ).nothrow().quiet();

  t.expect(ourExitCode).toBe(11);
  t.expect(theirResult.exitCode).toBe(11);
});
