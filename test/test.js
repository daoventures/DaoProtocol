const { expect } = require("chai")
const { ethers, network } = require("hardhat")
require("dotenv").config()
const IERC20_ABI = require("../abis/IERC20.json").abi
const IYearn_ABI = require("../artifacts/interfaces/IYearn.sol/IYearn.json").abi
const IYvault_ABI = require("../artifacts/interfaces/IYvault.sol/IYvault.json").abi

// USDT
const tokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const yEarnAddress = "0xE6354ed5bC4b393a5Aad09f21c46E101e692d447"
const yVaultAddress = "0x2f08119C6f07c006695E079AAFc638b8789FAf18"
const unlockedAddress = "0x1062a747393198f70F71ec65A582423Dba7E5Ab3"

// USDC
// const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
// const yEarnAddress = "0x26EA744E5B887E5205727f55dFBE8685e3b21951"
// const yVaultAddress = "0x597ad1e0c13bfe8025993d9e79c69e1c0233522e"
// const unlockedAddress = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8"

// DAI
// const tokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
// const yEarnAddress = "0xC2cB1040220768554cf699b0d863A3cd4324ce32"
// const yVaultAddress = "0xacd43e627e64355f1861cec6d3a6688b31a6f952"
// const unlockedAddress = "0x04ad0703B9c14A85A02920964f389973e094E153"

// TUSD
// const tokenAddress = "0x0000000000085d4780B73119b644AE5ecd22b376"
// const yEarnAddress = "0x73a052500105205d34daf004eab301916da8190f" // v2
// const yVaultAddress = "0x37d19d1c4e1fa9dc47bd1ea12f742a0887eda74a"
// const unlockedAddress = "0x701bd63938518d7DB7e0f00945110c80c67df532"

const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
let tx

describe("yfUSDT", () => {
    beforeEach(async () => {
        // Reset mainnet forking before each test
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    jsonRpcUrl: process.env.PUBLIC_NODE_URL,
                    blockNumber: 11686462
                }
            }]
        })

        // Transfer some USDT to sender before each test
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [unlockedAddress]
        })
        const unlockedSigner = await ethers.provider.getSigner(unlockedAddress)
        const [senderSigner, _] = await ethers.getSigners()
        const senderSignerAddress = await senderSigner.getAddress()
        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
        await tokenContract.connect(unlockedSigner).transfer(senderSignerAddress, 10000000)
        // Check if sender have 10000000 USDT
        expect(await tokenContract.balanceOf(senderSignerAddress)).to.equal(10000000)
    })

    it("should deploy contract correctly", async () => {
        // Get sender address and deploy the contract
        const [senderSigner, _] = await ethers.getSigners()
        const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()
        // Check if contract owner is contract deployer
        expect(await yfUSDTContract.owner()).to.equal(await senderSigner.getAddress())
        // Check if token accept is USDT
        expect(await yfUSDTContract.token()).to.equal(tokenAddress)
        // Check if no initial amount set in earn pool, vault pool, earn price and vault price
        expect(await yfUSDTContract.earnPool()).to.equal(0)
        expect(await yfUSDTContract.vaultPool()).to.equal(0)
        expect(await yfUSDTContract.earnPrice()).to.equal(0)
        expect(await yfUSDTContract.vaultPrice()).to.equal(0)
        // Check if initial tier2 of deposit fee is 10001 <= tokenAmount <= 100000 (More details in contract)
        expect(await yfUSDTContract.depositFeeTier2(0)).to.equal(10001)
        expect(await yfUSDTContract.depositFeeTier2(1)).to.equal(100000)
        // Check if initial deposit fee percentage is 1% for tier1, 0.5% for tier2, and 0.25% for tier3 (More details in contract)
        expect(await yfUSDTContract.depositFeePercentage(0)).to.equal(100) // 1% = 100/10000, more detail in contract
        expect(await yfUSDTContract.depositFeePercentage(1)).to.equal(50) // 1% = 50/10000, more detail in contract
        expect(await yfUSDTContract.depositFeePercentage(2)).to.equal(25) // 1% = 25/10000, more detail in contract
        // Check if initial profile sharing fee percentage is 10%
        expect(await yfUSDTContract.profileSharingFeePercentage()).to.equal(10)
        // Check if contract is not vesting
        expect(await yfUSDTContract.isVesting()).is.false
        // Check if treasury wallet address match given address
        expect(await yfUSDTContract.treasuryWallet()).to.equal(treasuryWalletAddress)
        // Check if Yearn USDT Earn contract and Yearn USDT Vault contract match given contract
        expect(await yfUSDTContract.earn()).to.equal(yEarnAddress)
        expect(await yfUSDTContract.vault()).to.equal(yVaultAddress)
        // Check daoUSDT token is set properly
        expect(await yfUSDTContract.name()).to.equal("DAO Tether USDT")
        expect(await yfUSDTContract.symbol()).to.equal("daoUSDT")
        expect(await yfUSDTContract.decimals()).to.equal(6)
    })

    it("should able to transfer contract ownership to other address by contract owner only", async () => {
        // Get address of owner and new owner and deploy the contract
        const [ownerSigner, newOwnerSigner, _] = await ethers.getSigners()
        const ownerSignerAddress = await ownerSigner.getAddress()
        const newOwnerSignerAddress = await newOwnerSigner.getAddress()
        const YfUSDTContract = await ethers.getContractFactory("yfUSDT", ownerSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()
        // Check if contract ownership is owner before transfer
        expect(await yfUSDTContract.owner()).to.equal(ownerSignerAddress)
        // Check if new owner cannot execute admin function yet
        await expect(yfUSDTContract.connect(newOwnerSigner).setProfileSharingFeePercentage(20)).to.be.reverted
        // Transfer contract ownership from owner to new owner
        await yfUSDTContract.transferOwnership(newOwnerSignerAddress)
        // Check if contract ownership is new owner after transfer
        expect(await yfUSDTContract.owner()).to.equal(newOwnerSignerAddress)
        // Check if new owner can execute admin function
        await expect(yfUSDTContract.connect(newOwnerSigner).setProfileSharingFeePercentage(20)).not.to.be.reverted
        // Check if original owner neither can execute admin function nor transfer back ownership
        await expect(yfUSDTContract.connect(ownerSigner).setProfileSharingFeePercentage(20)).to.be.reverted
        await expect(yfUSDTContract.connect(ownerSigner).transferOwnership(ownerSignerAddress)).to.be.reverted
    })


    // it("should deposit earn and vault correctly", async () => {
    //     const [accountSigner, _] = await ethers.getSigners()
    //     const accountSignerAddress = await accountSigner.getAddress()

    //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
    //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
    //     await yfUSDTContract.deployed()

    //     const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)

    //     // Deposit into Yearn Farmer contract
    //     tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
    //     tx.wait()
    //     let earnDepositAmount = 100
    //     let vaultDepositAmount = 200
    //     await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)

    //     // Test function earnDepositBalanceOf and vaultDepositBalanceOf
    //     function afterDepositFee(amount) {
    //         if (amount > 0 && amount <= 10000) {
    //             return (amount - amount * 1 / 100).toString()
    //         } else if (amount >= 10001 && amount <= 100000) {
    //             return (amount - amount * 0.5 / 100).toString()
    //         } else {
    //             return (amount - amount * 0.25 / 100).toString()
    //         }
    //     }
    //     earnDepositAmount = afterDepositFee(earnDepositAmount)
    //     earnDepositAmount = new ethers.BigNumber.from(earnDepositAmount)
    //     vaultDepositAmount = afterDepositFee(vaultDepositAmount)
    //     vaultDepositAmount = new ethers.BigNumber.from(vaultDepositAmount)

    //     let balance
    //     balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
    //     expect(balance).to.equal(earnDepositAmount)
    //     balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
    //     expect(balance).to.equal(vaultDepositAmount)

    //     // Test function earnBalanceOf and vaultBalanceOf
    //     const IYearnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, accountSigner)
    //     const earnPool = await IYearnContract.calcPoolValueInToken()
    //     const earnTotalSupply = await IYearnContract.totalSupply()
    //     const earnShares = earnDepositAmount.mul(earnTotalSupply).div(earnPool)

    //     const IYvaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, accountSigner)
    //     const vaultPool = await IYvaultContract.balance()
    //     const vaultTotalSupply = await IYvaultContract.totalSupply()
    //     const vaultShares = vaultDepositAmount.mul(vaultTotalSupply).div(vaultPool)

    //     balance = await yfUSDTContract.earnBalanceOf(accountSignerAddress)
    //     expect(balance).to.equal(earnShares)
    //     balance = await yfUSDTContract.vaultBalanceOf(accountSignerAddress)
    //     expect(balance).to.equal(vaultShares)

    //     // Test if deposit address is a contract
    //     const SampleContract = await ethers.getContractFactory("SampleContract")
    //     const sampleContract = await SampleContract.deploy(yfUSDTContract.address)
    //     await sampleContract.deployed()
    //     await hre.network.provider.request({
    //         method: "hardhat_impersonateAccount",
    //         params: [senderAddress]
    //     })
    //     const senderSigner = await ethers.provider.getSigner(senderAddress)
    //     await tokenContract.connect(senderSigner).transfer(sampleContract.address, 10000000)
    //     tx = await tokenContract.approve(sampleContract.address, 1000000)
    //     tx.wait()
    //     await expect(sampleContract.deposit()).to.be.reverted
    // })


    // it("should set deposit fee tier correctly", async () => {
    //     const [accountSigner, _] = await ethers.getSigners()
    //     const accountSignerAddress = await accountSigner.getAddress()

    //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
    //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
    //     await yfUSDTContract.deployed()

    //     const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)
    //     tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
    //     tx.wait()

    //     // const depositFeeTier2 = [5000, 50000]
    //     // await yfUSDTContract.setDepositFeeTier(depositFeeTier2)
    //     // expect(await yfUSDTContract.depositFeeTier2(0)).to.equal(depositFeeTier2[0])
    //     // expect(await yfUSDTContract.depositFeeTier2(1)).to.equal(depositFeeTier2[1])
        
    //     let balance

    //     // const earnDepositAmount = 100
    //     // const vaultDepositAmount = 200
    //     // await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)
    //     // balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
    //     // const earnDepositAmountAfterFee = earnDepositAmount - (earnDepositAmount * 1 / 100)
    //     // expect(balance.toString()).to.equal(earnDepositAmountAfterFee.toString())
    //     // balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
    //     // const vaultDepositAmountAfterFee = vaultDepositAmount - (vaultDepositAmount * 1 / 100)
    //     // expect(balance.toString()).to.equal(vaultDepositAmountAfterFee.toString())

    //     // const earnDepositAmount = 20000
    //     // const vaultDepositAmount = 30000
    //     // await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)
    //     // balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
    //     // const earnDepositAmountAfterFee = earnDepositAmount - (earnDepositAmount * 0.5 / 100)
    //     // expect(balance.toString()).to.equal(earnDepositAmountAfterFee.toString())
    //     // const vaultDepositAmountAfterFee = vaultDepositAmount - (vaultDepositAmount * 0.5 / 100)
    //     // balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
    //     // expect(balance.toString()).to.equal(vaultDepositAmountAfterFee.toString())

    //     // const earnDepositAmount = 30000
    //     // const vaultDepositAmount = 30000
    //     // await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)
    //     // balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
    //     // const earnDepositAmountAfterFee = earnDepositAmount - (earnDepositAmount * 0.25 / 100)
    //     // expect(balance.toString()).to.equal(earnDepositAmountAfterFee.toString())
    //     // const vaultDepositAmountAfterFee = vaultDepositAmount - (vaultDepositAmount * 0.25 / 100)
    //     // balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
    //     // expect(balance.toString()).to.equal(vaultDepositAmountAfterFee.toString())

    //     // const hackerSigner = await ethers.provider.getSigner(accountSigners[1].address)
    //     // await expect(yfUSDTContract.connect(hackerSigner).setDepositFeeTier([1, 2])).to.be.reverted
    // })


    // it("should set deposit fee percentage correctly", async () => {
    //     const [accountSigner, hackerSigner, _] = await ethers.getSigners()
    //     const accountSignerAddress = await accountSigner.getAddress()

    //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
    //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
    //     await yfUSDTContract.deployed()

    //     const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)
    //     tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
    //     tx.wait()

    //     // const hackerSigner = await ethers.provider.getSigner(accountSigners[1].address)
    //     await expect(yfUSDTContract.connect(hackerSigner).setDepositFeePercentage([390, 390, 390])).to.be.reverted
    //     await expect(yfUSDTContract.connect(accountSigner).setDepositFeePercentage([1000, 1000, 1000])).to.be.reverted

    //     let earnBalanceBeforeDeposit, earnBalanceAfterDeposit, earnBalance
    //     let vaultBalanceBeforeDeposit, vaultBalanceAfterDeposit, vaultBalance
    //     const earnDepositAmount = 100
    //     const vaultDepositAmount = 200
    //     const totalDepositAmount = earnDepositAmount + vaultDepositAmount
    //     const tier1ProfileSharingFeePercentage = 200
    //     const tier2ProfileSharingFeePercentage = 100
    //     const tier3ProfileSharingFeePercentage = 75
    //     await yfUSDTContract.setDepositFeePercentage([
    //         tier1ProfileSharingFeePercentage, 
    //         tier2ProfileSharingFeePercentage, 
    //         tier3ProfileSharingFeePercentage
    //     ])
    //     earnBalanceBeforeDeposit = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
    //     vaultBalanceBeforeDeposit = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
    //     await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)
    //     earnBalanceAfterDeposit = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
    //     vaultBalanceAfterDeposit = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
    //     earnBalance = earnBalanceAfterDeposit - earnBalanceBeforeDeposit
    //     vaultBalance = vaultBalanceAfterDeposit - vaultBalanceBeforeDeposit
    //     let expectedEarnBalance, expectedVaultBalance
    //     if (totalDepositAmount < 10000) {
    //         expectedEarnBalance = earnDepositAmount - (earnDepositAmount * tier1ProfileSharingFeePercentage / 10000)
    //         expectedVaultBalance = vaultDepositAmount - (vaultDepositAmount * tier1ProfileSharingFeePercentage / 10000)
    //     } else if (totalDepositAmount >= 10000 && totalDepositAmount <= 100000) {
    //         expectedEarnBalance = earnDepositAmount - (earnDepositAmount * tier2ProfileSharingFeePercentage / 10000)
    //         expectedVaultBalance = vaultDepositAmount - (vaultDepositAmount * tier2ProfileSharingFeePercentage / 10000)
    //     } else {
    //         expectedEarnBalance = earnDepositAmount - (earnDepositAmount * tier3ProfileSharingFeePercentage / 10000)
    //         expectedVaultBalance = vaultDepositAmount - (vaultDepositAmount * tier3ProfileSharingFeePercentage / 10000)
    //     }
    //     expect(earnBalance).to.equal(expectedEarnBalance)
    //     expect(vaultBalance).to.equal(expectedVaultBalance)
    // })


    // it("should withdraw earn and vault correctly", async () => {
    //     const [accountSigner, _] = await ethers.getSigners()
    //     const accountSignerAddress = await accountSigner.getAddress()

    //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
    //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
    //     await yfUSDTContract.deployed()

    //     const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)

    //     // Deposit into Yearn Farmer contract
    //     tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
    //     tx.wait()
    //     let earnDepositAmount = 100
    //     let vaultDepositAmount = 200
    //     await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)

    //     const daoTokenAmountBeforeWithdraw = await yfUSDTContract.balanceOf(accountSignerAddress)
    //     const USDTAmountBeforeWithdraw = await tokenContract.balanceOf(accountSignerAddress)

    //     // Withdraw from Yearn Farmer contract
    //     const earnShares = await yfUSDTContract.earnBalanceOf(accountSignerAddress)
    //     await yfUSDTContract.withdrawEarn(earnShares)
    //     expect((await yfUSDTContract.earnPool()).toString()).to.equal("0")
    //     expect((await yfUSDTContract.earnBalanceOf(accountSignerAddress)).toString()).to.equal("0")
    //     expect(await yfUSDTContract.balanceOf(accountSignerAddress)).to.equal(daoTokenAmountBeforeWithdraw.sub(earnShares))
    //     expect((await tokenContract.balanceOf(accountSignerAddress)).gt(USDTAmountBeforeWithdraw)).is.true
    //     expect((await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)).toString()).to.equal("0")
    //     await expect(yfUSDTContract.withdrawEarn(0)).to.be.revertedWith("Amount must be greater than 0")
    //     await expect(yfUSDTContract.withdrawEarn(earnShares)).to.be.revertedWith("Insufficient Balances")

    //     const vaultShares = await yfUSDTContract.vaultBalanceOf(accountSignerAddress)
    //     await yfUSDTContract.withdrawVault(vaultShares)
    //     expect((await yfUSDTContract.vaultPool()).toString()).to.equal("0")
    //     expect((await yfUSDTContract.vaultBalanceOf(accountSignerAddress)).toString()).to.equal("0")
    //     expect((await yfUSDTContract.balanceOf(accountSignerAddress)).toString()).to.equal("0")
    //     expect((await tokenContract.balanceOf(accountSignerAddress)).gt(USDTAmountBeforeWithdraw)).is.true
    //     expect((await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)).toString()).to.equal("0")
    //     await expect(yfUSDTContract.withdrawVault(0)).to.be.revertedWith("Amount must be greater than 0")
    //     await expect(yfUSDTContract.withdrawVault(vaultShares)).to.be.revertedWith("Insufficient Balances")
    // })


    // // it("should set withdraw fee percentage correctly", async () => {
    // //     // TO DO
    // // })


    // it("should send deposit fee and profile sharing fee to treasury wallet correctly", async () => {
    //     const [accountSigner, _] = await ethers.getSigners()
    //     const accountSignerAddress = await accountSigner.getAddress()

    //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
    //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
    //     await yfUSDTContract.deployed()

    //     const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)

    //     // Clear out all token in treasury wallet
    //     await hre.network.provider.request({
    //         method: "hardhat_impersonateAccount",
    //         params: [treasuryWalletAddress]
    //     })
    //     const treasuryWalletSigner = await ethers.provider.getSigner(treasuryWalletAddress)
    //     await tokenContract.connect(treasuryWalletSigner).transfer(yfUSDTContract.address, await tokenContract.balanceOf(treasuryWalletAddress))

    //     // Deposit into Yearn Farmer contract
    //     tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
    //     tx.wait()
    //     let earnDepositAmount = 100 // Also test with 10000, 100000
    //     let vaultDepositAmount = 200 // Also test with 20000, 200000
    //     await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)

    //     let earnDepositFee, vaultDepositFee, depositFee
    //     balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
    //     earnDepositFee = earnDepositAmount - balance
    //     balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
    //     vaultDepositFee = vaultDepositAmount - balance
    //     depositFee = earnDepositFee + vaultDepositFee
    //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(depositFee)

    //     // Withdraw from Yearn Farmer Contract
    //     let profileSharingFee
    //     await yfUSDTContract.withdrawEarn(await yfUSDTContract.earnBalanceOf(accountSignerAddress))
    //     profileSharingFee = 0
    //     // profileSharingFee = 100 * 0.1 // 10%
    //     depositFee += profileSharingFee
    //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(depositFee)

    //     await yfUSDTContract.withdrawVault(await yfUSDTContract.vaultBalanceOf(accountSignerAddress))
    //     profileSharingFee = 0
    //     // profileSharingFee = 200 * 0.1 // 10%
    //     depositFee += profileSharingFee
    //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(depositFee)
    // })

})
