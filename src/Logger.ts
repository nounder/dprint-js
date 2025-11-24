// ordered by verbosity
export const LogLevels = [
  "debug",
  "info",
  "warn",
  "error",
  "silent",
] as const

export type LogLevel = typeof LogLevels[number]

/**
 * Check if a message of a given level should be logged based on current log level
 */
export function shouldLog(
  currentLogLevel: LogLevel,
  messageLevel: LogLevel,
): boolean {
  const currentLevel = LogLevels.indexOf(currentLogLevel)
  const msgLevel = LogLevels.indexOf(messageLevel)
  return msgLevel >= currentLevel
}
