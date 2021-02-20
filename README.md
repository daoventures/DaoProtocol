
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
Create an .env file within the folder
Type in `PUBLIC_NODE_URL=https://eth-mainnet.alchemyapi.io/v2/{your-alchemy-id}`
> Note: For public node, we recommend use Alchemy instead of Infura. Infura may cause some weird error in this test suite. If you don't have one, apply in https://www.alchemyapi.io/

```
npx hardhat test
```
> Note: For the first test run, you might encounter this error `Error: Timeout of 20000ms exceeded.`. If so, please run again `npx hardhat test`.

## Functions
### User functions
#### function `deposit(list)`
Deposit into Yearn Earn and Vault contract. This function only can access through daoVault contract.
- *Param*: number list [Yearn Earn deposit amount, Yearn Vault deposit amount]

#### function `withdraw(list)`
Withdraw from Yearn Earn and Vault contract. This function only can access through daoVault contract.
- *Param*: number list [Yearn Earn withdraw amount, Yearn Vault withdraw amount]

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
Get token amount based on daoUSDT hold by account after contract in vesting state.
- *Param*: Address of account to check
- *Return*: Token amount based on on daoUSDT hold by account. 0 if contract is not in vesting state

### Admin functions
#### function `unlockFunction(integar)`
Unlock admin function. All admin function unlock time is 1 day.
- *Param*: A number that represent enum Functions (0 for `setTreasuryWallet()`, 1 for `setDepositFeeTier2()`, 2 for `setDepositFeePercentage()`, 3 for `setProfileSharingFeePercentage()`, 4 for `vesting()`)

#### function `setTreasuryWallet(address)`
Set new treasury wallet address in contract.
- *Param*: Address of new treasury wallet
- *Requirements*: 1 day after execute `unlockFunction(0)` and valid for 1 day.

#### function `setDepositFeeTier2(list)`
Set new deposit fee tier 2.
Deposit fee has three tier. Tier 1: deposit amount < minimun. Tier 2: minimun <= deposit amount <= maximum. Tier 3: maximun < deposit amount.
- *Param*: number list [minimum, maximum]
- *Requirements*: 1 day after execute `unlockFunction(1)` and valid for 1 day.

#### function `setDepositFeePercentage(list)`
Set new deposit fee percentage. Deposit fee has three tier.
- *Param*: number list [tier1perc, tier2perc, tier3perc] (100 = 1%, maximum 3999)
- *Requirements*: 1 day after execute `unlockFunction(2)` and valid for 1 day.

#### function `setProfileSharingFeePercentage(integar)`
Set new profile sharing fee percentage.
- *Param*: integer (1 = 1%, maximun 39)
- *Requirements*: 1 day after execute `unlockFunction(3)` and valid for 1 day.

#### function `setProfileSharingFeePercentage(integar)`
Set new profile sharing fee percentage.
- *Param*: integer (1 = 1%, maximun 39)
- *Requirements*: 1 day after execute `unlockFunction(3)` and valid for 1 day.

#### function `vesting()`
Make contract in vesting state. Withdraw all balance from Yearn Earn and Vault contract. Block user interaction function `deposit()` and `withdraw()`. `getEarnDepositBalance()` and `getVaultDepositBalance()` return 0. (use `getSharesValue()` instead)
- *Param*: -
- *Requirements*: 1 day after execute `unlockFunction(4)` and valid for 1 day.

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

#### function `depositFeeTier2()`
Get current deposit fee tier 2 ([minimun, maximun]).
Deposit fee has three tier. Tier 1: deposit amount < minimun. Tier 2: minimun <= deposit amount <= maximum. Tier 3: maximun < deposit amount.
- *Param*: -
- *Return*: Current deposit fee tier 2

#### function `depositFeePercentage()`
Get current deposit fee percentage ([tier1perc, tier2perc, tier3perc]). 100 = 1%.
- *Param*: -
- *Return*: Current deposit fee percentage in amount

#### function `profileSharingFeePercentage()`
Get current profile sharing fee percentage. 1 = 1%.
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

#### function `TIMELOCK()`
Get timelock duration for each unlock (unchangable).
- *Param*: -
- *Return*: Timelock duration for each unlock

#### function `timelock()`
Get current unlock time for function (in seconds, since 1970-01-01).
- *Param*: A number that represent enum Functions (0 for `setTreasuryWallet()`, 1 for `setDepositFeeTier2()`, 2 for `setDepositFeePercentage()`, 3 for `setProfileSharingFeePercentage()`, 4 for `vesting()`)
- *Return*: Current unlock time for function

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
- *Return*: integar (seconds since 1970-01-01)

#### function `LOCKTIME()`
Check duration for unlock `migrateFunds()` (unchangable).
- *Param*: -
- *Return*: integar (seconds)