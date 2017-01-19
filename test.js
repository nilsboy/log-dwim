#!/usr/bin/env node

let {DEBUG, WARN, INFO, DIE, DUMP} = require(`.`)

console.log(require(`.`))

WARN(`warn`)
INFO(`info`)

DUMP({ 1: `la`, 2: { le: `lu`}})

DIE(`im out`)
