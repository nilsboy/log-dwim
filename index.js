#!/usr/bin/env node

// TODO: option to set pattern layout
// TODO add color - the stdout appender has color already build in
// TODO: to add line and column of log statement:
//   checkout: https://github.com/ww24/log4js-node-extend
// TODO: add stackTrace - i.e. see: https://github.com/tj/callsite
// TODO: allow to call with a function to execute but also to print
// TODO: env vars based on app name
// TODO: add option for sync: https://github.com/nomiddlename/log4js-node/wiki/Date%20rolling%20file%20appender%20-%20with%20synchronous%20file%20output%20modes
// TODO: add appname to log pattern?
// TODO: check NODE_ENV?

"use strict;"

// allows long stacktraces for promises in debug mode
const Promise = require(`bluebird`)

const path = require(`path`)
const packpath = require(`packpath`)
const envPaths = require(`env-paths`)
const log4js = require(`log4js`)
const util = require(`util`)
const fs = require(`fs-extra`)
const expandTilde = require(`expand-tilde`)
const _ = require(`lodash`)
const callsite = require(`callsite`)

let logger

// // TODO: tunnel all stderr?
// process.__defineGetter__(`stderr`, () => new EchoStream())
// const stream = require(`stream`)
// class EchoStream extends stream.Writable {
//   _write(chunk, enc, next) {
//     logger.INFO(chunk.toString())
//     next()
//   }
// }

const config = {
  appenders: []
}

const consoleAppenderConfig = {
  category: [`main`]
  , type: `stderr`

  , layout: {
    type: `pattern`
    , pattern: `%d{hh:mm} %-5p> %m`
    , example: `INFO > message`
  }
}

const fileAppenderConfig = {
  type: `dateFile`
  , usefsync: true
  , absolute: true
  , pattern: `.dd`

  // add pattern to first filename too
  , alwaysIncludePattern: false
  , category: [`main`]
  , layout: {
    type: `pattern`
    , pattern: `%d %h %-5p> %m`
  }
}

config.appenders.push(consoleAppenderConfig)

class Logger {
  constructor(
    options = {
      appName: null
    }
  ) {
    if (process.env.LOG_DWIM_DEBUG) {
      this._debugDwim = true
    }

    this.setAppName(options.appName)
    this._logger = log4js.getLogger(`main`)
    this._log4js = log4js

    if (!process.env.LOG_LEVEL) {
      if (process.stderr.isTTY) {
        this.setLogLevel(`INFO`)
      } else {
        this.setLogLevel(`ERROR`)
      }
    } else {
      this.setLogLevel(process.env.LOG_LEVEL.toUpperCase())
    }

    // this._traceDwim(`### process.env.LOG_FILE:`, process.env.LOG_FILE)
    if (process.env.LOG_FILE) {
      this.setLogFile(process.env.LOG_FILE)
    }

    log4js.configure(config)
    this.createLoggerFacade()
    this.installExceptionHandlers()
  }

  setAppName(appName) {
    // get calling modules package.json
    const parentPackageJson = path.join(packpath.parent(), `package.json`)

    this.parentPackage = require(parentPackageJson)
    this.appName = appName || this.parentPackage.name || `unnamed logger`
  }

  setLogLevel(logLevel) {
    this.logLevel = logLevel.toLowerCase()
    this._logger.setLevel(this.logLevel)
    if (this._debugDwim) {
      this._traceDwim(`Loglevel set to: ${this.logLevel}`)
    }
  }

  _traceDwim(msg) {
    console.error(`log-dwim DEBUG> ${msg}`)
  }

  // TODO: static
  createLogFileName(logFilePath) {
    const logDir = envPaths(this.appName).log

    if (!logFilePath) {
      logFilePath = this.appName
    }
    logFilePath = expandTilde(logFilePath)

    if (!path.isAbsolute(logFilePath)) {
      logFilePath = path.join(logDir, logFilePath)
    }

    if (path.extname(logFilePath) !== `.log`) {
      logFilePath += `.log`
    }
    return logFilePath
  }

  setLogFile(logFilePath) {
    logFilePath = this.createLogFileName(logFilePath)
    fs.mkdirsSync(path.dirname(logFilePath))

    if (this._debugDwim) {
      if (config.appenders[1]) {
        this._traceDwim(
          `Replacing already set logfile: ${config.appenders[1].filename} - with: ${logFilePath}`
        )
      } else {
        this._traceDwim(`Setting logfile to ${logFilePath}`)
      }
    }

    fileAppenderConfig.filename = logFilePath
    config.appenders[1] = fileAppenderConfig
    this._log4js.configure(config)

    if (this._debugDwim) {
      this._traceDwim(`Logfile set to: ${logFilePath}`)
    }

    this.logfile = logFilePath
  }

  EXIT() {
    this._logger.fatal(...Array.prototype.slice.call(arguments))
    process.exit(1)
  }

  DUMP(object) {
    this._logger[logLevel](
      `DUMP:\n  ${util.inspect(object, {
        depth: null
      })}`
    )
  }

  createLoggerFacade() {
    const logger = this._logger

    for (const m of [`trace`, `debug`, `info`, `warn`, `error`, `fatal`]) {
      this[m.toUpperCase()] = function() {
        if (!logger[`is${_.startCase(m)}Enabled`]()) {
          return
        }
        return logger[m](...Array.prototype.slice.call(arguments))
      }
    }
  }

  // Browser support may need Bluebird to throw these:
  // WindowEventHandlers.onunhandledrejection
  // WindowEventHandlers.onrejectionhandled
  // (https://trackjs.com/blog/unhandled-promises/)
  installExceptionHandlers() {
    logger = this
    addAsFirstListener(`SIGINT`, sigintEventListener)
    addAsFirstListener(`SIGHUB`, sighubEventListener)
    addAsFirstListener(`warning`, warningEventListener, true)

    addAsFirstListener(`uncaughtException`, uncaughtExceptionEventListener)

    addAsFirstListener(`unhandledRejection`, unhandledRejectionEventListener)
    addAsFirstListener(`rejectionHandled`, rejectionHandledEventListener)

    addAsFirstListener(`beforeExit`, () =>
      logger.TRACE(`beforeExit event received`)
    )
    addAsFirstListener(`exit`, exitCode =>
      logger.TRACE(`exit event received with exitCode ${exitCode}`)
    )
    addAsFirstListener(`message`, () =>
      logger.TRACE(`message event received by child process`)
    )

    function addAsFirstListener(signal, handler, removeExisting) {
      let listeners = process.listeners(signal)

      if (removeExisting) {
        listeners = []
      } else if (listeners.length) {
        logger.TRACE(
          `found existing event listener for event "${signal}":\n${listeners}`
        )
      }

      process.removeAllListeners(signal)

      for (const listener of [handler, ...listeners]) {
        process.on(signal, listener)
      }
    }

    function sigintEventListener() {
      logger.FATAL(`SIGINT event received`)
      process.exit(1)
    }

    function sighubEventListener() {
      logger.WARN(`SIGHUB event received`)
    }

    function warningEventListener(warning) {
      logger.WARN(`warning event received:\n`, warning)
    }

    function uncaughtExceptionEventListener(err) {
      logger.FATAL(
        `uncaughtException event received:\n${err.stack}\n${_stackTrace()}`
      )
      process.exit(1)
    }

    // exists in future versions of node by itself
    // TODO: stackTrace not useful
    function unhandledRejectionEventListener(reason, p) {
      logger.FATAL(
        reason,
        // TODO: new line
        `(unhandledRejection event)\n`
      )
      process.exit(1)
    }

    function rejectionHandledEventListener(p) {
      logger.WARN(`rejectionHandled event received:\nPromise:\n`, p)
    }

    function _stackTrace() {
      let stackTrace = ``

      callsite().forEach((site) => {
        stackTrace +=
          `\n    at ${site.getFunctionName() || `anonymous`}` +
          ` (${site.getFileName()}:${site.getLineNumber()})`
      })
      return stackTrace
    }
  }
}

module.exports = Logger
