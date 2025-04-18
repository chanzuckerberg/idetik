type LogLevel = "info" | "warn" | "error" | "debug";

const Levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} satisfies Record<LogLevel, number>;

const Colors = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
} satisfies Record<LogLevel, string>;

const regex = /at new\s+(.*)\s+\(/;

export class Logger {
  private static logLevel_: LogLevel =
    import.meta.env.MODE === "production" ? "warn" : "debug";

  public static setLogLevel(level: LogLevel) {
    Logger.logLevel_ = level;
  }

  public static debug(
    message: string,
    moduleName?: string,
    ...params: unknown[]
  ) {
    Logger.log("debug", message, moduleName, ...params);
  }

  public static info(
    message: string,
    moduleName?: string,
    ...params: unknown[]
  ) {
    Logger.log("info", message, moduleName, ...params);
  }

  public static warn(
    message: string,
    moduleName?: string,
    ...params: unknown[]
  ) {
    Logger.log("warn", message, moduleName, ...params);
  }

  public static error(
    message: string,
    moduleName?: string,
    ...params: unknown[]
  ) {
    Logger.log("error", message, moduleName, ...params);
  }

  private static log(
    level: LogLevel,
    message: string,
    moduleName?: string,
    ...args: unknown[]
  ) {
    if (Levels[level] < Levels[Logger.logLevel_]) return;

    const timestamp = new Date().toISOString();
    const module = moduleName ?? Logger.detectModuleName();
    const color = Colors[level];
    const tag = `[${timestamp}][${level.toUpperCase()}][${module}]`;
    const output = [`${color}${tag}`, message, ...args];

    switch (level) {
      case "debug":
        console.debug(...output);
        break;
      case "info":
        console.info(...output);
        break;
      case "warn":
        console.warn(...output);
        break;
      case "error":
        console.error(...output);
        break;
    }
  }

  private static detectModuleName(): string {
    // This logic is based on the format of the stack trace in the V8 engine
    // (used by Node.js and Chrome). It also makes some assumptions about the
    // calling context of the logger. It's very brittle and may break in future
    // versions of Node.js or Chrome. Let's keep it simple for now and improve
    // it later if needed.
    try {
      const err = new Error();
      const stack = err.stack?.split("\n");
      if (!stack || stack.length < 4) return "unknown";
      const callerLine = stack[4]; // "at new ModuleName (file:line)"
      const match = regex.exec(callerLine);
      if (match) return match[1].trim();
    } catch {
      // ignore errors
    }

    return "unknown";
  }
}
