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

var failures = 0
cases.forEach((theCase) => {
  try {
    executeSequence(theCase)
  } catch(e) {
    failures++
    console.log(theCase+": ", e)
  }
})
console.log("\nFailures: "+failures)



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
    Output('Success', ['aliceKey', 'bobKey'], []),
    Output('Bob Claim 1', ['aliceKey', 'bobKey', 'bobSecret'], bobOut),
    Output('Revoke', ['aliceKey', 'bobKey', 'absTimelock(100)'], [
      Output('Bob Claim 2', ['aliceKey', 'bobKey'], []),
      Output('Refund', ['aliceKey', 'bobKey', 'aliceSecret', 'timelock(100)'], aliceOut),
      Output('Timeout', ['aliceKey', 'bobKey', 'timelock(200)'], bobOut)
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

  printState("After Step 0 (Transactions have been presigned)", alice, bob)

  // Step 1
  alice.send(btcToBob)
  printState("After Step 1 (Alice sent the 'BTC to Bob' transaction)", alice, bob)

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
    printState("After Step 2 (Bob sent the 'LTC to Alice' transaction)", alice, bob)
  }

  // Step 3
  if(theCase.indexOf('Alice never signs the Bob Claim 1 transaction') === 0) {
    gs.timePasses(200)
    bob.send(btcToBob.out('Revoke'))
    if(theCase === 'Alice never signs the Bob Claim 1 transaction - Alice Refund') {
      gs.timePasses(100)
      alice.send(btcToBob.out('Revoke', 'Refund'))
    } else { // Bob Timeout
      gs.timePasses(200)
      bob.send(btcToBob.out('Revoke', 'Timeout'))
    }
    return printState("Final State", alice, bob)
  } else {
    alice.sign('aliceKey', btcToBob.out('Bob Claim 1'))
    printState("After Step 3 (Alice signed the Bob Claim 1 transction)", alice, bob)
  }

  // Step 4
  if(theCase === 'Bob never gives Alice bobSecret - Bob Success') {
    bob.send(btcToBob.out('Bob Claim 1'))
    return printState("Final State", alice, bob)
  } else if(theCase === 'Bob never gives Alice bobSecret - Alice Revoke') {
    gs.timePasses(200)
    alice.send(btcToBob.out('Revoke'))
    gs.timePasses(100)
    alice.send(btcToBob.out('Revoke', 'Refund'))
    return printState("Final State", alice, bob)
  } else {
    bob.give('bobSecret', alice)
    printState("After Step 4 (Bob gave Alice bobSecret)", alice, bob)
  }

  // Step 5
  if(theCase === 'Alice never gives Bob AliceKey') {
    // It doesn't have to be this amount of time, any amount of time
    // significantly before 200 will work.
    gs.timePasses(50)
    // alice.send(btcToBob.out('Revoke')) // Alice can't Revoke yet.
    bob.send(btcToBob.out('Bob Claim 1'))
    // Alice will at some point spend her LTC.
    alice.send(ltcToAlice.out('Success'))
    return printState("Final State", alice, bob)
  } else {
    alice.give('aliceKey', bob)
    printState("After Step 5 (Alice gave Bob aliceKey)", alice, bob)
  }

  // Step 6 - Wait and watch.

  // Step 7
  if(theCase === 'Alice can double spend in step 7') {
    gs.timePasses(200)
    alice.send(btcToBob.out('Revoke'))
    alice.send(ltcToAlice.out('Success'))

    // alice.send(btcToBob.out('Revoke', 'Refund')) // Alice can't do this yet at this point.
    bob.send(btcToBob.out('Bob Claim 1'))
    return printState("Final State", alice, bob)
  } else {
    alice.send(ltcToAlice.out('Success'))
    printState("After Step 7 (Alice spent the LTC)", alice, bob)
  }

  bob.send(btcToBob.out('Success'))

  printState("Final State (After Bob spent the Success output)", alice, bob)

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

