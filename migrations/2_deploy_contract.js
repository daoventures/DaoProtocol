const yfUSDT = artifacts.require("yfUSDT");

module.exports = function(deployer) {
  /**
   * 2nd parameter: USDT Smart Contract Address
   * 3rd parameter: yEarn Smart Contract Address
   * 4th parameter: yVault Smart Contract Address
   */
  deployer.deploy(yfUSDT, "0x2922d23EB6B635f72BBca45bE092cfE4FcA50b9A", "0x07514EE6C24bB934F12F0f136e74dD9A3e69F6EE", "0xA2c249002A9Bb8e08E0dd8E8AD2eD5B42b8EA07b");
};