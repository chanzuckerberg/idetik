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

// Add new module names here as needed to represent different parts of the application
type Module =
  | "ChunkManager"
  | "ChunkManagerSource"
  | "ChunkedImageLayer"
  | "EventDispatcher"
  | "Idetik"
  | "ImageLayer"
  | "LabelImageLayer"
  | "RenderablePool"
  | "Viewport"
  | "WebGLRenderer"
  | "WebGLShaderProgram"
  | "WebGLTexture"
  | "WireframeGeometry";

export class Logger {
  private static logLevel_: LogLevel =
    import.meta.env.MODE === "production" ? "info" : "debug";

  public static setLogLevel(level: LogLevel) {
    Logger.logLevel_ = level;
  }

  public static debug(
    moduleName: Module,
    message: string,
    ...params: unknown[]
  ) {
    Logger.log("debug", moduleName, message, ...params);
  }

  public static info(
    moduleName: Module,
    message: string,
    ...params: unknown[]
  ) {
    Logger.log("info", moduleName, message, ...params);
  }

  public static warn(
    moduleName: Module,
    message: string,
    ...params: unknown[]
  ) {
    Logger.log("warn", moduleName, message, ...params);
  }

  public static error(
    moduleName: Module,
    message: string,
    ...params: unknown[]
  ) {
    Logger.log("error", moduleName, message, ...params);
  }

  private static log(
    level: LogLevel,
    moduleName: Module,
    message: string,
    ...args: unknown[]
  ) {
    if (Levels[level] < Levels[Logger.logLevel_]) return;

    const timestamp = new Date().toISOString();
    const color = Colors[level];
    const tag = `[${timestamp}][${level.toUpperCase()}][${moduleName}]`;
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
}
