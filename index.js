#!/usr/bin/env node

// TODO: option to set pattern layout
// TODO: dump config if LOG_DWIM_DUMP_CONFIG is set or at trace level?
// TODO add color - the stdout appender has color already build in
// TODO: to add line and column of log statement:
//   checkout: https://github.com/ww24/log4js-node-extend
// TODO: add stacktrace
// TODO: allow to call with a function to execute but also to print
// TODO: env vars based on app name
// TODO: add option for sync: https://github.com/nomiddlename/log4js-node/wiki/Date%20rolling%20file%20appender%20-%20with%20synchronous%20file%20output%20modes

"use strict;"

// get calling modules package.json
const mainPackage = require.main.require('./package')

const paths = require('env-paths')(mainPackage.name)
const log4js = require('log4js');
const util = require('util')
const fs = require('fs')
const path = require('path')
const expandTilde = require('expand-tilde')
const mkdir = require(`mkdirp`).sync
const _ = require('lodash')

var config = {
    "appenders": [
    ]
}
var consoleAppenderConfig = {
  "category": [ "main" ],
  "type": "stderr",
  "layout": {
    "type": "pattern"
    , pattern: "%d{hh:mm} %-5p> %m"
    , example: `INFO> message`
  }
}

var fileAppenderConfig = {
  "type": "dateFile",
  "usefsync": true,
  "absolute": true,
  "pattern": ".dd",
  // add pattern to first file too
  "alwaysIncludePattern": false, 
  category: [ 'main' ],
  "layout": {
    "type": "pattern",
    "pattern": "%d %h %p> %m",
  }
}

config.appenders.push(consoleAppenderConfig)

let logger = log4js.getLogger(`main`)
let logLevel = process.env.LOG_LEVEL || `INFO`
console.error(`using loglevel: ${logLevel}`)
logLevel = logLevel.toLowerCase()
logger.setLevel(logLevel)

log4js.configure(config)
var exports = {
  EXIT() {
    logger.fatal(...Array.prototype.slice.call(arguments))
    process.exit(1)
  },
  DUMP(object) {
    logger[logLevel](`DUMP:\n  ` + util.inspect(object, {depth: null}))
  },
  createLogFileName(logFilePath = mainPackage.name) {
    if(!logFilePath) {
      logFilePath = mainPackage.name
    }
    logFilePath = expandTilde(logFilePath)
    
    if(!path.isAbsolute(logFilePath)) {
      logFilePath = path.join(paths.log, logFilePath)
    }

    mkdir(path.dirname(logFilePath))

    if(path.extname(logFilePath) !== `.log`) {
      logFilePath += `.log`
    }
  },
  setLogFile(logFilePath) {
    if(!logFilePath) {
      logFilePath = mainPackage.name
    }
    logFilePath = expandTilde(logFilePath)
    
    if(!path.isAbsolute(logFilePath)) {
      logFilePath = path.join(paths.log, logFilePath)
    }

    mkdir(path.dirname(logFilePath))

    if(path.extname(logFilePath) !== `.log`) {
      logFilePath += `.log`
    }

    if (config.appenders[1]) {
      logger.warn(`Replacing already set logfile: ${config.appenders[1].filename} - with: ${logFilePath}`)
    } else {
      logger.info(`Setting logfile to ${logFilePath}`)
    }

    fileAppenderConfig.filename = logFilePath
    config.appenders[1] = fileAppenderConfig
    log4js.configure(config)

    logger.info(`Logfile set to: ${logFilePath}`)
  },
}

exports.logger = exports

for (let m of [`trace`, `debug`, `info`, `warn`, `error`, `fatal`]) {
  exports[m.toUpperCase()] = function() {
    if (!logger[`is` + _.startCase(m) + `Enabled`]()) {
      return
    }

    return logger[m](...Array.prototype.slice.call(arguments))
  }
}

process.on('SIGINT', () => {
  logger.fatal(`sigint 1`)
})

process.on('SIGINT', () => {
  logger.fatal(`sigint 2`)
  process.exit(1)
})

const sigintListener = () => {
  logger.fatal(`received SIGINT - exiting`)
  process.exit(1)
}

const uncaughtExceptionListener = (err) => {
  logger.fatal(`Exiting due to uncaught exception: ${err}`)
  // log4js.shutdown()
  throw err
  // process.exit(1)
}


const sighubListener = () => {
  logger.warn(`received SIGHUB`)
}

function warningListener(warning) {
  logger.warn(warning)
}

// TODO: handle other events too?
addAsFirstListener(`SIGINT`, sigintListener) 
addAsFirstListener(`SIGHUB`, sighubListener) 
addAsFirstListener(`uncaughtException`, uncaughtExceptionListener) 
addAsFirstListener(`warning`, warningListener)

// if no other listeners: exit.
function addAsFirstListener(signal, handler) {
  let listeners = process.listeners(signal)
  process.removeAllListeners(signal)
  
  for (const listener of [handler, ...listeners]) {
    process.on(signal, listener)
  }
}

if (process.env.LOG_FILE) {
  exports.setLogFile(process.env.LOG_FILE)
}

module.exports = exports
