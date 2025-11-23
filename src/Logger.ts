/**
 * Logging utilities for dprint-js
 */

/**
 * All available log levels in order of verbosity
 */
export const LogLevels = ["debug", "info", "warn", "error", "silent"] as const;

/**
 * Log level type for controlling logging output
 */
export type LogLevel = typeof LogLevels[number];

/**
 * Check if a message of a given level should be logged based on current log level
 * @param currentLogLevel - The current log level setting
 * @param messageLevel - The level of the message to check
 * @returns True if the message should be logged
 */
export function shouldLog(currentLogLevel: LogLevel, messageLevel: LogLevel): boolean {
  const currentLevel = LogLevels.indexOf(currentLogLevel);
  const msgLevel = LogLevels.indexOf(messageLevel);
  return msgLevel >= currentLevel;
}
