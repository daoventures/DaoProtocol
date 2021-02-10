// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/// @title OpenZeppelin libraries
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/// @dev Interface of Yearn Finance Earn and Vault contract
import "../interfaces/IYearn.sol";
import "../interfaces/IYvault.sol";

// For debugging use, will be removed in production
import "hardhat/console.sol";

/// @title Contract for utilize USDT in Yearn Finance contract
contract yfUSDTv2 is ERC20, Ownable {
  /**
   * @dev Inherit from Ownable contract enable contract ownership transferable
   * Function: transferOwnership(newOwnerAddress)
   * Only current owner is able to call the function
   */

  using SafeERC20 for IERC20;
  using Address for address;
  using SafeMath for uint;

  IERC20 public token;
  IYearn public earn;
  IYvault public vault;
  uint public constant MAX_UNIT = 2**256 - 2;
  mapping (address => uint) private earnDepositAmount;
  mapping (address => uint) private vaultDepositAmount;
  uint public pool;

  address public treasuryWallet; // Address that collecting fees

  uint[] public depositFeeTier2 = [10001, 100000]; // Represent [tier2 minimun, tier2 maximun], initial value represent Tier 2 from 10001 to 100000
  uint[] public depositFeePercentage = [100, 50, 25]; // Represent [Tier 1, Tier 2, Tier 3], initial value represent [1%, 0.5%, 0.25%]
  uint public profileSharingFeePercentage = 10;

  bool public isVesting = false;

  // Timelock related variable
  enum Functions { WALLET, FEETIER, D_FEEPERC, W_FEEPERC, VEST, MIGRATE }
  uint private constant _TIMELOCK = 1 days;
  mapping(Functions => uint) public timelock;
  address public newStrategy;

  event SetTreasuryWallet(address indexed oldTreasuryWallet, address indexed newTreasuryWallet);
  event SetDepositFeeTier2(uint[] oldDepositFeeTier2, uint[] newDepositFeeTier2);
  event SetDepositFeePercentage(uint[] oldDepositFeePercentage, uint[] newDepositFeePercentage);
  event SetProfileSharingFeePercentage(uint indexed oldProfileSharingFeePercentage, uint indexed newProfileSharingFeePercentage);

  constructor(address _earn, address _vault, address _treasuryWallet) 
    ERC20("DAO Tether USDT", "daoUSDT") { // ********** This need to be change and create new .sol file for DAI, USDC and TUSD **********
      _setupDecimals(6); // ********** This need to be change to 18 for yfDAI.sol and yfTUSD.sol **********
      token = IERC20(address(0xdAC17F958D2ee523a2206206994597C13D831ec7)); // ********** This need to be change to respective address for DAI, USDC and TUSD **********

      earn = IYearn(address(_earn));
      vault = IYvault(address(_vault));
      approvePooling();

      treasuryWallet = _treasuryWallet;
  }

  /**
   * @notice This function revert transaction if admin function is locked
   * @notice All admin function are locked by default
   * @dev Run unlockFunction() to unlock the admin function
   * @param _fn enum Functions
   */
  modifier notLocked(Functions _fn) {
    require(timelock[_fn] != 0 && timelock[_fn] <= block.timestamp, "Function is locked");
    _;
  }

  /**
   * @notice Unlock admin function. All admin function unlock time is 1 day except migrate funds(5 days)
   * @param _fn A number that represent enum Functions
   * @dev 0 = WALLET, 1 = FEETIER, ..., 5 = MIGRATE
   * Requirements:
   * - Only contract owner can call this function
   */
  function unlockFunction(Functions _fn) external onlyOwner {
    if (_fn == Functions.MIGRATE) {
      timelock[_fn] = block.timestamp.add(_TIMELOCK.mul(5));
    } else {
      timelock[_fn] = block.timestamp.add(_TIMELOCK);
    }
  }

  /**
   * @notice Set new treasury wallet address in contract
   * @param _treasuryWallet Address of new treasury wallet
   * Requirements:
   * - Only contract owner can call this function
   * - This contract is not locked
   */
  function setTreasuryWallet(address _treasuryWallet) external onlyOwner notLocked(Functions.WALLET) {
    emit SetTreasuryWallet(treasuryWallet, _treasuryWallet);
    treasuryWallet = _treasuryWallet;
    timelock[Functions.WALLET] = 0;
  }

  /**
   * @notice Function to set deposit fee tier
   * @notice Details for deposit fee tier can view at deposit() function below
   * @param _depositFeeTier2  Array [tier2 minimun, tier2 maximun], view additional info below
   * Requirements:
   * - Only contract owner can call this function
   * - This contract is not locked
   * - First element in array must greater than 0
   * - Second element must greater than first element
   */
  function setDepositFeeTier2(uint[] calldata _depositFeeTier2) external onlyOwner notLocked(Functions.FEETIER) {
    require(_depositFeeTier2[0] != 0, "Minimun amount cannot be 0");
    require(_depositFeeTier2[1] > _depositFeeTier2[0], "Maximun amount must greater than minimun amount");
    /**
     * Deposit fees have three tier, but it is sufficient to have minimun and maximun amount of tier 2
     * Tier 1: deposit amount < minimun amount of tier 2
     * Tier 2: minimun amount of tier 2 <= deposit amount <= maximun amount of tier 2
     * Tier 3: amount > maximun amount of tier 2
     */
    emit SetDepositFeeTier2(depositFeeTier2, _depositFeeTier2);
    depositFeeTier2 = _depositFeeTier2;
    timelock[Functions.FEETIER] = 0;
  }

  /**
   * @notice Set deposit fee in percentage
   * @param _depositFeePercentage An array of integer, view additional info below
   * Requirements:
   * - Only contract owner can call this function
   * - This contract is not locked
   * - Each of the element in the array must less than 4000 (40%) 
   */
  function setDepositFeePercentage(uint[] calldata _depositFeePercentage) external onlyOwner notLocked(Functions.D_FEEPERC) {
    /** 
     * _depositFeePercentage content a array of 3 element, representing deposit fee of tier 1, tier 2 and tier 3
     * For example depositFeePercentage is [100, 50, 25]
     * which mean deposit fee for Tier 1 = 1%, Tier 2 = 0.5% and Tier 3 = 0.25%
     */
    require(
      _depositFeePercentage[0] < 4000 &&
      _depositFeePercentage[1] < 4000 &&
      _depositFeePercentage[2] < 4000, "Deposit fee percentage cannot be more than 40%"
    );
    emit SetDepositFeePercentage(depositFeePercentage, _depositFeePercentage);
    depositFeePercentage = _depositFeePercentage;
    timelock[Functions.D_FEEPERC] = 0;
  }

  /**
   * @notice Set profile sharing(withdraw with profit) fee in percentage
   * @param _percentage Integar that represent actual percentage
   * Requirements:
   * - Only contract owner can call this function
   * - This contract is not locked
   * - Amount set must less than 40 (40%)
   */
  function setProfileSharingFeePercentage(uint _percentage) public onlyOwner notLocked(Functions.W_FEEPERC) {
    require(_percentage < 40, "Profile sharing fee percentage cannot be more than 40%");
    emit SetProfileSharingFeePercentage(profileSharingFeePercentage, _percentage);
    profileSharingFeePercentage = _percentage;
    timelock[Functions.W_FEEPERC] = 0;
  }

  /**
   * @notice Approve Yearn Finance contracts to deposit token from this contract
   * @dev This function only need execute once in contract contructor
   */
  function approvePooling() public {
    // Allow Yearn Earn contract to transfer USDT from this contract
    uint earnAllowance = token.allowance(address(this), address(earn));
    if (earnAllowance == uint(0)) {
      token.safeApprove(address(earn), MAX_UNIT);
    }
    // Allow Yearn Vault contract to transfer USDT from this contract
    uint vaultAllowance = token.allowance(address(this), address(vault));
    if (vaultAllowance == uint(0)) {
      token.safeApprove(address(vault), MAX_UNIT);
    }
  }

  /**
   * @notice Get Yearn Earn current total deposit amount of account (after deposit fee)
   * @param _address Address of account to check
   * @return Current total deposit amount of account in Yearn Earn (after deposit fee). 0 if contract is in vesting state.
   * Requirements:
   * - This contract is not in vesting state
   */
  function getEarnDepositAmount(address _address) external view returns (uint) {
    if (isVesting == true) {
      return 0;
    } else {
      return earnDepositAmount[_address];
    }
  }

  /**
   * @notice Get Yearn Vault current total deposit amount of account (after deposit fee)
   * @param _address Address of account to check
   * @return Current total deposit amount of account in Yearn Vault (after deposit fee). 0 if contract is in vesting state.
   * Requirements:
   * - This contract is not in vesting state
   */
  function getVaultDepositAmount(address _address) external view returns (uint) {
    if (isVesting == true) {
      return 0;
    } else {
      return vaultDepositAmount[_address];
    }
  }

  /**
   * @notice Deposit USDT into Yearn Earn and Vault contract
   * @notice Sender get daoUSDT token based on shares after deposit
   * @param earnAmount amount of earn in deposit
   * @param vaultAmount amount of vault in deposit
   * Requirements:
   * - Sender must approve this contract to transfer USDT from sender to this contract
   * - Sender must be an EOA account
   * - This contract is not in vesting state
   * - Either earn deposit or vault deposit must greater than 0
   */
  function deposit(uint earnAmount, uint vaultAmount) public {
    require(address(msg.sender).isContract() == false, "Caller is a contract not EOA");
    require(isVesting == false, "Contract in vesting state");
    require(earnAmount > 0 || vaultAmount > 0, "Deposit Amount must be greater than 0");
    
    uint depositAmount = earnAmount.add(vaultAmount);
    token.safeTransferFrom(msg.sender, address(this), depositAmount);

    /**
     * v2: Deposit fees
     * depositFeeTier2 is used to set each tier minimun and maximun
     * For example depositFeeTier2 is [10000, 100000],
     * Tier 1 = depositAmount < 10001
     * Tier 2 = 10001 <= depositAmount <= 100000
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

    // Deposit to Yearn Earn
    if (earnAmount > 0) {
      uint earnPool = earn.calcPoolValueInToken();
      uint earnShares = 0;
      if (earnPool == 0) {
        earnShares = earnAmount;
      } else {
        earnShares = (earnAmount.mul(earn.totalSupply())).div(earnPool);
      }

      earn.deposit(earnAmount);
      earnDepositAmount[msg.sender] = earnDepositAmount[msg.sender].add(earnAmount);
    }

    // Deposit to Yearn Vault
    if (vaultAmount > 0) {
      uint vaultPool = vault.balance();
      uint vaultShares = 0;
      if (vaultPool == 0) {
        vaultShares = vaultAmount;
      } else {
        vaultShares = (vaultAmount.mul(vault.totalSupply())).div(vaultPool);
      }

      vault.deposit(vaultAmount);
      vaultDepositAmount[msg.sender] = vaultDepositAmount[msg.sender].add(vaultAmount);
    }

    // Mint daoUSDT to sender
    uint shares = 0;
    if (totalSupply() == 0) {
      shares = earnAmount.add(vaultAmount);
    } else {
      shares = (earnAmount.add(vaultAmount)).mul(totalSupply()).div(pool);
    }
    _mint(msg.sender, shares);
    pool = pool.add(earnAmount.add(vaultAmount));
  }

  /**
   * @notice Withdraw USDT from Yearn Earn contract
   * @notice Sender's daoUSDT token been burned based on amount withdraw
   * @param amount Amount to withdraw
   * Requirements:
   * - Sender must be an EOA account
   * - Contract is not in vesting state
   * - Amount input must greater than 0
   * - Amount input must less than or equal to sender current total amount of earn deposit in contract
   */
  function withdrawEarn(uint amount) public {
    require(isVesting == false, "Contract in vesting state");
    require(amount > 0, "Amount must > 0");
    require(earnDepositAmount[msg.sender] >= amount, "Insufficient balance");

    uint earnShares = (amount.mul(earn.totalSupply())).div(earn.calcPoolValueInToken()); // Find earn shares based on deposit amount 
    uint r = (earn.calcPoolValueInToken().mul(earnShares)).div(earn.totalSupply()); // Actual earn withdraw amount
    // uint r = 200; // For testing purpose, need to be removed on production

    earn.withdraw(earnShares);
    earnDepositAmount[msg.sender] = earnDepositAmount[msg.sender].sub(amount);
    
    uint shares = amount.mul(totalSupply()).div(pool); // Find contract shares based on deposit amount
    _burn(msg.sender, shares);
    pool = pool.sub(amount);

    if (r > amount) {
      uint p = r.sub(amount); // Profit
      uint fees = p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(msg.sender, r.sub(fees));
      token.safeTransfer(treasuryWallet, fees);
    } else {
      token.safeTransfer(msg.sender, r);
    }
  }

  /**
   * @notice Withdraw USDT from Yearn Vault contract
   * @notice Sender's daoUSDT token been burned based on amount withdraw
   * @param amount Amount to withdraw
   * Requirements:
   * - Sender must be an EOA account
   * - Contract is not in vesting state
   * - Amount input must greater than 0
   * - Amount input must less than or equal to sender current total amount of earn deposit in contract
   */
  function withdrawVault(uint amount) public {
    require(isVesting == false, "Contract in vesting state");
    require(amount > 0, "Amount must be > 0");
    require(vaultDepositAmount[msg.sender] >= amount, "Insufficient balance");
    
    uint vaultShares = (amount.mul(vault.totalSupply())).div(vault.balance()); // Find vault shares based on deposit amount 
    uint r = (vault.balance().mul(vaultShares)).div(vault.totalSupply()); // Actual vault withdraw amount
    // uint r = 200; // For testing purpose, need to be removed on production

    vault.withdraw(vaultShares);
    vaultDepositAmount[msg.sender] = vaultDepositAmount[msg.sender].sub(amount);
    
    uint shares = amount.mul(totalSupply()).div(pool);
    _burn(msg.sender, shares);
    pool = pool.sub(amount);

    if (r > amount) {
      uint p = r.sub(amount); // Profit
      uint fees = p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(msg.sender, r.sub(fees));
      token.safeTransfer(treasuryWallet, fees);
    } else {
      token.safeTransfer(msg.sender, r);
    }
  }

  /**
   * @notice Vesting this contract, withdraw all the token from Yearn contract
   * @notice Disabled the deposit and withdraw functions for public
   * @notice Only allowed users to do refund from this contract
   * Requirements:
   * - Only contract owner can call this function
   * - This contract is not locked
   * - This contract is not in vesting state
   */
  function vesting() external onlyOwner notLocked(Functions.VEST) {
    require(isVesting == false, "Already in vesting state");

    // Withdraw all funds from Yearn earn and vault contract
    isVesting = true;
    earn.withdraw(earn.balanceOf((address(this))));
    vault.withdraw(vault.balanceOf((address(this))));

    // Collect all profit
    if (token.balanceOf(address(this)) > pool) {
      uint profit = token.balanceOf(address(this)).sub(pool);
      uint fees = profit.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(treasuryWallet, fees);
    }
    pool = 0;
  }

  /**
   * @notice Get token amount based on daoUSDT hold by account after contract in vesting state
   * @param _address Address of account to check
   * @return Token amount based on on daoUSDT hold by account. 0 if contract is not in vesting state
   */
  function getSharesValue(address _address) external view returns (uint) {
    if (isVesting == false) {
      return 0;
    } else {
      uint shares = balanceOf(_address);
      return token.balanceOf(address(this)).mul(shares).div(totalSupply());
    }
  }

  /**
   * @notice Refund all tokens based on daoUSDT hold by sender
   * @notice Only available after contract in vesting state
   * Requirements:
   * - This contract is in vesting state
   * - Sender must has hold some daoUSDT
   */
  function refund() external {
    require(isVesting == true, "Not in vesting state");
    require(balanceOf(address(msg.sender)) > 0, "No balance to refund");

    uint shares = balanceOf(msg.sender);
    uint refundAmount = token.balanceOf(address(this)).mul(shares).div(totalSupply());
    token.safeTransfer(msg.sender, refundAmount);
    _burn(msg.sender, shares);
  }

  /**
   * @notice Set new strategy contract
   * @param _newStrategy New strategy contract address
   * Requirements:
   * - Only contract owner can call this function
   * - New strategy must be a contract
   */
  function setNewStrategy(address _newStrategy) external onlyOwner {
    require(_newStrategy.isContract() == true, "New strategy is not contract");

    newStrategy = _newStrategy;
  }

  /**
   * @notice Migrate all token to new strategy contract
   * Requirements:
   * - Only contract owner can call this function
   * - This contract is not locked
   * - This contract is in vesting state
   */
  function migrate() external onlyOwner notLocked(Functions.MIGRATE) {
    require(isVesting == true, "Not in vesting state");

    token.safeTransfer(newStrategy, token.balanceOf(address(this)));
  }
}