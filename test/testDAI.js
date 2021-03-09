const { expect } = require("chai")
const { ethers, network } = require("hardhat")
require("dotenv").config()
const IERC20_ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json").abi
const IYearn_ABI = require("../artifacts/interfaces/IYearn.sol/IYearn.json").abi
const IYvault_ABI = require("../artifacts/interfaces/IYvault.sol/IYvault.json").abi

// DAI
const tokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const yEarnAddress = "0xC2cB1040220768554cf699b0d863A3cd4324ce32"
const yVaultAddress = "0xACd43E627e64355f1861cEC6d3a6688B31a6F952"
const unlockedAddress = "0x04ad0703B9c14A85A02920964f389973e094E153"

const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const communityWalletAddress = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"

describe("yfDAIv2", () => {
    beforeEach(async () => {
        // Reset mainnet forking before each test
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    jsonRpcUrl: process.env.PUBLIC_NODE_URL,
                    blockNumber: 11980000
                }
            }]
        })

        // Transfer some DAI to sender before each test
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [unlockedAddress]
        })
        const unlockedSigner = await ethers.provider.getSigner(unlockedAddress)
        const [senderSigner, _] = await ethers.getSigners()
        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
        await tokenContract.connect(unlockedSigner).transfer(senderSigner.address, tokenContract.balanceOf(unlockedAddress))
    })

    it("should deploy contract correctly", async () => {
        // Get sender address and deploy the contracts
        const [senderSigner, _] = await ethers.getSigners()
        const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
        const yfDAIContract = await YfDAIContract.deploy()
        const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
        const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
        await yfDAIContract.setVault(daoVaultDAI.address)
        // Check if execute set vault function again to be reverted
        await expect(yfDAIContract.setVault(senderSigner.address)).to.be.revertedWith("Vault set")
        // Check if contract owner is contract deployer in both contracts
        expect(await yfDAIContract.owner()).to.equal(senderSigner.address)
        expect(await daoVaultDAI.owner()).to.equal(senderSigner.address)
        // Check if token accept is DAI in both contract
        expect(await yfDAIContract.token()).to.equal(tokenAddress)
        expect(await daoVaultDAI.token()).to.equal(tokenAddress)
        // Check if Yearn DAI Earn contract and Yearn DAI Vault contract match given contract in Yearn Farmer contract
        expect(await yfDAIContract.earn()).to.equal(yEarnAddress)
        expect(await yfDAIContract.vault()).to.equal(yVaultAddress)
        // Check if initial pool set correctly in Yearn Farmer contract
        expect(await yfDAIContract.pool()).to.equal(0)
        // Check if treasury wallet address match given address in Yearn Farmer contract
        expect(await yfDAIContract.treasuryWallet()).to.equal(treasuryWalletAddress)
        // Check if community wallet address match given address in Yearn Farmer contract
        expect(await yfDAIContract.communityWallet()).to.equal(communityWalletAddress)
        // Check if initial tier2 of network fee is 50001e6 <= tokenAmount <= 100000e6 in Yearn Farmer contract (More details in contract)
        expect(await yfDAIContract.networkFeeTier2(0)).to.equal("50000000001")
        expect(await yfDAIContract.networkFeeTier2(1)).to.equal("100000000000")
        // Check if initial network fee percentage is 1% for tier1, 0.75% for tier2, and 0.5% for tier3 in Yearn Farmer contract (More details in contract)
        expect(await yfDAIContract.networkFeePercentage(0)).to.equal(100) // 1% = 100/10000, more detail in contract
        expect(await yfDAIContract.networkFeePercentage(1)).to.equal(75) // 1% = 50/10000, more detail in contract
        expect(await yfDAIContract.networkFeePercentage(2)).to.equal(50) // 1% = 25/10000, more detail in contract
        // Check if initial custom network fee tier is 1000000e6
        expect(await yfDAIContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("1", 12))
        // Check if initial custom network fee percentage is 0.25%
        expect(await yfDAIContract.customNetworkFeePercentage()).to.equal(25)
        // Check if initial profile sharing fee percentage is 10% in Yearn Farmer contract
        expect(await yfDAIContract.profileSharingFeePercentage()).to.equal(1000)
        // Check if contract is not vesting in Yearn Farmer contract
        expect(await yfDAIContract.isVesting()).is.false
        // Check if daoVaultDAI contract address set correctly in Yearn Farmer contract
        expect(await yfDAIContract.daoVault()).to.equal(daoVaultDAI.address)
        // Check daoDAI token is set properly in daoVaultDAI contract
        expect(await daoVaultDAI.name()).to.equal("DAO Vault Medium DAI")
        expect(await daoVaultDAI.symbol()).to.equal("dvmDAI")
        expect(await daoVaultDAI.decimals()).to.equal(6)
        // Check if strategy match given contract in daoVaultDAI contract
        expect(await daoVaultDAI.strategy()).to.equal(yfDAIContract.address)
        // Check pendingStrategy is no pre-set in daoVaultDAI contract
        expect(await daoVaultDAI.pendingStrategy()).to.equal(ethers.constants.AddressZero)
        expect(await daoVaultDAI.canSetPendingStrategy()).is.true
        // Check if no unlockTime set yet in daoVaultDAI contract
        expect(await daoVaultDAI.unlockTime()).to.equal(0)
        // Check if timelock duration is 2 days in daoVaultDAI contract
        expect(await daoVaultDAI.LOCKTIME()).to.equal(2*24*60*60) // 2 days in seconds
    })

    // Check user functions
    describe("User functions", () => {
        it("should able to deposit earn and vault correctly", async () => {
            // Get sender address and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Transfer some DAI to client
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientSigner.address, "1000000000")
            expect(await token.balanceOf(clientSigner.address)).to.equal("1000000000")
            // Check if meet the function requirements
            const SampleContract = await ethers.getContractFactory("SampleContract")
            const sampleContract = await SampleContract.deploy(daoVaultDAI.address, tokenAddress)
            await sampleContract.deployed()
            await token.transfer(sampleContract.address, "1000000000")
            expect(await token.balanceOf(sampleContract.address)).to.equal("1000000000")
            await sampleContract.approve(yfDAIContract.address)
            await expect(sampleContract.deposit()).to.be.revertedWith("Only EOA")
            await expect(daoVaultDAI.connect(clientSigner).deposit([0, 0])).to.be.revertedWith("Amount must > 0")
            await expect(yfDAIContract.connect(clientSigner).deposit(["100000000", "200000000"])).to.be.revertedWith("Only can call from Vault")
            // Deposit 100 DAI to Yearn Earn contract and 200 to Yearn Vault Contract
            await token.connect(clientSigner).approve(yfDAIContract.address, "10000000000")
            const tx = await daoVaultDAI.connect(clientSigner).deposit(["100000000", "200000000"])
            // Check if user deposit successfully with correct amount
            const earnDepositAmount = await yfDAIContract.getEarnDepositBalance(clientSigner.address)
            const vaultDepositAmount = await yfDAIContract.getVaultDepositBalance(clientSigner.address)
            // Network fee for amount < 10000 is 1% by default
            const earnDepositBalance = "100000000" - Math.floor(100000000 * 1 / 100)
            const vaultDepositBalance = "200000000" - Math.floor(200000000 * 1 / 100)
            expect(earnDepositAmount).to.equal(earnDepositBalance)
            expect(vaultDepositAmount).to.equal(vaultDepositBalance)
            expect(await daoVaultDAI.balanceOf(clientSigner.address)).to.equal(earnDepositAmount.add(vaultDepositAmount))
        })

        it("should deduct correct fees from deposit amount based on tier", async () => {
            // Get signer and address of sender and deploy the contracts
            const [senderSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Check deduct network fee correctly in tier 1
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.approve(yfDAIContract.address, ethers.utils.parseEther("1"))
            let earnDepositBalance, vaultDepositBalance
            await daoVaultDAI.deposit(["100000000", "200000000"])
            // Network fee for amount < 10000 is 1% in tier 1 by default
            earnDepositBalance = "100000000" - Math.floor(100000000 * 1 / 100)
            vaultDepositBalance = "200000000" - Math.floor(200000000 * 1 / 100)
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal(Math.floor(earnDepositBalance))
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal(Math.floor(vaultDepositBalance))
            // Check deduct network fee correctly in tier 2
            await daoVaultDAI.deposit(["60000000000", "20000000000"])
            // Network fee for amount > 50000 and amount <= 100000 is 0.75% in tier 2 by default
            earnDepositBalance = earnDepositBalance + Math.floor("60000000000" - Math.floor(60000000000 * 0.75 / 100))
            vaultDepositBalance = vaultDepositBalance + Math.floor("20000000000" - Math.floor(20000000000 * 0.75 / 100))
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal(earnDepositBalance)
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal(vaultDepositBalance)
            // Check deduct network fee correctly in tier 3
            await daoVaultDAI.deposit(["100000000000", "200000000000"])
            // Network fee for amount > 100000 is 0.5% in tier 3 by default
            earnDepositBalance = earnDepositBalance + Math.floor(100000000000 - Math.floor(100000000000 * 0.5 / 100))
            vaultDepositBalance = vaultDepositBalance + Math.floor(200000000000 - Math.floor(200000000000 * 0.5 / 100))
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal(earnDepositBalance)
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal(vaultDepositBalance)
            // Check deduct network fee correctly in custom tier
            await daoVaultDAI.deposit(["1000000000000", "2000000000000"])
            // Network fee for amount > 1000000 is 0.25% in custom tier by default
            earnDepositBalance = earnDepositBalance + Math.floor(1000000000000 - Math.floor(1000000000000 * 0.25 / 100))
            vaultDepositBalance = vaultDepositBalance + Math.floor(2000000000000 - Math.floor(2000000000000 * 0.25 / 100))
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal(earnDepositBalance)
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal(vaultDepositBalance)
        })

        it("should withdraw earn and vault correctly", async () => {
            // Get signer and address of sender and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Transfer some DAI to client
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientSigner.address, "1000000000")
            // Deposit some DAI into Yearn Farmer contract
            await token.connect(clientSigner).approve(yfDAIContract.address, "1000000000")
            const clientTokenAmountBeforeDeposit = await token.balanceOf(clientSigner.address)
            const earnDepositAmount = new ethers.BigNumber.from("100000000")
            const vaultDepositAmount = new ethers.BigNumber.from("200000000")
            await daoVaultDAI.connect(clientSigner).deposit([earnDepositAmount, vaultDepositAmount])
            // Check if withdraw amount meet the function requirements
            await expect(daoVaultDAI.connect(clientSigner).withdraw(["1000000000", 0])).to.be.revertedWith("Insufficient balance")
            await expect(daoVaultDAI.connect(clientSigner).withdraw([0, "1000000000"])).to.be.revertedWith("Insufficient balance")
            await expect(yfDAIContract.connect(clientSigner).withdraw(["100000000", "200000000"])).to.be.revertedWith("Only can call from Vault")
            // Get Yearn Farmer earn and vault deposit amount of client account 
            const earnDepositBalance = await yfDAIContract.getEarnDepositBalance(clientSigner.address)
            const vaultDepositBalance = await yfDAIContract.getVaultDepositBalance(clientSigner.address)
            // Get off-chain actual withdraw DAI amount based on Yearn Earn and Vault contract
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
            const earnSharesInYearnContract = (earnDepositBalance.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken())
            const actualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(earnSharesInYearnContract)).div(await earnContract.totalSupply())
            const vaultSharesinYearnContract = (vaultDepositBalance.mul(await vaultContract.totalSupply())).div(await vaultContract.balance())
            const actualVaultWithdrawAmount = ((await vaultContract.balance()).mul(vaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            // Get shares based on deposit
            const daoEarnShares = earnDepositBalance.mul(await daoVaultDAI.totalSupply()).div(await yfDAIContract.pool())
            const daoVaultDAIShares = vaultDepositBalance.mul(await daoVaultDAI.totalSupply()).div(await yfDAIContract.pool())
            // Withdraw all from Yearn Earn and Vault
            await daoVaultDAI.connect(clientSigner).withdraw([daoEarnShares, daoVaultDAIShares])
            // Check if balance deposit amount in Yearn Farmer contract is correct
            expect(await yfDAIContract.getEarnDepositBalance(clientSigner.address)).to.equal(0)
            expect(await yfDAIContract.getVaultDepositBalance(clientSigner.address)).to.equal(0)
            // Check if daoDAI in client account is correct
            expect(await daoVaultDAI.balanceOf(clientSigner.address)).to.equal(0)
            // Check if pool amount in contract is Yearn Farmer is correct
            expect(await yfDAIContract.pool()).to.equal(0)
            // Check if DAI amount withdraw from Yearn Farmer contract is correct
            const clientTokenAmountAfterWithdraw = clientTokenAmountBeforeDeposit.sub(earnDepositAmount.add(vaultDepositAmount)).add(actualEarnWithdrawAmount.add(actualVaultWithdrawAmount))
            expect(await token.balanceOf(clientSigner.address)).to.equal(clientTokenAmountAfterWithdraw)
        })

        // it("should withdraw earn and vault correctly if there is profit", async () => {
        //     // To run this test you must comment out r variable in withdrawEarn() and withdrawVault() function
        //     // and assign r with the amount higher than deposit amount
        //     // For example "uint256 r = 200000000" in withdrawEarn() and "uint256 r = 400000000" in withdrawVault
        //     // if deposit 100000000 for Yearn Earn contract and 200000000 for Yearn Vault contract
        //     // Besides, you must provide some DAI to Yearn Farmer contract as profit from Yearn contract
        //     // Get signer and address of sender and deploy the contracts
        //     const [senderSigner, _] = await ethers.getSigners()
        //     const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
        //     const yfDAIContract = await YfDAIContract.deploy()
        //     const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
        //     const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
        //     await yfDAIContract.setVault(daoVaultDAI.address)
        //     // Get treasury wallet DAI balance before deposit
        //     const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
        //     const treasuryWalletTokenBalBeforeDeposit = await token.balanceOf(treasuryWalletAddress)
        //     // Get community wallet DAI balance before deposit
        //     const communityWalletTokenBalBeforeDeposit = await token.balanceOf(communityWalletAddress)
        //     // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
        //     await token.approve(yfDAIContract.address, "1000000000")
        //     await daoVaultDAI.deposit(["100000000", "200000000"])
        //     // Transfer some DAI to Yearn Farmer contract as profit from Yearn contract
        //     await token.transfer(yfDAIContract.address, "1000000000")
        //     // Record DAI amount of sender before withdraw earn shares
        //     const senderTokenAmountBeforeWithdraw = await token.balanceOf(senderSigner.address)
        //     // Get earn and vault deposit balance of sender 
        //     const earnDepositBalance = await yfDAIContract.getEarnDepositBalance(senderSigner.address)
        //     const vaultDepositBalance = await yfDAIContract.getVaultDepositBalance(senderSigner.address)
        //     // Calculate fees for earn and vault profit
        //     const earnExampleWithdrawAmount = new ethers.BigNumber.from("200000000")
        //     const earnFee = (earnExampleWithdrawAmount.sub(earnDepositBalance)).mul(10).div(100) // .mul(10).div(100): 10% profile sharing fee 
        //     const vaultExampleWithdrawAmount = new ethers.BigNumber.from("400000000")
        //     const vaultFee = (vaultExampleWithdrawAmount.sub(vaultDepositBalance)).mul(10).div(100) // .mul(10).div(100): 10% profile sharing fee 
        //     // Get shares based on deposit
        //     const daoEarnShares = earnDepositBalance.mul(await daoVaultDAI.totalSupply()).div(await yfDAIContract.pool())
        //     const daoVaultDAIShares = vaultDepositBalance.mul(await daoVaultDAI.totalSupply()).div(await yfDAIContract.pool())
        //     // Withdraw all from Yearn Earn and Vault contract
        //     await daoVaultDAI.withdraw([daoEarnShares, daoVaultDAIShares])
        //     // Check if total token balance is correct after withdraw
        //     expect(await token.balanceOf(senderSigner.address)).to.equal(
        //         senderTokenAmountBeforeWithdraw
        //         .add(earnExampleWithdrawAmount.sub(earnFee))
        //         .add(vaultExampleWithdrawAmount.sub(vaultFee))
        //     )
        //     // Check if all fees transfer to treasury and community wallet correctly
        //     const networkFees = Math.floor((100000000 + 200000000) * 1 / 100) // 1% network fee for tier 1, for treasury wallet only
        //     const profileSharingFees = (earnFee.add(vaultFee)).mul(50).div(100) // 50% split between treasury and community wallet
        //     expect(await token.balanceOf(treasuryWalletAddress)).to.equal(treasuryWalletTokenBalBeforeDeposit.add(profileSharingFees.add(networkFees)))
        //     expect(await token.balanceOf(communityWalletAddress)).to.equal(communityWalletTokenBalBeforeDeposit.add(profileSharingFees))
        // })

        it("should able to get earn and vault deposit amount correctly", async () => {
            // Get signer and address of sender and client and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.approve(yfDAIContract.address, "1000000000")
            await daoVaultDAI.deposit(["100000000", "200000000"])
            // Deposit another 300 to Yearn Earn contract and 400 to Yearn Vault contract
            await daoVaultDAI.deposit(["300000000", "400000000"])
            // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after network fee return correctly
            const totalEarnDepositAfterFee = (100000000 + 300000000) - Math.floor((100000000 + 300000000) * 0.01) // 0.01: 1% network fee for tier 1
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal(totalEarnDepositAfterFee)
            const totalVaultDepositAfterFee = (200000000 + 400000000) - Math.floor((200000000 + 400000000) * 0.01) // 0.01: 1% network fee for tier 1
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal(totalVaultDepositAfterFee)
            // Transfer some DAI to client account
            await token.transfer(clientSigner.address, "1000000000")
            expect(await token.balanceOf(clientSigner.address)).to.equal("1000000000")
            // Deposit 150 to Yearn Earn contract and 250 to Yearn Vault contract from client
            await token.connect(clientSigner).approve(yfDAIContract.address, "1000000000")
            await daoVaultDAI.connect(clientSigner).deposit(["150000000", "250000000"])
            // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after network fee from another account return correctly
            expect(await yfDAIContract.getEarnDepositBalance(clientSigner.address)).to.equal(150000000 - Math.floor(150000000 * 0.01)) // 0.01: 1% network fee for tier 1
            expect(await yfDAIContract.getVaultDepositBalance(clientSigner.address)).to.equal(250000000 - Math.floor(250000000 * 0.01)) // 0.01: 1% network fee for tier 1
        })

        it("should able to deal with mix and match situation (deposit and withdraw several times by several parties)", async () => {
             // Get signer and address of sender and client and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Transfer some token to client account
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientSigner.address, "10000000000")
            expect(await token.balanceOf(clientSigner.address)).to.equal("10000000000")
            // Get sender and client account token balance before deposit
            const senderTknBalBefDep = await token.balanceOf(senderSigner.address)
            const clientTknBalBefDep = await token.balanceOf(clientSigner.address)
            // Mix and max deposit
            await token.approve(yfDAIContract.address, "10000000000")
            await token.connect(clientSigner).approve(yfDAIContract.address, "10000000000")
            await daoVaultDAI.deposit(["123000000", 0])
            await daoVaultDAI.connect(clientSigner).deposit([0, "212000000"])
            await daoVaultDAI.deposit([0, "166000000"])
            await daoVaultDAI.connect(clientSigner).deposit(["249000000", 0])
            await daoVaultDAI.deposit(["132000000", "186000000"])
            await daoVaultDAI.connect(clientSigner).deposit(["234000000", "269000000"])
            // Get Yearn Farmer earn and vault network fees of accounts
            const senderEarnDepFee = Math.floor(123000000*0.01)+Math.floor(132000000*0.01)
            const senderVaultDepFee = Math.floor(166000000*0.01)+Math.floor(186000000*0.01)
            const clientEarnDepFee = Math.floor(249000000*0.01)+Math.floor(234000000*0.01)
            const clientVaultDepFee = Math.floor(212000000*0.01)+Math.floor(269000000*0.01)
            // Check if deposit amount of accounts return correctly
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal((123000000+132000000)-senderEarnDepFee)
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal((166000000+186000000)-senderVaultDepFee)
            expect(await yfDAIContract.getEarnDepositBalance(clientSigner.address)).to.equal((249000000+234000000)-clientEarnDepFee)
            expect(await yfDAIContract.getVaultDepositBalance(clientSigner.address)).to.equal((212000000+269000000)-clientVaultDepFee)
            // Check if daoDAI distribute to accounts correctly
            expect(await daoVaultDAI.balanceOf(senderSigner.address)).to.equal((123000000+132000000+166000000+186000000)-senderEarnDepFee-senderVaultDepFee)
            expect(await daoVaultDAI.balanceOf(clientSigner.address)).to.equal((212000000+249000000+234000000+269000000)-clientEarnDepFee-clientVaultDepFee)
            // Get accounts token balance after deposit
            const senderTknBalAftDep = await token.balanceOf(senderSigner.address)
            const clientTknBalAftDep = await token.balanceOf(clientSigner.address)
            // Check if token balance of accounts deduct correctly after deposit
            expect(senderTknBalAftDep).to.equal(senderTknBalBefDep.sub(123000000+132000000+166000000+186000000))
            expect(clientTknBalAftDep).to.equal(clientTknBalBefDep.sub(212000000+249000000+234000000+269000000))
            // Check if network fees send to treasury wallet correctly
            expect(await token.balanceOf(treasuryWalletAddress)).to.equal(senderEarnDepFee+senderVaultDepFee+clientEarnDepFee+clientVaultDepFee)
            // Get Yearn Farmer pool amount
            const yfPool = await yfDAIContract.pool()
            // Check if Yearn Farmer pool amount sum up correctly
            expect(yfPool).to.equal(
                (await yfDAIContract.getEarnDepositBalance(senderSigner.address)).add(await yfDAIContract.getVaultDepositBalance(senderSigner.address))
                .add(await yfDAIContract.getEarnDepositBalance(clientSigner.address)).add(await yfDAIContract.getVaultDepositBalance(clientSigner.address))
            )
            // Mix and max withdraw
            await daoVaultDAI.withdraw(["200000000", 0])
            await daoVaultDAI.connect(clientSigner).withdraw(["132000000", 0])
            await daoVaultDAI.withdraw([0, "24000000"])
            await daoVaultDAI.connect(clientSigner).withdraw([0, "188000000"])
            // Get earn and vault deposit balance of accounts
            const senderEarnDepBalAftWdr = await yfDAIContract.getEarnDepositBalance(senderSigner.address)
            const senderVaultDepBalAftWdr = await yfDAIContract.getVaultDepositBalance(senderSigner.address)
            const clientEarnDepBalAftWdr = await yfDAIContract.getEarnDepositBalance(clientSigner.address)
            const clientVaultDepBalAftWdr = await yfDAIContract.getVaultDepositBalance(clientSigner.address)
            // Check if deposit amount of accounts return correctly after withdraw 1st time
            expect(senderEarnDepBalAftWdr).to.equal((123000000+132000000)-senderEarnDepFee-200000000)
            expect(senderVaultDepBalAftWdr).to.equal((166000000+186000000)-senderVaultDepFee-24000000)
            expect(clientEarnDepBalAftWdr).to.equal((249000000+234000000)-clientEarnDepFee-132000000)
            expect(clientVaultDepBalAftWdr).to.equal((212000000+269000000)-clientVaultDepFee-188000000)
            // Check if daoDAI burn correctly in accounts
            expect(await daoVaultDAI.balanceOf(senderSigner.address)).to.equal((123000000+132000000+166000000+186000000)-Math.floor(123000000*0.01)-Math.floor(132000000*0.01)-Math.floor(166000000*0.01)-Math.floor(186000000*0.01)-(200000000+24000000))
            expect(await daoVaultDAI.balanceOf(clientSigner.address)).to.equal((212000000+249000000+234000000+269000000)-Math.floor(212000000*0.01)-Math.floor(249000000*0.01)-Math.floor(234000000*0.01)-Math.floor(269000000*0.01)-(132000000+188000000))
            // Get accounts token balance after withdraw 1st time
            const senderTknBalAftWdr = await token.balanceOf(senderSigner.address)
            const clientTknBalAftWdr = await token.balanceOf(clientSigner.address)
            // Get total withdraw amount of sender and client in big number
            const senderEarnWdrAmt = new ethers.BigNumber.from("200000000")
            const senderVaultWdrAmt = new ethers.BigNumber.from("24000000")
            const clientEarnWdrAmt = new ethers.BigNumber.from("132000000")
            const clientVaultWdrAmt = new ethers.BigNumber.from("188000000")
            // Get off-chain actual withdraw DAI amount based on Yearn Earn and Vault contract
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
            expect(senderTknBalAftWdr).to.equal(senderTknBalAftDep.add(senderActualEarnWithdrawAmount).add(senderActualVaultWithdrawAmount).sub(1)) // Small variation
            expect(clientTknBalAftWdr).to.equal(clientTknBalAftDep.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount))
            // Check if Yearn Contract pool amount deduct correctly
            expect(await yfDAIContract.pool()).to.equal(yfPool.sub(senderEarnWdrAmt.add(senderVaultWdrAmt).add(clientEarnWdrAmt).add(clientVaultWdrAmt)))
            // Get shares based on deposit
            const senderDaoEarnShares = (await yfDAIContract.getEarnDepositBalance(senderSigner.address)).mul(await daoVaultDAI.totalSupply()).div(await yfDAIContract.pool())
            const senderDaoVaultDAIShares = (await yfDAIContract.getVaultDepositBalance(senderSigner.address)).mul(await daoVaultDAI.totalSupply()).div(await yfDAIContract.pool())
            const clientDaoEarnShares = (await yfDAIContract.getEarnDepositBalance(clientSigner.address)).mul(await daoVaultDAI.totalSupply()).div(await yfDAIContract.pool())
            const clientDaoVaultDAIShares = (await yfDAIContract.getVaultDepositBalance(clientSigner.address)).mul(await daoVaultDAI.totalSupply()).div(await yfDAIContract.pool())
            // Withdraw all balance for accounts in Yearn contract 
            await daoVaultDAI.withdraw([senderDaoEarnShares, 0])
            await daoVaultDAI.connect(clientSigner).withdraw([clientDaoEarnShares, 0])
            await daoVaultDAI.withdraw([0, senderDaoVaultDAIShares])
            await daoVaultDAI.connect(clientSigner).withdraw([0, clientDaoVaultDAIShares])
            // Check if deposit amount of accounts return 0
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal(0)
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal(0)
            expect(await yfDAIContract.getEarnDepositBalance(clientSigner.address)).to.equal(0)
            expect(await yfDAIContract.getVaultDepositBalance(clientSigner.address)).to.equal(0)
            // Check if daoDAI burn to empty in accounts
            expect(await daoVaultDAI.balanceOf(senderSigner.address)).to.equal(0)
            expect(await daoVaultDAI.balanceOf(clientSigner.address)).to.equal(0)
            // Get off-chain actual withdraw DAI amount based on Yearn Earn and Vault contract
            senderEarnSharesinYearnContract = (senderEarnDepBalAftWdr.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken())
            senderActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(senderEarnSharesinYearnContract)).div(await earnContract.totalSupply())
            senderVaultSharesinYearnContract = (senderVaultDepBalAftWdr.mul(await vaultContract.totalSupply())).div(await vaultContract.balance())
            senderActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(senderVaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            clientEarnSharesinYearnContract = (clientEarnDepBalAftWdr.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken())
            clientActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await earnContract.totalSupply())
            clientVaultSharesinYearnContract = (clientVaultDepBalAftWdr.mul(await vaultContract.totalSupply())).div(await vaultContract.balance())
            clientActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            // Check if token balance of accounts top-up correctly after withdraw all
            expect(await token.balanceOf(senderSigner.address)).to.equal(senderTknBalAftWdr.add(senderActualEarnWithdrawAmount).add(senderActualVaultWithdrawAmount))
            expect(await token.balanceOf(clientSigner.address)).to.equal(clientTknBalAftWdr.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount))
            // Check if Yearn Contract pool amount return 0
            expect(await yfDAIContract.pool()).to.equal(0)
        })

        it("should able to deal with mix and match situation (deposit and withdraw several times in tier 2)", async () => {
            // Get signer and address of sender and client and deploy the contracts
            const [senderSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Approve Yearn Farmer to transfer token from sender
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.approve(yfDAIContract.address, "1000000000000")
            // Get current balance DAI of sender account
            const tokenBalanceBeforeDeposit = await token.balanceOf(senderSigner.address)
            // Mix and max deposit and withdraw
            await daoVaultDAI.deposit(["62345000000", "22222000000"])
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
            let senderSharesinYearnContract = (new ethers.BigNumber.from("8932000000")).mul(await earnContract.totalSupply()).div(await earnContract.calcPoolValueInToken())
            let senderActualWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(senderSharesinYearnContract)).div(await earnContract.totalSupply())
            await daoVaultDAI.withdraw(["8932000000", 0])
            await daoVaultDAI.deposit(["97822000000", 0])
            await daoVaultDAI.deposit(["4444000000", 0])
            let currentTokenBalance = tokenBalanceBeforeDeposit.sub("62345000000").sub("22222000000").add(senderActualWithdrawAmount).sub("97822000000").sub("4444000000")
            senderSharesinYearnContract = (new ethers.BigNumber.from("7035000000")).mul(await earnContract.totalSupply()).div(await earnContract.calcPoolValueInToken())
            senderActualWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(senderSharesinYearnContract)).div(await earnContract.totalSupply())
            await daoVaultDAI.withdraw(["7035000000", 0])
            currentTokenBalance = currentTokenBalance.add(senderActualWithdrawAmount)
            senderSharesinYearnContract = (new ethers.BigNumber.from("19965000000")).mul(await vaultContract.totalSupply()).div(await vaultContract.balance())
            senderActualWithdrawAmount = ((await vaultContract.balance()).mul(senderSharesinYearnContract)).div(await vaultContract.totalSupply())
            await daoVaultDAI.withdraw([0, "19965000000"])
            await daoVaultDAI.deposit([0, "59367000000"])
            currentTokenBalance = currentTokenBalance.add(senderActualWithdrawAmount).sub("59367000000")
            // Check if earn and vault deposit balance return correctly
            const earnDepositBalance = (62345000000-Math.floor(62345000000*0.0075))+(97822000000-Math.floor(97822000000*0.0075))+(4444000000-Math.floor(4444000000*0.01))-8932000000-7035000000
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal(earnDepositBalance)
            const vaultDepositBalance = (22222000000-Math.floor(22222000000*0.0075))+(59367000000-Math.floor(59367000000*0.0075))-19965000000
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal(vaultDepositBalance)
            // Check if balance token of sender account correctly after mix and max deposit and withdraw
            expect(await token.balanceOf(senderSigner.address)).to.equal(currentTokenBalance) // Small variation
            // Check if daoDAI balance of sender account correct
            expect(await daoVaultDAI.balanceOf(senderSigner.address)).to.equal(earnDepositBalance+vaultDepositBalance)
            // Check if treasury wallet receive fees amount correctly
            expect(await token.balanceOf(treasuryWalletAddress)).to.equal(Math.floor(62345000000*0.0075)+Math.floor(22222000000*0.0075)+Math.floor(97822000000*0.0075)+Math.floor(4444000000*0.01)+Math.floor(59367000000*0.0075))
            // Check if Yearn Farmer pool amount correct
            expect(await yfDAIContract.pool()).to.equal((62345000000-Math.floor(62345000000*0.0075))+(22222000000-Math.floor(22222000000*0.0075))-8932000000+(97822000000-Math.floor(97822000000*0.0075))+(4444000000-Math.floor(4444000000*0.01))-7035000000-19965000000+(59367000000-Math.floor(59367000000*0.0075)))
        })

        it("should able to refund token when this contract is in vesting state", async () => {
            // Get address of owner and deploy the contracts
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Transfer some token to client
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientSigner.address, "1000000000")
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await token.connect(clientSigner).approve(yfDAIContract.address, ethers.utils.parseEther("1"))
            await daoVaultDAI.connect(clientSigner).deposit(["100000000", "200000000"])
            // Get client DAI balance before refund
            const tokenBalanceBeforeRefund = await token.balanceOf(clientSigner.address)
            // Get client earn and vault deposit balance return before vesting
            const clientEarnDepositBalanceBeforeVesting = await yfDAIContract.getEarnDepositBalance(clientSigner.address)
            const clientVaultDepositBalanceBeforeVesting = await yfDAIContract.getVaultDepositBalance(clientSigner.address)
            // Get client off-chain actual earn withdraw amount
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
            const clientEarnSharesinYearnContract = (clientEarnDepositBalanceBeforeVesting).mul(await earnContract.totalSupply()).div(await earnContract.calcPoolValueInToken())
            const clientActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await earnContract.totalSupply())
            const clientVaultSharesinYearnContract = (clientVaultDepositBalanceBeforeVesting).mul(await vaultContract.totalSupply()).div(await vaultContract.balance())
            const clientActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await vaultContract.totalSupply())
            // Execute vesting function
            await yfDAIContract.vesting()
            // Check if function to get shares value return correctly
            expect(await yfDAIContract.getSharesValue(clientSigner.address)).to.gte(clientActualEarnWithdrawAmount.add(clientActualVaultWithdrawAmount))
            // Check if refund function meet requirements
            await expect(daoVaultDAI.refund()).to.be.revertedWith("No balance to refund")
            await expect(yfDAIContract.refund("100000000")).to.be.revertedWith("Only can call from Vault")
            // Execute refund function
            await daoVaultDAI.connect(clientSigner).refund()
            // Check if DAI amount of client refund correctly
            expect(await token.balanceOf(clientSigner.address)).to.gte(tokenBalanceBeforeRefund.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount))
            // Check if daoDAI of client burn to 0
            expect(await daoVaultDAI.balanceOf(clientSigner.address)).to.equal(0)
        })

        it("should able to refund token with profit when this contract is in vesting state", async () => {
            // Get address of owner and deploy the contracts
            const [senderSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Transfer some DAI to Yearn Farmer contract as profit from Yearn contract
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(yfDAIContract.address, "1000000000")
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await token.approve(yfDAIContract.address, "1000000000")
            await daoVaultDAI.deposit(["100000000", "200000000"])
            // Get client DAI balance before refund
            const tokenBalanceBeforeRefund = await token.balanceOf(senderSigner.address)
            // Execute vesting function
            await yfDAIContract.vesting()
            // Get shares value before execute refund function
            const sharesValue = await yfDAIContract.getSharesValue(senderSigner.address)
            // Execute refund function
            await daoVaultDAI.refund()
            // Check if refund token amount correctly
            expect(await token.balanceOf(senderSigner.address)).to.equal(tokenBalanceBeforeRefund.add(sharesValue))
            // Check if Yearn-Farmer pool equal to 0
            expect(await yfDAIContract.pool()).to.equal(0)
            expect(await daoVaultDAI.balanceOf(senderSigner.address)).to.equal(0)
            expect(await yfDAIContract.balanceOf(daoVaultDAI.address)).to.equal(0)
            expect(await yfDAIContract.getEarnDepositBalance(senderSigner.address)).to.equal(0)
            expect(await yfDAIContract.getVaultDepositBalance(senderSigner.address)).to.equal(0)
            expect(await yfDAIContract.getSharesValue(senderSigner.address)).to.equal(0)
        })

        it("should approve Yearn Earn and Vault contract to deposit DAI from yfDAI contract", async () => {
            // This function only execute one time and already execute while yfDAI contract deployed.
            // User should ignore this function.

            // Get address of owner and deploy the contracts
            const [senderSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", senderSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", senderSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Check if Yearn Earn and Vault contract can deposit a huge amount of DAI from yfDAI contract
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.approve(yfDAIContract.address, "500000000000000")
            await expect(daoVaultDAI.deposit(["250000000000000", "250000000000000"])).not.to.be.reverted
        })
    })


    // Test admin functions
    describe("Admin functions", () => {
        it("should able to transfer contract ownership to other address by contract owner only", async () => {
            // Get address of owner and new owner and deploy the contracts
            const [ownerSigner, newOwnerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", ownerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", ownerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Check if contract ownership is owner before transfer
            expect(await yfDAIContract.owner()).to.equal(ownerSigner.address)
            expect(await daoVaultDAI.owner()).to.equal(ownerSigner.address)
            // Check if new owner cannot execute admin functions yet
            await expect(daoVaultDAI.connect(newOwnerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVaultDAI.connect(newOwnerSigner).setPendingStrategy(newOwnerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVaultDAI.connect(newOwnerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setVault(newOwnerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setTreasuryWallet(newOwnerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setNetworkFeeTier2(["100000000", "200000000"])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setNetworkFeePercentage([30, 30, 30])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 13))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setCustomNetworkFeePercentage(20)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
            // Transfer contract ownership from owner to new owner
            await daoVaultDAI.transferOwnership(newOwnerSigner.address)
            await yfDAIContract.transferOwnership(newOwnerSigner.address)
            // Check if contract ownership is new owner after transfer
            expect(await daoVaultDAI.owner()).to.equal(newOwnerSigner.address)
            expect(await yfDAIContract.owner()).to.equal(newOwnerSigner.address)
            // Check if new owner can execute admin function
            await expect(daoVaultDAI.connect(newOwnerSigner).unlockMigrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVaultDAI.connect(newOwnerSigner).setPendingStrategy(ownerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVaultDAI.connect(newOwnerSigner).migrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setVault(ownerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setTreasuryWallet(ownerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setNetworkFeeTier2(["100000000", "200000000"])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setNetworkFeePercentage([30, 30, 30])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 13))).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).setCustomNetworkFeePercentage(20)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(newOwnerSigner).vesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
            // Check if original owner neither can execute admin function nor transfer back ownership
            await expect(daoVaultDAI.connect(ownerSigner).transferOwnership(ownerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVaultDAI.connect(ownerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVaultDAI.connect(ownerSigner).setPendingStrategy(ownerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(daoVaultDAI.connect(ownerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(ownerSigner).transferOwnership(ownerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(ownerSigner).setVault(ownerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(ownerSigner).setTreasuryWallet(ownerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(ownerSigner).setNetworkFeeTier2(["100000000", "200000000"])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(ownerSigner).setNetworkFeePercentage([30, 30, 30])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(ownerSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 13))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(ownerSigner).setCustomNetworkFeePercentage(20)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfDAIContract.connect(ownerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("should able to set pending strategy, migrate funds and set new strategy correctly in daoVaultDAI contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Set pending strategy
            const SampleContract = await ethers.getContractFactory("SampleContract", deployerSigner)
            const sampleContract = await SampleContract.deploy(daoVaultDAI.address, tokenAddress)
            await sampleContract.deployed()
            await daoVaultDAI.setPendingStrategy(sampleContract.address)
            // Check if pending strategy is set with given address
            expect(await daoVaultDAI.pendingStrategy()).to.equal(sampleContract.address)
            // Deposit into daoVaultDAI and execute vesting function
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            await token.approve(yfDAIContract.address, "100000000000")
            await daoVaultDAI.deposit(["1000000000", "2000000000"])
            await yfDAIContract.vesting()
            // Get Yearn Farmer token balance before migrate
            const tokenBalance = await token.balanceOf(yfDAIContract.address) 
            // Execute unlock migrate funds function
            await daoVaultDAI.unlockMigrateFunds()
            // Check if execute migrate funds function before 2 days be reverted
            network.provider.send("evm_increaseTime", [86400]) // advance 1 day
            await expect(daoVaultDAI.migrateFunds()).to.be.revertedWith("Function locked")
            network.provider.send("evm_increaseTime", [86400*2+60]) // advance another 2 days
            await expect(daoVaultDAI.migrateFunds()).to.be.revertedWith("Function locked")
            // Execute unlock migrate funds function again
            await daoVaultDAI.unlockMigrateFunds()
            network.provider.send("evm_increaseTime", [86400*2]) // advance for 2 days
            // Check if migrate funds function meet the requirements
            // await expect(daoVaultDAI.migrateFunds()).to.be.revertedWith("No balance to migrate") // need to comment out deposit() function to test this
            // await expect(daoVaultDAI.migrateFunds()).to.be.revertedWith("No pendingStrategy") // need to comment out set/check pending strategy function to test this
            // Approve for token transfer from Yearn Farmer to new strategy
            await yfDAIContract.approveMigrate()
            // Check if migrate funds function is log
            await expect(daoVaultDAI.migrateFunds()).to.emit(daoVaultDAI, "MigrateFunds")
                .withArgs(yfDAIContract.address, sampleContract.address, tokenBalance)
            // Check if token transfer correctly
            expect(await token.balanceOf(sampleContract.address)).to.equal(tokenBalance)
            expect(await token.balanceOf(yfDAIContract.address)).to.equal(0)
            // Check if yfDAI in daoVaultDAI burn to 0
            expect(await yfDAIContract.balanceOf(daoVaultDAI.address)).to.equal(0)
            // Check if new strategy set and pending strategy reset to 0
            expect(await daoVaultDAI.strategy()).to.equal(sampleContract.address)
            expect(await daoVaultDAI.pendingStrategy()).to.equal(ethers.constants.AddressZero)
            // Check if execute migrate funds function again be reverted
            await expect(daoVaultDAI.migrateFunds()).to.be.revertedWith("Function locked")
        })

        it("should able to set new treasury wallet correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and new treasury wallet and deploy the contracts
            const [deployerSigner, newTreasuryWalletSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Set new treasury wallet
            // Check if event for setTreasuryWallet function is logged
            await expect(yfDAIContract.setTreasuryWallet(newTreasuryWalletSigner.address))
                .to.emit(yfDAIContract, "SetTreasuryWallet")
                .withArgs(treasuryWalletAddress, newTreasuryWalletSigner.address)
            // Check if new treasury wallet is set to the contract
            expect(await yfDAIContract.treasuryWallet()).to.equal(newTreasuryWalletSigner.address)
            // Check if new treasury wallet receive fees
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            await token.approve(yfDAIContract.address, "1000000000")
            await daoVaultDAI.deposit(["100000000", "200000000"])
            // - 100 + 200 < 300 within network fee tier 1 hence fee = 1%
            expect(await token.balanceOf(newTreasuryWalletSigner.address)).to.equal("3000000")
        })

        it("should able to set new community wallet correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and new community wallet and deploy the contracts
            const [deployerSigner, newCommunityWalletSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Set new community wallet
            // Check if event for setCommunityWallet function is logged
            await expect(yfDAIContract.setCommunityWallet(newCommunityWalletSigner.address))
                .to.emit(yfDAIContract, "SetCommunityWallet")
                .withArgs(communityWalletAddress, newCommunityWalletSigner.address)
            // Check if new community wallet is set to the contract
            expect(await yfDAIContract.communityWallet()).to.equal(newCommunityWalletSigner.address)
        })

        it("should able to set new network fee tier correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Check if function parameter meet the requirements
            await expect(yfDAIContract.setNetworkFeeTier2([0, "10000000000"]))
                .to.be.revertedWith("Minimun amount cannot be 0")
            await expect(yfDAIContract.setNetworkFeeTier2(["10000000000", "10000000000"]))
                .to.be.revertedWith("Maximun amount must greater than minimun amount")
            // Set network fee tier 2 with minimun 60001 and maximun 600000 (default 50001, 500000)
            // and Check if function is log
            await expect(yfDAIContract.setNetworkFeeTier2(["60000000001", "600000000000"]))
                .to.emit(yfDAIContract, "SetNetworkFeeTier2")
                .withArgs(["50000000001", "100000000000"], ["60000000001", "600000000000"]) // [oldNetworkFeeTier2, newNetworkFeeTier2]
            // Check if network fee tier 2 amount is set correctly
            expect(await yfDAIContract.networkFeeTier2(0)).to.equal("60000000001")
            expect(await yfDAIContract.networkFeeTier2(1)).to.equal("600000000000")
        })

        it("should able to set new custom network fee tier correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Check if function parameter meet the requirements
            await expect(yfDAIContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 10)))
                .to.be.revertedWith("Custom network fee tier must greater than tier 2")
            // Set custom network fee tier to 2000000 (default 1000000)
            // and Check if function is log
            await expect(yfDAIContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("2", 12)))
                .to.emit(yfDAIContract, "SetCustomNetworkFeeTier")
                .withArgs("1000000000000", "2000000000000") // [oldCustomNetworkFeeTier, newCustomNetworkFeeTier]
            // Check if custom network fee tier amount is set correctly
            expect(await yfDAIContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("2", 12))
        })

        it("should able to set new network fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Check if function parameter meet the requirements (100 = 1%)
            await expect(yfDAIContract.setNetworkFeePercentage([4000, 0, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            await expect(yfDAIContract.setNetworkFeePercentage([0, 4000, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            await expect(yfDAIContract.setNetworkFeePercentage([0, 0, 4000]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            // Set network fee percentage to tier1 2%, tier2 1%, tier3 0.5% (default tier1 1%, tier2 0.5%, tier3 0.25%)
            // And check if function is log
            await expect(yfDAIContract.setNetworkFeePercentage([200, 100, 50]))
                .to.emit(yfDAIContract, "SetNetworkFeePercentage")
                .withArgs([100, 75, 50], [200, 100, 50]) // [oldNetworkFeePercentage, newNetworkFeePercentage]
            // Check if network fee percentage is set correctly
            expect(await yfDAIContract.networkFeePercentage(0)).to.equal(200)
            expect(await yfDAIContract.networkFeePercentage(1)).to.equal(100)
            expect(await yfDAIContract.networkFeePercentage(2)).to.equal(50)
        })

        it("should able to set new custom network fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Check if function parameter meet the requirements (100 = 1%)
            await expect(yfDAIContract.setCustomNetworkFeePercentage(60))
                .to.be.revertedWith("Custom network fee percentage cannot be more than tier 2")
            // Set network fee percentage to 0.1% (default 0.25%)
            // And check if function is log
            await expect(yfDAIContract.setCustomNetworkFeePercentage(10))
                .to.emit(yfDAIContract, "SetCustomNetworkFeePercentage")
                .withArgs(25, 10) // [oldCustomNetworkFeePercentage, newCustomNetworkFeePercentage]
            // Check if network fee percentage is set correctly
            expect(await yfDAIContract.customNetworkFeePercentage()).to.equal(10)
        })

        it("should able to set new profile sharing fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Check if function parameter meet the requirements
            await expect(yfDAIContract.setProfileSharingFeePercentage(4000))
                .to.be.revertedWith("Profile sharing fee percentage cannot be more than 40%")
            // Set profile sharing fee percentage to 20% (default 10%) and check if function log
            await expect(yfDAIContract.setProfileSharingFeePercentage(2000))
                .to.emit(yfDAIContract, "SetProfileSharingFeePercentage")
                .withArgs(1000, 2000) // [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]
            // Check if profile sharing fee percentage is set correctly
            expect(await yfDAIContract.profileSharingFeePercentage()).to.equal(2000)
        })

        it("should set contract in vesting state correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Deposit into Yearn Farmer through daoVaultDAI
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            await token.approve(yfDAIContract.address, "1000000000")
            await daoVaultDAI.deposit(["100000000", "200000000"])
            // Check if get shares value return 0 if no vesting (this function only available after vesting state)
            expect(await yfDAIContract.getSharesValue(deployerSigner.address)).to.equal(0)
            // Check if corresponding function to be reverted if no vesting (these function only available after vesting state)
            await expect(daoVaultDAI.refund()).to.be.revertedWith("Not in vesting state")
            await expect(yfDAIContract.approveMigrate()).to.be.revertedWith("Not in vesting state")
            await yfDAIContract.vesting()
            // Check if vesting state is true
            expect(await yfDAIContract.isVesting()).is.true
            // Check if corresponding function to be reverted in vesting state
            await expect(daoVaultDAI.deposit(["100000000", "200000000"])).to.be.revertedWith("Contract in vesting state")
            await expect(daoVaultDAI.withdraw(["50000000", "100000000"])).to.be.revertedWith("Contract in vesting state")
            // Check if corresponding getter function return 0 in vesting state
            expect(await yfDAIContract.getEarnDepositBalance(deployerSigner.address)).to.equal(0) 
            expect(await yfDAIContract.getVaultDepositBalance(deployerSigner.address)).to.equal(0) 
            // Check if execute vesting function again to be reverted
            await expect(yfDAIContract.vesting()).to.be.revertedWith("Already in vesting state")
            // Check if pool reset to 0 after vesting state
            expect(await yfDAIContract.pool()).to.equal(0)
        })

        it("should send profit to treasury and community wallet correctly after vesting state in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const [deployerSigner, _] = await ethers.getSigners()
            const YfDAIContract = await ethers.getContractFactory("yfDAIv2", deployerSigner)
            const yfDAIContract = await YfDAIContract.deploy()
            const DaoVaultDAI = await ethers.getContractFactory("DAOVaultMediumDAI", deployerSigner)
            const daoVaultDAI = await DaoVaultDAI.deploy(yfDAIContract.address)
            await yfDAIContract.setVault(daoVaultDAI.address)
            // Deposit into Yearn Farmer through daoVaultDAI
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            await token.approve(yfDAIContract.address, "1000000000")
            await daoVaultDAI.deposit(["100000000", "200000000"])
            const treasuryWalletBalanceBeforeVesting = await token.balanceOf(treasuryWalletAddress)
            const communityWalletBalanceBeforeVesting = await token.balanceOf(communityWalletAddress)
            // Get off-chain Yearn earn and vault actual withdraw amount
            const earnDepositBalance = await yfDAIContract.getEarnDepositBalance(deployerSigner.address)
            const vaultDepositBalance = await yfDAIContract.getVaultDepositBalance(deployerSigner.address)
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, deployerSigner)
            const vaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, deployerSigner)
            const offChainActualEarnWithdrawAmount = ((await earnContract.calcPoolValueInToken()).mul(
                (earnDepositBalance.mul(await earnContract.totalSupply())).div(await earnContract.calcPoolValueInToken()))
            ).div(await earnContract.totalSupply())
            const offChainActualVaultWithdrawAmount = ((await vaultContract.balance()).mul(
                (vaultDepositBalance.mul(await vaultContract.totalSupply())).div(await vaultContract.balance()))
            ).div(await vaultContract.totalSupply())
            // Transfer some token to Yearn Farmer contract treat as profit
            await token.transfer(yfDAIContract.address, "100000000")
            await yfDAIContract.vesting()
            // Check if balance token in Yearn Farmer contract correctly after fee
            expect(await token.balanceOf(yfDAIContract.address)).to.equal(await yfDAIContract.getSharesValue(deployerSigner.address))
            // Check if amount fee transfer to treasury and community wallet correctly (50% split)
            const profit = (await token.balanceOf(yfDAIContract.address)).sub(offChainActualEarnWithdrawAmount.add(offChainActualVaultWithdrawAmount))
            const profileSharingFee = profit.mul(10).div(100)
            expect(await token.balanceOf(treasuryWalletAddress)).to.gte(treasuryWalletBalanceBeforeVesting.add(profileSharingFee.mul(50).div(100)))
            expect(await token.balanceOf(communityWalletAddress)).to.gte(communityWalletBalanceBeforeVesting.add(profileSharingFee.mul(50).div(100)))
        })
    })
})
