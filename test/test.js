import { loadConfig, loadPlugins, formatFile, findFiles } from "../src/index.js";
import * as fs from "node:fs";
import * as path from "node:path";

async function runTests() {
  console.log("Running dprint-js tests...\n");

  try {
    // Test 1: Load configuration
    console.log("Test 1: Loading configuration");
    const config = loadConfig();
    console.log(`✓ Config loaded from: ${config.configPath}`);
    console.log(`✓ Found ${config.plugins.length} plugins configured\n`);

    // Test 2: Load plugins
    console.log("Test 2: Loading plugins");
    const plugins = await loadPlugins(config);
    console.log(`✓ Loaded ${plugins.length} plugins successfully`);
    plugins.forEach((p) => console.log(`  - ${p.pluginName}`));
    console.log();

    // Test 3: Find files
    console.log("Test 3: Finding files");
    const files = await findFiles(config, ["test/sample.*"]);
    console.log(`✓ Found ${files.length} test files`);
    files.forEach((f) => console.log(`  - ${path.basename(f)}`));
    console.log();

    // Test 4: Format check
    console.log("Test 4: Checking if files are formatted");
    let allFormatted = true;
    for (const file of files) {
      const result = formatFile(file, plugins);
      if (result.formatted && result.changed) {
        console.log(`✗ ${path.basename(file)} is not formatted`);
        allFormatted = false;
      } else if (result.formatted) {
        console.log(`✓ ${path.basename(file)} is formatted`);
      }
    }
    console.log();

    if (allFormatted) {
      console.log("All tests passed! ✓");
    } else {
      console.log("Some files need formatting. Run 'node bin/dprint.js fmt' to fix.");
    }
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    process.exit(1);
  }
}

runTests();
