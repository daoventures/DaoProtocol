// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

/// @title OpenZeppelin libraries
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/// @dev Interface of Yearn Finance Earn and Vault contract
import "../interfaces/IYearn.sol";
import "../interfaces/IYvault.sol";

// For debugging use, will be removed in production
import "hardhat/console.sol";

interface IDaoVault {
  function totalSupply() external view returns (uint256);
  function balanceOf(address _address) external view returns (uint256); 
}

/// @title Contract for utilize USDT in Yearn Finance contract
contract yfUSDTv2 is ERC20, Ownable {
  /**
   * @dev Inherit from Ownable contract enable contract ownership transferable
   * Function: transferOwnership(newOwnerAddress)
   * Only current owner is able to call the function
   */

  using SafeERC20 for IERC20;
  using Address for address;
  using SafeMath for uint256;

  IERC20 public token;
  IYearn public earn;
  IYvault public vault;
  uint256 private constant MAX_UNIT = 2**256 - 2;
  mapping (address => uint256) private earnDepositBalance;
  mapping (address => uint256) private vaultDepositBalance;
  uint256 public pool;

  address public treasuryWallet; // Address that collecting fees

  uint256[] public depositFeeTier2 = [10001, 100000]; // Represent [tier2 minimun, tier2 maximun], initial value represent Tier 2 from 10001 to 100000
  uint256[] public depositFeePercentage = [100, 50, 25]; // Represent [Tier 1, Tier 2, Tier 3], initial value represent [1%, 0.5%, 0.25%]
  uint256 public profileSharingFeePercentage = 10;

  bool public isVesting = false;
  IDaoVault public daoVault;

  // Timelock related variable
  enum Functions {WALLET, FEETIER, D_FEEPERC, W_FEEPERC, VEST}
  uint256 public constant TIMELOCK = 1 days;
  mapping(Functions => uint256) public timelock;

  event SetTreasuryWallet(address indexed oldTreasuryWallet, address indexed newTreasuryWallet);
  event SetDepositFeeTier2(uint256[] oldDepositFeeTier2, uint256[] newDepositFeeTier2);
  event SetDepositFeePercentage(uint256[] oldDepositFeePercentage, uint256[] newDepositFeePercentage);
  event SetProfileSharingFeePercentage(uint256 indexed oldProfileSharingFeePercentage, uint256 indexed newProfileSharingFeePercentage);

  constructor(address _token, address _earn, address _vault, address _treasuryWallet)
    ERC20("Yearn Farmer USDT", "yfUSDT") {
      token = IERC20(_token);

      earn = IYearn(address(_earn));
      vault = IYvault(address(_vault));
      _approvePooling();

      treasuryWallet = _treasuryWallet;
  }

  /**
   * @notice This function revert transaction if admin function is locked
   * @notice All admin function are locked by default
   * @dev Run unlockFunction() to unlock the admin function
   * @param _fn enum Functions
   */
  modifier notLocked(Functions _fn) {
    require(timelock[_fn] != 0 && timelock[_fn] <= block.timestamp 
      && timelock[_fn] + 1 days >= block.timestamp, "Function locked");
    _;
  }

  /**
   * @notice Unlock admin function. All admin function unlock time is 1 day.
   * @param _fn A number that represent enum Functions
   * @dev 0 = WALLET, 1 = FEETIER, ..., 5 = MIGRATE
   * Requirements:
   * - Only contract owner can call this function
   */
  function unlockFunction(Functions _fn) external onlyOwner {
    timelock[_fn] = block.timestamp.add(TIMELOCK);
  }

  function setVault(address _address) external onlyOwner {
    require(address(daoVault) == address(0), "Vault set");

    daoVault = IDaoVault(_address);
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
  function setDepositFeeTier2(uint256[] calldata _depositFeeTier2) external onlyOwner notLocked(Functions.FEETIER) {
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
  function setDepositFeePercentage(uint256[] calldata _depositFeePercentage) external onlyOwner notLocked(Functions.D_FEEPERC) {
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
  function setProfileSharingFeePercentage(uint256 _percentage) public onlyOwner notLocked(Functions.W_FEEPERC) {
    require(_percentage < 40, "Profile sharing fee percentage cannot be more than 40%");
    emit SetProfileSharingFeePercentage(profileSharingFeePercentage, _percentage);
    profileSharingFeePercentage = _percentage;
    timelock[Functions.W_FEEPERC] = 0;
  }

  /**
   * @notice Approve Yearn Finance contracts to deposit token from this contract
   * @dev This function only need execute once in contract contructor
   */
  function _approvePooling() private {
    // Allow Yearn Earn contract to transfer USDT from this contract
    uint256 earnAllowance = token.allowance(address(this), address(earn));
    if (earnAllowance == uint256(0)) {
      token.safeApprove(address(earn), MAX_UNIT);
    }
    // Allow Yearn Vault contract to transfer USDT from this contract
    uint256 vaultAllowance = token.allowance(address(this), address(vault));
    if (vaultAllowance == uint256(0)) {
      token.safeApprove(address(vault), MAX_UNIT);
    }
  }

  /**
   * @notice Get Yearn Earn current total deposit amount of account (after deposit fee)
   * @param _address Address of account to check
   * @return Current total deposit amount of account in Yearn Earn (after deposit fee). 0 if contract is in vesting state.
   */
  function getEarnDepositBalance(address _address) external view returns (uint256) {
    if (isVesting == true) {
      return 0;
    } else {
      return earnDepositBalance[_address];
    }
  }

  /**
   * @notice Get Yearn Vault current total deposit amount of account (after deposit fee)
   * @param _address Address of account to check
   * @return Current total deposit amount of account in Yearn Vault (after deposit fee). 0 if contract is in vesting state.
   */
  function getVaultDepositBalance(address _address) external view returns (uint256) {
    if (isVesting == true) {
      return 0;
    } else {
      return vaultDepositBalance[_address];
    }
  }

  /**
   * @notice Deposit USDT into Yearn Earn and Vault contract
   * @notice Sender get daoUSDT token based on shares after deposit
   * @param _amounts amount of earn and vault to deposit
   * Requirements:
   * - Sender must approve this contract to transfer USDT from sender to this contract
   * - Sender must be an EOA account
   * - This contract is not in vesting state
   * - Either earn deposit or vault deposit must greater than 0
   */
  function deposit(uint256[] memory _amounts) public {
    require(isVesting == false, "Contract in vesting state");
    require(msg.sender == address(daoVault), "Only can call from Vault");
    require(_amounts[0] > 0 || _amounts[1] > 0, "Amount must > 0");
    
    uint256 _earnAmount = _amounts[0];
    uint256 _vaultAmount = _amounts[1];
    uint256 _depositAmount = _earnAmount.add(_vaultAmount);
    token.safeTransferFrom(tx.origin, address(this), _depositAmount);

    uint256 _earnDepositFee = 0;
    uint256 _vaultDepositFee = 0;
    uint256 _depositFeePercentage = 0;
    /**
     * v2: Deposit fees
     * depositFeeTier2 is used to set each tier minimun and maximun
     * For example depositFeeTier2 is [10000, 100000],
     * Tier 1 = _depositAmount < 10001
     * Tier 2 = 10001 <= _depositAmount <= 100000
     * Tier 3 = _depositAmount > 100000
     *
     * depositFeePercentage is used to set each tier deposit fee percentage
     * For example depositFeePercentage is [100, 50, 25]
     * which mean deposit fee for Tier 1 = 1%, Tier 2 = 0.5%, Tier 3 = 0.25%
     */
    if (_depositAmount < depositFeeTier2[0]) {
    // Tier 1
      _depositFeePercentage = depositFeePercentage[0];
    } else if (_depositAmount >= depositFeeTier2[0] && _depositAmount <= depositFeeTier2[1]) {
    // Tier 2
      _depositFeePercentage = depositFeePercentage[1];
    } else {
    // Tier 3
      _depositFeePercentage = depositFeePercentage[2];
    }

    // Deposit to Yearn Earn after fee
    if (_earnAmount > 0) {
      _earnDepositFee = _earnAmount.mul(_depositFeePercentage).div(10000);
      _earnAmount = _earnAmount.sub(_earnDepositFee);
      earn.deposit(_earnAmount);
      earnDepositBalance[tx.origin] = earnDepositBalance[tx.origin].add(_earnAmount);
    }

    // Deposit to Yearn Vault after fee
    if (_vaultAmount > 0) {
      _vaultDepositFee = _vaultAmount.mul(_depositFeePercentage).div(10000);
      _vaultAmount = _vaultAmount.sub(_vaultDepositFee);
      vault.deposit(_vaultAmount);
      vaultDepositBalance[tx.origin] = vaultDepositBalance[tx.origin].add(_vaultAmount);
    }
    token.safeTransfer(treasuryWallet, _earnDepositFee.add(_vaultDepositFee));

    uint256 _shares = 0;
    if (totalSupply() == 0) {
      _shares = _earnAmount.add(_vaultAmount);
    } else {
      _shares = (_earnAmount.add(_vaultAmount)).mul(totalSupply()).div(pool);
    }
    _mint(address(daoVault), _shares);
    pool = pool.add(_earnAmount.add(_vaultAmount));
  }

  function withdraw(uint256[] memory _shares) external {
    require(isVesting == false, "Contract in vesting state");
    require(msg.sender == address(daoVault), "Only can call from Vault");

    if (_shares[0] > 0) {
      _withdrawEarn(_shares[0]);
    }

    if (_shares[1] > 0) {
      _withdrawVault(_shares[1]);
    }
  }

  /**
   * @notice Withdraw USDT from Yearn Earn contract
   * @notice Sender's daoUSDT token been burned based on amount withdraw
   * @param _shares Amount of shares to withdraw
   * Requirements:
   * - Sender must be an EOA account
   * - Contract is not in vesting state
   * - Amount input must greater than 0
   * - Amount input must less than or equal to sender current total amount of earn deposit in contract
   */
  function _withdrawEarn(uint256 _shares) private {
    uint256 _d = pool.mul(_shares).div(totalSupply()); // Initial Deposit Amount
    require(earnDepositBalance[tx.origin] >= _d, "Insufficient balance");
    uint256 _earnShares = (_d.mul(earn.totalSupply())).div(earn.calcPoolValueInToken()); // Find earn shares based on deposit amount 
    uint256 _r = ((earn.calcPoolValueInToken()).mul(_earnShares)).div(earn.totalSupply()); // Actual earn withdraw amount
    // uint256 _r = 200; // For testing purpose, need to be removed on production

    earn.withdraw(_earnShares);
    earnDepositBalance[tx.origin] = earnDepositBalance[tx.origin].sub(_d);
    
    _burn(address(daoVault), _shares);
    pool = pool.sub(_d);

    if (_r > _d) {
      uint256 _p = _r.sub(_d); // Profit
      uint256 _fees = _p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(tx.origin, _r.sub(_fees));
      token.safeTransfer(treasuryWallet, _fees);
    } else {
      token.safeTransfer(tx.origin, _r);
    }
  }

  /**
   * @notice Withdraw USDT from Yearn Vault contract
   * @notice Sender's daoUSDT token been burned based on amount withdraw
   * @param _shares Amount of shares to withdraw
   * Requirements:
   * - Sender must be an EOA account
   * - Contract is not in vesting state
   * - Amount input must greater than 0
   * - Amount input must less than or equal to sender current total amount of earn deposit in contract
   */
  function _withdrawVault(uint256 _shares) private {
    uint256 _d = pool.mul(_shares).div(totalSupply()); // Initial Deposit Amount
    require(vaultDepositBalance[tx.origin] >= _d, "Insufficient balance");
    uint256 _vaultShares = (_d.mul(vault.totalSupply())).div(vault.balance()); // Find vault shares based on deposit amount 
    uint256 _r = ((vault.balance()).mul(_vaultShares)).div(vault.totalSupply()); // Actual vault withdraw amount
    // uint256 _r = 400; // For testing purpose, need to be removed on production

    vault.withdraw(_vaultShares);
    vaultDepositBalance[tx.origin] = vaultDepositBalance[tx.origin].sub(_d);

    _burn(address(daoVault), _shares);
    pool = pool.sub(_d);

    if (_r > _d) {
      uint256 _p = _r.sub(_d); // Profit
      uint256 _fees = _p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(tx.origin, _r.sub(_fees));
      token.safeTransfer(treasuryWallet, _fees);
    } else {
      token.safeTransfer(tx.origin, _r);
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
    uint256 _earnBalance = earn.balanceOf(address(this));
    uint256 _vaultBalance = vault.balanceOf(address(this));
    if (_earnBalance > 0) {
      earn.withdraw(_earnBalance);
    }
    if (_vaultBalance > 0) {
      vault.withdraw(_vaultBalance);
    }

    // Collect all profit
    if (token.balanceOf(address(this)) > pool) {
      uint256 _profit = token.balanceOf(address(this)).sub(pool);
      uint256 _fee = _profit.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(treasuryWallet, _fee);
    }
    pool = 0;
  }

  /**
   * @notice Get token amount based on daoUSDT hold by account after contract in vesting state
   * @param _address Address of account to check
   * @return Token amount based on on daoUSDT hold by account. 0 if contract is not in vesting state
   */
  function getSharesValue(address _address) external view returns (uint256) {
    if (isVesting == false) {
      return 0;
    } else {
      uint256 _shares = daoVault.balanceOf(_address);
      if (_shares > 0) {
        return token.balanceOf(address(this)).mul(_shares).div(daoVault.totalSupply());
      } else {
        return 0;
      }
    }
  }

  /**
   * @notice Refund all tokens based on daoUSDT hold by sender
   * @notice Only available after contract in vesting state
   * Requirements:
   * - This contract is in vesting state
   * - Sender must has hold some daoUSDT
   */
  function refund(uint256 _shares) external {
    require(isVesting == true, "Not in vesting state");

    uint256 _refundAmount = token.balanceOf(address(this)).mul(_shares).div(daoVault.totalSupply());
    token.safeTransfer(tx.origin, _refundAmount);
    _burn(address(daoVault), _shares);
  }

  function approveMigrate() external onlyOwner {
    require(isVesting == true, "Not in vesting state");

    if (token.allowance(address(this), address(daoVault)) == 0) {
      token.safeApprove(address(daoVault), token.balanceOf(address(this)));
    }
  }
}