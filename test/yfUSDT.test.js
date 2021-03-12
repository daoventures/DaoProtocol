const { assert } = require("chai");

const TetherToken = artifacts.require("TetherToken");
const YUSDT = artifacts.require("yUSDT");
const YVAULT = artifacts.require("yVault");
const YFUSDT = artifacts.require("yfUSDT");

require("chai")
  .use(require("chai-as-promised"))
  .should();

contract("DAO Protocol", ([owner, investor]) => {
  let tetherToken, yEarn, yVault, yearnFarmer;

  before("Deploying contracts", async () => {
    // Loading contracts
    tetherToken = await TetherToken.new(2000000000000000, "Tether USD", "USDT", 6);
    yEarn = await YUSDT.new();
    yVault = await YVAULT.new(tetherToken.address, "0x0000000000000000000000000000000000000000");
    yearnFarmer = await YFUSDT.new(tetherToken.address, yEarn.address, yVault.address);

    // Send USDT to to investor
    await tetherToken.transfer(investor, 100000000000);
  });

  // Basic assertions regarding our token
  describe("Yearn-Farmer Deployment Attributes", async () => {
    it("Has the correct name", async () => {
      const name = await yearnFarmer.name();
      assert.equal(name, "DAO Tether USDT");
    });

    it("Has the correct symbol", async () => {
      const symbol = await yearnFarmer.symbol();
      assert.equal(symbol, "daoUSDT");
    });

    it("Has the correct decimals", async () => {
      const decimals = await yearnFarmer.decimals();
      assert.equal(decimals, 6);
    });
  });

  describe("Yearn-Farmer Performance Fee", async () => {
    it("Owner updates Fee", async () => {
      // Verifying current state
      result = await yearnFarmer.feePercentages()
      assert.equal(result, 20)

      // Setting new state
      await yearnFarmer.setFeePercentages(3, { from: owner }) // onlyOwner
      result = await yearnFarmer.feePercentages()
      assert.equal(result.toString(), 3) 
    })
  })

  describe("Deploy investor funds to yEarn and yVault", async () => {
    it("Investor has USDT", async () => {
      result = await tetherToken.balanceOf(investor);
      assert.equal(result.toString(), 100000000000);
    });

    it("Investor approves Yearn-Farmer to spend his USDT", async () => {
      // Investor approves YF to spend $100,000 USDT
      await tetherToken.approve(yearnFarmer.address, 100000000000, { from: investor }) // Correct invocation
      result = await tetherToken.allowance(investor, yearnFarmer.address)
      assert.equal(result.toString(), 100000000000)
    })

    it("Investor deposits funds to Yearn-Farmer", async () => { 
      // Investing $100,000 USDT into YF with equal weight
      await yearnFarmer.deposit(50000000000, 50000000000, { from: investor })
      result = await yearnFarmer.balanceOf(investor)
      assert.equal(result.toString(), 100000000000)
    })

    it("yEarn and yVaults confirms deposits are received", async () => {
      // Verify correct yEarn Balance of investor
      result = await yearnFarmer.earnBalanceOf(investor)
      assert.equal(result.toString(), 50000000000) 

      // Verify correct yVault Balance of investor
      internalLedgerBalance = await yearnFarmer.vaultBalanceOf(investor)
      assert.equal(internalLedgerBalance.toString(), 50000000000)
    })

    it("Our internal ledgers are updated after deposits", async () => {
      // Verify correct yEarn Deposit Balance of investor
      result = await yearnFarmer.earnDepositBalanceOf(investor)
      assert.equal(result.toString(), 50000000000) 

      // Verify correct yVault Deposit Balance of investor
      result = await yearnFarmer.vaultDepositBalanceOf(investor)
      assert.equal(result.toString(), 50000000000)
    })

    it("Investor's USDT balance is correct", async () => {
      result = await tetherToken.balanceOf(investor)
      assert.equal(result.toString(), 0)
    })
  });
});
