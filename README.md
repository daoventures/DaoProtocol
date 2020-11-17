# DaoVentures Protocol

DaoVentures Protocol is a set of Ethereum Smart Contracts focused on creating a simple way to invest in Yearn Protocol in yEarn and yVault.

(deprecated) Mainnet Etherscan: https://etherscan.io/address/0xE8c9F440677bDC8bA915734e6c7C1b232916877d

## Installations

To run this project you need:

1. npm install -g truffle
2. npm install
3. Change the parameters of the smart contract addresses on the `migrations` file.
4. truffle compile
5. truffle migrate

### Deploy to Testnet

Change your environment variables before deploy to Testnet

```sh
$ truffle migrate --network rinkeby
```

### Steps for invest into this contract

1. Invoke `approve` function with 999999999999 amount in `TetherToken` smart contract with user address.
2. Invoke `deposit` function in `yfUSDT` smart contract with investment amount.

For withdrawal purpose, you may either invoke `withdrawEarn` to withdraw from yEarn or `withdrawVault` to withdraw from yVault.

## Contract Functionalities

### Admin Functions
1. `setFeePercentages` - Set the fees percentages of the profit commission

2. `setEarn` - Change Earn smart contract

3. `setVault` - Change Vault smart contract

4. `approvePooling` - Approve Earn and Vault smart contract from Tether token

5. `vesting` 
   - Change to state of vesting 
   - collect all the funds from Earn and Vault smart contracts for emergency uses
   - Disabled the deposit and withdraw functions for public
   - Only allowed users to do refund from yfUSDT
   
6. `revertContract` 
    - Revert state of vesting 
    - Allow smart contract work as usual
    - Only allow to revert after 24 hours of vesting
    
### Public Functions
1. `earnBalanceOf` - Check your Earn balance

2. `vaultBalanceOf` - Check your Vault balance

3. `earnDepositBalanceOf` - Check your current investment amount of Earn smart contract

4. `vaultDepositBalanceOf` - Check your current investment amount of Vault smart contract

5. `deposit` - Deposit funds into Earn and Vault smart contracts

6. `withdrawEarn` - Withdraw funds from Earn smart contract

7. `withdrawVault` - Withdraw funds from Vault smart contract

8. `refundEarn` - Refund all of your Earn funds after yfUSDT is vested

9. `refundVault` - Refund all of your Vault funds after yfUSDT is vested
