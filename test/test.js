const { expect, assert } = require("chai")
const { ethers } = require("hardhat")
const hre = require("hardhat")
require("dotenv").config()
const IERC20_ABI = require("../abis/IERC20.json").abi
const IYearn_ABI = require("../artifacts/interfaces/IYearn.sol/IYearn.json").abi
const IYvault_ABI = require("../artifacts/interfaces/IYvault.sol/IYvault.json").abi

// USDT
const tokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const yEarnAddress = "0xE6354ed5bC4b393a5Aad09f21c46E101e692d447"
const yVaultAddress = "0x2f08119c6f07c006695e079aafc638b8789faf18"
const senderAddress = "0x1062a747393198f70F71ec65A582423Dba7E5Ab3"

// USDC
// const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
// const yEarnAddress = "0x26EA744E5B887E5205727f55dFBE8685e3b21951"
// const yVaultAddress = "0x597ad1e0c13bfe8025993d9e79c69e1c0233522e"
// const senderAddress = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8"

// DAI
// const tokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
// const yEarnAddress = "0xC2cB1040220768554cf699b0d863A3cd4324ce32"
// const yVaultAddress = "0xacd43e627e64355f1861cec6d3a6688b31a6f952"
// const senderAddress = "0x04ad0703B9c14A85A02920964f389973e094E153"

// TUSD
// const tokenAddress = "0x0000000000085d4780B73119b644AE5ecd22b376"
// const yEarnAddress = "0x73a052500105205d34daf004eab301916da8190f" // v2
// const yVaultAddress = "0x37d19d1c4e1fa9dc47bd1ea12f742a0887eda74a"
// const senderAddress = "0x701bd63938518d7DB7e0f00945110c80c67df532"

const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
let tx

describe("yfUSDT", () => {
    before(async () => {
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [senderAddress]
        })
        const senderSigner = await ethers.provider.getSigner(senderAddress)

        const [accountSigner, _] = await ethers.getSigners()
        const accountSignerAddress = await accountSigner.getAddress()

        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)
        await tokenContract.connect(senderSigner).transfer(accountSignerAddress, 10000000)
        expect(await tokenContract.balanceOf(accountSignerAddress)).to.equal(10000000)

        // const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
        // const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        // await yfUSDTContract.deployed()
        // await tokenContract.connect(senderSigner).transfer(yfUSDTContract.address, 10000)
        // expect(await tokenContract.balanceOf(yfUSDTContract.address)).to.equal(10000)
    })

    // it("Should work", async () => {
    //     const [accountSigner, _] = await ethers.getSigners()
    //     const accountSignerAddress = await accountSigner.getAddress()

    //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
    //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
    //     await yfUSDTContract.deployed()
    //     // expect(yfUSDTContract.address).is.properAddress

    //     const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)

    //     // expect(await tokenContract.balanceOf(accountSignerAddress)).to.equal(1000000)
    //     // expect(await tokenContract.balanceOf(yfUSDTContract.address)).to.equal(10000)

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

    //     const daoUSDTContract = new ethers.Contract(yfUSDTContract.address, IERC20_ABI, accountSigner)
    //     balance = await daoUSDTContract.balanceOf(accountSignerAddress)
    //     expect(balance).to.equal(earnShares.add(vaultShares))

    //     // Test function withdrawEarn and withdrawVault
    //     const profitSharingPercentage = 10
        
    //     const earnReturn = earnPool.mul(earnShares).div(earnTotalSupply)
    //     // const earnReturn = new ethers.BigNumber.from("200")
    //     let finalEarnReturn
    //     if (earnReturn.gt(earnDepositAmount)) {
    //         const earnProfit = earnReturn.sub(earnDepositAmount)
    //         const earnProfileSharingFee = earnProfit.mul(profitSharingPercentage).div(100)
    //         finalEarnReturn = earnReturn.sub(earnProfileSharingFee)
    //     } else {
    //         finalEarnReturn = earnReturn
    //     }
    //     const balanceBeforeWithdrawEarn = await tokenContract.balanceOf(accountSignerAddress)
    //     await yfUSDTContract.withdrawEarn(earnShares)
    //     const balanceAfterWithdrawEarn = await tokenContract.balanceOf(accountSignerAddress)
    //     expect(balanceAfterWithdrawEarn.sub(balanceBeforeWithdrawEarn)).to.equal(finalEarnReturn)
    //     balance = await daoUSDTContract.balanceOf(accountSignerAddress)
    //     expect(balance).to.equal(vaultShares)

    //     const vaultReturn = vaultPool.mul(vaultShares).div(vaultTotalSupply)
    //     // const vaultReturn = new ethers.BigNumber.from("400")
    //     let finalVaultReturn
    //     if (vaultReturn.gt(vaultDepositAmount)) {
    //         const vaultProfit = vaultReturn.sub(vaultDepositAmount)
    //         const vaultProfileSharingFee = vaultProfit.mul(profitSharingPercentage).div(100)
    //         finalVaultReturn = vaultReturn.sub(vaultProfileSharingFee)
    //     } else {
    //         finalVaultReturn = vaultReturn
    //     }
    //     const balanceBeforeWithdrawVault = await tokenContract.balanceOf(accountSignerAddress)
    //     await yfUSDTContract.withdrawVault(vaultShares)
    //     const balanceAfterWithdrawVault = await tokenContract.balanceOf(accountSignerAddress)
    //     expect(balanceAfterWithdrawVault.sub(balanceBeforeWithdrawVault)).to.equal(finalVaultReturn)
    //     balance = await daoUSDTContract.balanceOf(accountSignerAddress)
    //     expect(balance).to.equal(0)
    // })


    it("should transfer contract ownership to other address correctly", async () => {
        const accountSigners = await ethers.getSigners()
        const originalSigner = await ethers.provider.getSigner(accountSigners[0].address)
        const originalSignerAddress = await originalSigner.getAddress()
        const anotherSigner = await ethers.provider.getSigner(accountSigners[1].address)
        const anotherSignerAddress = await anotherSigner.getAddress()

        const YfUSDTContract = await ethers.getContractFactory("yfUSDT", originalSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()

        expect(await yfUSDTContract.owner()).to.equal(originalSignerAddress)
        await expect(yfUSDTContract.connect(anotherSigner).setProfileSharingFeePercentage(20)).to.be.reverted
        await yfUSDTContract.transferOwnership(anotherSignerAddress)
        expect(await yfUSDTContract.owner()).to.equal(anotherSignerAddress)
        await expect(yfUSDTContract.connect(originalSigner).setProfileSharingFeePercentage(20)).to.be.reverted

        await expect(yfUSDTContract.connect(originalSigner).transferOwnership(originalSignerAddress)).to.be.reverted
    })


    it("should deposit earn and vault correctly", async () => {
        const [accountSigner, _] = await ethers.getSigners()
        const accountSignerAddress = await accountSigner.getAddress()

        const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()

        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)

        // Deposit into Yearn Farmer contract
        tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
        tx.wait()
        let earnDepositAmount = 100
        let vaultDepositAmount = 200
        await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)

        // Test function earnDepositBalanceOf and vaultDepositBalanceOf
        function afterDepositFee(amount) {
            if (amount > 0 && amount <= 10000) {
                return (amount - amount * 1 / 100).toString()
            } else if (amount >= 10001 && amount <= 100000) {
                return (amount - amount * 0.5 / 100).toString()
            } else {
                return (amount - amount * 0.25 / 100).toString()
            }
        }
        earnDepositAmount = afterDepositFee(earnDepositAmount)
        earnDepositAmount = new ethers.BigNumber.from(earnDepositAmount)
        vaultDepositAmount = afterDepositFee(vaultDepositAmount)
        vaultDepositAmount = new ethers.BigNumber.from(vaultDepositAmount)

        let balance
        balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
        expect(balance).to.equal(earnDepositAmount)
        balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
        expect(balance).to.equal(vaultDepositAmount)

        // Test function earnBalanceOf and vaultBalanceOf
        const IYearnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, accountSigner)
        const earnPool = await IYearnContract.calcPoolValueInToken()
        const earnTotalSupply = await IYearnContract.totalSupply()
        const earnShares = earnDepositAmount.mul(earnTotalSupply).div(earnPool)

        const IYvaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, accountSigner)
        const vaultPool = await IYvaultContract.balance()
        const vaultTotalSupply = await IYvaultContract.totalSupply()
        const vaultShares = vaultDepositAmount.mul(vaultTotalSupply).div(vaultPool)

        balance = await yfUSDTContract.earnBalanceOf(accountSignerAddress)
        expect(balance).to.equal(earnShares)
        balance = await yfUSDTContract.vaultBalanceOf(accountSignerAddress)
        expect(balance).to.equal(vaultShares)

        // Test if deposit address is a contract
        const SampleContract = await ethers.getContractFactory("SampleContract")
        const sampleContract = await SampleContract.deploy(yfUSDTContract.address)
        await sampleContract.deployed()
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [senderAddress]
        })
        const senderSigner = await ethers.provider.getSigner(senderAddress)
        await tokenContract.connect(senderSigner).transfer(sampleContract.address, 10000000)
        tx = await tokenContract.approve(sampleContract.address, 1000000)
        tx.wait()
        await expect(sampleContract.deposit()).to.be.reverted
    })


    it("should set deposit fee tier correctly", async () => {
        const [accountSigner, _] = await ethers.getSigners()
        const accountSignerAddress = await accountSigner.getAddress()

        const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()

        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)
        tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
        tx.wait()

        // const depositFeeTier2 = [5000, 50000]
        // await yfUSDTContract.setDepositFeeTier(depositFeeTier2)
        // expect(await yfUSDTContract.depositFeeTier2(0)).to.equal(depositFeeTier2[0])
        // expect(await yfUSDTContract.depositFeeTier2(1)).to.equal(depositFeeTier2[1])
        
        let balance

        // const earnDepositAmount = 100
        // const vaultDepositAmount = 200
        // await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)
        // balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
        // const earnDepositAmountAfterFee = earnDepositAmount - (earnDepositAmount * 1 / 100)
        // expect(balance.toString()).to.equal(earnDepositAmountAfterFee.toString())
        // balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
        // const vaultDepositAmountAfterFee = vaultDepositAmount - (vaultDepositAmount * 1 / 100)
        // expect(balance.toString()).to.equal(vaultDepositAmountAfterFee.toString())

        // const earnDepositAmount = 20000
        // const vaultDepositAmount = 30000
        // await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)
        // balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
        // const earnDepositAmountAfterFee = earnDepositAmount - (earnDepositAmount * 0.5 / 100)
        // expect(balance.toString()).to.equal(earnDepositAmountAfterFee.toString())
        // const vaultDepositAmountAfterFee = vaultDepositAmount - (vaultDepositAmount * 0.5 / 100)
        // balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
        // expect(balance.toString()).to.equal(vaultDepositAmountAfterFee.toString())

        // const earnDepositAmount = 30000
        // const vaultDepositAmount = 30000
        // await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)
        // balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
        // const earnDepositAmountAfterFee = earnDepositAmount - (earnDepositAmount * 0.25 / 100)
        // expect(balance.toString()).to.equal(earnDepositAmountAfterFee.toString())
        // const vaultDepositAmountAfterFee = vaultDepositAmount - (vaultDepositAmount * 0.25 / 100)
        // balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
        // expect(balance.toString()).to.equal(vaultDepositAmountAfterFee.toString())

        // const hackerSigner = await ethers.provider.getSigner(accountSigners[1].address)
        // await expect(yfUSDTContract.connect(hackerSigner).setDepositFeeTier([1, 2])).to.be.reverted
    })


    it("should set deposit fee percentage correctly", async () => {
        const [accountSigner, hackerSigner, _] = await ethers.getSigners()
        const accountSignerAddress = await accountSigner.getAddress()

        const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()

        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)
        tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
        tx.wait()

        // const hackerSigner = await ethers.provider.getSigner(accountSigners[1].address)
        await expect(yfUSDTContract.connect(hackerSigner).setDepositFeePercentage([390, 390, 390])).to.be.reverted
        await expect(yfUSDTContract.connect(accountSigner).setDepositFeePercentage([1000, 1000, 1000])).to.be.reverted

        let earnBalanceBeforeDeposit, earnBalanceAfterDeposit, earnBalance
        let vaultBalanceBeforeDeposit, vaultBalanceAfterDeposit, vaultBalance
        const earnDepositAmount = 100
        const vaultDepositAmount = 200
        const totalDepositAmount = earnDepositAmount + vaultDepositAmount
        const tier1ProfileSharingFeePercentage = 200
        const tier2ProfileSharingFeePercentage = 100
        const tier3ProfileSharingFeePercentage = 75
        await yfUSDTContract.setDepositFeePercentage([
            tier1ProfileSharingFeePercentage, 
            tier2ProfileSharingFeePercentage, 
            tier3ProfileSharingFeePercentage
        ])
        earnBalanceBeforeDeposit = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
        vaultBalanceBeforeDeposit = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
        await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)
        earnBalanceAfterDeposit = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
        vaultBalanceAfterDeposit = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
        earnBalance = earnBalanceAfterDeposit - earnBalanceBeforeDeposit
        vaultBalance = vaultBalanceAfterDeposit - vaultBalanceBeforeDeposit
        let expectedEarnBalance, expectedVaultBalance
        if (totalDepositAmount < 10000) {
            expectedEarnBalance = earnDepositAmount - (earnDepositAmount * tier1ProfileSharingFeePercentage / 10000)
            expectedVaultBalance = vaultDepositAmount - (vaultDepositAmount * tier1ProfileSharingFeePercentage / 10000)
        } else if (totalDepositAmount >= 10000 && totalDepositAmount <= 100000) {
            expectedEarnBalance = earnDepositAmount - (earnDepositAmount * tier2ProfileSharingFeePercentage / 10000)
            expectedVaultBalance = vaultDepositAmount - (vaultDepositAmount * tier2ProfileSharingFeePercentage / 10000)
        } else {
            expectedEarnBalance = earnDepositAmount - (earnDepositAmount * tier3ProfileSharingFeePercentage / 10000)
            expectedVaultBalance = vaultDepositAmount - (vaultDepositAmount * tier3ProfileSharingFeePercentage / 10000)
        }
        expect(earnBalance).to.equal(expectedEarnBalance)
        expect(vaultBalance).to.equal(expectedVaultBalance)
    })


    it("should withdraw earn and vault correctly", async () => {
        const [accountSigner, _] = await ethers.getSigners()
        const accountSignerAddress = await accountSigner.getAddress()

        const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()

        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)

        // Deposit into Yearn Farmer contract
        tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
        tx.wait()
        let earnDepositAmount = 100
        let vaultDepositAmount = 200
        await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)

        const daoTokenAmountBeforeWithdraw = await yfUSDTContract.balanceOf(accountSignerAddress)
        const USDTAmountBeforeWithdraw = await tokenContract.balanceOf(accountSignerAddress)

        // Withdraw from Yearn Farmer contract
        const earnShares = await yfUSDTContract.earnBalanceOf(accountSignerAddress)
        await yfUSDTContract.withdrawEarn(earnShares)
        expect((await yfUSDTContract.earnPool()).toString()).to.equal("0")
        expect((await yfUSDTContract.earnBalanceOf(accountSignerAddress)).toString()).to.equal("0")
        expect(await yfUSDTContract.balanceOf(accountSignerAddress)).to.equal(daoTokenAmountBeforeWithdraw.sub(earnShares))
        expect((await tokenContract.balanceOf(accountSignerAddress)).gt(USDTAmountBeforeWithdraw)).is.true
        expect((await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)).toString()).to.equal("0")
        await expect(yfUSDTContract.withdrawEarn(0)).to.be.revertedWith("Amount must be greater than 0")
        await expect(yfUSDTContract.withdrawEarn(earnShares)).to.be.revertedWith("Insufficient Balances")

        const vaultShares = await yfUSDTContract.vaultBalanceOf(accountSignerAddress)
        await yfUSDTContract.withdrawVault(vaultShares)
        expect((await yfUSDTContract.vaultPool()).toString()).to.equal("0")
        expect((await yfUSDTContract.vaultBalanceOf(accountSignerAddress)).toString()).to.equal("0")
        expect((await yfUSDTContract.balanceOf(accountSignerAddress)).toString()).to.equal("0")
        expect((await tokenContract.balanceOf(accountSignerAddress)).gt(USDTAmountBeforeWithdraw)).is.true
        expect((await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)).toString()).to.equal("0")
        await expect(yfUSDTContract.withdrawVault(0)).to.be.revertedWith("Amount must be greater than 0")
        await expect(yfUSDTContract.withdrawVault(vaultShares)).to.be.revertedWith("Insufficient Balances")
    })


    // it("should set withdraw fee percentage correctly", async () => {
    //     // TO DO
    // })


    it("should send deposit fee and profile sharing fee to treasury wallet correctly", async () => {
        const [accountSigner, _] = await ethers.getSigners()
        const accountSignerAddress = await accountSigner.getAddress()

        const YfUSDTContract = await ethers.getContractFactory("yfUSDT", accountSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()

        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, accountSigner)

        // Clear out all token in treasury wallet
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [treasuryWalletAddress]
        })
        const treasuryWalletSigner = await ethers.provider.getSigner(treasuryWalletAddress)
        await tokenContract.connect(treasuryWalletSigner).transfer(yfUSDTContract.address, await tokenContract.balanceOf(treasuryWalletAddress))

        // Deposit into Yearn Farmer contract
        tx = await tokenContract.approve(yfUSDTContract.address, 1000000)
        tx.wait()
        let earnDepositAmount = 100 // Also test with 10000, 100000
        let vaultDepositAmount = 200 // Also test with 20000, 200000
        await yfUSDTContract.deposit(earnDepositAmount, vaultDepositAmount)

        let earnDepositFee, vaultDepositFee, depositFee
        balance = await yfUSDTContract.earnDepositBalanceOf(accountSignerAddress)
        earnDepositFee = earnDepositAmount - balance
        balance = await yfUSDTContract.vaultDepositBalanceOf(accountSignerAddress)
        vaultDepositFee = vaultDepositAmount - balance
        depositFee = earnDepositFee + vaultDepositFee
        expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(depositFee)

        // Withdraw from Yearn Farmer Contract
        let profileSharingFee
        await yfUSDTContract.withdrawEarn(await yfUSDTContract.earnBalanceOf(accountSignerAddress))
        profileSharingFee = 0
        // profileSharingFee = 100 * 0.1 // 10%
        depositFee += profileSharingFee
        expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(depositFee)

        await yfUSDTContract.withdrawVault(await yfUSDTContract.vaultBalanceOf(accountSignerAddress))
        profileSharingFee = 0
        // profileSharingFee = 200 * 0.1 // 10%
        depositFee += profileSharingFee
        expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(depositFee)
    })
})
