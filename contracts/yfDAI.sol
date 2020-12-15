// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IYearn.sol";
import "../interfaces/IYvault.sol";

contract yfDAI is ERC20, Ownable {
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
  uint public feePercentages = 20;
  uint256 public unlockDate;
  uint256 private _earnTotalSupply;
  uint256 private _vaultTotalSupply;

  IYearn public earn;
  IYvault public vault;
  uint public constant MAX_UINT = 2**256 - 2;

  constructor(address _token, address _earn, address _vault) public 
    ERC20("DAO DAI", "daoDAI") {
      _setupDecimals(18);
      token = IERC20(_token);
      earn = IYearn(address(_earn));
      vault = IYvault(address(_vault));
      approvePooling();
  }

  function setFeePercentages(uint _percentage) public onlyOwner {
    feePercentages = _percentage;
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
    require(isVesting == false, "Unable to deposit funds. The funds are vested. ");
    require(earnAmount > 0 || vaultAmount > 0, "Deposit Amount must be greater than 0");
    
    uint depositAmount = earnAmount.add(vaultAmount);

    token.safeTransferFrom(msg.sender, address(this), depositAmount);

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
    require(isVesting == false, "Unable to withdraw funds. The funds are vested. ");
    require(_shares > 0, "Amount must be greater than 0");
    require(earnBalanceOf(msg.sender) >= _shares, "Insufficient Balances");

    uint256 d = _shares.mul(earnDepositAmount[msg.sender]).div(earnBalances[msg.sender]); // Initial Deposit Amount
    uint256 r = (earn.calcPoolValueInToken().mul(_shares)).div(earn.totalSupply()); // Convert profit into USDT

    earn.withdraw(_shares);
    earnPool = earnPool.sub(_shares);
    earnBalances[msg.sender] = earnBalances[msg.sender].sub(_shares, "redeem amount exceeds balance");
    _burn(msg.sender, _shares);

    if (r > d) {
      uint256 p = r.sub(d); // Profit
      uint256 fees = p.mul(feePercentages).div(100);
      token.safeTransfer(msg.sender, r.sub(fees)); // Take Fees Percentages from Profit
    } else {
      token.safeTransfer(msg.sender, r);
    }
    
    earnDepositAmount[msg.sender] = earnDepositAmount[msg.sender].sub(_shares, "redeem amount exceeds balance");
  }

  function withdrawVault(uint _shares) public {
    require(isVesting == false, "Unable to withdraw funds. The funds are vested. ");
    require(_shares > 0, "Amount must be greater than 0");
    require(vaultBalanceOf(msg.sender) >= _shares, "Insufficient Balances");

    uint256 d = _shares.mul(vaultDepositAmount[msg.sender]).div(vaultBalances[msg.sender]); // Initial Deposit Amount
    uint256 r = (vault.balance().mul(_shares)).div(vault.totalSupply()); // Convert profit into USDT

    vault.withdraw(_shares);
    vaultPool = vaultPool.sub(_shares);
    vaultBalances[msg.sender] = vaultBalances[msg.sender].sub(_shares, "redeem amount exceeds balance");
    _burn(msg.sender, _shares);

    if (r > d) {
      uint256 p = r.sub(d); // Profit
      uint256 fees = p.mul(feePercentages).div(100);
      token.safeTransfer(msg.sender, r.sub(fees)); // Take Fees Percentages from Profit
    } else {
      token.safeTransfer(msg.sender, r);
    }
    
    vaultDepositAmount[msg.sender] = vaultDepositAmount[msg.sender].sub(_shares, "redeem amount exceeds balance");
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
    require(isVesting == true, "The funds must be vested before refund.");

    uint shares = earnBalances[msg.sender];
    earnBalances[msg.sender] = uint(0);
    uint256 r = shares.div(_earnTotalSupply).mul(earnPrice);
    uint256 d = earnDepositAmount[msg.sender];

    if (r > d) {
      uint256 p = r.sub(d);
      uint256 fees = p.mul(feePercentages).div(100);
      token.safeTransfer(msg.sender, r.sub(fees)); // Take Fees Percentages from Profit
    } else {
      token.safeTransfer(msg.sender, r);
    }
    _burn(msg.sender, shares);
    earnDepositAmount[msg.sender] = uint(0);
  }

  function refundVault() public {
    require(isVesting == true, "The funds must be vested before refund.");

    uint shares = vaultBalances[msg.sender];
    vaultBalances[msg.sender] = uint(0);
    uint256 r = shares.div(_vaultTotalSupply).mul(vaultPrice);
    uint256 d = vaultDepositAmount[msg.sender];

    if (r > d) {
      uint256 p = r.sub(d);
      uint256 fees = p.mul(feePercentages).div(100);
      token.safeTransfer(msg.sender, r.sub(fees)); // Take Fees Percentages from Profit
    } else {
      token.safeTransfer(msg.sender, r);
    }
    
    _burn(msg.sender, shares);
    vaultDepositAmount[msg.sender] = uint(0);
  }
}