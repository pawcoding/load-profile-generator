import chalk from 'chalk'
import { WriteStream, createWriteStream } from 'fs'
import path from 'path'

/**
 * Regex to remove ANSI escape codes from a string
 */
const ansiRegex = [
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
].join('|')

/**
 * Custom logger to prepend prefix for each command / function
 */
export class Logger {
  /**
   * Write stream to log file
   */
  private static logFile?: WriteStream

  /**
   * Cache of all logs to be written to the log file
   */
  private static logs: string[] = []

  /**
   * Interval to write logs to file
   */
  private static logInterval?: NodeJS.Timeout

  /**
   * Write logs to file and clear log cache
   */
  private static logToFile(): void {
    if (Logger.logs.length > 0) {
      // Write logs to file
      const logs = Logger.logs.join('\n')
      Logger.logs = []
      Logger.logFile?.write(logs + '\n')
    }
  }

  /**
   * Start logging to file
   */
  public static startLogging(): void {
    if (!Logger.logInterval) {
      if (!Logger.logFile) {
        // Create file stream for logging
        const now = Date.now()
        Logger.logFile = createWriteStream(
          path.join(process.cwd(), 'lpg', 'logs', `log-${now}.txt`),
          { flags: 'w' },
        )
      }

      // Write logs to file every 5 seconds
      Logger.logInterval = setInterval(Logger.logToFile, 5000)
    }
  }

  /**
   * Stop logging to file and write remaining logs to file
   */
  public static stopLogging(): void {
    if (Logger.logInterval) {
      // Stop writing logs to file and clear interval
      clearInterval(Logger.logInterval)
      Logger.logInterval = undefined

      // Write remaining logs to file
      Logger.logToFile()
    }
  }

  /**
   * Prefix of the component / function that uses the logger
   */
  private readonly _prefix: string

  /**
   * Unique ID of the user
   */
  private readonly _userId?: number

  /**
   * Whether to log to std.out
   */
  private readonly _console: boolean

  /**
   * Maximum number of users to log to std.out
   */
  private readonly _maxLoggingUser: number

  /**
   * @param prefix Prefix of the component / function that uses the logger
   * @param userId Unique ID of the user (optional)
   * @param console Whether to log to std.out (default: true)
   * @param maxConcurrentUsers Maximum number of users to log to std.out (default: 10)
   */
  constructor(
    prefix: string,
    userId?: number,
    console = true,
    maxConcurrentUsers?: number,
  ) {
    this._prefix = prefix.toLocaleUpperCase().substring(0, 4).padEnd(4)
    this._userId = userId
    this._console = console

    if (maxConcurrentUsers) {
      if (maxConcurrentUsers > 10) {
        this._maxLoggingUser = maxConcurrentUsers / 10
      } else {
        this._maxLoggingUser = maxConcurrentUsers - 1
      }
    } else {
      this._maxLoggingUser = 10
    }

    Logger.startLogging()
  }

  /**
   * Write a message to std.out as info
   * and to the log file
   */
  public info(message: any): void {
    // Write unformatted message to log file
    const now = new Date()
    Logger.logs.push(
      `{${now.toISOString()}}\t[LPG/${this._prefix}${
        !!this._userId ? `/${this._userId.toString().padStart(5, '0')}` : ''
      }]\t${message}`.replace(new RegExp(ansiRegex, 'g'), ''),
    )

    // Only log every 10th user to avoid cluttering the console
    // unless verbose logging is enabled
    if (
      !this._console ||
      (this._userId &&
        this._userId % this._maxLoggingUser >= 1 &&
        process.env.LOGGING !== 'verbose')
    ) {
      return
    }

    // Write formatted message to std.out
    console.info(
      `${chalk.blue(
        `[${chalk.bold('LPG')}/${this._prefix}${
          !!this._userId ? `/${this._userId.toString().padStart(5, '0')}` : ''
        }]`,
      )}\t${message}`,
    )
  }

  /**
   * Write a message to std.err as error
   * and to the log file
   */
  public error(message: any): void {
    // Write unformatted message to log file
    const now = new Date()
    Logger.logs.push(
      `{${now.toISOString()}}\t[LPG/${this._prefix}${
        !!this._userId ? `/${this._userId.toString().padStart(5, '0')}` : ''
      }]\t${message}`.replace(new RegExp(ansiRegex, 'g'), ''),
    )

    // Write formatted message to std.err
    console.error(
      `${chalk.blue(
        `[${chalk.bold('LPG')}/${this._prefix}${
          this._userId ? `/${this._userId.toString().padStart(5, '0')}` : ''
        }]`,
      )}\t${chalk.red(message)}`,
    )
  }
}
