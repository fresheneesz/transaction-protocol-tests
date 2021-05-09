var proto = require('proto')

/* Example Usage of this module:

var gs = GlobalState()
function Output() {
  return gs.Output.apply(gs, arguments)
}

var tx = Output('BTC to Bob', ['aliceKey'], [
  Output('Success', ['aliceKey', 'bobKey', 'bobSecret'], bobOut),
  Output('Revoke', ['aliceKey', 'bobKey', 'absTimelock(200)'], [
    Output('Refund', ['aliceKey', 'bobKey', 'aliceSecret', 'timelock(100)'], aliceOut),
    Output('Timeout', ['aliceKey', 'bobKey', 'aliceSecret', 'timelock(200)'], bobOut)
  ])
]).confirmed()

var alice = gs.User(['aliceKey', 'aliceSecret'])
var bob = gs.User(['bobKey', 'bobSecret'])

alice.sign('aliceKey', tx.out('Revoke'))
alice.sign('aliceKey', tx.out('Revoke', 'Timeout'))
bob.sign('bobKey', tx.out('Revoke'))
bob.sign('bobKey', tx.out('Revoke','Refund'))

alice.send(btcToBob)
alice.sign('aliceKey', tx.out('Success'))
bob.give('bobSecret', alice)
alice.give('aliceKey', bob)

gs.timePasses(200)
alice.send(tx.out('Revoke'))

console.log(alice.getMergedState())
console.log(btcToBob.print())
*/


// Represents the global state for a sequence of transactions. This is state that any user can see.
GlobalState = proto(function() {
  this.init = function() {
    this.state = {time: 0}
    // this.users = []
    this.outputs = []
  }

  this.User = function(stateItems) {
    var user = User(stateItems, this)
    // this.users.push(user)
    return user
  }

  this.Output = function(name, requirements, possibleOutputs) {
    var outputs = OutputClass(name, requirements, possibleOutputs, this)
    this.outputs.push(outputs)
    return outputs
  }

  // This can be used to reveal secrets or indicate time-passed by setting eg 'timelock(1 day)'
  this.set = function(stateItem) {
    this.state[stateItem] = true
  }

  this.timePasses = function(amount) {
    this.state.time += amount
  }
})

var User = proto(function() {
  this.init = function(stateItems, globalState) {
    this.globalState = globalState
    // The state has spending requirements this user can fulfil.
    this.state = {}
    stateItems.forEach((item) => {
      verifyStateItemName_(item)
      this.state[item] = true
    })
  }

  // Returns the user's state merged with global state.
  this.getMergedState = function() {
    var combinedState = Object.assign({}, this.state)
    mergeState(combinedState, this.globalState.state)
    return combinedState
  }

  // Fulfills a spending requirement for a spend path for all involved parties.
  // Fails if the user cannot fulfill that requirement.
  // Does not support the ability to send a signature of an output to a particular party (all parties will receive the signature)
  this.sign = function(spendingRequirement, outputs) {
    this.verifyHasStateItem(this.state, spendingRequirement)
    if(getStateItemSuffix(spendingRequirement) !== 'Key') {
      throw new Error("Attempting to sign with something that isn't a key: "+spendingRequirement)
    }
    outputs.state[spendingRequirement] = true
  }

  // Fulfills all the spending requirements for a spend path and sends it. Fails if the user cannot fulfill the
  // requirements.
  this.send = function(outputs) {
    outputs.send(this.state)
  }

  this.give = function(spendingRequirement, otherUser) {
    this.verifyHasStateItem(this.state, spendingRequirement)
    otherUser.state[spendingRequirement] = true
  }

  this.verifyHasStateItem = function(state, item) {
    if(!state[item]) throw new Error("User doesn't have state item: "+item)
  }

  function verifyStateItemName_(name) {
    var suffix = getStateItemSuffix(name)
    if(!(suffix in {Secret:1, Key:1})) {
      throw new Error("User state item name doesn't end in 'Secret' or 'Key': "+name)
    }
  }
})

// Represents an output. Currently only supports outputs with one spend path.
var OutputClass = proto(function() {
  // requirements - A list of requirements that must all be fulfilled to send the transaction.
  // possibleOutputs - An array where each value is either:
    // A. an Output object, or
    // B. a requirements list. This indicates that if the requirements are fulfilled it can be sent anywhere.
  this.init = function(name, requirements, possibleOutputs, globalState) {
    this.globalState = globalState
    this.name = name
    this.spent = false
    this.state = {}
    this.confirmationTime // Will be set when parent creates this output.
    this.requirements = requirements
    if(possibleOutputs) {
      // Maps output name to the output
      this.possibleOutputs = copyOutputPaths_(createSpendPathMap_(this, possibleOutputs))
    } else {
      this.possibleOutputs = {}
    }
  }

  // Sets this output as confirmed and returns it. Should be done for the top-level outputs, since they can't
  // be spent until they're confirmed.
  this.confirmed = function() {
    this.confirmationTime = this.globalState.state.time
    return this
  }

  this.send = function(userState) {
    if(this.confirmationTime === undefined) {
      throw new Error("Attempted to send a transaction from an output that has not been confirmed yet: "+this.requirements)
    }
    if(this.spent) {
      throw new Error("Attempted to send a transaction from an output that has already been spent: "+this.requirements)
    }

    var combinedState = Object.assign({}, userState)
    mergeState(combinedState, this.state)
    mergeState(combinedState, this.globalState.state)

    var stateProxy = new Proxy({}, {
      get(target, property) {
        var propertySuffix = getStateItemSuffix(property)
        if(propertySuffix === 'Key') {
          return combinedState[property]
        } else if(propertySuffix === 'Secret') {
          this.globalState.set(property)
          return combinedState[property]
        } else {
          throw new Error("This shouldn't be possible.")
        }
        return property in target ? target[property] : 0
      }
    })

    var remainingRequirements = this.getRemainingRequirements(combinedState)
    if(remainingRequirements.length === 0) {
      this.requirements.forEach((requirement) => {
        // Reveal any secrets needed to send the transaction.
        if(getStateItemSuffix(requirement) === 'Secret') {
          this.globalState.set(requirement)
        }
        for(var name in this.possibleOutputs) {
          var possibleOutput = this.possibleOutputs[name]
          possibleOutput.confirmationTime = this.globalState.state.time
        }
        this.spent = true
      })
    } else {
      throw new Error("Can't fulfill requirements to send Output. Unfulfillable requirements are: "+remainingRequirements)
    }
  }

  // Returns the output with the given name(s).
  // For example, outputs.out('x', 'y') will return the output y inside output x.
  this.out = function(/*output1, output2, ...*/) {
    var outputNames = Array.prototype.slice.call(arguments, 0)
    var curOutput = this.possibleOutputs[outputNames[0]]
    for(var n=1; n<outputNames.length; n++) {
      curOutput = curOutput.possibleOutputs[outputNames[n]]
    }
    return curOutput
  }

  this.copy = function() {
    var possibleOutputList = createSpendPathList(copyOutputPaths_(this.possibleOutputs))
    var path = this.globalState.Output(this.name, this.requirements, possibleOutputList)
    Object.assign(path.state, this.state)
    return path
  }

  this.requirementsFulfilled = function(state) {
    this.requirements.forEach((requirement) => {
      if(!state[requirement]) {
        return false
      }
    })
    return true
  }

  // For the passed in state object, get the list of requirements the state can't fulfil.
  this.getRemainingRequirements = function(state) {
    var results = []
    this.requirements.forEach((requirement) => {
      if(requirement.indexOf('absTimelock(') === 0) {
        var lockTime = parseInt(requirement.slice('absTimelock('.length, -1))
        if(state.time < lockTime) {
          results.push(requirement)
        }
      } else if(requirement.indexOf('timelock(') === 0) {
        var lockTime = parseInt(requirement.slice('timelock('.length, -1))
        if(!this.confirmationTime || state.time < this.confirmationTime + lockTime) {
          results.push(requirement)
        }
      } else if(!state[requirement]) {
        results.push(requirement)
      }
    })
    return results
  }

  this.print = function(printName) {
    var combinedState = Object.assign({}, this.state)
    mergeState(combinedState, this.globalState.state)

    if(this.spent) {
      if(Object.keys(this.possibleOutputs).length === 0) {
        return '<all spent>'
      }
      for(var name in this.possibleOutputs) {
        if(this.possibleOutputs[name].spent) {
          return this.possibleOutputs[name].print()
        }
      }
    } else {
      var remainingRequirements = this.getRemainingRequirements(combinedState)
      if(remainingRequirements.length > 0) {
        var requirementsDisplay = remainingRequirements.join(' & ')
      } else {
        var requirementsDisplay = '<any party can spend>'
      }
    }

    var outputsDisplayLines = []
    var possibleOutputsKeys = Object.keys(this.possibleOutputs)
    if(possibleOutputsKeys.length === 0) {
      return requirementsDisplay || ''
    } else if(possibleOutputsKeys.length === 1) {
      var pathName = possibleOutputsKeys[0]
      var output = this.possibleOutputs[pathName]
      var outputDisplay = output.print(true).split('\n').join('\n'+" ".repeat(3))
      if(this.name && printName) {
        return (requirementsDisplay? requirementsDisplay+'\n' : '')+'-> '+this.name+': '+outputDisplay
      } else {
        return (requirementsDisplay? requirementsDisplay+' -> ' : '')+outputDisplay
      }

    } else {
      var chunks = []
      for(var n=0; n<possibleOutputsKeys.length; n++) {
        var pathName = possibleOutputsKeys[n]
        var output = this.possibleOutputs[pathName]
        var line = (!this.spent? '   ' : '')+'* '+pathName+': '+output.print(false).split('\n').join('\n'+" ".repeat((!this.spent?3:0)))
        outputsDisplayLines.push(line)
      }
      if(possibleOutputsKeys.length > 0) {
        chunks.push((!this.spent? '-> ' : '')+this.name+': ')
        chunks.push(outputsDisplayLines.join('\n'))
      }

      return (requirementsDisplay? requirementsDisplay+'\n' : '')+chunks.join('\n')
    }
  }

  function copyOutputPaths_(outputPaths) {
    var result = {}
    for(var path in outputPaths) {
      result[path] = outputPaths[path].copy()
    }
    return result
  }

  function createSpendPathMap_(that, possibleOutputs) {
    var result = {}
    possibleOutputs.forEach((possibleOutput) => {
      if(possibleOutput instanceof OutputClass) {
        result[possibleOutput.name] = possibleOutput
      } else {
        var requirements = possibleOutput
        result['Anywhere'] = that.globalState.Output(undefined, requirements, undefined)
      }

    })
    return result
  }

  function createSpendPathList(possibleOutputMap) {
    var result = []
    for(var x in possibleOutputMap) {
      result.push(possibleOutputMap[x])
    }
    return result
  }
})

function getStateItemSuffix(name) {
  if(name.slice(-6) === 'Secret') return 'Secret'
  if(name.slice(-3) === 'Key') return 'Key'
}

function mergeState(target, stateToMergeIn) {
  for(var item in stateToMergeIn) {
    if(stateToMergeIn[item] !== false && stateToMergeIn[item] !== undefined) {
      target[item] = stateToMergeIn[item]
    }
  }
}

module.exports = {GlobalState, User, OutputClass}
