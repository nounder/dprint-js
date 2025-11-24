export type Logger = {
  debug(message?: any, ...optionalParams: any[]): void
  log(message?: any, ...optionalParams: any[]): void
  error(message?: any, ...optionalParams: any[]): void
}

export const empty = build({
  debug: () => {},
  log: () => {},
  error: () => {},
})

export function build(impl: Logger): Logger {
  return impl
}
