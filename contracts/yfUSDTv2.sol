// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IYearn.sol";
import "../interfaces/IYvault.sol";
import "../interfaces/IDaoVault.sol";

/// @title Contract for yield token in Yearn Finance contracts
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

  // Address to collect fees
  address public treasuryWallet;
  address public communityWallet;
  uint256 public constant DENOMINATOR = 10000;
  uint256 public constant treasuryFee = 5000; // 50% on profile sharing fee
  uint256 public constant communityFee = 5000; // 50% on profile sharing fee


  uint256[] public depositFeeTier2 = [10000e6+1, 100000e6]; // Represent [tier2 minimun, tier2 maximun], initial value represent Tier 2 from 10001 to 100000
  uint256[] public depositFeePercentage = [100, 50, 25]; // Represent [Tier 1, Tier 2, Tier 3], initial value represent [1%, 0.5%, 0.25%]
  uint256 public profileSharingFeePercentage = 10;

  bool public isVesting = false;
  IDaoVault public daoVault;

  event SetTreasuryWallet(address indexed oldTreasuryWallet, address indexed newTreasuryWallet);
  event SetCommunityWallet(address indexed oldCommunityWallet, address indexed newCommunityWallet);
  event SetDepositFeeTier2(uint256[] oldDepositFeeTier2, uint256[] newDepositFeeTier2);
  event SetDepositFeePercentage(uint256[] oldDepositFeePercentage, uint256[] newDepositFeePercentage);
  event SetProfileSharingFeePercentage(uint256 indexed oldProfileSharingFeePercentage, uint256 indexed newProfileSharingFeePercentage);

  constructor(address _token, address _earn, address _vault, address _treasuryWallet, address _communityWallet)
    ERC20("Yearn Farmer v2 USDT", "yfUSDTv2") {
      token = IERC20(_token);
      _setupDecimals(6);

      earn = IYearn(address(_earn));
      vault = IYvault(address(_vault));
      _approvePooling();

      treasuryWallet = _treasuryWallet;
      communityWallet = _communityWallet;
  }

  /**
   * @notice Set Vault that interact with this contract
   * @dev This function call after deploy Vault contract and only able to call once 
   * @param _address Address of Vault
   * Requirements:
   * - Only owner of this contract can call this function
   * - Vault is not set yet
   */
  function setVault(address _address) external onlyOwner {
    require(address(daoVault) == address(0), "Vault set");

    daoVault = IDaoVault(_address);
  }

  /**
   * @notice Set new treasury wallet address in contract
   * @param _treasuryWallet Address of new treasury wallet
   * Requirements:
   * - Only owner of this contract can call this function
   */
  function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
    emit SetTreasuryWallet(treasuryWallet, _treasuryWallet);
    treasuryWallet = _treasuryWallet;
  }

  /**
   * @notice Set new community wallet address in contract
   * @param _communityWallet Address of new community wallet
   * Requirements:
   * - Only owner of this contract can call this function
   */
  function setCommunityWallet(address _communityWallet) external onlyOwner {
    emit SetCommunityWallet(communityWallet, _communityWallet);
    communityWallet = _communityWallet;
  }

  /**
   * @notice Function to set deposit fee tier
   * @notice Details for deposit fee tier can view at deposit() function below
   * @param _depositFeeTier2  Array [tier2 minimun, tier2 maximun], view additional info below
   * Requirements:
   * - Only owner of this contract can call this function
   * - First element in array must greater than 0
   * - Second element must greater than first element
   */
  function setDepositFeeTier2(uint256[] calldata _depositFeeTier2) external onlyOwner {
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
  }

  /**
   * @notice Set deposit fee in percentage
   * @param _depositFeePercentage An array of integer, view additional info below
   * Requirements:
   * - Only owner of this contract can call this function
   * - Each of the element in the array must less than 4000 (40%) 
   */
  function setDepositFeePercentage(uint256[] calldata _depositFeePercentage) external onlyOwner {
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
  }

  /**
   * @notice Set profile sharing(activate when withdraw with profit) fee in percentage
   * @param _percentage Integar that represent actual percentage
   * Requirements:
   * - Only owner of this contract can call this function
   * - Amount set must less than 40 (40%)
   */
  function setProfileSharingFeePercentage(uint256 _percentage) public onlyOwner {
    require(_percentage < 40, "Profile sharing fee percentage cannot be more than 40%");
    emit SetProfileSharingFeePercentage(profileSharingFeePercentage, _percentage);
    profileSharingFeePercentage = _percentage;
  }

  /**
   * @notice Approve Yearn Finance contracts to deposit token from this contract
   * @dev This function only need execute once in contract contructor
   */
  function _approvePooling() private {
    uint256 earnAllowance = token.allowance(address(this), address(earn));
    if (earnAllowance == uint256(0)) {
      token.safeApprove(address(earn), MAX_UNIT);
    }
    uint256 vaultAllowance = token.allowance(address(this), address(vault));
    if (vaultAllowance == uint256(0)) {
      token.safeApprove(address(vault), MAX_UNIT);
    }
  }

  /**
   * @notice Get Yearn Earn current total deposit amount of account (after deposit fee)
   * @param _address Address of account to check
   * @return Current total deposit amount of account in Yearn Earn. 0 if contract is in vesting state.
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
   * @return Current total deposit amount of account in Yearn Vault. 0 if contract is in vesting state.
   */
  function getVaultDepositBalance(address _address) external view returns (uint256) {
    if (isVesting == true) {
      return 0;
    } else {
      return vaultDepositBalance[_address];
    }
  }

  /**
   * @notice Deposit token into Yearn Earn and Vault contract
   * @param _amounts amount of earn and vault to deposit in list: [earn deposit amount, vault deposit amount]
   * Requirements:
   * - Sender must approve this contract to transfer token from sender to this contract
   * - This contract is not in vesting state
   * - Only daoVault can call this function
   * - Either first element(earn deposit) or second element(earn deposit) in list must greater than 0
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
      _earnDepositFee = _earnAmount.mul(_depositFeePercentage).div(DENOMINATOR);
      _earnAmount = _earnAmount.sub(_earnDepositFee);
      earn.deposit(_earnAmount);
      earnDepositBalance[tx.origin] = earnDepositBalance[tx.origin].add(_earnAmount);
    }

    // Deposit to Yearn Vault after fee
    if (_vaultAmount > 0) {
      _vaultDepositFee = _vaultAmount.mul(_depositFeePercentage).div(DENOMINATOR);
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

  /**
   * @notice Withdraw from Yearn Earn and Vault contract
   * @param _shares amount of earn and vault to withdraw in list: [earn withdraw amount, vault withdraw amount]
   * Requirements:
   * - This contract is not in vesting state
   * - Only daoVault can call this function
   */
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
   * @notice Withdraw from Yearn Earn contract
   * @dev Only call within function withdraw()
   * @param _shares Amount of shares to withdraw
   * Requirements:
   * - Contract is not in vesting state
   * - Amount input must less than or equal to sender current total amount of earn deposit in contract
   */
  function _withdrawEarn(uint256 _shares) private {
    uint256 _d = pool.mul(_shares).div(totalSupply()); // Initial Deposit Amount
    require(earnDepositBalance[tx.origin] >= _d, "Insufficient balance");
    uint256 _earnShares = (_d.mul(earn.totalSupply())).div(earn.calcPoolValueInToken()); // Find earn shares based on deposit amount 
    uint256 _r = ((earn.calcPoolValueInToken()).mul(_earnShares)).div(earn.totalSupply()); // Actual earn withdraw amount

    earn.withdraw(_earnShares);
    earnDepositBalance[tx.origin] = earnDepositBalance[tx.origin].sub(_d);
    
    _burn(address(daoVault), _shares);
    pool = pool.sub(_d);

    if (_r > _d) {
      uint256 _p = _r.sub(_d); // Profit
      uint256 _fee = _p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(tx.origin, _r.sub(_fee));
      token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
      token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
    } else {
      token.safeTransfer(tx.origin, _r);
    }
  }

  /**
   * @notice Withdraw from Yearn Vault contract
   * @dev Only call within function withdraw()
   * @param _shares Amount of shares to withdraw
   * Requirements:
   * - Contract is not in vesting state
   * - Amount input must less than or equal to sender current total amount of vault deposit in contract
   */
  function _withdrawVault(uint256 _shares) private {
    uint256 _d = pool.mul(_shares).div(totalSupply()); // Initial Deposit Amount
    require(vaultDepositBalance[tx.origin] >= _d, "Insufficient balance");
    uint256 _vaultShares = (_d.mul(vault.totalSupply())).div(vault.balance()); // Find vault shares based on deposit amount 
    uint256 _r = ((vault.balance()).mul(_vaultShares)).div(vault.totalSupply()); // Actual vault withdraw amount

    vault.withdraw(_vaultShares);
    vaultDepositBalance[tx.origin] = vaultDepositBalance[tx.origin].sub(_d);

    _burn(address(daoVault), _shares);
    pool = pool.sub(_d);

    if (_r > _d) {
      uint256 _p = _r.sub(_d); // Profit
      uint256 _fee = _p.mul(profileSharingFeePercentage).div(100);
      token.safeTransfer(tx.origin, _r.sub(_fee));
      token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
      token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
    } else {
      token.safeTransfer(tx.origin, _r);
    }
  }

  /**
   * @notice Vesting this contract, withdraw all the token from Yearn contract
   * @notice Disabled the deposit and withdraw functions for public
   * @notice Only allowed users to do refund from this contract
   * Requirements:
   * - Only owner of this contract can call this function
   * - This contract is not in vesting state
   */
  function vesting() external onlyOwner {
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
      token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
      token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
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
   * - Only daoVault can call this function
   */
  function refund(uint256 _shares) external {
    require(isVesting == true, "Not in vesting state");
    require(msg.sender == address(daoVault), "Only can call from Vault");

    uint256 _refundAmount = token.balanceOf(address(this)).mul(_shares).div(daoVault.totalSupply());
    token.safeTransfer(tx.origin, _refundAmount);
    _burn(address(daoVault), _shares);
  }

  /**
   * @notice Approve daoVault to migrate funds from this contract
   * @notice Only available after contract in vesting state
   * Requirements:
   * - Only owner of this contract can call this function
   * - This contract is in vesting state
   */
  function approveMigrate() external onlyOwner {
    require(isVesting == true, "Not in vesting state");

    if (token.allowance(address(this), address(daoVault)) == 0) {
      token.safeApprove(address(daoVault), token.balanceOf(address(this)));
    }
  }
}