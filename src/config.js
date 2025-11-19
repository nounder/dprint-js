import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Find the dprint configuration file by searching up from the current directory.
 * @param {string} startDir - The directory to start searching from
 * @returns {string|null} - Path to the config file or null if not found
 */
export function findConfigFile(startDir = process.cwd()) {
  const configNames = ["dprint.json", ".dprint.json"];
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    for (const configName of configNames) {
      const configPath = path.join(currentDir, configName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  // Check root directory
  for (const configName of configNames) {
    const configPath = path.join(root, configName);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Load and parse the dprint configuration file.
 * @param {string|null} configPath - Path to the config file (or null to auto-find)
 * @returns {object} - Parsed configuration object
 */
export function loadConfig(configPath = null) {
  const actualPath = configPath || findConfigFile();

  if (!actualPath) {
    throw new Error(
      "Could not find dprint.json configuration file. Run 'dprint init' to create one."
    );
  }

  const content = fs.readFileSync(actualPath, "utf-8");

  try {
    const config = JSON.parse(content);

    // Set default values
    config.includes = config.includes || ["**/*"];
    config.excludes = config.excludes || [
      "**/node_modules",
      "**/.git",
      "**/target",
      "**/dist",
      "**/build"
    ];
    config.plugins = config.plugins || [];

    return {
      ...config,
      configPath: actualPath,
      configDir: path.dirname(actualPath)
    };
  } catch (error) {
    throw new Error(`Failed to parse ${actualPath}: ${error.message}`);
  }
}

/**
 * Create a default dprint.json configuration file.
 * @param {string} outputPath - Path where to create the config file
 */
export function createDefaultConfig(outputPath = "dprint.json") {
  const defaultConfig = {
    "$schema": "https://dprint.dev/schemas/v0.json",
    "includes": ["**/*.{ts,tsx,js,jsx,json,md}"],
    "excludes": [
      "**/node_modules",
      "**/.git",
      "**/dist",
      "**/build",
      "**/coverage"
    ],
    "plugins": [
      "@dprint/typescript",
      "@dprint/json",
      "@dprint/markdown"
    ],
    "typescript": {
      "quoteStyle": "double",
      "semiColons": "always"
    },
    "json": {
      "indentWidth": 2
    },
    "markdown": {
      "lineWidth": 80
    }
  };

  const content = JSON.stringify(defaultConfig, null, 2) + "\n";
  fs.writeFileSync(outputPath, content, "utf-8");

  return outputPath;
}
