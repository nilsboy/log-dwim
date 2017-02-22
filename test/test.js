/* global it */

`use strict`

// TODO: test parent name
// TODO: test file pattern postfix

const assert = require(`assert`)
const stdMocks = require(`std-mocks`)

const envPaths = require(`env-paths`)
const path = require(`path`)

var Logger = require(`../`)
var lib

beforeEach(() =>
  lib = new Logger()
)

afterEach(() => {
  // make sure std* get restored after failing tests
  stdMocks.restore()
})

it(`appName is set automatically`, () =>
  assert.equal(lib.appName, `log-dwim`)
)

it(`appName can be specified`, () =>
  assert.equal(new Logger({appName: `foo`}).appName, `foo`)
)

it(`createLogFileName returns absolute path`, () =>
  assert.ok(path.isAbsolute(lib.createLogFileName()))
)

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

it(`stderr output looks right`, () => {
  stdMocks.use()
  lib.INFO(`foo`)
  stdMocks.restore()
  const output = stdMocks.flush()

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

