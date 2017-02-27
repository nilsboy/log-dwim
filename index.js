#!/usr/bin/env node

// TODO: option to set pattern layout
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
const fs = require(`fs-extra`)
const expandTilde = require(`expand-tilde`)
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

  constructor(options = { appName: null }) {

    if(process.env.LOG_DWIM_DEBUG) {
      this._debugDwim = true
    }

    this.setAppName(options.appName)
    this._logger = log4js.getLogger(`main`)
    this._log4js = log4js

    if(!process.env.LOG_LEVEL) {
      if(process.stderr.isTTY) {
        this.setLogLevel(`INFO`)
      } else {
        this.setLogLevel(`ERROR`)
      }
    }

    // this._traceDwim(`### process.env.LOG_FILE:`, process.env.LOG_FILE)
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

    if(this._debugDwim) {
      if (config.appenders[1]) {
        this._traceDwim(`Replacing already set logfile: ${config.appenders[1].filename} - with: ${logFilePath}`)
      } else {
        this._traceDwim(`Setting logfile to ${logFilePath}`)
      }
    }

    fileAppenderConfig.filename = logFilePath
    config.appenders[1] = fileAppenderConfig
    this._log4js.configure(config)

    if(this._debugDwim) {
      this._traceDwim(`Logfile set to: ${logFilePath}`)
    }

    this.logfile = logFilePath
  }

  EXIT() {
    this._logger.fatal(...Array.prototype.slice.call(arguments))
    process.exit(1)
  }

  DUMP(object) {
    this._logger[logLevel](`DUMP:\n  ${util.inspect(object, {
      depth: null
    })}`)
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
      this._logger.fatal(`received SIGINT - exiting`)
      process.exit(1)
    }

    const sighubListener = () => {
      this._logger.warn(`received SIGHUB`)
    }

    function warningListener(warning) {
      this._logger.warn(warning)
    }

    const uncaughtExceptionListener = (err) => {
      this._logger.fatal(`Exiting due to uncaught exception: ${err}`)

      // log4js.shutdown()
      // TODO: need to throw if only handler?
      throw err

      // process.exit(1)
    }

    function unhandledRejectionHandler(reason, p) {
      this._logger.warn(`Unhandled Rejection at: Promise `, p, ` reason: `, reason)
    }

    function rejectionHandledHandler(p) {
      this._logger.info(`Handled Rejection at: Promise `, p)
    }
  }
}

module.exports = Logger

