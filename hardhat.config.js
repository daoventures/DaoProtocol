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
    version: "0.7.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
