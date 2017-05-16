#!/usr/bin/env node

const LogDwim = require(`./`)
const logDwim = new LogDwim()
const { TRACE, DEBUG, INFO, WARN, ERROR, EXIT } = logDwim

function doSomethingAsync() {
  return new Promise((resolve, reject) => {
    reject(`haha`)
    setTimeout(() => {
      resolve(`success`) // Fulfill the promise successfully
    }, 100)
  })
}

doSomethingAsync().then((fulfilledResult) => {
  console.log(fulfilledResult) // Prints 'success'
})
