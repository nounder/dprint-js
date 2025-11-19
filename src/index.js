// Main entry point for programmatic usage
export { loadConfig, findConfigFile, createDefaultConfig } from "./config.js";
export { findFiles, getFileExtension, shouldFormatFile } from "./files.js";
export {
  loadPlugins,
  findFormatterForFile,
  formatFile,
  writeFormattedFile
} from "./formatter.js";
export { init } from "./commands/init.js";
export { fmt } from "./commands/fmt.js";
export { check } from "./commands/check.js";
