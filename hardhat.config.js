require("@nomiclabs/hardhat-waffle")
require("dotenv").config()

// task("accounts", "Prints the list of accounts", async () => {
  // const accounts = await ethers.getSigners();
  // for (const account of accounts) {
  //   console.log(account.address);
  // }
// });

module.exports = {
  networks: {
    hardhat: {
      accounts: {
        mnemonic: "raven forget quick pyramid busy bronze oven veteran gas yard clown ill"
      },
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 11686462,
      }
    }
  },
  solidity: {
    version: "0.6.2",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
