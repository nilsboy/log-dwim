/* global it */

`use strict`

const assert = require(`assert`)
const stdMocks = require(`std-mocks`)

const envPaths = require(`env-paths`)
const path = require(`path`)
const fs = require(`fs-extra`)
const LOG_DIRECTORY = require(`unique-temp-dir`)()

const LogDwim = require(`../`)
let lib

// process.env.LOG_DWIM_DEBUG = 1

beforeEach((done) => {
  process.stderr.isTTY = true
  lib = new LogDwim()
  done()
})

afterEach((done) => {
  delete(process.env.LOG_FILE)
  // make sure std* get restored after failing tests
  stdMocks.restore()
  if (fs.existsSync(LOG_DIRECTORY)) {
    fs.removeSync(LOG_DIRECTORY)
  }
  done()
})

it(`appName is set automatically`, () =>
  assert.equal(lib.appName, `log-dwim`)
)

it(`appName can be specified`, () =>
  assert.equal(new LogDwim({
    appName: `foo`
  }).appName, `foo`)
)

it(`createLogFileName returns absolute path`, () =>
  assert.ok(path.isAbsolute(lib.createLogFileName()))
)

it(`createLogFileName returns absolute path for leading tilde`, () => {
  assert.ok(path.isAbsolute(lib.createLogFileName(`~/foo`)))
})

it(`default logging directory`, () =>
  assert.ok(lib.createLogFileName().startsWith(envPaths(lib.appName).log))
)

// TODO: async test problem with env var and `logs to logfile` test
// it(`set logfile name via env`, () => {
//   const logfile = path.join(LOG_DIRECTORY, `baz.log`)
//   process.env.LOG_FILE = logfile
//   lib = new LogDwim()
//   assert.ok(lib.logfile == logfile)
// })

// TODO: still not convinced this is good...
it(`default logging directory ends with -nodejs`, () =>
  assert.ok(path.dirname(lib.createLogFileName()).endsWith(`-nodejs`))
)

it(`produces no stdout`, () => {
  stdMocks.use()
  lib.INFO(`foo`)
  stdMocks.restore()
  const output = stdMocks.flush()

  assert.equal(output.stdout, ``)
})

it(`stderr output looks ok`, () => {
  lib.setLogLevel(`INFO`)
  stdMocks.use()
  lib.INFO(`foo`)
  const output = stdMocks.flush()

  stdMocks.restore()
  assert.ok(/^\d\d\:\d\d INFO > foo\n$/.test(output.stderr.toString()))
})

// TODO: check all levels
it(`outputs trace output with log level trace`, () => {
  lib.setLogLevel(`TRACE`)
  stdMocks.use()
  lib.TRACE(`foo`)
  stdMocks.restore()
  const output = stdMocks.flush()

  assert.ok(/^\d\d\:\d\d TRACE> foo\n$/.test(output.stderr.toString()))
})

it(`outputs INFO output with log level trace`, () => {
  lib.setLogLevel(`TRACE`)
  stdMocks.use()
  lib.INFO(`foo`)
  stdMocks.restore()
  const output = stdMocks.flush()

  assert.ok(/^\d\d\:\d\d INFO > foo\n$/.test(output.stderr.toString()))
})

it(`level gets set to error when not connected to a tty`, () => {
  process.stderr.isTTY = false
  lib = new LogDwim()
  assert.equal(lib.logLevel, `error`)
})

it(`level gets set to info when connected to a tty`, () => {
  lib = new LogDwim()
  assert.equal(lib.logLevel, `info`)
})

it(`logs to logfile`, (done) => {
  const logFile = path.join(LOG_DIRECTORY, `foo.log`)

  // console.error(`### process.env.LOG_FILE:`, process.env.LOG_FILE)

  lib = new LogDwim()
  lib.setLogFile(logFile)
  lib.INFO(`foo`)

  // Shutdown to sync the logfile to disk
  lib._log4js.shutdown((err) => {
  delete(process.env.LOG_FILE)
    if (err) {
      throw err
    }

    assert.ok(fs.existsSync(logFile))
    const output = fs.readFileSync(logFile).toString()

    // 2017-02-27 14:49:54.077 hostname INFO > foo
    assert.ok(/^.* INFO > foo\n*$/.test(output))

    done()
  })
})
