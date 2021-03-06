
# Yearn-Farmer v2
Yearn-Farmer v2 is a lending aggregator that build on top of Yearn Finance. User can choose to deposit between Yearn Earn or Vault through daoVault.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

## Installation
Clone the repository and install it.
```
git clone https://github.com/daoventures/Yearn-Farmer
cd Yearn-Farmer
git checkout develop
npm install
```

## Compile
```
npx hardhat compile
```

## Tests
Create an .env file within the folder. Type in `PUBLIC_NODE_URL=https://eth-mainnet.alchemyapi.io/v2/{your-alchemy-id}`
> Note: For public node, we recommend use Alchemy instead of Infura. Infura may cause some weird error in this test suite. If you don't have one, apply in https://www.alchemyapi.io/

```
npx hardhat test
```
> Note: For the first few test run, you might encounter this error `Error: Timeout of 20000ms exceeded.`. If so, please run again `npx hardhat test`.

## Functions
### User functions
#### function `deposit(list)`
Deposit into Yearn Earn and Vault contract. This function only can access through daoVault contract.
- *Param*: number list [Yearn Earn deposit amount, Yearn Vault deposit amount]

#### function `withdraw(list)`
Withdraw from Yearn Earn and Vault contract. This function only can access through daoVault contract.
- *Param*: number list [Yearn Earn withdraw shares, Yearn Vault withdraw shares]
> Get Yearn Earn/Vault withdraw shares from Yearn-Farmer v2 through getEarnDepositBalance()/getVaultDepositBalance(). Deposit balance = shares amount. This is for the very first strategy only(before vesting).

#### function `refund()`
Refund from Yearn-Farmer contract. This function only can access through daoVault contract. This function only available after Yearn-Farmer in vesting state.
- *Param*: -

#### function `getEarnDepositBalance(address)`
Get Yearn Earn current total deposit amount of account (after deposit fee).
- *Param*: Address of account to check
- *Return*: Current total deposit amount of account in Yearn Earn (after deposit fee).

#### function `getVaultDepositBalance(address)`
Get Yearn Vault current total deposit amount of account (after deposit fee).
- *Param*: Address of account to check
- *Return*: Current total deposit amount of account in Yearn Vault (after deposit fee).

#### function `getSharesValue(address)`
Get token amount based on daoToken hold by account after contract in vesting state.
- *Param*: Address of account to check
- *Return*: Token amount based on on daoToken hold by account. 0 if contract is not in vesting state

### Admin functions
#### function `setTreasuryWallet(address)`
Set new treasury wallet address in contract.
- *Param*: Address of new treasury wallet
- *Event*: eventName: SetTreasuryWallet, args: [oldTreasuryWallet(indexed), newTreasuryWallet(indexed)]

#### function `setCommunityWallet(address)`
Set new community wallet address in contract.
- *Param*: Address of new community wallet
- *Event*: eventName: SetCommunityWallet, args: [oldCommunityWallet(indexed), newCommunityWallet(indexed)]

#### function `setDepositFeeTier2(list)`
Set new deposit fee tier 2.
Deposit fee has three tier. Tier 1: deposit amount < minimun. Tier 2: minimun <= deposit amount <= maximum. Tier 3: maximun < deposit amount.
- *Param*: number list [minimum, maximum]
- *Event*: eventName: SetDepositFeeTier2, args: [[oldDepositFeeTier2], [newDepositFeeTier2]]

#### function `setDepositFeePercentage(list)`
Set new deposit fee percentage. Deposit fee has three tier.
- *Param*: number list [tier1perc, tier2perc, tier3perc] (100 = 1%, maximum 3999)
- *Event*: eventName: SetDepositFeePercentage, args: [[oldDepositFeePercentage], [newDepositFeePercentage]]

#### function `setCustomDepositFeeTier(integar)`
Set new custom deposit fee tier.
Custom deposit fee tier is checked before deposit fee tier 3 when calculate deposit fee.
Please make sure custom deposit fee tier amount is higher than deposit fee tier 3.
- *Param*: number list [minimum, maximum]
- *Event*: eventName: SetCustomDepositFeeTier, args: [oldCustomDepositFeeTier, newCustomDepositFeeTier]

#### function `setCustomDepositFeePercentage(integar)`
Set new custom deposit fee percentage.
- *Param*: integar (100 = 1%)
- *Event*: eventName: SetCustomDepositFeePercentage, args: [oldCustomDepositFeePercentage, newCustomDepositFeePercentage]

#### function `setProfileSharingFeePercentage(integar)`
Set new profile sharing fee percentage.
- *Param*: integer (1 = 1%, maximun 39)
- *Event*: eventName: SetProfileSharingFeePercentage, args: [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]

#### function `vesting()`
Make contract in vesting state. Withdraw all balance from Yearn Earn and Vault contract. Block user interaction function `deposit()` and `withdraw()`. `getEarnDepositBalance()` and `getVaultDepositBalance()` return 0. (use `getSharesValue()` instead)
- *Param*: -

#### function `approveMigrate()`
Allow daoVault to move funds in this contract.
- *Param*: -
- *Requirements*: Contract in vesting state

### General functions
#### function `token()`
Get current ERC20 token used.
- *Param*: -
- *Return*: Current ERC20 token address used

#### function `earn()`
Get current Yearn Earn contract used.
- *Param*: -
- *Return*: Current Yearn Earn contract address used

#### function `vault()`
Get current Yearn Vault contract used.
- *Param*: -
- *Return*: Current Yearn Vault contract address used

#### function `pool()`
Get current accumulate pool.
- *Param*: -
- *Return*: Current accumulate pool amount

#### function `treasuryWallet()`
Get current treasury wallet.
- *Param*: -
- *Return*: Current treasury wallet address

#### function `communityWallet()`
Get current community wallet.
- *Param*: -
- *Return*: Current community wallet address

#### function `depositFeeTier2()`
Get current deposit fee tier 2 ([minimun, maximun]).
Deposit fee has three tier. Tier 1: deposit amount < minimun. Tier 2: minimun <= deposit amount <= maximum. Tier 3: maximun < deposit amount.
- *Param*: -
- *Return*: Current deposit fee tier 2

#### function `customDepositFeeTier()`
Get current custom deposit fee tier.
- *Param*: -
- *Return*: Current custom deposit fee tier

#### function `depositFeePercentage()`
Get current deposit fee percentage ([tier1perc, tier2perc, tier3perc]). 100 = 1%.
- *Param*: -
- *Return*: Current deposit fee percentage in amount

#### function `customDepositFeePercentage()`
Get current custom deposit fee percentage. 100 = 1%.
- *Param*: -
- *Return*: Current custom deposit fee percentage in amount

#### function `profileSharingFeePercentage()`
Get current profile sharing fee percentage. 100 = 1%.
- *Param*: -
- *Return*: Current profile sharing fee percentage in amount

#### function `isVesting()`
Get current vesting state.
- *Param*: -
- *Return*: Current vesting state in boolean

#### function `daoVault()`
Get current daoVault used.
- *Param*: -
- *Return*: Current daoVault address

# Vault
Vault is a contract that help user to deposit, withdraw and refund in the latest strategy. Vault distribute daoToken to user based on shares.

### The smart contract is still under development (testing and auditing) and we strongly advise anyone not to deposit anything on the mainnet until we publicly launch the product.

> **Installation**, **Compile** and **Tests** is same as Yearn-Farmer v2 section, and it only need to implement 1 time.

## Functions
### User functions
#### function `deposit(list)`
Deposit into strategy.
- *Param*: number list [first amount, second amount]

#### function `withdraw(list)`
Withdraw from strategy.
- *Param*: number list [first amount, second amount]

#### function `refund()`
Refund from strategy. Only available if strategy in certain condition (for example vesting state).
- *Param*: -

### Admin functions
#### function `setPendingStrategy(address)`
Set new strategy that will be replace old strategy.
- *Param*: New strategy address

#### function `unlockMigrateFunds()`
Unlock `migrateFunds()`. Execute `setPendingStrategy()` will be reverted after execute this function.
- *Param*: -

#### function `migrateFunds()`
Migrate funds from old strategy to new strategy.
- *Param*: -
- *Requirements*: 5 days after execute `unlockMigrateFunds()` and valid for 1 day.  
- *Event*: eventName: MigrateFunds, args: [fromStrategy(indexed), toStrategy(indexed), amount]

### General functions
#### function `token()`
Get current ERC20 token used.
- *Param*: -
- *Return*: Current ERC20 token address used

#### function `strategy()`
Get current strategy contract used.
- *Param*: -
- *Return*: Current strategy contract address used

#### function `pendingStrategy()`
Get current pending strategy address if got (only use when prepare to change strategy).
- *Param*: -
- *Return*: Current pending strategy address if got

#### function `canSetPendingStrategy()`
Check status whether can set pending strategy (return false when unlock migrate function).
- *Param*: -
- *Return*: Current can set pending strategy status in boolean

#### function `unlockTime()`
Check unlock time for function `migrateFunds()`.
- *Param*: -
- *Return*: Unlock time(seconds since 1970-01-01)

#### function `LOCKTIME()`
Check duration for unlock `migrateFunds()` (unchangable).
- *Param*: -
- *Return*: Duration(seconds)

#### function `balanceOf(address)`
Check balance of dvmToken.
- *Param*: Address to check
- *Return*: Balance of dvmToken