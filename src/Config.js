import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Find dprint.json configuration file starting from the current directory
 * and walking up the directory tree.
 */
export function findConfigFile(startDir = process.cwd(), options = {}) {
  // If config discovery is disabled, don't search
  if (options.configDiscovery === false) {
    return null;
  }

  // If custom config path is specified, use it
  if (options.config) {
    return options.config;
  }

  let currentDir = startDir;

  while (true) {
    const configPath = path.join(currentDir, "dprint.json");
    if (fs.existsSync(configPath)) {
      return configPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root directory
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * Load and parse dprint.json configuration file
 */
export function loadConfig(configPath, options = {}) {
  if (!configPath) {
    throw new Error("No dprint.json configuration file found");
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");

    // Try parsing directly first
    let config;
    try {
      config = JSON.parse(content);
    } catch (parseError) {
      // If direct parsing fails, try stripping comments
      const jsonContent = stripJsonComments(content);
      config = JSON.parse(jsonContent);
    }

    // Apply command-line option overrides
    if (options.plugins && options.plugins.length > 0) {
      config.plugins = options.plugins;
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to parse configuration file ${configPath}: ${error.message}`);
  }
}

/**
 * Simple JSON comment stripper (removes single-line and multi-line comments)
 */
function stripJsonComments(jsonString) {
  // Remove single-line comments
  let result = jsonString.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments (replace with space to avoid breaking JSON structure)
  result = result.replace(/\/\*[\s\S]*?\*\//g, " ");
  return result;
}

/**
 * Get default configuration for init command
 */
export function getDefaultConfig() {
  return {
    "$schema": "https://dprint.dev/schemas/v0.json",
    "projectType": "openSource",
    "incremental": true,
    "includes": ["**/*.{ts,tsx,js,jsx,json,md}"],
    "excludes": [
      "**/node_modules",
      "**/*-lock.json",
      "**/dist",
      "**/build",
      "**/coverage",
    ],
    "plugins": [
      "@dprint/typescript",
      "@dprint/json",
      "@dprint/markdown",
    ],
    "typescript": {},
    "json": {},
    "markdown": {},
  };
}
