require("@nomiclabs/hardhat-waffle")
require("dotenv").config()

module.exports = {
  networks: {
    hardhat: {
      accounts: {
        mnemonic: process.env.MNEMONIC
      },
      forking: {
        url: process.env.PUBLIC_NODE_URL,
        blockNumber: 11686462,
      }
    }
  },
  solidity: {
    version: "0.7.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
