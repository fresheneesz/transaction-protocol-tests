# Succinct Atomic Swaps With  Emulated OP_BBV

The [SAS with OP_BBV](https://github.com/fresheneesz/bip-efficient-bitcoin-vaults/blob/main/SAS-with-emulated-bbv.md) can be emulated using [this emulation technique](https://github.com/fresheneesz/bip-efficient-bitcoin-vaults/blob/main/bip-beforeblockverify.md#emulation-with-absolute-and-relative-timelocks). This has the downside that one party (Bob) must watch the blockchain until he spends the coins he received in the swap. 

## Comparison to SAS without OP_BBV

* Pro: No dynamic state that can't be recovered from the seed needs to be stored / backed up for long period of time.
* Con: Is not scriptless.

Both this and [Ruben Somsen's SAS protocol](https://gist.github.com/RubenSomsen/8853a66a64825716f51b409be528355f) require 2 transactions (1 per chain) in normal scenarios. And both require one party (Bob) to watch the chain until he spends his received coins. However, in this protocol, once the `ALTC to Alice` transaction has been sent, neither party needs to store any dynamic state and can restore from only their seed. In Ruben's SAS protocol, Bob must store state (Alice's key) until he spends his received coins. However, this protocol is not scriptless.

## Transaction spend-paths

The transactions could look like the following using [spend-path notation](https://github.com/fresheneesz/bip-efficient-bitcoin-vaults/blob/main/notation.md):

```
AliceSig
-> BTC to Bob:
   * Bob Success: BobSig & relTimelock(1 day)
   * Alice Revoke: AliceSig & aliceSecret & BobSig
     -> Revoke Address:
        * Refund: AliceSig & relTimelock(1 day)
        * Revoke Fail: BobSig & absTimelock(2 days)
   
BobSig
-> ALTC to Alice: 
   * Alice Success: AliceSig & relTimelock(2 day)
   * Bob Revoke: BobSig & aliceSecret
```

## Cases

### Normal Case

1. Alice creates the transaction creating the outputs `BTC to Bob` and `revokeAddress`. The absolute time-locks are set relative to this moment. 
2. Bob signs a transaction spending the `Alice Revoke` spend-path to `Revoke Address`.
3. Alice sends `BTC to Bob` transaction
4. Bob sends `ALTC to Alice` transaction
5. Wait 1 day.
6. At this point, Bob can spend `Bob Success`. Bob must continue to watch the chain until he spends using the `Bob Success` spend-path, because Alice might spend `Alice Revoke` at any time before that. 
7. After another day, Alice can spend `Alice Success` whenever she wants (now or in the future).
8. Eventually Bob spends the output using the `Bob Success` spend path.

### Bob doesn't send the ALTC after step 3

4. After say 6 hours, Alice sends the transaction spending `Alice Revoke`.
5. After another day, Alice spends using the `Refund` to retrieve her BTC. 

### `Alice Revoke` after Bob sends `ALTC to Alice` in step 4:

5. After say 6 hours, Alice sends the `Alice Revoke` transaction. This reveals `aliceSecret`.
6. Bob then spends `Bob Revoke` to retrieve his ALTC.
7. A. Alice would then probably spend the `Refund` path to retrieve the BTC. 
   B. If Alice does not do step 7, after another day, Bob can then spend `Alice Revoke Fail` to take the BTC as well as the ALTC.

So at the end of this, Bob gets back the ALTC and Alice gets back the BTC (minus fees). 

### `Alice Revoke` after 1 day (step 5)

6. Alice sends the `Alice Revoke` transaction. This reveals `aliceSecret`.
7. Bob then spends `Bob Revoke` to retrieve his ALTC.
8. After another day, Bob spends `Alice Revoke Fail`.

At the end of this, Bob gets both the ALTC and the BTC. Its in Alice's best interests to never do this. 

## Properties

* In normal cases, only two transactions needed in total - one on each chain.
* In failure cases, up to five transactions in total may be needed.
* Alice can consider the transaction complete after 1 day.
* Bob can only consider the transaction fully complete when he spends the `Bob Success` spend-path. Until then, Bob must watch the chain for Alice attempting to cheat. 
* Recovery normally does not require any secrets - recovery should be possible from just the seed. Bob can recover from his seed alone at any point in the protocol, as long as `aliceSecret` is generated deterministically from the seed. To generate the seed, Alice can simply use an HD wallet spend path with an index that hasn't been used before, which she can verify by looking for any `Alice Revoke` transactions a key from her seed has signed on the blockchain. 
* Alice needs to back up the pre-signed `Alice Revoke`  transaction to recover from data loss that occurs in the middle of the protocol. This only needs to be done until Bob sends the `ALTC to Alice` transaction (and it is confirmed) or until Alice sends the `Refund` transaction. In practice, this could normally take well under an hour (or some small fraction of whatever smaller timeout is chosen). 



