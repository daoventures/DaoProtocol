require("@nomiclabs/hardhat-waffle")

module.exports = {
  networks: {
    hardhat: {
      accounts: {
        mnemonic: "mnemonic mnemonic mnemonic mnemonic mnemonic mnemonic mnemonic mnemonic mnemonic mnemonic mnemonic mnemonic"
      }
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.6.12"
      }
    ],
    overrides: {
      "contracts/yfUSDT.sol": {
        version: "0.6.12"
      }
    },
    // settings: {
    //   optimizer: {
    //     enabled: true,
    //     runs: 200
    //   }
    // }
  }
};
