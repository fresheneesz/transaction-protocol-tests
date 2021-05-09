var util = require("util")
var {GlobalState, User} = require('../tx-tools')


// Cases:
var cases = [
  'normal',
  'Bob never sends LTC',
  'Alice never signs the success transaction - Alice Refund',
  'Alice never signs the success transaction - Bob Timeout',
  'Bob never gives Alice bobSecret - Bob Success',
  'Bob never gives Alice bobSecret - Alice Revoke',
  'Alice never gives Bob AliceKey',
  'Alice can double spend in step 7',
]

cases.forEach((theCase) => {
  var failures = 0
  try {
    executeSequence(theCase)
  } catch(e) {
    failures++
    console.log(theCase+": ", e)
  }
  console.log("\nFailures: "+failures)
})



// Step 2: Case Bob never sends LTC

function executeSequence(theCase) {
  var aliceOut = [['aliceKey']]
  var bobOut = [['bobKey']]

  var gs = GlobalState()
  function Output() {
    return gs.Output.apply(gs, arguments)
  }

  var ltcToAlice = Output('LTC to Alice', ['bobKey'], [
    Output('Success', ['aliceSecret', 'bobSecret'], [])
  ]).confirmed()
  var btcToBob = Output('BTC to Bob', ['aliceKey'], [
    Output('Success', ['aliceKey', 'bobKey', 'bobSecret'], bobOut),
    Output('Revoke', ['aliceKey', 'bobKey', 'absTimelock(200)'], [
      Output('Refund', ['aliceKey', 'bobKey', 'aliceSecret', 'timelock(100)'], aliceOut),
      Output('Timeout', ['aliceKey', 'bobKey', 'aliceSecret', 'timelock(200)'], bobOut)
    ])
  ]).confirmed()

  var alice = gs.User(['aliceKey', 'aliceSecret'])
  var bob = gs.User(['bobKey', 'bobSecret'])

  printState("Begin Case: "+theCase, alice, bob)

  // Step 0
  alice.sign('aliceKey', btcToBob.out('Revoke'))
  alice.sign('aliceKey', btcToBob.out('Revoke', 'Timeout'))
  bob.sign('bobKey', btcToBob.out('Revoke'))
  bob.sign('bobKey', btcToBob.out('Revoke','Refund'))

  printState("After Step 0", alice, bob)

  // Step 1
  alice.send(btcToBob)
  printState("After Step 1", alice, bob)

  // Step 2
  if(theCase === 'Bob never sends LTC') {
    gs.timePasses(200)
    alice.send(btcToBob.out('Revoke'))

    printState("After Alice sends Revoke", alice, bob)

    gs.timePasses(100)
    alice.send(btcToBob.out('Revoke', 'Refund'))

    return printState("Final State", alice, bob)
  } else{
    bob.send(ltcToAlice)
    printState("After Step 2", alice, bob)
  }

  // Step 3
  if(theCase.indexOf('Alice never signs the success transaction') === 0) {
    gs.timePasses(200)
    bob.send(btcToBob.out('Revoke'))
    if(theCase === 'Alice never signs the success transaction - Alice Refund') {
      gs.timePasses(100)
      alice.send(btcToBob.out('Revoke', 'Refund'))
    } else { // Bob Timeout
      gs.timePasses(200)
      bob.send(btcToBob.out('Revoke', 'Timeout'))
    }
    return printState("Final State", alice, bob)
  } else {
    alice.sign('aliceKey', btcToBob.out('Success'))
    printState("After Step 3", alice, bob)
  }

  // Step 4
  if(theCase === 'Bob never gives Alice bobSecret - Bob Success') {
    bob.send(btcToBob.out('Success'))
    return printState("Final State")
  } else if(theCase === 'Bob never gives Alice bobSecret - Alice Revoke') {
    gs.timePasses(200)
    alice.send(btcToBob.out('Revoke'))
    gs.timePasses(100)
    alice.send(btcToBob.out('Revoke', 'Refund'))
    return printState("Final State")
  } else {
    bob.give('bobSecret', alice)
    printState("After Step 4", alice, bob)
  }

  // Step 5
  if(theCase === 'Alice never gives Bob AliceKey') {
    gs.timePasses(200)
    // Alice can now spend both the LTC and the BTC
    alice.send(btcToBob.out('Revoke'))
    alice.send(ltcToAlice.out('Success'))
    gs.timePasses(100)
    alice.send(btcToBob.out('Revoke', 'Refund'))
    return printState("Final State", alice, bob)
  } else {
    alice.give('aliceKey', bob)
    printState("After Step 5", alice, bob)
  }

  // Step 6 - Wait and watch.

  // Step 7
  if(theCase === 'Alice can double spend in step 7') {
    gs.timePasses(200)
    alice.send(btcToBob.out('Revoke'))
    alice.send(ltcToAlice.out('Success'))

    gs.timePasses(100)
    alice.send(btcToBob.out('Revoke', 'Refund'))
    return printState("Final State", alice, bob)
  } else {
    alice.send(ltcToAlice.out('Success'))
    printState("After Step 7", alice, bob)
  }

  bob.send(btcToBob.out('Success'))

  printState("Final State", alice, bob)

  function printState(name, alice, bob) {
    console.log("\n"+name+":\n")
    console.log(indent(2, ['LTC: '+ltcToAlice.print(), '', 'BTC: '+btcToBob.print()].join('\n')))
    console.log(indent(2, "\nAlice's State: "+util.inspect(alice.getMergedState(), {colors: true})))
    console.log(indent(2, "Bob's State:   "+util.inspect(bob.getMergedState(), {colors: true})))
  }
}

function indent(indent, string) {
  var indentText = ' '.repeat(indent)
  return indentText+string.split('\n').join('\n'+indentText)
}

