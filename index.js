// TODO unredirect console.log?

"use strict;"

let logLevel = process.env.LOG_LEVEL || `INFO`
console.log(`loglevel: ${logLevel}`)

logLevel = logLevel.toLowerCase()

const log4js = require('log4js');
const util = require('util')


var config = {
    "appenders": [
    ]
}
var consoleAppenderConfig = {
  "type": "stderr",
  "layout": {
    "type": "pattern",
    "pattern": "%d%h %p> %m%n",
  }
}

var consoleConfig = {
  info: {
    example: `INFO> message`
    , pattern: "%d{hh:mm} %-5p> %m",
  }
  , debug: {
    example: `2017/01/09 00:17:04 [11104] DEBUG /home/file 59 class> message`
    , pattern: "%d{ISO8601_WITH_TZ_OFFSET} [%x{pid}] %p %m"
    , tokens: {
      "pid" : function() { return process.pid }
    }
  }
}

// TODO: option to set pattern layout
// consoleAppenderConfig.layout.pattern = consoleConfig[logLevel].pattern
consoleAppenderConfig.layout.pattern = consoleConfig[`info`].pattern
consoleAppenderConfig.layout.tokens = consoleConfig[`info`].tokens

config.appenders.push(consoleAppenderConfig)

log4js.configure(config, {});

/* TODO app */
let logger = log4js.getLogger("app");
logger.setLevel(logLevel)

var exports = {
  DIE() {
    logger.fatal(...Array.prototype.slice.call(arguments))
    process.exit(1)
  },
  DUMP(object) {
    logger[logLevel](`\n` + util.inspect(object, {depth: null}))
  }
}

for (let m of [`trace`, `debug`, `info`, `warn`, `error`, `fatal`]) {
  exports[m.toUpperCase()] = function() {
    return logger[m](...Array.prototype.slice.call(arguments))
  }
}

module.exports = exports
