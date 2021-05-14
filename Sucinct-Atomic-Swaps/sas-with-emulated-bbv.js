var util = require("util")
var {GlobalState, User} = require('../tx-tools')


// Cases:
var cases = [
  'normal',
  'Bob never sends ALTC',
  'Alice Revokes the BTC to Bob after Bob sends the ALTC',
  'Alice Revokes the BTC after 1 day',
]

var failures = 0
cases.forEach((theCase) => {
  executeSequence(theCase)
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


  try {
    // Step 1
    var btcToBob = Output('BTC to Bob', ['aliceKey'], [
      Output('Success', ['bobKey', 'timelock(100)'], bobOut),
      Output('Revoke', ['aliceKey', 'aliceSecret', 'bobKey'], [
        Output('Refund', ['aliceKey', 'timelock(100)'], aliceOut),
        Output('Fail', ['bobKey', 'absTimelock(200)'], bobOut)
      ])
    ]).confirmed()
    var altcToAlice = Output('ALTC to Alice', ['bobKey'], [
      Output('Success', ['aliceKey', 'timelock(100)'], []),
      Output('Revoke', ['bobKey', 'aliceSecret'], []),
    ]).confirmed()

    var alice = gs.User(['aliceKey', 'aliceSecret'])
    var bob = gs.User(['bobKey', 'bobSecret'])

    printState("Begin Case: "+theCase, alice, bob)

    // Step 2
    bob.sign('bobKey', btcToBob.out('Revoke'))
    printState("After Step 2 (Transactions have been presigned)", alice, bob)

    // Step 3
    alice.send(btcToBob)
    printState("After Step 3 (Alice sent the 'BTC to Bob' transaction)", alice, bob)

    // Step 4
    if(theCase !== 'Bob never sends ALTC') {
      bob.send(altcToAlice)
      printState("After Step 4 (Bob sent the 'LTC to Alice' transaction)", alice, bob)
    } else{
      gs.timePasses(50)
      alice.send(btcToBob.out('Revoke'))
      printState("After Alice sends Revoke", alice, bob)

      gs.timePasses(100)
      alice.send(btcToBob.out('Revoke', 'Refund'))
      return printState("Final State", alice, bob)
    }

    // Step 5
    if(theCase !== 'Alice Revokes the BTC to Bob after Bob sends the ALTC') {
      gs.timePasses(100)
    } else {
      gs.timePasses(50)
      alice.send(btcToBob.out('Revoke'))
      bob.send(altcToAlice.out('Revoke'))
      printState("After Alice Revokes the BTC and Bob Revokes the ALTC", alice, bob)

      gs.timePasses(100)
      //bob.send(btcToBob.out('Revoke', 'Fail')) // Bob can't send the Fail transaction here yet.
      alice.send(btcToBob.out('Revoke', 'Refund'))
      return printState("Final State", alice, bob)
    }

    // Step 6 - Bob watches the chain. Bob can spend the BTC whenever.

    // Step 7 - After this, Alice can spend her ALTC.
    if(theCase !== 'Alice Revokes the BTC after 1 day') {
      gs.timePasses(100)
      alice.send(altcToAlice.out('Success'))
    } else {
      alice.send(btcToBob.out('Revoke'))
      bob.send(altcToAlice.out('Revoke'))
      gs.timePasses(100)
      bob.send(btcToBob.out('Revoke', 'Fail'))
      return printState("Final State", alice, bob)
    }

    // Step 8
    printState("Step 8", alice, bob)
    bob.send(btcToBob.out('Success'))

    printState("Final State (After Bob spent the Success output)", alice, bob)
  } catch(e) {
    failures++
    console.log(theCase+": ", e)
    printState("State during error", alice, bob)
  }

  function printState(name, alice, bob) {
    console.log("\n"+name+":\n")
    console.log(indent(2, ['ALTC: '+altcToAlice.print(), '', 'BTC: '+btcToBob.print()].join('\n')))
    console.log(indent(2, "\nAlice's State: "+util.inspect(alice.getMergedState(), {colors: true, compact: 5, breakLength: 90})))
    console.log(indent(2, "Bob's State:   "+util.inspect(bob.getMergedState(), {colors: true, compact: 5, breakLength: 90})))
  }
}

function indent(indent, string) {
  var indentText = ' '.repeat(indent)
  return indentText+string.split('\n').join('\n'+indentText)
}

