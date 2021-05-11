# Succinct Atomic Swaps scratchpad

This goes through [Succinct Atomic Swaps](https://gist.github.com/RubenSomsen/8853a66a64825716f51b409be528355f#file-succinctatomicswap-svg) to find the different states. This uses [Spend-path notation](https://github.com/fresheneesz/bip-efficient-bitcoin-vaults/blob/main/notation.md).

## Transactions

 BobSig 
 -> LTC to Alice: aliceSecret & bobSecret
 AliceSig
 -> BTC to Bob: 
    * Success: AliceSig & BobSig & bobSecret
     -> BobSig
    * Refund1: absTimelock(1 day) & AliceSig & BobSig & aliceSecret
     -> AliceSig & BobSig || AliceSig & timelock(1 day)
    * Revoke:  absTimelock(2 days) & AliceSig & BobSig
     -> Revoke Output:
        * Refund2: timelock(1 day) & AliceSig & BobSig & aliceSecret
         -> AliceSig
        * Timeout: timelock(2 days) & AliceSig & BobSig
         -> BobSig

## Cases:

### Normal Case:

0. Alice signs the "Revoke" and "Revoke-timeout", Bob signs "Revoke" and "Revoke-refund".
1. Alice sends "BTC to Bob" transaction.
2. Bob sends "LTC to Alice" transaction.
3. Alice signs the success transaction (with an adapter signature that requires secretBob).
4. Bob gives Alice bobSecret
5. Alice gives Bob AliceKey (which can produce AliceSig).
6. Bob continues to watch the chain for a revoke transaction.
7. Alice at some point spends the LTC to wherever she wants, which reveals aliceSecret.
8. Bob at some point sends the Success transaction to complete the transaction. 

#### States

##### After Step 0

 BobSig
 -> LTC to Alice: aliceSecret & bobSecret
 AliceSig
 -> BTC to Bob: 
    * Success: AliceSig & BobSig & bobSecret
     -> BobSig
    * Refund1: absTimelock(1 day) & AliceSig & BobSig & aliceSecret
     -> AliceSig & BobSig || timelock(1 day) & AliceSig
    * Revoke:  absTimelock(2 days)
     -> Revoke Output:
        * Refund2: timelock(1 day) & AliceSig & aliceSecret
         -> AliceSig
        * Timeout: timelock(2 days) & BobSig
         -> BobSig

##### After Step 1

 BobSig
 -> LTC to Alice: aliceSecret & bobSecret

 BTC to Bob: 
 * Success: AliceSig & BobSig & bobSecret
  -> BobSig
 * Refund1: absTimelock(1 day) & AliceSig & BobSig & aliceSecret
  -> AliceSig & BobSig || timelock(1 day) & AliceSig
 * Revoke:  absTimelock(2 days)
  -> Revoke Output:
     * Refund2: timelock(1 day) & AliceSig & aliceSecret
      -> AliceSig
     * Timeout: timelock(2 days) & BobSig
      -> BobSig

##### After Step 2

 LTC to Alice: aliceSecret & bobSecret
 BTC to Bob: 
 * Success: AliceSig & BobSig & bobSecret
  -> BobSig
 * Refund1: absTimelock(1 day) & AliceSig & BobSig & aliceSecret
  -> AliceSig & BobSig || timelock(1 day) & AliceSig
 * Revoke:  absTimelock(2 days)
  -> Revoke Output:
     * Refund2: timelock(1 day) & AliceSig & aliceSecret
      -> AliceSig
     * Timeout: timelock(2 days) & BobSig
      -> BobSig

##### After Step 3

 LTC to Alice: aliceSecret & bobSecret
 BTC to Bob: 
 * Success: BobSig & bobSecret
  -> BobSig
 * Refund1: absTimelock(1 day) & AliceSig & BobSig & aliceSecret
  -> AliceSig & BobSig || timelock(1 day) & AliceSig
 * Revoke:  absTimelock(2 days)
  -> Revoke Output:
     * Refund2: timelock(1 day) & AliceSig & aliceSecret
      -> AliceSig
     * Timeout: timelock(2 days) & BobSig
      -> BobSig

##### After Step 4

 LTC to Alice: aliceSecret
 BTC to Bob: 
 * Success: BobSig -> BobSig
 * Refund1: absTimelock(1 day) & AliceSig & BobSig & aliceSecret
  -> AliceSig & BobSig || timelock(1 day) & AliceSig
 * Revoke:  absTimelock(2 days)
  -> Revoke Output:
     * Refund2: timelock(1 day) & AliceSig & aliceSecret -> AliceSig
     * Timeout: timelock(2 days) & BobSig -> BobSig

##### After Step 5

 LTC to Alice: aliceSecret
 BTC to Bob: 
 * Success: BobSig -> BobSig
 * Refund1: absTimelock(1 day) & BobSig & aliceSecret
  -> BobSig || timelock(1 day)
 * Revoke:  absTimelock(2 days)
  -> Revoke Output:
     * Refund2: timelock(1 day) & aliceSecret -> AliceSig
     * Timeout: timelock(2 days) & BobSig -> BobSig

##### After Step 7

 BTC to Bob: 
 * Success: BobSig -> BobSig
 * Refund1: absTimelock(1 day) & BobSig
  -> BobSig || timelock(1 day)
 * Revoke:  absTimelock(2 days)
  -> Revoke Output:
     * Refund2: timelock(1 day) -> AliceSig
     * Timeout: timelock(2 days) & BobSig -> BobSig

### Step 2: Case Bob never sends LTC

2. After 2 days, Alice sends the Revoke transaction.
3. After 1 day, Alice sends the Refund2 transaction.

### Step 3: Alice never signs the success transaction

3. After 2 days, Bob sends the Revoke transaction.
4a. If after 1 day Alice sends the Refund2 transaction. Bob will learn aliceSecret and be able to access the LTC.
4b. If after 2 more days, Bob sends the Timeout transaction, and receives his bitcoin back. Note that at this point neither party has no trustless way to retrieve the LTC.

### Step 4: Bob never gives Alice bobSecret

4a. If Bob sends the Success transaction within 2 days, Alice will learn bobSecret and can spend the LTC.
4b. If, after 2 days, Alice sends the Revoke transaction, she can then send Refund2 after 1 day to retrieve her bitcoin.

### Step 5: Alice never gives Bob AliceKey

5. Alice can spend the LTC to Alice output and the Revoke transactions at the same time, allowing her to steal funds.

### Step 6: Alice can double spend

Alice can double spend just as in the Alice never gives Bob AliceKey case.