import * as NFS from "node:fs"
import * as NPath from "node:path"
import * as Logger from "./Logger.ts"

function serialize(value: any): string {
  if (value === undefined) return "undefined"
  if (value === null) return "null"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack || ""}`
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function make(opts: {
  path: string
}): Logger.Logger {
  // Ensure directory exists
  const logDir = NPath.dirname(opts.path)
  if (!NFS.existsSync(logDir)) {
    NFS.mkdirSync(logDir, { recursive: true })
  }

  function write(level: string, message?: any, ...optionalParams: any[]): void {
    const timestamp = new Date().toISOString()
    const parts = [message, ...optionalParams].map(serialize).join(" ")
    const line = `[${timestamp}] ${level}: ${parts}\n`
    NFS.writeFileSync(opts.path, line, { flag: "a" })
  }

  return Logger.build({
    debug(message?: any, ...optionalParams: any[]): void {
      write("DEBUG", message, ...optionalParams)
    },

    log(message?: any, ...optionalParams: any[]): void {
      write("LOG", message, ...optionalParams)
    },

    error(message?: any, ...optionalParams: any[]): void {
      write("ERROR", message, ...optionalParams)
    },
  })
}
