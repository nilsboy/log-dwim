#!/usr/bin/env node

// TODO: option to set pattern layout
// TODO: dump config if LOG_DWIM_DUMP_CONFIG is set or at trace level?
// TODO add color - the stdout appender has color already build in
// TODO: to add line and column of log statement:
//   checkout: https://github.com/ww24/log4js-node-extend
// TODO: add stacktrace - i.e. see: https://github.com/tj/callsite
// TODO: allow to call with a function to execute but also to print
// TODO: env vars based on app name
// TODO: add option for sync: https://github.com/nomiddlename/log4js-node/wiki/Date%20rolling%20file%20appender%20-%20with%20synchronous%20file%20output%20modes
// TODO: add appname to log pattern?
// TODO: tunnel all stderr?

"use strict;"

const path = require(`path`)
const packpath = require(`packpath`)
const envPaths = require(`env-paths`)
const log4js = require(`log4js`)
const util = require(`util`)
const fs = require(`fs`)
const expandTilde = require(`expand-tilde`)
const mkdir = require(`mkdirp`).sync
const _ = require(`lodash`)

const config = {
  appenders: [
  ]
}

const consoleAppenderConfig = {
  category: [`main`]
  , type: `stderr`

  , layout: {
    type: `pattern`
    , pattern: `%d{hh:mm} %-5p> %m`
    , example: `INFO> message`
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
    , pattern: `%d %h %p> %m`
  }
}

config.appenders.push(consoleAppenderConfig)

class Logger {

  constructor(options = {
    appName: null
  }) {
    this.setAppName(options.appName)
    this._loggerBackend = log4js.getLogger(`main`)
    this.setLogLevel(process.env.LOG_LEVEL || `INFO`)

    if (process.env.LOG_FILE) {
      this.setLogFile(process.env.LOG_FILE)
    }

    log4js.configure(config)

    this.createLoggerFacade()
  }

  setAppName(appName) {
    // get calling modules package.json
    const parentPackageJson = path.join(packpath.parent(), `package.json`)

    this.parentPackage = require(parentPackageJson)
    this.appName = appName || this.parentPackage.name || `unnamed logger`
  }

  setLogLevel(logLevel) {
    this.logLevel = logLevel.toLowerCase()
    this._loggerBackend.setLevel(this.logLevel)
    if (process.env.DEBUG_LOGGER) {
      console.error(`Using loglevel: ${this.logLevel}`)
    }
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
    mkdir(path.dirname(logFilePath))

    if (config.appenders[1]) {
      this._loggerBackend.warn(`Replacing already set logfile: ${config.appenders[1].filename} - with: ${logFilePath}`)
    } else {
      this._loggerBackend.info(`Setting logfile to ${logFilePath}`)
    }

    fileAppenderConfig.filename = logFilePath
    config.appenders[1] = fileAppenderConfig
    this.log4js.configure(config)

    this._loggerBackend.info(`Logfile set to: ${logFilePath}`)
  }

  EXIT() {
    this._loggerBackend.fatal(...Array.prototype.slice.call(arguments))
    process.exit(1)
  }

  DUMP(object) {
    this._loggerBackend[logLevel](`DUMP:\n  ${util.inspect(object, {
      depth: null
    })}`)
  }

  createLoggerFacade() {
    const loggerBackend = this._loggerBackend

    for (const m of [`trace`, `debug`, `info`, `warn`, `error`, `fatal`]) {
      this[m.toUpperCase()] = function() {
        if (!loggerBackend[`is${_.startCase(m)}Enabled`]()) {
          return
        }
        return loggerBackend[m](...Array.prototype.slice.call(arguments))
      }
    }
    this.logger = this
  }

  // TODO
  installExceptionHandlers() {
    addAsFirstListener(`SIGINT`, sigintListener)
    addAsFirstListener(`SIGHUB`, sighubListener)
    addAsFirstListener(`warning`, warningListener)
    addAsFirstListener(`uncaughtException`, uncaughtExceptionListener)
    addAsFirstListener(`unhandledRejection`, unhandledRejectionHandler)
    addAsFirstListener(`rejectionHandled`, rejectionHandledHandler)

    function addAsFirstListener(signal, handler) {
      const listeners = process.listeners(signal)

      process.removeAllListeners(signal)

      for (const listener of [handler, ...listeners]) {
        process.on(signal, listener)
      }
    }

    const sigintListener = () => {
      this._loggerBackend.fatal(`received SIGINT - exiting`)
      process.exit(1)
    }

    const sighubListener = () => {
      this._loggerBackend.warn(`received SIGHUB`)
    }

    function warningListener(warning) {
      this._loggerBackend.warn(warning)
    }

    const uncaughtExceptionListener = (err) => {
      this._loggerBackend.fatal(`Exiting due to uncaught exception: ${err}`)

      // log4js.shutdown()
      // TODO: need to throw if only handler?
      throw err

      // process.exit(1)
    }

    function unhandledRejectionHandler(reason, p) {
      this._loggerBackend.warn(`Unhandled Rejection at: Promise `, p, ` reason: `, reason)
    }

    function rejectionHandledHandler(p) {
      this._loggerBackend.info(`Handled Rejection at: Promise `, p)
    }
  }
}

module.exports = Logger

