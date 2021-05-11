# Succinct Atomic Swaps scratchpad

This goes through [Succinct Atomic Swaps](https://gist.github.com/RubenSomsen/8853a66a64825716f51b409be528355f#file-succinctatomicswap-svg) to find the different states. This uses [Spend-path notation](https://github.com/fresheneesz/bip-efficient-bitcoin-vaults/blob/main/notation.md).

## Transactions

```
 BobSig 
 -> LTC to Alice: aliceSecret & bobSecret
 
 AliceSig
 -> BTC to Bob: 
    * Success: AliceSig & BobSig
    * Bob Claim1: AliceSig & BobSig -> BobSig
    * Refund1: absTimelock(1 day) & AliceSig & BobSig
      -> AliceSig & BobSig || AliceSig & timelock(1 day)
    * Revoke:  absTimelock(2 days) & AliceSig & BobSig
      -> Revoke Output:
         * Bob Claim2: AliceSig & BobSig
         * Refund2: timelock(1 day) & AliceSig & BobSig -> AliceSig
         * Timeout: timelock(2 days) & AliceSig & BobSig -> BobSig
```

## Cases:

### Normal Case:

0. Alice signs the `Revoke` and `Revoke-Timeout`, Bob signs `Revoke`. Bob also signs both `Refund1` and `Revoke-Refund2` with adapter signatures that require `aliceSecret` to complete.
1. Alice sends `BTC to Bob` transaction.
2. Bob sends `LTC to Alice` transaction.
3. Alice signs the `Bob Claim1` transaction with an adapter signature that adds the requirement of `bobSecret` to the transaction.
4. Bob gives Alice `bobSecret`
5. Alice gives Bob `AliceKey` (which can produce `AliceSig`).
6. Bob continues to watch the chain for a revoke transaction.
7. Alice at some point spends the LTC to wherever she wants, which reveals `aliceSecret`.
8. Bob at some point sends the `Success` transaction to complete the transaction. 

#### States

##### After Step 0

```
 BobSig
 -> LTC to Alice: aliceSecret & bobSecret
 
 AliceSig
 -> BTC to Bob: 
   * Success: AliceSig & BobSig
   * Bob Claim1: AliceSig & BobSig -> BobSig
   * Refund1: absTimelock(1 day) & AliceSig & aliceSecret
     -> AliceSig & BobSig || timelock(1 day) & AliceSig
   * Revoke:  absTimelock(2 days)
     -> Revoke Output:
        * Bob Claim2: AliceSig & BobSig
        * Refund2: timelock(1 day) & AliceSig & aliceSecret -> AliceSig
        * Timeout: timelock(2 days) & BobSig -> BobSig
```

##### After Step 1

```
 BobSig
 -> LTC to Alice: aliceSecret & bobSecret

 BTC to Bob: 
 * Success: AliceSig & BobSig
 * Bob Claim1: AliceSig & BobSig -> BobSig
 * Refund1: absTimelock(1 day) & AliceSig & aliceSecret
    -> AliceSig & BobSig || timelock(1 day) & AliceSig
 * Revoke:  absTimelock(2 days)
    -> Revoke Output:
       * Bob Claim2: AliceSig & BobSig
       * Refund2: timelock(1 day) & AliceSig & aliceSecret -> AliceSig
       * Timeout: timelock(2 days) & BobSig -> BobSig
```

##### After Step 2

```
 LTC to Alice: aliceSecret & bobSecret
 BTC to Bob: 
 * Success: AliceSig & BobSig
 * Bob Claim1: AliceSig & BobSig -> BobSig
 * Refund1: absTimelock(1 day) & AliceSig & aliceSecret
    -> AliceSig & BobSig || timelock(1 day) & AliceSig
 * Revoke:  absTimelock(2 days)
    -> Revoke Output:
       * Bob Claim2: AliceSig & BobSig
       * Refund2: timelock(1 day) & AliceSig & aliceSecret -> AliceSig
       * Timeout: timelock(2 days) & BobSig -> BobSig
```

##### After Step 3

```
 LTC to Alice: aliceSecret & bobSecret
 BTC to Bob: 
 * Success: AliceSig & BobSig
 * Bob Claim1: bobSecret & BobSig -> BobSig
 * Refund1: absTimelock(1 day) & AliceSig & aliceSecret
    -> AliceSig & BobSig || timelock(1 day) & AliceSig
 * Revoke:  absTimelock(2 days)
    -> Revoke Output:
       * Bob Claim2: AliceSig & BobSig
       * Refund2: timelock(1 day) & AliceSig & aliceSecret -> AliceSig
       * Timeout: timelock(2 days) & BobSig -> BobSig
```

##### After Step 4

```
 LTC to Alice: aliceSecret
 BTC to Bob: 
 * Success: AliceSig & BobSig
 * Bob Claim1: BobSig -> BobSig
 * Refund1: absTimelock(1 day) & AliceSig & aliceSecret
    -> AliceSig & BobSig || timelock(1 day) & AliceSig
 * Revoke:  absTimelock(2 days)
    -> Revoke Output:
       * Bob Claim2: AliceSig & BobSig
       * Refund2: timelock(1 day) & AliceSig & aliceSecret -> AliceSig
       * Timeout: timelock(2 days) & BobSig -> BobSig
```

##### After Step 5

```
 LTC to Alice: aliceSecret
 BTC to Bob: 
 * Success: AliceSig & BobSig
 * 1: BobSig -> BobSig
 * Refund1: absTimelock(1 day) & aliceSecret
    -> BobSig || timelock(1 day)
 * Revoke:  absTimelock(2 days)
    -> Revoke Output:
       * Bob Claim2: AliceSig & BobSig
       * Refund2: timelock(1 day) & aliceSecret -> AliceSig
       * Timeout: timelock(2 days) & BobSig -> BobSig
```

##### After Step 7

```
 BTC to Bob: 
 * Success: AliceSig & BobSig
 * Bob Claim1: BobSig -> BobSig
 * Refund1: absTimelock(1 day) -> BobSig || timelock(1 day)
 * Revoke:  absTimelock(2 days)
    -> Revoke Output:
       * Bob Claim2: AliceSig & BobSig
       * Refund2: timelock(1 day) -> AliceSig
       * Timeout: timelock(2 days) & BobSig -> BobSig
```

### Step 2: Case Bob never sends LTC

2. After 2 days, Alice sends the `Revoke` transaction.
3. After 1 day, Alice sends the `Refund2` transaction.

OR (more efficiently)

2. After 1 day, Alice sends the `Refund1` transaction.
3. After another 1 day, Alice spends the output confirmed in step 2.

### Step 3: Alice never signs the `Bob Claim1` transaction

3. After 2 days, Bob sends the `Revoke` transaction.
4a. If after 1 day Alice sends the `Refund2` transaction. Bob will learn `aliceSecret` and be able to access the LTC.
4b. If after 2 more days, Bob sends the `Timeout` transaction, and receives his bitcoin back. Note that at this point neither party has no trustless way to retrieve the LTC.

### Step 4: Bob never gives Alice bobSecret

4a. If Bob sends the `Bob Claim1` transaction within 2 days, Alice will learn `bobSecret` and can spend the LTC.
4b. If, after 2 days, Alice sends the `Revoke` transaction, she can then send `Refund2` after 1 day to retrieve her bitcoin.

### Step 5: Alice never gives Bob AliceKey

1. After about a day (and less than 2 days), Bob can send the `Bob Claim1` transaction to receive his BTC at the predetermined return address.
2. After 2 days, Alice can spend the `LTC to Alice` output.

### Step 6: Alice can double spend

1. After 2 days, Alice spends the `LTC to Alice` output and the `Revoke` output at the same time.
2. Bob then spends `Bob Claim2` to retrieve his coins and send wherever he wants.

