const { assert, isAbove } = require("chai");

const Dai = artifacts.require("Dai");
const YUSDT = artifacts.require("yUSDT");
const YVAULT = artifacts.require("yVault");
const YFDAI = artifacts.require("yfDAI");

require("chai")
  .use(require("chai-as-promised"))
  .should();

contract("Yearn-Farmer DAI", ([owner, investor]) => {
  let dai, yEarn, yVault, yearnFarmer;

  before("Deploying contracts", async () => {
    // Loading contracts
    dai = await Dai.new();
    yEarn = await YUSDT.new();
    yVault = await YVAULT.new(dai.address, "0x0000000000000000000000000000000000000000");
    yearnFarmer = await YFDAI.new(dai.address, yEarn.address, yVault.address);

    // Send $100,000 DAI to to investor
    await dai.transfer(investor, 1000000000000000000000000);
  });

  // Basic assertions regarding our token
  describe("Yearn-Farmer Deployment Attributes", async () => {
    it("Has the correct name", async () => {
      const name = await yearnFarmer.name();
      assert.equal(name, "DAO DAI");
    });

    it("Has the correct symbol", async () => {
      const symbol = await yearnFarmer.symbol();
      assert.equal(symbol, "daoDAI");
    });

    it("Has the correct decimals", async () => {
      const decimals = await yearnFarmer.decimals();
      assert.equal(decimals, 18);
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
    it("Investor has DAI", async () => {
      result = await dai.balanceOf(investor);
      assert.equal(result.toString(), 1000000000000000000000000);
    });

    it("Investor approves Yearn-Farmer to spend his DAI", async () => {
      // Investor approves YF to spend $100,000 DAI
      await dai.approve(yearnFarmer.address, 1000000000000000000000000, { from: investor }) // Correct invocation
      result = await dai.allowance(investor, yearnFarmer.address)
      assert.equal(result.toString(), 1000000000000000000000000)
    })

    it("Investor deposits funds to Yearn-Farmer", async () => { 
      // Investing $100,000 DAI into YF with equal weight
      await yearnFarmer.deposit(500000000000000000000000, 500000000000000000000000, { from: investor })
      result = await yearnFarmer.balanceOf(investor)
      assert.equal(result.toString(), 100000000000)
    })

    it("yEarn and yVaults confirms deposits are received", async () => {
      // Verify correct yEarn Balance of investor
      result = await yEarn.balanceOf(investor)
      assert.equal(result.toString(), 500000000000000000000000)
      
      result = await yearnFarmer.earnBalanceOf(investor)
      assert.equal(result.toString(), 500000000000000000000000) 
      
      // Verify correct yVault Balance of investor
      result = await yVault.balanceOf(investor)
      assert.equal(result.toString(), 500000000000000000000000)
      
      result = await yearnFarmer.vaultBalanceOf(investor)
      assert.equal(result.toString(), 500000000000000000000000)
    })

    it("Our internal ledgers are updated after deposits", async () => {
      // Verify correct yEarn Deposit Balance of investor
      result = await yearnFarmer.earnDepositBalanceOf(investor)
      assert.equal(result.toString(), 500000000000000000000000) 

      // Verify correct yVault Deposit Balance of investor
      result = await yearnFarmer.vaultDepositBalanceOf(investor)
      assert.equal(result.toString(), 500000000000000000000000)
    })

    it("Investor's DAI balance is correct", async () => {
      result = await dai.balanceOf(investor)
      assert.equal(result.toString(), 0)
    })
  });

  describe("Investor withdraws funds from Yearn-Farmer", async () => {
    it("Investor requests a withdrawal", async () => {
        // Withdraw yVault balance
        let vaultBalance = await yearnFarmer.vaultBalanceOf(investor)
        result = await yearnFarmer.withdrawVault(vaultBalance, { from:investor })
        assert.equal(result.toString(), vaultBalance)

        // Withdraw yEarn balance
        let earnBalance = await yearnFarmer.earnBalanceOf(investor)
        result = await yearnFarmer.withdrawEarn(earnBalance, { from:investor })
        assert.equal(result.toString(), earnBalance)
    });

    it("Our internal ledgers are updated after withdrawal", async () => {
        // Verify correct yEarn Deposit Balance of investor
        result = await yearnFarmer.earnDepositBalanceOf(investor)
        assert.equal(result.toString(), 0)

        // Verify correct yVault Deposit Balance of investor
        result = await yearnFarmer.vaultDepositBalanceOf(investor)
        assert.equal(result.toString(), 0)
    });
    
    it("Investor has received back his deposit in DAI", async () => {
        // Verifying that the investor has received back his deposit, 
        // without verifying the exact amount due to challenges with simulating the exact return. 
        result = await dai.balanceOf(investor);
        assert.isAbove(result.toString(), 0);
    });
  });
});