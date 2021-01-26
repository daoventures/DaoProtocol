// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IYearn.sol";
import "../interfaces/IYvault.sol";

import "hardhat/console.sol";

contract yfUSDT is ERC20, Ownable {
  /**
  * Inherit from Ownable contract enable contract ownership transferable
  * Function: transferOwnership(newOwnerAddress)
  * Only current owner is able to call the function
  */

  using SafeERC20 for IERC20;
  using Address for address;
  using SafeMath for uint256;

  IERC20 public token;
  mapping (address => uint256) private earnBalances;
  mapping (address => uint256) private vaultBalances;
  mapping (address => uint256) private earnDepositAmount;
  mapping (address => uint256) private vaultDepositAmount;
  uint256 public earnPool;
  uint256 public vaultPool;
  uint public earnPrice;
  uint public vaultPrice;
  bool public isVesting = false;
  uint[] public depositFeeTier2 = [10001, 100000]; // [tier2 minimun, tier2 maximun]
  uint[] public depositFeePercentage = [100, 50, 25]; // [Tier 1, Tier 2, Tier 3], initial value represent [1%, 0.5%, 0.25%]
  uint public profileSharingFeePercentage = 10;
  uint256 public unlockDate;
  uint256 private _earnTotalSupply;
  uint256 private _vaultTotalSupply;

  address private treasuryWallet;

  IYearn public earn;
  IYvault public vault;
  uint public constant MAX_UINT = 2**256 - 2;

  constructor(address _token, address _earn, address _vault, address _treasuryWallet) public 
    ERC20("DAO Tether USDT", "daoUSDT") { // ********** This need to be change and create new .sol file for DAI, USDC and TUSD **********
      _setupDecimals(6);
      token = IERC20(_token);

      earn = IYearn(address(_earn));
      vault = IYvault(address(_vault));
      approvePooling();

      treasuryWallet = _treasuryWallet;
  }

  function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
    treasuryWallet = _treasuryWallet;
  }

  function setDepositFeeTier(uint[] calldata _depositFeeTier2) external onlyOwner {
    require(_depositFeeTier2[0] != 0); // First amount(minimun) cannot be 0
    require(_depositFeeTier2[1] > _depositFeeTier2[0]); // Second amount(maximun) must be greater than first amount(minimun)
    /**
    * Deposit fees have three tier, but it is enough to have minimun and maximun amount of tier 2
    * Tier 1: deposit amount < minimun amount of tier 2
    * Tier 2: minimun amount of tier 2 <= deposit amount <= maximun amount of tier 2
    * Tier 3: amount > maximun amount of tier 2
    */
    depositFeeTier2 = _depositFeeTier2;
  }

  function setDepositFeePercentage(uint[] calldata _depositFeePercentage) external onlyOwner {
    /** 
    * _depositFeePercentage content a list of 3 element, representing deposit fee of tier 1, tier 2 and tier 3
    * For example depositFeePercentage is [100, 50, 25]
    * which mean deposit fee for Tier 1 = 1%, Tier 2 = 0.5% and Tier 3 = 0.25%
    */
    require(
      // Deposit fee percentage cannot be more than 40%
      _depositFeePercentage[0] < 400 ||
      _depositFeePercentage[1] < 400 ||
      _depositFeePercentage[2] < 400
    );
    depositFeePercentage = _depositFeePercentage;
  }

  function setProfileSharingFeePercentage(uint _percentage) public onlyOwner {
    require(_percentage < 40); // Profile sharing fee percentage cannot be more than 40%
    profileSharingFeePercentage = _percentage;
  }

  function setEarn(address _contract) public onlyOwner {
    earn = IYearn(address(_contract));
  }

  function setVault(address _contract) public onlyOwner {
    vault = IYvault(address(_contract));
  }

  function approvePooling() public {
    uint256 earnAllowance = token.allowance(address(this), address(earn));
    if (earnAllowance == uint256(0)) {
      token.safeApprove(address(earn), MAX_UINT);
    }

    uint256 vaultAllowance = token.allowance(address(this), address(vault));
    if (vaultAllowance == uint256(0)) {
      token.safeApprove(address(vault), MAX_UINT);
    }
  }

  function earnBalanceOf(address _address) public view returns (uint256) {
    return earnBalances[_address];
  }

  function vaultBalanceOf(address _address) public view returns (uint256) {
    return vaultBalances[_address];
  }

  function earnDepositBalanceOf(address _address) public view returns (uint256) {
    return earnDepositAmount[_address];
  }

  function vaultDepositBalanceOf(address _address) public view returns (uint256) {
    return vaultDepositAmount[_address];
  }

  function deposit(uint earnAmount, uint vaultAmount) public {
    require(address(msg.sender).isContract() == false, "Caller is a contract not EOA");
    require(isVesting == false, "Unable to deposit funds. The funds are vested. ");
    require(earnAmount > 0 || vaultAmount > 0, "Deposit Amount must be greater than 0");
    
    uint depositAmount = earnAmount.add(vaultAmount);

    token.safeTransferFrom(msg.sender, address(this), depositAmount);

    /**
    * v2: Deposit fees
    * depositFeeTier2 is used to set each tier minimun and maximun
    * For example depositFeeTier2 is [10000, 100000],
    * Tier 1 = depositAmount < 10000
    * Tier 2 = 10000 <= depositAmount <= 100000
    * Tier 3 = depositAmount > 100000
    *
    * depositFeePercentage is used to set each tier deposit fee percentage
    * For example depositFeePercentage is [100, 50, 25]
    * which mean deposit fee for Tier 1 = 1%, Tier 2 = 0.5%, Tier 3 = 0.25%
    */
    if (depositAmount < depositFeeTier2[0]) {
      // Tier 1
      earnAmount = earnAmount.sub(earnAmount.mul(depositFeePercentage[0]).div(10000));
      vaultAmount = vaultAmount.sub(vaultAmount.mul(depositFeePercentage[0]).div(10000));
      uint totalDepositFee = depositAmount.mul(depositFeePercentage[0]).div(10000);
      token.safeTransfer(treasuryWallet, totalDepositFee);
    } else if (depositAmount >= depositFeeTier2[0] && depositAmount <= depositFeeTier2[1]) {
      // Tier 2
      earnAmount = earnAmount.sub(earnAmount.mul(depositFeePercentage[1]).div(10000));
      vaultAmount = vaultAmount.sub(vaultAmount.mul(depositFeePercentage[1]).div(10000));
      uint totalDepositFee = depositAmount.mul(depositFeePercentage[1]).div(10000);
      token.safeTransfer(treasuryWallet, totalDepositFee);
    } else {
      // Tier 3
      earnAmount = earnAmount.sub(earnAmount.mul(depositFeePercentage[2]).div(10000));
      vaultAmount = vaultAmount.sub(vaultAmount.mul(depositFeePercentage[2]).div(10000));
      uint totalDepositFee = depositAmount.mul(depositFeePercentage[2]).div(10000);
      token.safeTransfer(treasuryWallet, totalDepositFee);
    }

    // Calculate pool shares
    uint256 shares = 0;

    if (earnAmount > 0) {
      uint256 pool = earn.calcPoolValueInToken();
      uint256 earnShares = 0;
      if (pool == 0) {
        earnShares = earnAmount;
        pool = earnAmount;
      } else {
        earnShares = (earnAmount.mul(earn.totalSupply())).div(pool);
      }

      if (earnBalances[msg.sender] == 0) {
        earnBalances[msg.sender] = earnShares;
      } else {
        earnBalances[msg.sender] = earnBalances[msg.sender].add(earnShares);
      } 
      earn.deposit(earnAmount); // Deposit first to ensure success transaction before adding own accounting tokens
      shares = shares.add(earnShares);
      earnPool = earnPool.add(earnShares);
      
      if (earnDepositAmount[msg.sender] == 0) {
        earnDepositAmount[msg.sender] = earnAmount;
      } else {
        earnDepositAmount[msg.sender] = earnDepositAmount[msg.sender].add(earnAmount);
      }
    }

    if (vaultAmount > 0) {
      uint256 pool = vault.balance();
      uint256 vaultShares = 0;
      if (pool == 0) {
        vaultShares = vaultAmount;
        pool = vaultAmount;
      } else {
        vaultShares = (vaultAmount.mul(vault.totalSupply())).div(pool);
      }

      if (vaultBalances[msg.sender] == 0) {
        vaultBalances[msg.sender] = vaultShares;
      } else {
        vaultBalances[msg.sender] = vaultBalances[msg.sender].add(vaultShares);
      }
      vault.deposit(vaultAmount); // Deposit first to ensure success transaction before adding own accounting tokens
      shares = shares.add(vaultShares);
      vaultPool = vaultPool.add(vaultShares);

      if (vaultDepositAmount[msg.sender] == 0) {
        vaultDepositAmount[msg.sender] = vaultAmount;
      } else {
        vaultDepositAmount[msg.sender] = vaultDepositAmount[msg.sender].add(vaultAmount);
      }
    }

    _mint(msg.sender, shares);
  }

  function withdrawEarn(uint _shares) public {
    require(address(msg.sender).isContract() == false); // Caller is a contract not EOA
    require(isVesting == false, "Unable to withdraw funds. The funds are vested.");
    require(_shares > 0, "Amount must be greater than 0");
    require(earnBalanceOf(msg.sender) >= _shares, "Insufficient Balances");

    uint256 d = _shares.mul(earnDepositAmount[msg.sender]).div(earnBalances[msg.sender]); // Initial Deposit Amount
    uint256 r = (earn.calcPoolValueInToken().mul(_shares)).div(earn.totalSupply()); // Convert profit into USDT
    // uint256 r = 200;

    earn.withdraw(_shares);
    earnPool = earnPool.sub(_shares);
    earnBalances[msg.sender] = earnBalances[msg.sender].sub(_shares, "redeem amount exceeds balance");
    _burn(msg.sender, _shares);

    if (r > d) {
      uint256 p = r.sub(d); // Profit
      uint256 fees = p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(msg.sender, r.sub(fees)); // Take Fees Percentages from Profit
      token.safeTransfer(treasuryWallet, fees);
    } else {
      token.safeTransfer(msg.sender, r);
    }
    
    earnDepositAmount[msg.sender] = earnDepositAmount[msg.sender].sub(d, "redeem amount exceeds balance");
  }

  function withdrawVault(uint _shares) public {
    require(address(msg.sender).isContract() == false); // Caller is a contract not EOA
    require(isVesting == false, "Unable to withdraw funds. The funds are vested.");
    require(_shares > 0, "Amount must be greater than 0");
    require(vaultBalanceOf(msg.sender) >= _shares, "Insufficient Balances");

    uint256 d = _shares.mul(vaultDepositAmount[msg.sender]).div(vaultBalances[msg.sender]); // Initial Deposit Amount
    uint256 r = (vault.balance().mul(_shares)).div(vault.totalSupply()); // Convert profit into USDT
    // uint256 r = 400;

    vault.withdraw(_shares);
    vaultPool = vaultPool.sub(_shares);
    vaultBalances[msg.sender] = vaultBalances[msg.sender].sub(_shares, "redeem amount exceeds balance");
    _burn(msg.sender, _shares);

    if (r > d) {
      uint256 p = r.sub(d); // Profit
      uint256 fees = p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(msg.sender, r.sub(fees)); // Take Fees Percentages from Profit
      token.safeTransfer(treasuryWallet, fees);
    } else {
      token.safeTransfer(msg.sender, r);
    }
    
    vaultDepositAmount[msg.sender] = vaultDepositAmount[msg.sender].sub(d, "redeem amount exceeds balance");
  }

  function vesting() public onlyOwner {
    require(isVesting == false, "The funds are collected.");

    isVesting = true;
    _earnTotalSupply = earn.totalSupply();
    earnPrice = (earn.calcPoolValueInToken().mul(earnPool)).div(_earnTotalSupply);
    earn.withdraw(earnPool);
    earnPool = uint256(0);

    _vaultTotalSupply = vault.totalSupply();
    vaultPrice = (vault.balance().mul(vaultPool)).div(_vaultTotalSupply);
    vault.withdraw(vaultPool);
    vaultPool = uint256(0);

    unlockDate = now.add(1 days); // Set Current Block Timestamp
  }

  function revertContract() public onlyOwner {
    require(isVesting == true, "It only can be reverted when the funds are vested.");
    require(now >= unlockDate, "Revert contract only can be made after 24 hours of vesting.");

    isVesting = false;
    earnPrice = uint(0);
    vaultPrice = uint(0);
    unlockDate = uint(0);
  }

  function refundEarn() public {
    require(address(msg.sender).isContract() == false); // Caller is a contract not EOA
    require(isVesting == true, "The funds must be vested before refund.");

    uint shares = earnBalances[msg.sender];
    earnBalances[msg.sender] = uint(0);
    uint256 r = shares.div(_earnTotalSupply).mul(earnPrice);
    uint256 d = earnDepositAmount[msg.sender];

    if (r > d) {
      uint256 p = r.sub(d);
      uint256 fees = p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(msg.sender, r.sub(fees)); // Take Fees Percentages from Profit
    } else {
      token.safeTransfer(msg.sender, r);
    }
    _burn(msg.sender, shares);
    earnDepositAmount[msg.sender] = uint(0);
  }

  function refundVault() public {
    require(address(msg.sender).isContract() == false); // Caller is a contract not EOA
    require(isVesting == true, "The funds must be vested before refund.");

    uint shares = vaultBalances[msg.sender];
    vaultBalances[msg.sender] = uint(0);
    uint256 r = shares.div(_vaultTotalSupply).mul(vaultPrice);
    uint256 d = vaultDepositAmount[msg.sender];

    if (r > d) {
      uint256 p = r.sub(d);
      uint256 fees = p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(msg.sender, r.sub(fees)); // Take Fees Percentages from Profit
    } else {
      token.safeTransfer(msg.sender, r);
    }
    
    _burn(msg.sender, shares);
    vaultDepositAmount[msg.sender] = uint(0);
  }
}