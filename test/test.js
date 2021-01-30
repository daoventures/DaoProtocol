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
        await tokenContract.connect(unlockedSigner).transfer(senderSignerAddress, 500000000000000)
        // Check if sender have 500000000000000 USDT
        expect(await tokenContract.balanceOf(senderSignerAddress)).to.equal(500000000000000)
    })

    // it("should deploy contract correctly", async () => {
    //     // Get sender address and deploy the contract
    //     const [senderSigner, _] = await ethers.getSigners()
    //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
    //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
    //     await yfUSDTContract.deployed()
    //     // Check if contract owner is contract deployer
    //     expect(await yfUSDTContract.owner()).to.equal(await senderSigner.getAddress())
    //     // Check if token accept is USDT
    //     expect(await yfUSDTContract.token()).to.equal(tokenAddress)
    //     // Check if no initial amount set in earn pool, vault pool, earn price and vault price
    //     expect(await yfUSDTContract.earnPool()).to.equal(0)
    //     expect(await yfUSDTContract.vaultPool()).to.equal(0)
    //     expect(await yfUSDTContract.earnPrice()).to.equal(0)
    //     expect(await yfUSDTContract.vaultPrice()).to.equal(0)
    //     // Check if initial tier2 of deposit fee is 10001 <= tokenAmount <= 100000 (More details in contract)
    //     expect(await yfUSDTContract.depositFeeTier2(0)).to.equal(10001)
    //     expect(await yfUSDTContract.depositFeeTier2(1)).to.equal(100000)
    //     // Check if initial deposit fee percentage is 1% for tier1, 0.5% for tier2, and 0.25% for tier3 (More details in contract)
    //     expect(await yfUSDTContract.depositFeePercentage(0)).to.equal(100) // 1% = 100/10000, more detail in contract
    //     expect(await yfUSDTContract.depositFeePercentage(1)).to.equal(50) // 1% = 50/10000, more detail in contract
    //     expect(await yfUSDTContract.depositFeePercentage(2)).to.equal(25) // 1% = 25/10000, more detail in contract
    //     // Check if initial profile sharing fee percentage is 10%
    //     expect(await yfUSDTContract.profileSharingFeePercentage()).to.equal(10)
    //     // Check if contract is not vesting
    //     expect(await yfUSDTContract.isVesting()).is.false
    //     // Check if treasury wallet address match given address
    //     expect(await yfUSDTContract.treasuryWallet()).to.equal(treasuryWalletAddress)
    //     // Check if Yearn USDT Earn contract and Yearn USDT Vault contract match given contract
    //     expect(await yfUSDTContract.earn()).to.equal(yEarnAddress)
    //     expect(await yfUSDTContract.vault()).to.equal(yVaultAddress)
    //     // Check daoUSDT token is set properly
    //     expect(await yfUSDTContract.name()).to.equal("DAO Tether USDT")
    //     expect(await yfUSDTContract.symbol()).to.equal("daoUSDT")
    //     expect(await yfUSDTContract.decimals()).to.equal(6)
    // })

    // Check user functions
    describe("User functions", () => {
    //     it("should able to deposit earn and vault correctly", async () => {
    //         // Get sender and client address and deploy the contract
    //         const [senderSigner, clientSigner, _] = await ethers.getSigners()
    //         const clientAddress = await clientSigner.getAddress()
    //         const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
    //         const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
    //         await yfUSDTContract.deployed()
    //         // Transfer some USDT to client
    //         const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
    //         await token.transfer(clientAddress, 1000)
    //         expect(await token.balanceOf(clientAddress)).to.equal(1000)
    //         // Check if caller and deposit amount meet the function requirements
    //         const SampleContract = await ethers.getContractFactory("SampleContract")
    //         const sampleContract = await SampleContract.deploy(yfUSDTContract.address, tokenAddress)
    //         await sampleContract.deployed()
    //         await token.transfer(sampleContract.address, 1000)
    //         expect(await token.balanceOf(sampleContract.address)).to.equal(1000)
    //         await sampleContract.approve()
    //         await expect(sampleContract.deposit()).to.be.revertedWith("Caller is a contract not EOA")
    //         await expect(yfUSDTContract.connect(clientSigner).deposit(0, 0)).to.be.revertedWith("Deposit Amount must be greater than 0")
    //         // Deposit 100 USDT to Yearn Earn contract and 200 to Yearn Vault Contract
    //         await token.connect(clientSigner).approve(yfUSDTContract.address, 10000000000)
    //         await yfUSDTContract.connect(clientSigner).deposit(100, 200)
    //         // Check if user should get correct deposit and shares amount
    //         // Check if user deposit successfully with correct amount
    //         const earnDepositAmount = await yfUSDTContract.earnDepositBalanceOf(clientAddress)
    //         const vaultDepositAmount = await yfUSDTContract.vaultDepositBalanceOf(clientAddress)
    //         // Deposit fee for amount < 10000 is 1% by default
    //         const earnDepositBalance = 100 - (100 * 1 / 100)
    //         const vaultDepositBalance = 200 - (200 * 1 / 100)
    //         expect(earnDepositAmount).to.equal(earnDepositBalance)
    //         expect(vaultDepositAmount).to.equal(vaultDepositBalance)
    //         // Get Yearn Earn shares off-chain
    //         const IYearnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
    //         const earnPool = await IYearnContract.calcPoolValueInToken()
    //         const earnTotalSupply = await IYearnContract.totalSupply()
    //         const earnShares = earnDepositAmount.mul(earnTotalSupply).div(earnPool)
    //         // Get Yearn Vault shares off-chain
    //         const IYvaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
    //         const vaultPool = await IYvaultContract.balance()
    //         const vaultTotalSupply = await IYvaultContract.totalSupply()
    //         const vaultShares = vaultDepositAmount.mul(vaultTotalSupply).div(vaultPool)
    //         // Check if balance shares of Yearn Earn contract and Yearn Vault contract return correctly
    //         expect(await yfUSDTContract.earnBalanceOf(clientAddress)).to.equal(earnShares)
    //         expect(await yfUSDTContract.vaultBalanceOf(clientAddress)).to.equal(vaultShares)
    //         // Check if correct daoUSDT token amount receive after deposit (same as total deposit amount of shares)
    //         expect(await yfUSDTContract.balanceOf(clientAddress)).to.equal(earnShares.add(vaultShares))
    //     })

        // it("should deduct correct fees from deposit amount based on tier", async () => {
        //     // Get signer and address of sender and deploy the contract
        //     const [senderSigner, _] = await ethers.getSigners()
        //     const senderAddress = await senderSigner.getAddress()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     await yfUSDTContract.deployed()
        //     // Check deduct deposit fee correctly in tier 1
        //     const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
        //     await token.approve(yfUSDTContract.address, 10000000000)
        //     let earnDepositBalance, vaultDepositBalance
        //     await yfUSDTContract.deposit(100, 200)
        //     // Deposit fee for amount < 10000 is 1% in tier 1 by default
        //     earnDepositBalance = 100 - (100 * 1 / 100)
        //     vaultDepositBalance = 200 - (200 * 1 / 100)
        //     expect(await yfUSDTContract.earnDepositBalanceOf(senderAddress)).to.equal(earnDepositBalance)
        //     expect(await yfUSDTContract.vaultDepositBalanceOf(senderAddress)).to.equal(vaultDepositBalance)
        //     // Check deduct deposit fee correctly in tier 2
        //     await yfUSDTContract.deposit(10000, 20000)
        //     // Deposit fee for amount > 10000 and amount <= 100000 is 0.5% in tier 2 by default
        //     earnDepositBalance = earnDepositBalance + (10000 - (10000 * 0.5 / 100))
        //     vaultDepositBalance = vaultDepositBalance + (20000 - (20000 * 0.5 / 100))
        //     expect(await yfUSDTContract.earnDepositBalanceOf(senderAddress)).to.equal(earnDepositBalance)
        //     expect(await yfUSDTContract.vaultDepositBalanceOf(senderAddress)).to.equal(vaultDepositBalance)
        //     // Check deduct deposit fee correctly in tier 3
        //     await yfUSDTContract.deposit(100000, 200000)
        //     // Deposit fee for amount > 100000 is 0.25% in tier 3 by default
        //     earnDepositBalance = earnDepositBalance + (100000 - (100000 * 0.25 / 100))
        //     vaultDepositBalance = vaultDepositBalance + (200000 - (200000 * 0.25 / 100))
        //     expect(await yfUSDTContract.earnDepositBalanceOf(senderAddress)).to.equal(earnDepositBalance)
        //     expect(await yfUSDTContract.vaultDepositBalanceOf(senderAddress)).to.equal(vaultDepositBalance)
        // })

        it("should withdraw earn and vault correctly", async () => {
            // Get signer and address of sender and deploy the contract
            const [senderSigner, clientSigner, _] = await ethers.getSigners()
            const senderAddress = await senderSigner.getAddress()
            const clientAddress = await clientSigner.getAddress()
            const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
            const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
            await yfUSDTContract.deployed()
            // Transfer some USDT to client
            const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
            await token.transfer(clientAddress, 1000)
            // Deposit some USDT into Yearn Farmer contract
            await token.connect(clientSigner).approve(yfUSDTContract.address, 1000)
            await yfUSDTContract.connect(clientSigner).deposit(100, 200)
            // Withdraw partial token from Yearn Earn in Yearn Farmer contract
            // Check if withdraw amount meet the function requirements
            await expect(yfUSDTContract.connect(clientSigner).withdrawEarn(0)).to.be.revertedWith("Amount must be greater than 0")
            await expect(yfUSDTContract.connect(clientSigner).withdrawEarn(1000)).to.be.revertedWith("Insufficient Balances")
            // Get earn and vault shares amout (withdraw function use this as parameter)
            const earnShares = await yfUSDTContract.earnBalanceOf(clientAddress)
            const vaultShares = await yfUSDTContract.vaultBalanceOf(clientAddress)
            // Convert profit into USDT off-chain
            const earnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
            let offChainWithdrawTokenAmount
            offChainWithdrawTokenAmount = ((await earnContract.calcPoolValueInToken()).mul(earnShares.sub(50))).div(await earnContract.totalSupply())
            // Execute withdraw function for Yearn Earn
            let clientTokenAmountBeforeWithdraw, clientTokenAmountAfterWithdraw
            clientTokenAmountBeforeWithdraw = await token.balanceOf(clientAddress)
            await yfUSDTContract.connect(clientSigner).withdrawEarn(earnShares.sub(50))
            // Check if USDT amount that transfer back to client correctly 
            clientTokenAmountAfterWithdraw = await token.balanceOf(clientAddress)
            expect(offChainWithdrawTokenAmount).to.equal(clientTokenAmountAfterWithdraw.sub(clientTokenAmountBeforeWithdraw))
            // Check if daoUSDT balance of client correctly after burned (earnShares amount of token burned, left vaultShares of amount)
            expect(await yfUSDTContract.balanceOf(clientAddress)).to.equal(vaultShares.add(50))
            // Check if return amount of function earnBalanceOf and earnDepositBalanceOf correct
        })

        // it("should able to return shares and deposit amount correctly", async () => {
        //     // Get address of owner and deploy the contract
        //     const [senderSigner, _] = await ethers.getSigners()
        //     const senderAddress = await senderSigner.getAddress()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
        //     const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
        //     await token.approve(yfUSDTContract.address, 1000)
        //     await yfUSDTContract.deposit(100, 200)
        //     // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after deposit fee return correctly
        //     // Deposit fee for amount < 10000 is 1% by default
        //     const earnDepositBalance = 100 - (100 * 1 / 100)
        //     const vaultDepositBalance = 200 - (200 * 1 / 100)
        //     const earnDepositAmount = await yfUSDTContract.earnDepositBalanceOf(senderAddress)
        //     const vaultDepositAmount = await yfUSDTContract.vaultDepositBalanceOf(senderAddress)
        //     expect(earnDepositAmount).to.equal(earnDepositBalance)
        //     expect(vaultDepositAmount).to.equal(vaultDepositBalance)
        //     // Get Yearn Earn shares off-chain
        //     const IYearnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, senderSigner)
        //     const earnPool = await IYearnContract.calcPoolValueInToken()
        //     const earnTotalSupply = await IYearnContract.totalSupply()
        //     const earnShares = earnDepositAmount.mul(earnTotalSupply).div(earnPool)
        //     // Get Yearn Vault shares off-chain
        //     const IYvaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, senderSigner)
        //     const vaultPool = await IYvaultContract.balance()
        //     const vaultTotalSupply = await IYvaultContract.totalSupply()
        //     const vaultShares = vaultDepositAmount.mul(vaultTotalSupply).div(vaultPool)
        //     // Check if balance shares of Yearn Earn contract and Yearn Vault contract return correctly
        //     expect(await yfUSDTContract.earnBalanceOf(senderAddress)).to.equal(earnShares)
        //     expect(await yfUSDTContract.vaultBalanceOf(senderAddress)).to.equal(vaultShares)
        // })

        // it("should approve Yearn Earn and Vault contract to deposit USDT from yfUSDT contract", async () => {
        //     // This function only execute one time and already execute while yfUSDT contract deployed.
        //     // User should ignore this function.

        //     // Get address of owner and deploy the contract
        //     const [senderSigner, _] = await ethers.getSigners()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     // Check if Yearn Earn and Vault contract can deposit a huge amount of USDT from yfUSDT contract
        //     const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
        //     await token.approve(yfUSDTContract.address, 500000000000000)
        //     await expect(yfUSDTContract.deposit(250000000000000, 250000000000000)).not.to.be.reverted
        // })
    })


    // Test admin functions
    describe("Admin functions", () => {
        // it("should able to transfer contract ownership to other address by contract owner only", async () => {
        //     // Get address of owner and new owner and deploy the contract
        //     const [ownerSigner, newOwnerSigner, _] = await ethers.getSigners()
        //     const ownerSignerAddress = await ownerSigner.getAddress()
        //     const newOwnerSignerAddress = await newOwnerSigner.getAddress()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", ownerSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     await yfUSDTContract.deployed()
        //     // Check if contract ownership is owner before transfer
        //     expect(await yfUSDTContract.owner()).to.equal(ownerSignerAddress)
        //     // Check if new owner cannot execute admin function yet
        //     await expect(yfUSDTContract.connect(newOwnerSigner).setProfileSharingFeePercentage(20)).to.be.reverted
        //     // Transfer contract ownership from owner to new owner
        //     await yfUSDTContract.transferOwnership(newOwnerSignerAddress)
        //     // Check if contract ownership is new owner after transfer
        //     expect(await yfUSDTContract.owner()).to.equal(newOwnerSignerAddress)
        //     // Check if new owner can execute admin function
        //     await expect(yfUSDTContract.connect(newOwnerSigner).setProfileSharingFeePercentage(20)).not.to.be.reverted
        //     // Check if original owner neither can execute admin function nor transfer back ownership
        //     await expect(yfUSDTContract.connect(ownerSigner).setProfileSharingFeePercentage(20)).to.be.reverted
        //     await expect(yfUSDTContract.connect(ownerSigner).transferOwnership(ownerSignerAddress)).to.be.reverted
        // })

        // it("should able to set new treasury wallet correctly", async () => {
        //     // Get address of sender and new treasury wallet and deploy the contract
        //     const [senderSigner, newTreasuryWalletSigner, _] = await ethers.getSigners()
        //     const newTreasuryWalletAddress = await newTreasuryWalletSigner.getAddress()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     await yfUSDTContract.deployed()
        //     // Check if only contract owner can execute this function
        //     await expect(yfUSDTContract.connect(newTreasuryWalletSigner).setTreasuryWallet(newTreasuryWalletAddress))
        //         .to.be.revertedWith("caller is not the owner")
        //     // Set new treasury wallet
        //     await yfUSDTContract.setTreasuryWallet(newTreasuryWalletAddress)
        //     // Check if new treasury wallet is set to the contract
        //     expect(await yfUSDTContract.treasuryWallet()).to.equal(newTreasuryWalletAddress)
        //     // Check if new treasury wallet receive fees
        //     const token = new ethers.Contract(tokenAddress, IERC20_ABI, senderSigner)
        //     await token.approve(yfUSDTContract.address, 1000)
        //     await yfUSDTContract.deposit(100, 200)
        //     // - 100 + 200 < 300 within deposit fee tier 1 hence fee = 1%
        //     expect(await token.balanceOf(newTreasuryWalletAddress)).to.equal(3)
        //     // Check if event for setTreasuryWallet function is logged (by set back original treasury wallet)
        //     await expect(yfUSDTContract.setTreasuryWallet(treasuryWalletAddress))
        //         .to.emit(yfUSDTContract, "SetTreasuryWallet")
        //         .withArgs(newTreasuryWalletAddress, treasuryWalletAddress)
        // })

        // it("should able to set new deposit fee tier correctly", async () => {
        //     // Get signer of sender and hacker and deploy the contract
        //     const [senderSigner, hackerSigner, _] = await ethers.getSigners()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     await yfUSDTContract.deployed()
        //     // Check if only contract owner can execute the function
        //     await expect(yfUSDTContract.connect(hackerSigner).setDepositFeeTier2([1, 2]))
        //         .to.be.revertedWith("caller is not the owner")
        //     // Check if function parameter meet the requirements
        //     await expect(yfUSDTContract.setDepositFeeTier2([0, 10000]))
        //         .to.be.revertedWith("Minimun amount cannot be 0")
        //     await expect(yfUSDTContract.setDepositFeeTier2([10000, 10000]))
        //         .to.be.revertedWith("Maximun amount must greater than minimun amount")
        //     // Set deposit fee tier 2 with minimun 50001 and maximun 500000 (default 10001, 100000)
        //     expect(await yfUSDTContract.depositFeeTier2(0)).to.equal(10001)
        //     expect(await yfUSDTContract.depositFeeTier2(1)).to.equal(100000)
        //     await yfUSDTContract.setDepositFeeTier2([50001, 500000])
        //     // Check if deposit fee tier 2 amount is set correctly
        //     expect(await yfUSDTContract.depositFeeTier2(0)).to.equal(50001)
        //     expect(await yfUSDTContract.depositFeeTier2(1)).to.equal(500000)
        //     // Check if event for setDepositFeeTier2() is log (by set back the default tier 2 amount)
        //     await expect(yfUSDTContract.setDepositFeeTier2([10001, 100000]))
        //         .to.emit(yfUSDTContract, "SetDepositFeeTier2")
        //         .withArgs([50001, 500000], [10001, 100000]) // [oldDepositFeeTier2, newDepositFeeTier2]
        // })

        // it("should able to set new deposit fee percentage correctly", async () => {
        //     // Get signer of sender and hacker and deploy the contract
        //     const [senderSigner, hackerSigner, _] = await ethers.getSigners()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     await yfUSDTContract.deployed()
        //     // Check if only contract owner can execute the function
        //     // 100 = 1%
        //     await expect(yfUSDTContract.connect(hackerSigner).setDepositFeePercentage([3900, 3900, 3900]))
        //         .to.be.revertedWith("caller is not the owner")
        //     // Check if function parameter meet the requirements
        //     await expect(yfUSDTContract.setDepositFeePercentage([4000, 0, 0]))
        //         .to.be.revertedWith("Deposit fee percentage cannot be more than 40%")
        //     await expect(yfUSDTContract.setDepositFeePercentage([0, 4000, 0]))
        //         .to.be.revertedWith("Deposit fee percentage cannot be more than 40%")
        //     await expect(yfUSDTContract.setDepositFeePercentage([0, 0, 4000]))
        //         .to.be.revertedWith("Deposit fee percentage cannot be more than 40%")
        //     // Set deposit fee percentage to tier1 2%, tier2 1%, tier3 0.5% (default tier1 1%, tier2 0.5%, tier3 0.25%)
        //     expect(await yfUSDTContract.depositFeePercentage(0)).to.equal(100)
        //     expect(await yfUSDTContract.depositFeePercentage(1)).to.equal(50)
        //     expect(await yfUSDTContract.depositFeePercentage(2)).to.equal(25)
        //     await yfUSDTContract.setDepositFeePercentage([200, 100, 50])
        //     // Check if deposit fee percentage is set correctly
        //     expect(await yfUSDTContract.depositFeePercentage(0)).to.equal(200)
        //     expect(await yfUSDTContract.depositFeePercentage(1)).to.equal(100)
        //     expect(await yfUSDTContract.depositFeePercentage(2)).to.equal(50)
        //     // Check if event for setDepositFeePercentage() is log (by set back the default deposit fee percentage)
        //     await expect(yfUSDTContract.setDepositFeePercentage([100, 50, 25]))
        //         .to.emit(yfUSDTContract, "SetDepositFeePercentage")
        //         .withArgs([200, 100, 50], [100, 50, 25]) // [oldDepositFeePercentage, newDepositFeePercentage]
        // })

        // it("should able to set new profile sharing fee percentage correctly", async () => {
        //     // Get signer of sender and hacker and deploy the contract
        //     const [senderSigner, hackerSigner, _] = await ethers.getSigners()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     await yfUSDTContract.deployed()
        //     // Check if only contract owner can execute the function
        //     await expect(yfUSDTContract.connect(hackerSigner).setProfileSharingFeePercentage(39))
        //         .to.be.revertedWith("caller is not the owner")
        //     // Check if function parameter meet the requirements
        //     await expect(yfUSDTContract.setProfileSharingFeePercentage(40))
        //         .to.be.revertedWith("Profile sharing fee percentage cannot be more than 40%")
        //     // Set profile sharing fee percentage to 20% (default 10%)
        //     expect(await yfUSDTContract.profileSharingFeePercentage()).to.equal(10)
        //     await yfUSDTContract.setProfileSharingFeePercentage(20)
        //     // Check if profile sharing fee percentage is set correctly
        //     expect(await yfUSDTContract.profileSharingFeePercentage()).to.equal(20)
        //     // Check if event for setProfileSharingFeePercentage() is log (by set back the default profile sharing fee percentage)
        //     await expect(yfUSDTContract.setProfileSharingFeePercentage(10))
        //         .to.emit(yfUSDTContract, "SetProfileSharingFeePercentage")
        //         .withArgs(20, 10) // [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]
        // })

        // it("should able to set new Yearn Earn contract correctly", async () => {
        //     // Get signer of sender, malicious account and new Yearn Earn contract and deploy the contract
        //     const [senderSigner, maliciousSigner, newYEarnContract, _] = await ethers.getSigners()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     await yfUSDTContract.deployed()
        //     // Check if only contract owner can execute the function
        //     await expect(yfUSDTContract.connect(maliciousSigner).setEarn(await maliciousSigner.getAddress()))
        //         .to.be.revertedWith("caller is not the owner")
        //     // Set new Yearn Earn contract
        //     expect(await yfUSDTContract.earn()).to.equal(yEarnAddress)
        //     newYEarnContractAddress = await newYEarnContract.getAddress()
        //     await yfUSDTContract.setEarn(newYEarnContractAddress)
        //     // Check if new Yearn Earn contract is set correctly
        //     expect(await yfUSDTContract.earn()).to.equal(newYEarnContractAddress)
        //     // Check if event for setEarn() is log (by set back the default Yearn Earn contract)
        //     await expect(yfUSDTContract.setEarn(yEarnAddress))
        //         .to.emit(yfUSDTContract, "SetEarn")
        //         .withArgs(newYEarnContractAddress, yEarnAddress) // [old Yearn Earn contract Address, new Yearn Earn contract Address]
        // })

        // it("should able to set new Yearn Vault contract correctly", async () => {
        //     // Get signer of sender, malicious account and new Yearn Vault contract and deploy the contract
        //     const [senderSigner, maliciousSigner, newYVaultContract, _] = await ethers.getSigners()
        //     const YfUSDTContract = await ethers.getContractFactory("yfUSDT", senderSigner)
        //     const yfUSDTContract = await YfUSDTContract.deploy(tokenAddress, yEarnAddress, yVaultAddress, treasuryWalletAddress)
        //     await yfUSDTContract.deployed()
        //     // Check if only contract owner can execute the function
        //     await expect(yfUSDTContract.connect(maliciousSigner).setVault(await maliciousSigner.getAddress()))
        //         .to.be.revertedWith("caller is not the owner")
        //     // Set new Yearn Vault contract
        //     expect(await yfUSDTContract.vault()).to.equal(yVaultAddress)
        //     newYVaultContractAddress = await newYVaultContract.getAddress()
        //     await yfUSDTContract.setVault(newYVaultContractAddress)
        //     // Check if new Yearn Vault contract is set correctly
        //     expect(await yfUSDTContract.vault()).to.equal(newYVaultContractAddress)
        //     // Check if event for setVault() is log (by set back the default Yearn Vault contract)
        //     await expect(yfUSDTContract.setVault(yVaultAddress))
        //         .to.emit(yfUSDTContract, "SetVault")
        //         .withArgs(newYVaultContractAddress, yVaultAddress) // [old Yearn Vault contract Address, new Yearn Vault contract Address]
        // })

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
})
