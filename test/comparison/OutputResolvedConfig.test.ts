import { $ } from "bun"
import * as t from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as OutputResolvedConfigCommand from "../../src/commands/OutputResolvedConfigCommand.js"
import * as Testing from "../Testing.js"

const projectRoot = process.cwd()

// Get binary paths
const THEIR_BIN = Testing.THEIR_BIN
const OURS_BIN = Testing.OURS_BIN

// Get local plugin URL for rust dprint
const typescriptPluginUrl = Testing.getLocalPluginUrl("typescript", projectRoot)

let testDir
let oursDir
let theirsDir

t.beforeEach(() => {
  testDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dprint-test-comparison-output-resolved-config-"),
  )
  oursDir = path.join(testDir, "ours")
  theirsDir = path.join(testDir, "theirs")

  fs.mkdirSync(oursDir, { recursive: true })
  fs.mkdirSync(theirsDir, { recursive: true })

  const ourConfig = {
    lineWidth: 80,
    indentWidth: 2,
    includes: ["**/*.ts"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  }
  fs.writeFileSync(
    path.join(oursDir, "dprint.json"),
    JSON.stringify(ourConfig, null, 2),
  )

  const theirConfig = {
    lineWidth: 80,
    indentWidth: 2,
    includes: ["**/*.ts"],
    plugins: [typescriptPluginUrl],
    typescript: {},
  }
  fs.writeFileSync(
    path.join(theirsDir, "dprint.json"),
    JSON.stringify(theirConfig, null, 2),
  )
})

t.afterEach(() => {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

t.it("outputs resolved configuration as JSON", async () => {
  const ourResult = await $`${OURS_BIN} output-resolved-config`
    .cwd(oursDir)
    .nothrow()
    .quiet()
  const theirResult = await $`${THEIR_BIN} output-resolved-config`
    .cwd(theirsDir)
    .nothrow()
    .quiet()

  t.expect(ourResult.exitCode).toBe(0)
  t.expect(theirResult.exitCode).toBe(0)

  // Parse JSON output
  const ourConfig = JSON.parse(ourResult.stdout.toString())
  const theirConfig = JSON.parse(theirResult.stdout.toString())

  // Both should have typescript configuration
  t.expect(ourConfig).toHaveProperty("typescript")
  t.expect(theirConfig).toHaveProperty("typescript")

  // Both should have lineWidth and indentWidth set
  t.expect(ourConfig.typescript.lineWidth).toBe(80)
  t.expect(theirConfig.typescript.lineWidth).toBe(80)
  t.expect(ourConfig.typescript.indentWidth).toBe(2)
  t.expect(theirConfig.typescript.indentWidth).toBe(2)
})

t.it("returns same exit code when config is missing", async () => {
  fs.unlinkSync(path.join(oursDir, "dprint.json"))
  fs.unlinkSync(path.join(theirsDir, "dprint.json"))

  const ourExitCode = await OutputResolvedConfigCommand.run({
    logLevel: "silent",
    configDiscovery: false,
    cwd: oursDir,
  })
  const theirResult =
    await $`${THEIR_BIN} output-resolved-config --log-level silent --config dprint.json`
      .cwd(
        theirsDir,
      )
      .nothrow()
      .quiet()

  t.expect(ourExitCode).toBe(11)
  t.expect(theirResult.exitCode).toBe(11)
})
