import * as Logger from "./Logger.ts"

export function make() {
  return Logger.build({
    debug(message?: any, ...args: any[]): void {
      console.debug(message, ...args)
    },

    log(message?: any, ...args: any[]): void {
      console.log(message, ...args)
    },

    error(message?: any, ...args: any[]): void {
      console.error(message, ...args)
    },
  })
}
