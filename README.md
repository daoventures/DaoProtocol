# DaoVentures Protocol

DaoVentures Protocol is a set of Ethereum Smart Contracts focused on creating a simple way to invest in Yearn Protocol in yEarn and yVault.

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

1. Invoke `approve` function in `TetherToken` smart contract with user address.
2. Invoke `deposit` function in `yfUSDT` smart contract with investment amount.

For withdrawal purpose, you may either invoke `withdrawEarn` to withdraw from yEarn or `withdrawVault` to withdraw from yVault.
