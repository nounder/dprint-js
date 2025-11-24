import { $ } from "bun"
import * as t from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as ConfigCommand from "../../src/commands/ConfigCommand.ts"
import * as Testing from "../Testing.ts"

const projectRoot = process.cwd()

// Get binary paths
const THEIR_BIN = Testing.THEIR_BIN
const OURS_BIN = Testing.OURS_BIN

// Expected output from rust dprint for "config" without subcommand
const EXPECTED_CONFIG_HELP = `Functionality related to the configuration file.

Usage: dprint config [OPTIONS] <COMMAND>

Commands:
  init    Initializes a configuration file in the current directory.
  update  Updates the plugins in the configuration file.
  add     Adds a plugin to the configuration file.
  help    Print this message or the help of the given subcommand(s)

Options:
  -c, --config <config>             Path or url to JSON configuration file. Defaults to dprint.json(c) or .dprint.json(c) in current or ancestor directory when not provided.
      --config-discovery=<BOOLEAN>  Sets the config discovery mode. Set to \`false\` to completely disable.
      --plugins <urls/files>...     List of urls or file paths of plugins to use. This overrides what is specified in the config file.
  -L, --log-level <log-level>       Set log level [default: info] [possible values: debug, info, warn, error, silent]
  -h, --help                        Print help
`

let testDir
let oursDir
let theirsDir

t.beforeEach(() => {
  testDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dprint-test-comparison-config-"),
  )
  oursDir = path.join(testDir, "ours")
  theirsDir = path.join(testDir, "theirs")

  fs.mkdirSync(oursDir, { recursive: true })
  fs.mkdirSync(theirsDir, { recursive: true })
})

t.afterEach(() => {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

t.it(
  "config without subcommand shows help and returns exit code 10",
  async () => {
    // Run our implementation and capture output
    const ourResult = await $`${OURS_BIN} config 2>&1`
      .cwd(oursDir)
      .nothrow()
      .quiet()

    // Should return exit code 10
    t.expect(ourResult.exitCode).toBe(10)

    // Our output should match the expected help text
    const ourOutput = ourResult.stdout.toString().trim()
    t.expect(ourOutput).toBe(EXPECTED_CONFIG_HELP.trim())
  },
)

// Skip interactive config init test - requires user input in real dprint
// t.it("config init creates configuration file", async () => {
//   This test is skipped because the real dprint config init is interactive
//   and requires user input (plugin selection), which cannot be automated easily
// });

t.it("config add adds plugin to configuration", async () => {
  // Create initial config
  const config = {
    plugins: [],
  }
  fs.writeFileSync(
    path.join(oursDir, "dprint.json"),
    JSON.stringify(config, null, 2),
  )
  fs.writeFileSync(
    path.join(theirsDir, "dprint.json"),
    JSON.stringify(config, null, 2),
  )

  // Add plugin
  const pluginUrl = "https://plugins.dprint.dev/typescript-0.93.0.wasm"
  const ourResult = await $`bun run ${
    path.join(projectRoot, "bin/dprint")
  } config add ${pluginUrl}`
    .cwd(oursDir)
    .nothrow()
    .quiet()
  const theirResult = await $`${THEIR_BIN} config add ${pluginUrl}`
    .cwd(theirsDir)
    .nothrow()
    .quiet()

  t.expect(ourResult.exitCode).toBe(0)
  t.expect(theirResult.exitCode).toBe(0)

  // Both configs should have the plugin
  const ourConfig = JSON.parse(
    fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"),
  )
  const theirConfig = JSON.parse(
    fs.readFileSync(path.join(theirsDir, "dprint.json"), "utf-8"),
  )

  t.expect(ourConfig.plugins).toContain(pluginUrl)
  t.expect(theirConfig.plugins).toContain(pluginUrl)
})
