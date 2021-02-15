const yfUSDT = artifacts.require("yfUSDT");
const yfDAI = artifacts.require("yfDAI");

module.exports = function(deployer) {
  /**
   * 2nd parameter: USDT Smart Contract Address
   * 3rd parameter: yEarn Smart Contract Address
   * 4th parameter: yVault Smart Contract Address
   */
  deployer.deploy(yfUSDT, "0x2922d23EB6B635f72BBca45bE092cfE4FcA50b9A", "0x07514EE6C24bB934F12F0f136e74dD9A3e69F6EE", "0x7Cc77422B3EE0fd6c1544A9893802801Ba62C6eB");
  /**
   * 2nd parameter: DAI Smart Contract Address
   * 3rd parameter: yEarn Smart Contract Address
   * 4th parameter: yVault Smart Contract Address
   */
  deployer.deploy(yfDAI, "0x6B175474E89094C44Da98b954EedeAC495271d0F", "0x07514EE6C24bB934F12F0f136e74dD9A3e69F6EE", "0x7Cc77422B3EE0fd6c1544A9893802801Ba62C6eB");
};
