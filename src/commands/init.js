import * as fs from "node:fs";
import * as path from "node:path";
import { getDefaultConfig } from "../config.js";

/**
 * Initialize a new dprint.json configuration file
 */
export default async function initCommand(options = {}) {
  const configPath = path.join(process.cwd(), "dprint.json");

  if (fs.existsSync(configPath)) {
    console.error("Error: dprint.json already exists in the current directory");
    return 1;
  }

  const config = getDefaultConfig();
  const configJson = JSON.stringify(config, null, 2);

  fs.writeFileSync(configPath, configJson, "utf-8");
  console.log("Created dprint.json");

  return 0;
}
