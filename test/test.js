/* global it */

`use strict`

const assert = require(`assert`)
const stdMocks = require(`std-mocks`)

const envPaths = require(`env-paths`)
const path = require(`path`)
const fs = require(`fs-extra`)
const LOG_DIRECTORY = require(`unique-temp-dir`)()

const Logger = require(`../`)
let lib

beforeEach(() => {
  process.stderr.isTTY = true
  lib = new Logger()
})

afterEach(() => {
  // make sure std* get restored after failing tests
  stdMocks.restore()
  if (fs.existsSync(LOG_DIRECTORY)) {
    fs.removeSync(LOG_DIRECTORY)
  }
})

it(`appName is set automatically`, () =>
  assert.equal(lib.appName, `log-dwim`)
)

it(`appName can be specified`, () =>
  assert.equal(new Logger({
    appName: `foo`
  }).appName, `foo`)
)

it(`createLogFileName returns absolute path`, () =>
  assert.ok(path.isAbsolute(lib.createLogFileName()))
)

it(`createLogFilame returns absolute path for leading tilde`, () => {
  assert.ok(path.isAbsolute(lib.createLogFileName(`~/la/le/lu`)))
})

it(`default logging directory`, () =>
  assert.ok(lib.createLogFileName().startsWith(envPaths(lib.appName).log))
)

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
  lib = new Logger()
  assert.equal(lib.logLevel, `error`)
})

it(`level gets set to info when connected to a tty`, () => {
  process.stderr.isTTY = true
  lib = new Logger()
  assert.equal(lib.logLevel, `info`)
})

it(`logs to logfile`, (done) => {
  const logFile = path.join(LOG_DIRECTORY, `bla.log`)

  lib.setLogFile(logFile)
  lib.INFO(`foo`)

  // Shutdown to sync the logfile to disk
  lib._log4js.shutdown((err) => {
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
