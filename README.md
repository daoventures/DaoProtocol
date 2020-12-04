# Yearn Farmer

Yearn Farmer is a set of Ethereum Smart Contracts focused on creating a simple way to invest in Yearn Protocol in yEarn and yVault (USDT).

Mainnet Etherscan: https://etherscan.io/address/0xA0db955B5bdFA7C279CdE6C136FBA20C195CdEe5

## Installations

To run this project locally you need to deploy USDT, yEarn, yVault and this repo, Yearn-Farmer. 

1. `npm install` -g truffle`
2. `npm install`
3. Run a local Ganache Project. Take note of the Server Port and Network ID, as they will be needed for all deployments. 
4. Deploy USDT locally:
    1. cd into the project
    2. `npm install`
    3. In the ``truffle-config.js``:
        1. Uncomment only the development object and replace values with your own from Ganache
    4. `truffle compile`
    5. `truffle migrate --network development`
    6. For the contract migration “TetherToken”, save the value for the key “contract address” as we need that for later
5. Deploy yEarn locally: 
    1. `npm install`
    2. In the `truffle-config.js`:
        1. Uncomment only the development object and replace values with your own from Ganache
    3. Open the file /contracts/yEarn.sol and replace the address on line:389 with the USDT contract address you saved in an earlier step
    4. `truffle compile`
    5. `truffle migrate --network development`
    6. For the contract migration “yUSDT”, save the value for the key “contract address” as we need that for later
6. Deploy yVault locally: 
    1. `npm install`
    2. In the `truffle-config.js`:
        1. Uncomment only the development object and replace values with your own from Ganache
    1. Open the file /migrations/1_initial_migration.js and replace the 1st address on line:12 with the USDT contract address you saved in an earlier step. Ignore the 2nd address
    2. `truffle compile`
    3. `truffle migrate --network development`
    4. For the contract migration “yVault”, save the value for the key “contract address” as we need that for later
7. Change the parameters of the smart contract addresses on the migrations file.
9. `truffle compile`
10. `truffle migrate --network development`



### Deploy to Testnet

Change your environment variables before deploy to Testnet

```sh
$ truffle migrate --network rinkeby
```

### Steps for invest into this contract

1. Invoke `approve` function with 999999999999 amount in `TetherToken` smart contract with user address.
2. Invoke `deposit` function in `yfUSDT` smart contract with investment amount.

For withdrawal purpose, you may either invoke `withdrawEarn` to withdraw from yEarn or `withdrawVault` to withdraw from yVault.

![Flowchart](images/Flowchart_YearnFarmer.png?raw=true)

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
