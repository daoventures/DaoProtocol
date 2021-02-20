const { expect } = require("chai")
const { ethers, network } = require("hardhat")
require("dotenv").config()
const IERC20_ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json").abi
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

describe("yfUSDTv2", () => {
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
        await tokenContract.connect(unlockedSigner).transfer(senderSignerAddress, 500000000000000)
        expect(await tokenContract.balanceOf(senderSignerAddress)).to.equal(500000000000000)
    })

    it("should deploy contract correctly", async () => {
        // Get sender address and deploy the contracts
        const [senderSigner, _] = await ethers.getSigners()
        const senderAddress = await senderSigner.getAddress()
        const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
        const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
        await yfUSDTContract.deployed()
        const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
        const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
        await daoVault.deployed()
        await yfUSDTContract.setVault(daoVault.address)
        // Check if execute set vault function again to be reverted
        await expect(yfUSDTContract.setVault(senderAddress)).to.be.revertedWith("Vault set")
        // Check if contract owner is contract deployer in both contracts
        expect(await yfUSDTContract.owner()).to.equal(senderAddress)
        expect(await daoVault.owner()).to.equal(senderAddress)
        // Check if token accept is USDT in both contract
        expect(await yfUSDTContract.token()).to.equal(tokenAddress)
        expect(await daoVault.token()).to.equal(tokenAddress)
        // Check if Yearn USDT Earn contract and Yearn USDT Vault contract match given contract in Yearn Farmer contract
        expect(await yfUSDTContract.earn()).to.equal(yEarnAddress)
        expect(await yfUSDTContract.vault()).to.equal(yVaultAddress)
        // Check if initial pool set correctly in Yearn Farmer contract
        expect(await yfUSDTContract.pool()).to.equal(0)
        // Check if treasury wallet address match given address in Yearn Farmer contract
        expect(await yfUSDTContract.treasuryWallet()).to.equal(treasuryWalletAddress)
        // Check if initial tier2 of deposit fee is 10001 <= tokenAmount <= 100000 in Yearn Farmer contract (More details in contract)
        expect(await yfUSDTContract.depositFeeTier2(0)).to.equal(10001)
        expect(await yfUSDTContract.depositFeeTier2(1)).to.equal(100000)
        // Check if initial deposit fee percentage is 1% for tier1, 0.5% for tier2, and 0.25% for tier3 in Yearn Farmer contract (More details in contract)
        expect(await yfUSDTContract.depositFeePercentage(0)).to.equal(100) // 1% = 100/10000, more detail in contract
        expect(await yfUSDTContract.depositFeePercentage(1)).to.equal(50) // 1% = 50/10000, more detail in contract
        expect(await yfUSDTContract.depositFeePercentage(2)).to.equal(25) // 1% = 25/10000, more detail in contract
        // Check if initial profile sharing fee percentage is 10% in Yearn Farmer contract
        expect(await yfUSDTContract.profileSharingFeePercentage()).to.equal(10)
        // Check if contract is not vesting in Yearn Farmer contract
        expect(await yfUSDTContract.isVesting()).is.false
        // Check if daoVault contract address set correctly in Yearn Farmer contract
        expect(await yfUSDTContract.daoVault()).to.equal(daoVault.address)
        // Check if timelock duration is set to 1 day in Yearn Farmer contract
        expect(await yfUSDTContract.TIMELOCK()).to.equal(1*24*60*60) // 1 day in seconds
        // Check if no pre-set timelock in corresponding admin functions in Yearn Farmer contract
        expect(await yfUSDTContract.timelock(0)).to.equal(0) // setTreasuryWallet()
        expect(await yfUSDTContract.timelock(1)).to.equal(0) // setDepositFeeTier2()
        expect(await yfUSDTContract.timelock(2)).to.equal(0) // setDepositFeePercentage()
        expect(await yfUSDTContract.timelock(3)).to.equal(0) // setProfileSharingFeePercentage()
        expect(await yfUSDTContract.timelock(4)).to.equal(0) // vesting()
        // Check daoUSDT token is set properly in daoVault contract
        expect(await daoVault.name()).to.equal("DAO Tether USDT")
        expect(await daoVault.symbol()).to.equal("daoUSDT")
        expect(await daoVault.decimals()).to.equal(18)
        // Check if strategy match given contract in daoVault contract
        expect(await daoVault.strategy()).to.equal(yfUSDTContract.address)
        // Check pendingStrategy is no pre-set in daoVault contract
        expect(await daoVault.pendingStrategy()).to.equal(ethers.constants.AddressZero)
        expect(await daoVault.canSetPendingStrategy()).is.true
        // Check if no unlockTime set yet in daoVault contract
        expect(await daoVault.unlockTime()).to.equal(0)
        // Check if timelock duration is 5 days in daoVault contract
        expect(await daoVault.LOCKTIME()).to.equal(5*24*60*60) // 5 days in seconds
    })

    // Check user functions
    describe("User functions", () => {
        it("should able to deposit earn and vault correctly", async () => {
            // Get sender address and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const senderAddress = await senderSigner.getAddress()
            const clientAddress = await clientSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Transfer some USDT to client
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientAddress, 1000)
            expect(await token.balanceOf(clientAddress)).to.equal(1000)
            // Check if meet the function requirements
            const SampleContract = await ethers.getContractFactory("SampleContract")
            const sampleContract = await SampleContract.deploy(daoVault.address, tokenAddress)
            await sampleContract.deployed()
            await token.transfer(sampleContract.address, 1000)
            expect(await token.balanceOf(sampleContract.address)).to.equal(1000)
            await sampleContract.approve(yfUSDTContract.address)
            await expect(sampleContract.deposit()).to.be.revertedWith("Caller is a contract not EOA")
            await expect(daoVault.connect(clientSigner).deposit([0, 0])).to.be.revertedWith("Amount must > 0")
            await expect(yfUSDTContract.connect(clientSigner).deposit([100, 200])).to.be.revertedWith("Only can call from Vault")
            // Deposit 100 USDT to Yearn Earn contract and 200 to Yearn Vault Contract
            await token.connect(clientSigner).approve(yfUSDTContract.address, 10000000000)
            const tx = await daoVault.connect(clientSigner).deposit([100, 200])
            // Check if user deposit successfully with correct amount
            const earnDepositAmount = await yfUSDTContract.getEarnDepositBalance(clientAddress)
            const vaultDepositAmount = await yfUSDTContract.getVaultDepositBalance(clientAddress)
            // Deposit fee for amount < 10000 is 1% by default
            const earnDepositBalance = 100 - (100 * 1 / 100)
            const vaultDepositBalance = 200 - (200 * 1 / 100)
            expect(earnDepositAmount).to.equal(earnDepositBalance)
            expect(vaultDepositAmount).to.equal(vaultDepositBalance)
            expect(await daoVault.balanceOf(clientAddress)).to.equal(earnDepositAmount.add(vaultDepositAmount))
        })

        it("should deduct correct fees from deposit amount based on tier", async () => {
            // Get signer and address of sender and deploy the contracts
            const [senderSigner, _] = await ethers.getSigners()
            const senderAddress = await senderSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Check deduct deposit fee correctly in tier 1
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.approve(yfUSDTContract.address, 10000000000)
            let earnDepositBalance, vaultDepositBalance
            await daoVault.deposit([100, 200])
            // Deposit fee for amount < 10000 is 1% in tier 1 by default
            earnDepositBalance = 100 - (100 * 1 / 100)
            vaultDepositBalance = 200 - (200 * 1 / 100)
            expect(await yfUSDTContract.getEarnDepositBalance(senderAddress)).to.equal(earnDepositBalance)
            expect(await yfUSDTContract.getVaultDepositBalance(senderAddress)).to.equal(vaultDepositBalance)
            // Check deduct deposit fee correctly in tier 2
            await daoVault.deposit([10000, 20000])
            // Deposit fee for amount > 10000 and amount <= 100000 is 0.5% in tier 2 by default
            earnDepositBalance = earnDepositBalance + (10000 - (10000 * 0.5 / 100))
            vaultDepositBalance = vaultDepositBalance + (20000 - (20000 * 0.5 / 100))
            expect(await yfUSDTContract.getEarnDepositBalance(senderAddress)).to.equal(earnDepositBalance)
            expect(await yfUSDTContract.getVaultDepositBalance(senderAddress)).to.equal(vaultDepositBalance)
            // Check deduct deposit fee correctly in tier 3
            await daoVault.deposit([100000, 200000])
            // Deposit fee for amount > 100000 is 0.25% in tier 3 by default
            earnDepositBalance = earnDepositBalance + (100000 - (100000 * 0.25 / 100))
            vaultDepositBalance = vaultDepositBalance + (200000 - (200000 * 0.25 / 100))
            expect(await yfUSDTContract.getEarnDepositBalance(senderAddress)).to.equal(earnDepositBalance)
            expect(await yfUSDTContract.getVaultDepositBalance(senderAddress)).to.equal(vaultDepositBalance)
        })

        it("should withdraw earn and vault correctly", async () => {
            // Get signer and address of sender and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const clientAddress = await clientSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Transfer some USDT to client
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientAddress, 1000)
            // Deposit some USDT into Yearn Farmer contract
            await token.connect(clientSigner).approve(yfUSDTContract.address, 1000)
            const clientTokenAmountBeforeDeposit = await token.balanceOf(clientAddress)
            const earnDepositAmount = new ethers.BigNumber.from(100)
            const vaultDepositAmount = new ethers.BigNumber.from(200)
            await daoVault.connect(clientSigner).deposit([earnDepositAmount, vaultDepositAmount])
            // Check if withdraw amount meet the function requirements
            await expect(daoVault.connect(clientSigner).withdraw([1000, 0])).to.be.revertedWith("Insufficient balance")
            await expect(daoVault.connect(clientSigner).withdraw([0, 1000])).to.be.revertedWith("Insufficient balance")
            await expect(yfUSDTContract.connect(clientSigner).withdraw([100, 200])).to.be.revertedWith("Only can call from Vault")
            // Get Yearn Farmer earn and vault deposit amount of client account 
            const earnDepositBalance = await yfUSDTContract.getEarnDepositBalance(clientAddress)
            const vaultDepositBalance = await yfUSDTContract.getVaultDepositBalance(clientAddress)
            // Get off-chain actual withdraw USDT amount based on Yearn Earn and Vault contract
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
            const earnSharesInYearnContract = (earnDepositBalance.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken())
            const actualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(earnSharesInYearnContract)).div(await earnContract.totalSupply())
            const vaultSharesinYearnContract = (vaultDepositBalance.mul(await vaultContract.totalSupply())).div(await vaultContract.balance())
            const actualVaultWithdrawAmount = ((await vaultContract.balance()).mul(vaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            // Get shares based on deposit
            const daoEarnShares = earnDepositBalance.mul(await daoVault.totalSupply()).div(await yfUSDTContract.pool())
            const daoVaultShares = vaultDepositBalance.mul(await daoVault.totalSupply()).div(await yfUSDTContract.pool())
            // Withdraw all from Yearn Earn and Vault
            await daoVault.connect(clientSigner).withdraw([daoEarnShares, daoVaultShares])
            // Check if balance deposit amount in Yearn Farmer contract is correct
            expect(await yfUSDTContract.getEarnDepositBalance(clientAddress)).to.equal(0)
            expect(await yfUSDTContract.getVaultDepositBalance(clientAddress)).to.equal(0)
            // Check if daoUSDT in client account is correct
            expect(await daoVault.balanceOf(clientAddress)).to.equal(0)
            // Check if pool amount in contract is Yearn Farmer is correct
            expect(await yfUSDTContract.pool()).to.equal(0)
            // Check if USDT amount withdraw from Yearn Farmer contract is correct
            const clientTokenAmountAfterWithdraw = clientTokenAmountBeforeDeposit.sub(earnDepositAmount.add(vaultDepositAmount)).add(actualEarnWithdrawAmount.add(actualVaultWithdrawAmount))
            expect(await token.balanceOf(clientAddress)).to.equal(clientTokenAmountAfterWithdraw)
        })

        // it("should withdraw earn and vault correctly if there is profit", async () => {
        //     // To run this test you must comment out r variable in withdrawEarn() and withdrawVault() function
        //     // and assign r with the amount higher than deposit amount
        //     // For example "uint256 r = 200" in withdrawEarn() and "uint256 r = 400" in withdrawVault
        //     // if deposit 100 for Yearn Earn contract and 200 for Yearn Vault contract
        //     // Besides, you must provide some USDT to Yearn Farmer contract as profit from Yearn contract
        //     // Get signer and address of sender and deploy the contracts
        //     const [senderSigner, _] = await ethers.getSigners()
        //     const senderAddress = await senderSigner.getAddress()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
        //     const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
        //     await daoVault.deployed()
        //     await yfUSDTContract.setVault(daoVault.address)
        //     // Get treasury wallet USDT balance before deposit
        //     const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
        //     const treasuryWalletTokenBalBeforeDeposit = await token.balanceOf(treasuryWalletAddress)
        //     // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
        //     await token.approve(yfUSDTContract.address, 1000)
        //     await daoVault.deposit([100, 200])
        //     // Transfer some USDT to Yearn Farmer contract as profit from Yearn contract
        //     await token.transfer(yfUSDTContract.address, 1000)
        //     // Record USDT amount of sender before withdraw earn shares
        //     const senderTokenAmountBeforeWithdraw = await token.balanceOf(senderAddress)
        //     // Get earn and vault deposit balance of sender 
        //     const earnDepositBalance = await yfUSDTContract.getEarnDepositBalance(senderAddress)
        //     const vaultDepositBalance = await yfUSDTContract.getVaultDepositBalance(senderAddress)
        //     // Calculate fees for earn and vault profit
        //     const earnExampleWithdrawAmount = new ethers.BigNumber.from(200)
        //     const earnFee = (earnExampleWithdrawAmount.sub(earnDepositBalance)).mul(10).div(100) // .mul(10).div(100): 10% profile sharing fee 
        //     const vaultExampleWithdrawAmount = new ethers.BigNumber.from(400)
        //     const vaultFee = (vaultExampleWithdrawAmount.sub(vaultDepositBalance)).mul(10).div(100) // .mul(10).div(100): 10% profile sharing fee 
        //     // Get shares based on deposit
        //     const daoEarnShares = earnDepositBalance.mul(await daoVault.totalSupply()).div(await yfUSDTContract.pool())
        //     const daoVaultShares = vaultDepositBalance.mul(await daoVault.totalSupply()).div(await yfUSDTContract.pool())
        //     // Withdraw all from Yearn Earn and Vault contract
        //     await daoVault.withdraw([daoEarnShares, daoVaultShares])
        //     // Check if total token balance is correct after withdraw
        //     expect(await token.balanceOf(senderAddress)).to.equal(
        //         senderTokenAmountBeforeWithdraw
        //         .add(earnExampleWithdrawAmount.sub(earnFee))
        //         .add(vaultExampleWithdrawAmount.sub(vaultFee))
        //     )
        //     // Check if all fees transfer to treasury wallet correctly
        //     const depositFees = (100 + 200) * 1 / 100 // 1% deposit fee for tier 1
        //     const profileSharingFees = earnFee.add(vaultFee)
        //     expect(await token.balanceOf(treasuryWalletAddress)).to.equal(treasuryWalletTokenBalBeforeDeposit.add(profileSharingFees.add(depositFees)))
        // })

        it("should able to get earn and vault deposit amount correctly", async () => {
            // Get signer and address of sender and client and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const senderAddress = await senderSigner.getAddress()
            const clientAddress = await clientSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.approve(yfUSDTContract.address, 1000)
            await daoVault.deposit([100, 200])
            // Deposit another 300 to Yearn Earn contract and 400 to Yearn Vault contract
            await daoVault.deposit([300, 400])
            // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after deposit fee return correctly
            const totalEarnDepositAfterFee = (100 + 300) - Math.floor((100 + 300) * 0.01) // 0.01: 1% deposit fee for tier 1
            expect(await yfUSDTContract.getEarnDepositBalance(senderAddress)).to.equal(totalEarnDepositAfterFee)
            const totalVaultDepositAfterFee = (200 + 400) - Math.floor((200 + 400) * 0.01) // 0.01: 1% deposit fee for tier 1
            expect(await yfUSDTContract.getVaultDepositBalance(senderAddress)).to.equal(totalVaultDepositAfterFee)
            // Transfer some USDT to client account
            await token.transfer(clientAddress, 1000)
            expect(await token.balanceOf(clientAddress)).to.equal(1000)
            // Deposit 150 to Yearn Earn contract and 250 to Yearn Vault contract from client
            await token.connect(clientSigner).approve(yfUSDTContract.address, 1000)
            await daoVault.connect(clientSigner).deposit([150, 250])
            // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after deposit fee from another account return correctly
            expect(await yfUSDTContract.getEarnDepositBalance(clientAddress)).to.equal(150 - Math.floor(150 * 0.01)) // 0.01: 1% deposit fee for tier 1
            expect(await yfUSDTContract.getVaultDepositBalance(clientAddress)).to.equal(250 - Math.floor(250 * 0.01)) // 0.01: 1% deposit fee for tier 1
        })

        it("should able to deal with mix and match situation (deposit and withdraw several times by several parties)", async () => {
             // Get signer and address of sender and client and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const senderAddress = await senderSigner.getAddress()
            const clientAddress = await clientSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Transfer some token to client account
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientAddress, 10000)
            expect(await token.balanceOf(clientAddress)).to.equal(10000)
            // Get sender and client account token balance before deposit
            const senderTknBalBefDep = await token.balanceOf(senderAddress)
            const clientTknBalBefDep = await token.balanceOf(clientAddress)
            // Mix and max deposit
            await token.approve(yfUSDTContract.address, 10000)
            await token.connect(clientSigner).approve(yfUSDTContract.address, 10000)
            await daoVault.deposit([123, 0])
            await daoVault.connect(clientSigner).deposit([0, 212])
            await daoVault.deposit([0, 166])
            await daoVault.connect(clientSigner).deposit([249, 0])
            await daoVault.deposit([132, 186])
            await daoVault.connect(clientSigner).deposit([234, 269])
            // Get Yearn Farmer earn and vault deposit fees of accounts
            const senderEarnDepFee = Math.floor(123*0.01)+Math.floor(132*0.01)
            const senderVaultDepFee = Math.floor(166*0.01)+Math.floor(186*0.01)
            const clientEarnDepFee = Math.floor(249*0.01)+Math.floor(234*0.01)
            const clientVaultDepFee = Math.floor(212*0.01)+Math.floor(269*0.01)
            // Check if deposit amount of accounts return correctly
            expect(await yfUSDTContract.getEarnDepositBalance(senderAddress)).to.equal((123+132)-senderEarnDepFee)
            expect(await yfUSDTContract.getVaultDepositBalance(senderAddress)).to.equal((166+186)-senderVaultDepFee)
            expect(await yfUSDTContract.getEarnDepositBalance(clientAddress)).to.equal((249+234)-clientEarnDepFee)
            expect(await yfUSDTContract.getVaultDepositBalance(clientAddress)).to.equal((212+269)-clientVaultDepFee)
            // Check if daoUSDT distribute to accounts correctly
            expect(await daoVault.balanceOf(senderAddress)).to.equal((123+132+166+186)-senderEarnDepFee-senderVaultDepFee)
            expect(await daoVault.balanceOf(clientAddress)).to.equal((212+249+234+269)-clientEarnDepFee-clientVaultDepFee)
            // Get accounts token balance after deposit
            const senderTknBalAftDep = await token.balanceOf(senderAddress)
            const clientTknBalAftDep = await token.balanceOf(clientAddress)
            // Check if token balance of accounts deduct correctly after deposit
            expect(senderTknBalAftDep).to.equal(senderTknBalBefDep.sub(123+132+166+186))
            expect(clientTknBalAftDep).to.equal(clientTknBalBefDep.sub(212+249+234+269))
            // Check if deposit fees send to treasury wallet correctly
            expect(await token.balanceOf(treasuryWalletAddress)).to.equal(senderEarnDepFee+senderVaultDepFee+clientEarnDepFee+clientVaultDepFee)
            // Get Yearn Farmer pool amount
            const yfPool = await yfUSDTContract.pool()
            // Check if Yearn Farmer pool amount sum up correctly
            expect(yfPool).to.equal(
                (await yfUSDTContract.getEarnDepositBalance(senderAddress)).add(await yfUSDTContract.getVaultDepositBalance(senderAddress))
                .add(await yfUSDTContract.getEarnDepositBalance(clientAddress)).add(await yfUSDTContract.getVaultDepositBalance(clientAddress))
            )
            // Mix and max withdraw
            await daoVault.withdraw([200, 0])
            await daoVault.connect(clientSigner).withdraw([132, 0])
            await daoVault.withdraw([0, 24])
            await daoVault.connect(clientSigner).withdraw([0, 188])
            // Get earn and vault deposit balance of accounts
            const senderEarnDepBalAftWdr = await yfUSDTContract.getEarnDepositBalance(senderAddress)
            const senderVaultDepBalAftWdr = await yfUSDTContract.getVaultDepositBalance(senderAddress)
            const clientEarnDepBalAftWdr = await yfUSDTContract.getEarnDepositBalance(clientAddress)
            const clientVaultDepBalAftWdr = await yfUSDTContract.getVaultDepositBalance(clientAddress)
            // Check if deposit amount of accounts return correctly after withdraw 1st time
            expect(senderEarnDepBalAftWdr).to.equal((123+132)-senderEarnDepFee-200)
            expect(senderVaultDepBalAftWdr).to.equal((166+186)-senderVaultDepFee-24)
            expect(clientEarnDepBalAftWdr).to.equal((249+234)-clientEarnDepFee-132)
            expect(clientVaultDepBalAftWdr).to.equal((212+269)-clientVaultDepFee-188)
            // Check if daoUSDT burn correctly in accounts
            expect(await daoVault.balanceOf(senderAddress)).to.equal((123+132+166+186)-Math.floor(123*0.01)-Math.floor(132*0.01)-Math.floor(166*0.01)-Math.floor(186*0.01)-(200+24))
            expect(await daoVault.balanceOf(clientAddress)).to.equal((212+249+234+269)-Math.floor(212*0.01)-Math.floor(249*0.01)-Math.floor(234*0.01)-Math.floor(269*0.01)-(132+188))
            // Get accounts token balance after withdraw 1st time
            const senderTknBalAftWdr = await token.balanceOf(senderAddress)
            const clientTknBalAftWdr = await token.balanceOf(clientAddress)
            // Get total withdraw amount of sender and client in big number
            const senderEarnWdrAmt = new ethers.BigNumber.from(200)
            const senderVaultWdrAmt = new ethers.BigNumber.from(24)
            const clientEarnWdrAmt = new ethers.BigNumber.from(132)
            const clientVaultWdrAmt = new ethers.BigNumber.from(188)
            // Get off-chain actual withdraw USDT amount based on Yearn Earn and Vault contract
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
            let senderEarnSharesinYearnContract = (senderEarnWdrAmt.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken())
            let senderActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(senderEarnSharesinYearnContract)).div(await earnContract.totalSupply())
            let senderVaultSharesinYearnContract = (senderVaultWdrAmt.mul(await vaultContract.totalSupply())).div(await vaultContract.balance())
            let senderActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(senderVaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            let clientEarnSharesinYearnContract = (clientEarnWdrAmt.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken())
            let clientActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await earnContract.totalSupply())
            let clientVaultSharesinYearnContract = (clientVaultWdrAmt.mul(await vaultContract.totalSupply())).div(await vaultContract.balance())
            let clientActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            // Check if token balance of accounts top-up correctly after withdraw
            expect(senderTknBalAftWdr).to.equal(senderTknBalAftDep.add(senderActualEarnWithdrawAmount).add(senderActualVaultWithdrawAmount))
            expect(clientTknBalAftWdr).to.equal(clientTknBalAftDep.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount))
            // Check if Yearn Contract pool amount deduct correctly
            expect(await yfUSDTContract.pool()).to.equal(yfPool.sub(senderEarnWdrAmt.add(senderVaultWdrAmt).add(clientEarnWdrAmt).add(clientVaultWdrAmt)))
            // Get shares based on deposit
            const senderDaoEarnShares = (await yfUSDTContract.getEarnDepositBalance(senderAddress)).mul(await daoVault.totalSupply()).div(await yfUSDTContract.pool())
            const senderDaoVaultShares = (await yfUSDTContract.getVaultDepositBalance(senderAddress)).mul(await daoVault.totalSupply()).div(await yfUSDTContract.pool())
            const clientDaoEarnShares = (await yfUSDTContract.getEarnDepositBalance(clientAddress)).mul(await daoVault.totalSupply()).div(await yfUSDTContract.pool())
            const clientDaoVaultShares = (await yfUSDTContract.getVaultDepositBalance(clientAddress)).mul(await daoVault.totalSupply()).div(await yfUSDTContract.pool())
            // Withdraw all balance for accounts in Yearn contract 
            await daoVault.withdraw([senderDaoEarnShares, 0])
            await daoVault.connect(clientSigner).withdraw([clientDaoEarnShares, 0])
            await daoVault.withdraw([0, senderDaoVaultShares])
            await daoVault.connect(clientSigner).withdraw([0, clientDaoVaultShares])
            // Check if deposit amount of accounts return 0
            expect(await yfUSDTContract.getEarnDepositBalance(senderAddress)).to.equal(0)
            expect(await yfUSDTContract.getVaultDepositBalance(senderAddress)).to.equal(0)
            expect(await yfUSDTContract.getEarnDepositBalance(clientAddress)).to.equal(0)
            expect(await yfUSDTContract.getVaultDepositBalance(clientAddress)).to.equal(0)
            // Check if daoUSDT burn to empty in accounts
            expect(await daoVault.balanceOf(senderAddress)).to.equal(0)
            expect(await daoVault.balanceOf(clientAddress)).to.equal(0)
            // Get off-chain actual withdraw USDT amount based on Yearn Earn and Vault contract
            senderEarnSharesinYearnContract = (senderEarnDepBalAftWdr.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken())
            senderActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(senderEarnSharesinYearnContract)).div(await earnContract.totalSupply())
            senderVaultSharesinYearnContract = (senderVaultDepBalAftWdr.mul(await vaultContract.totalSupply())).div(await vaultContract.balance())
            senderActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(senderVaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            clientEarnSharesinYearnContract = (clientEarnDepBalAftWdr.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken())
            clientActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await earnContract.totalSupply())
            clientVaultSharesinYearnContract = (clientVaultDepBalAftWdr.mul(await vaultContract.totalSupply())).div(await vaultContract.balance())
            clientActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            // Check if token balance of accounts top-up correctly after withdraw all
            expect(await token.balanceOf(senderAddress)).to.equal(senderTknBalAftWdr.add(senderActualEarnWithdrawAmount).add(senderActualVaultWithdrawAmount))
            expect(await token.balanceOf(clientAddress)).to.equal(clientTknBalAftWdr.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount))
            // Check if Yearn Contract pool amount return 0
            expect(await yfUSDTContract.pool()).to.equal(0)
        })

        it("should able to deal with mix and match situation (deposit and withdraw several times in tier 2)", async () => {
            // Get signer and address of sender and client and deploy the contracts
            const [senderSigner, _] = await ethers.getSigners()
            const senderAddress = await senderSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Approve Yearn Farmer to transfer token from sender
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.approve(yfUSDTContract.address, 1000000)
            // Get current balance USDT of sender account
            const tokenBalanceBeforeDeposit = await token.balanceOf(senderAddress)
            // Mix and max deposit and withdraw
            await daoVault.deposit([12345, 22222])
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
            let senderSharesinYearnContract = (new ethers.BigNumber.from(8932)).mul(await earnContract.totalSupply()).div(await earnContract.calcPoolValueInToken())
            let senderActualWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(senderSharesinYearnContract)).div(await earnContract.totalSupply())
            await daoVault.withdraw([8932, 0])
            await daoVault.deposit([37822, 0])
            await daoVault.deposit([4444, 0])
            let currentTokenBalance = tokenBalanceBeforeDeposit.sub(12345).sub(22222).add(senderActualWithdrawAmount).sub(37822).sub(4444)
            senderSharesinYearnContract = (new ethers.BigNumber.from(7035)).mul(await earnContract.totalSupply()).div(await earnContract.calcPoolValueInToken())
            senderActualWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(senderSharesinYearnContract)).div(await earnContract.totalSupply())
            await daoVault.withdraw([7035, 0])
            currentTokenBalance = currentTokenBalance.add(senderActualWithdrawAmount)
            senderSharesinYearnContract = (new ethers.BigNumber.from(19965)).mul(await vaultContract.totalSupply()).div(await vaultContract.balance())
            senderActualWithdrawAmount = ((await vaultContract.balance()).mul(senderSharesinYearnContract)).div(await vaultContract.totalSupply())
            await daoVault.withdraw([0, 19965])
            await daoVault.deposit([0, 19367])
            currentTokenBalance = currentTokenBalance.add(senderActualWithdrawAmount).sub(19367)
            // Check if earn and vault deposit balance return correctly
            const earnDepositBalance = (12345-Math.floor(12345*0.005))+(37822-Math.floor(37822*0.005))+(4444-Math.floor(4444*0.01))-8932-7035
            expect(await yfUSDTContract.getEarnDepositBalance(senderAddress)).to.equal(earnDepositBalance)
            const vaultDepositBalance = (22222-Math.floor(22222*0.005))+(19367-Math.floor(19367*0.005))-19965
            expect(await yfUSDTContract.getVaultDepositBalance(senderAddress)).to.equal(vaultDepositBalance)
            // Check if balance token of sender account correctly after mix and max deposit and withdraw
            expect(await token.balanceOf(senderAddress)).to.equal(currentTokenBalance)
            // Check if daoUSDT balance of sender account correct
            expect(await daoVault.balanceOf(senderAddress)).to.equal(earnDepositBalance+vaultDepositBalance)
            // Check if treasury wallet receive fees amount correctly
            expect(await token.balanceOf(treasuryWalletAddress)).to.equal(Math.floor(12345*0.005)+Math.floor(22222*0.005)+Math.floor(37822*0.005)+Math.floor(4444*0.01)+Math.floor(19367*0.005))
            // Check if Yearn Farmer pool amount correct
            expect(await yfUSDTContract.pool()).to.equal((12345-Math.floor(12345*0.005))+(22222-Math.floor(22222*0.005))-8932+(37822-Math.floor(37822*0.005))+(4444-Math.floor(4444*0.01))-7035-19965+(19367-Math.floor(19367*0.005)))
        })

        it("should able to refund token when this contract is in vesting state", async () => {
            // Get address of owner and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const clientAddress = await clientSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Transfer some token to client
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientAddress, 1000)
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await token.connect(clientSigner).approve(yfUSDTContract.address, 1000)
            await daoVault.connect(clientSigner).deposit([100, 200])
            // Get client USDT balance before refund
            const tokenBalanceBeforeRefund = await token.balanceOf(clientAddress)
            // Get client earn and vault deposit balance return before vesting
            const clientEarnDepositBalanceBeforeVesting = await yfUSDTContract.getEarnDepositBalance(clientAddress)
            const clientVaultDepositBalanceBeforeVesting = await yfUSDTContract.getVaultDepositBalance(clientAddress)
            // Get client off-chain actual earn withdraw amount
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
            const clientEarnSharesinYearnContract = (clientEarnDepositBalanceBeforeVesting).mul(await earnContract.totalSupply()).div(await earnContract.calcPoolValueInToken())
            const clientActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await earnContract.totalSupply())
            const clientVaultSharesinYearnContract = (clientVaultDepositBalanceBeforeVesting).mul(await vaultContract.totalSupply()).div(await vaultContract.balance())
            const clientActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            // Unlock and execute vesting function
            await yfUSDTContract.unlockFunction(4)
            network.provider.send("evm_increaseTime", [86400])
            await yfUSDTContract.vesting()
            // Check if function to get shares value return correctly
            expect(await yfUSDTContract.getSharesValue(clientAddress)).to.equal(clientActualEarnWithdrawAmount.add(clientActualVaultWithdrawAmount))
            // Check if refund function meet requirements
            await expect(daoVault.refund()).to.be.revertedWith("No balance to refund")
            // Execute refund function
            await daoVault.connect(clientSigner).refund()
            // Check if USDT amount of client refund correctly
            expect(await token.balanceOf(clientAddress)).to.equal(tokenBalanceBeforeRefund.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount))
            // Check if daoUSDT of client burn to 0
            expect(await daoVault.balanceOf(clientAddress)).to.equal(0)
        })

        it("should able to refund token with profit when this contract is in vesting state", async () => {
            // Get address of owner and deploy the contracts
            const [senderSigner, _] = await ethers.getSigners()
            const senderAddress = senderSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Transfer some USDT to Yearn Farmer contract as profit from Yearn contract
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(yfUSDTContract.address, 1000)
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await token.approve(yfUSDTContract.address, 1000)
            await daoVault.deposit([100, 200])
            // Get client USDT balance before refund
            const tokenBalanceBeforeRefund = await token.balanceOf(senderAddress)
            // Unlock and execute vesting function
            await yfUSDTContract.unlockFunction(4)
            network.provider.send("evm_increaseTime", [86400])
            await yfUSDTContract.vesting()
            // Get shares value before execute refund function
            const sharesValue = await yfUSDTContract.getSharesValue(senderAddress)
            // Execute refund function
            await daoVault.refund()
            // Check if refund token amount correctly
            expect(await token.balanceOf(senderAddress)).to.equal(tokenBalanceBeforeRefund.add(sharesValue))
            // Check if Yearn-Farmer pool equal to 0
            expect(await yfUSDTContract.pool()).to.equal(0)
            expect(await daoVault.balanceOf(senderAddress)).to.equal(0)
            expect(await yfUSDTContract.balanceOf(daoVault.address)).to.equal(0)
            expect(await yfUSDTContract.getEarnDepositBalance(senderAddress)).to.equal(0)
            expect(await yfUSDTContract.getVaultDepositBalance(senderAddress)).to.equal(0)
            expect(await yfUSDTContract.getSharesValue(senderAddress)).to.equal(0)
        })

        it("should approve Yearn Earn and Vault contract to deposit USDT from yfUSDT contract", async () => {
            // This function only execute one time and already execute while yfUSDT contract deployed.
            // User should ignore this function.

            // Get address of owner and deploy the contracts
            const [senderSigner, _] = await ethers.getSigners()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", senderSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Check if Yearn Earn and Vault contract can deposit a huge amount of USDT from yfUSDT contract
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.approve(yfUSDTContract.address, 500000000000000)
            await expect(daoVault.deposit([250000000000000, 250000000000000])).not.to.be.reverted
        })
    })


    // Test admin functions
    describe("Admin functions", () => {
        it("should able to transfer contract ownership to other address by contract owner only", async () => {
            // Get address of owner and new owner and deploy the contracts
            const [ownerSigner, newOwnerSigner, _] = await ethers.getSigners()
            const ownerSignerAddress = await ownerSigner.getAddress()
            const newOwnerSignerAddress = await newOwnerSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", ownerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", ownerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Check if contract ownership is owner before transfer
            expect(await yfUSDTContract.owner()).to.equal(ownerSignerAddress)
            expect(await daoVault.owner()).to.equal(ownerSignerAddress)
            // Check if new owner cannot execute admin functions yet
            await expect(daoVault.connect(newOwnerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVault.connect(newOwnerSigner).setPendingStrategy(newOwnerSignerAddress)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVault.connect(newOwnerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).unlockFunction(0)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).setVault(newOwnerSignerAddress)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).setTreasuryWallet(newOwnerSignerAddress)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).setDepositFeeTier2([100, 200])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).setDepositFeePercentage([30, 30, 30])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
            // Transfer contract ownership from owner to new owner
            await daoVault.transferOwnership(newOwnerSignerAddress)
            await yfUSDTContract.transferOwnership(newOwnerSignerAddress)
            // Check if contract ownership is new owner after transfer
            expect(await daoVault.owner()).to.equal(newOwnerSignerAddress)
            expect(await yfUSDTContract.owner()).to.equal(newOwnerSignerAddress)
            // Check if new owner can execute admin function
            await expect(daoVault.connect(newOwnerSigner).unlockMigrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVault.connect(newOwnerSigner).setPendingStrategy(ownerSignerAddress)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVault.connect(newOwnerSigner).migrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).unlockFunction(0)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).setVault(ownerSignerAddress)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).setTreasuryWallet(ownerSignerAddress)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).setDepositFeeTier2([100, 200])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).setDepositFeePercentage([30, 30, 30])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(newOwnerSigner).vesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
            // Check if original owner neither can execute admin function nor transfer back ownership
            await expect(daoVault.connect(ownerSigner).transferOwnership(ownerSignerAddress)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVault.connect(ownerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVault.connect(ownerSigner).setPendingStrategy(ownerSignerAddress)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVault.connect(ownerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(ownerSigner).transferOwnership(ownerSignerAddress)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(ownerSigner).unlockFunction(0)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(ownerSigner).setVault(ownerSignerAddress)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(ownerSigner).setTreasuryWallet(ownerSignerAddress)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(ownerSigner).setDepositFeeTier2([100, 200])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(ownerSigner).setDepositFeePercentage([30, 30, 30])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(ownerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("should able to set pending strategy, migrate funds and set new strategy correctly in daoVault contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", deployerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", deployerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Set pending strategy
            const SampleContract = await ethers.getContractFactory("SampleContract", deployerSigner)
            const sampleContract = await SampleContract.deploy(daoVault.address, tokenAddress)
            await sampleContract.deployed()
            await daoVault.setPendingStrategy(sampleContract.address)
            // Check if pending strategy is set with given address
            expect(await daoVault.pendingStrategy()).to.equal(sampleContract.address)
            // Deposit into daoVault and execute vesting function
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            await token.approve(yfUSDTContract.address, 100000000)
            await daoVault.deposit([10000000, 20000000])
            await yfUSDTContract.unlockFunction(4) // unlock vesting() function
            network.provider.send("evm_increaseTime", [86400])
            await yfUSDTContract.vesting()
            // Get Yearn Farmer token balance before migrate
            const tokenBalance = await token.balanceOf(yfUSDTContract.address) 
            // Execute unlock migrate funds function
            await daoVault.unlockMigrateFunds()
            // Check if execute migrate funds function before 5 days be reverted
            network.provider.send("evm_increaseTime", [86400*4]) // advance 4 days
            await expect(daoVault.migrateFunds()).to.be.revertedWith("Function locked")
            network.provider.send("evm_increaseTime", [86400]) // advance another 1 day
            // Check if migrate funds function meet the requirements
            // await expect(daoVault.migrateFunds()).to.be.revertedWith("No balance to migrate") // need to comment out deposit() function to test this
            // await expect(daoVault.migrateFunds()).to.be.revertedWith("No pendingStrategy") // need to comment out set/check pending strategy function to test this
            // Approve for token transfer from Yearn Farmer to new strategy
            await yfUSDTContract.approveMigrate()
            // Check if migrate funds function is log
            await expect(daoVault.migrateFunds()).to.emit(daoVault, "MigrateFunds")
                .withArgs(yfUSDTContract.address, sampleContract.address, tokenBalance)
            // Check if token transfer correctly
            expect(await token.balanceOf(sampleContract.address)).to.equal(tokenBalance)
            expect(await token.balanceOf(yfUSDTContract.address)).to.equal(0)
            // Check if yfUSDT in daoVault burn to 0
            expect(await yfUSDTContract.balanceOf(daoVault.address)).to.equal(0)
            // Check if new strategy set and pending strategy reset to 0
            expect(await daoVault.strategy()).to.equal(sampleContract.address)
            expect(await daoVault.pendingStrategy()).to.equal(ethers.constants.AddressZero)
            // Check if execute migrate funds function after 6 days be reverted
            network.provider.send("evm_increaseTime", [86400]) // advance another 1 day
            await expect(daoVault.migrateFunds()).to.be.revertedWith("Function locked")
        })

        it("should lock function properly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const deployerAddress = await deployerSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", deployerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", deployerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Check if corresponding admin functions is locked
            await expect(yfUSDTContract.setTreasuryWallet(deployerAddress)).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setDepositFeeTier2([100, 200])).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setDepositFeePercentage([30, 30, 30])).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setProfileSharingFeePercentage(30)).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.vesting()).to.be.revertedWith("Function locked")
            // Ececute unlock function
            await yfUSDTContract.unlockFunction(0) // setTreasuryWallet()
            await yfUSDTContract.unlockFunction(1) // setDepositFeeTier2()
            await yfUSDTContract.unlockFunction(2) // setDepositFeePercentage()
            await yfUSDTContract.unlockFunction(3) // setProfileSharingFeePercentage()
            await yfUSDTContract.unlockFunction(4) // vesting()
            // advance time 23 hours and check if corresponding admin functions is still locked
            network.provider.send("evm_increaseTime", [86400-(60*60)])
            await expect(yfUSDTContract.setTreasuryWallet(deployerAddress)).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setDepositFeeTier2([100, 200])).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setDepositFeePercentage([30, 30, 30])).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setProfileSharingFeePercentage(30)).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.vesting()).to.be.revertedWith("Function locked")
            // advance time again 1 hour and check if corresponding admin functions is unlocked
            network.provider.send("evm_increaseTime", [60*60])
            await expect(yfUSDTContract.setTreasuryWallet(deployerAddress)).not.to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setDepositFeeTier2([100, 200])).not.to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setDepositFeePercentage([30, 30, 30])).not.to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setProfileSharingFeePercentage(30)).not.to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.vesting()).not.to.be.revertedWith("Function locked")
            // advance time again 1 day and check if corresponding admin functions is locked again
            network.provider.send("evm_increaseTime", [86400])
            await expect(yfUSDTContract.setTreasuryWallet(deployerAddress)).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setDepositFeeTier2([100, 200])).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setDepositFeePercentage([30, 30, 30])).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.setProfileSharingFeePercentage(30)).to.be.revertedWith("Function locked")
            await expect(yfUSDTContract.vesting()).to.be.revertedWith("Function locked")
        })

        it("should able to set new treasury wallet correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and new treasury wallet and deploy the contracts
            const [deployerSigner, newTreasuryWalletSigner, _] = await ethers.getSigners()
            const newTreasuryWalletAddress = await newTreasuryWalletSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", deployerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", deployerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Unlock function and set new treasury wallet
            await yfUSDTContract.unlockFunction(0)
            network.provider.send("evm_increaseTime", [86400])
            // Check if event for setTreasuryWallet function is logged (by set back original treasury wallet)
            await expect(yfUSDTContract.setTreasuryWallet(newTreasuryWalletAddress))
                .to.emit(yfUSDTContract, "SetTreasuryWallet")
                .withArgs(treasuryWalletAddress, newTreasuryWalletAddress)
            // Check if new treasury wallet is set to the contract
            expect(await yfUSDTContract.treasuryWallet()).to.equal(newTreasuryWalletAddress)
            // Check if new treasury wallet receive fees
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            await token.approve(yfUSDTContract.address, 1000)
            await daoVault.deposit([100, 200])
            // - 100 + 200 < 300 within deposit fee tier 1 hence fee = 1%
            expect(await token.balanceOf(newTreasuryWalletAddress)).to.equal(3)
        })

        it("should able to set new deposit fee tier correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", deployerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", deployerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Unlock the function and advance 1 day
            await yfUSDTContract.unlockFunction(1)
            network.provider.send("evm_increaseTime", [86400])
            // Check if function parameter meet the requirements
            await expect(yfUSDTContract.setDepositFeeTier2([0, 10000]))
                .to.be.revertedWith("Minimun amount cannot be 0")
            await expect(yfUSDTContract.setDepositFeeTier2([10000, 10000]))
                .to.be.revertedWith("Maximun amount must greater than minimun amount")
            // Set deposit fee tier 2 with minimun 50001 and maximun 500000 (default 10001, 100000)
            // and Check if function is log
            await expect(yfUSDTContract.setDepositFeeTier2([50001, 500000]))
                .to.emit(yfUSDTContract, "SetDepositFeeTier2")
                .withArgs([10001, 100000], [50001, 500000]) // [oldDepositFeeTier2, newDepositFeeTier2]
            // Check if deposit fee tier 2 amount is set correctly
            expect(await yfUSDTContract.depositFeeTier2(0)).to.equal(50001)
            expect(await yfUSDTContract.depositFeeTier2(1)).to.equal(500000)
        })

        it("should able to set new deposit fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", deployerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", deployerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Unlock function and advance 1 day
            await yfUSDTContract.unlockFunction(2)
            network.provider.send("evm_increaseTime", [86400])
            // Check if function parameter meet the requirements (100 = 1%)
            await expect(yfUSDTContract.setDepositFeePercentage([4000, 0, 0]))
                .to.be.revertedWith("Deposit fee percentage cannot be more than 40%")
            await expect(yfUSDTContract.setDepositFeePercentage([0, 4000, 0]))
                .to.be.revertedWith("Deposit fee percentage cannot be more than 40%")
            await expect(yfUSDTContract.setDepositFeePercentage([0, 0, 4000]))
                .to.be.revertedWith("Deposit fee percentage cannot be more than 40%")
            // Set deposit fee percentage to tier1 2%, tier2 1%, tier3 0.5% (default tier1 1%, tier2 0.5%, tier3 0.25%)
            // And check if function is log
            await expect(yfUSDTContract.setDepositFeePercentage([200, 100, 50]))
                .to.emit(yfUSDTContract, "SetDepositFeePercentage")
                .withArgs([100, 50, 25], [200, 100, 50]) // [oldDepositFeePercentage, newDepositFeePercentage]
            // Check if deposit fee percentage is set correctly
            expect(await yfUSDTContract.depositFeePercentage(0)).to.equal(200)
            expect(await yfUSDTContract.depositFeePercentage(1)).to.equal(100)
            expect(await yfUSDTContract.depositFeePercentage(2)).to.equal(50)
        })

        it("should able to set new profile sharing fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", deployerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", deployerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Unlock function and advance 1 day
            await yfUSDTContract.unlockFunction(3)
            network.provider.send("evm_increaseTime", [86400])
            // Check if function parameter meet the requirements
            await expect(yfUSDTContract.setProfileSharingFeePercentage(40))
                .to.be.revertedWith("Profile sharing fee percentage cannot be more than 40%")
            // Set profile sharing fee percentage to 20% (default 10%) and check if function log
            await expect(yfUSDTContract.setProfileSharingFeePercentage(20))
                .to.emit(yfUSDTContract, "SetProfileSharingFeePercentage")
                .withArgs(10, 20) // [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]
            // Check if profile sharing fee percentage is set correctly
            expect(await yfUSDTContract.profileSharingFeePercentage()).to.equal(20)
        })

        it("should set contract in vesting state correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const deployerAddress = await deployerSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", deployerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", deployerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Deposit into Yearn Farmer through daoVault
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            await token.approve(yfUSDTContract.address, 1000)
            await daoVault.deposit([100, 200])
            // Check if get shares value return 0 if no vesting (this function only available after vesting state)
            expect(await yfUSDTContract.getSharesValue(deployerAddress)).to.equal(0)
            // Check if corresponding function to be reverted if no vesting (these function only available after vesting state)
            await expect(daoVault.refund()).to.be.revertedWith("Not in vesting state")
            await expect(yfUSDTContract.approveMigrate()).to.be.revertedWith("Not in vesting state")
            // Unlock function, advance 1 day and execute vesting function
            await yfUSDTContract.unlockFunction(4)
            network.provider.send("evm_increaseTime", [86400])
            await yfUSDTContract.vesting()
            // Check if vesting state is true
            expect(await yfUSDTContract.isVesting()).is.true
            // Check if corresponding function to be reverted in vesting state
            await expect(daoVault.deposit([100, 200])).to.be.revertedWith("Contract in vesting state")
            await expect(daoVault.withdraw([50, 100])).to.be.revertedWith("Contract in vesting state")
            // Check if corresponding getter function return 0 in vesting state
            expect(await yfUSDTContract.getEarnDepositBalance(deployerAddress)).to.equal(0) 
            expect(await yfUSDTContract.getVaultDepositBalance(deployerAddress)).to.equal(0) 
            // Check if execute vesting function again to be reverted
            await expect(yfUSDTContract.vesting()).to.be.revertedWith("Already in vesting state")
            // Check if pool reset to 0 after vesting state
            expect(await yfUSDTContract.pool()).to.equal(0)
        })

        it("should send profit to treasury wallet correctly after vesting state in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const deployerAddress = await deployerSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDTv2", deployerSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            const DaoVault = await ethers.getContractFactory("daoVault", deployerSigner)
            const daoVault = await DaoVault.deploy(tokenAddress, yfUSDTContract.address)
            await daoVault.deployed()
            await yfUSDTContract.setVault(daoVault.address)
            // Deposit into Yearn Farmer through daoVault
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            await token.approve(yfUSDTContract.address, 1000)
            await daoVault.deposit([100, 200])
            const treasuryWalletBalanceBeforeVesting = await token.balanceOf(treasuryWalletAddress)
            // Get off-chain Yearn earn and vault actual withdraw amount
            const earnDepositBalance = await yfUSDTContract.getEarnDepositBalance(deployerAddress)
            const vaultDepositBalance = await yfUSDTContract.getVaultDepositBalance(deployerAddress)
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, deployerSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, deployerSigner)
            const offChainActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(
                (earnDepositBalance.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken()))
            ).div(await earnContract.totalSupply())
            const offChainActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(
                (vaultDepositBalance.mul(await vaultContract.totalSupply())).div(await vaultContract.balance()))
            ).div(await vaultContract.totalSupply())
            // Transfer some token to Yearn Farmer contract treat as profit
            await token.transfer(yfUSDTContract.address, 100)
            // Unlock function, advance 1 day and execute vesting function
            await yfUSDTContract.unlockFunction(4)
            network.provider.send("evm_increaseTime", [86400])
            await yfUSDTContract.vesting()
            // Check if balance token in Yearn Farmer contract correctly after fee
            expect(await token.balanceOf(yfUSDTContract.address)).to.equal(await yfUSDTContract.getSharesValue(deployerAddress))
            // Check if amount fee transfer to treasury wallet correctly
            const profit = (await token.balanceOf(yfUSDTContract.address)).sub(offChainActualEarnWithdrawAmount.add(offChainActualVaultWithdrawAmount))
            expect(await token.balanceOf(treasuryWalletAddress)).to.equal(treasuryWalletBalanceBeforeVesting.add(profit.mul(10).div(100)))
        })
    })
})
