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

/// For debugging use, will be removed in production
import "hardhat/console.sol";

/// @title Contract for utilize USDT in Yearn Finance contract
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
  uint256 public earnPrice;
  uint256 public vaultPrice;

  uint256[] public depositFeeTier2 = [10001, 100000]; /// Represent [tier2 minimun, tier2 maximun], initial value represent Tier 2 from 10001 to 100000
  uint256[] public depositFeePercentage = [100, 50, 25]; /// Represent [Tier 1, Tier 2, Tier 3], initial value represent [1%, 0.5%, 0.25%]
  uint256 public profileSharingFeePercentage = 10;

  bool public isVesting = false;
  uint256 public unlockDate;
  uint256 private _earnTotalSupply;
  uint256 private _vaultTotalSupply;

  address public treasuryWallet; /// Address that collecting fees

  IYearn public earn;
  IYvault public vault;
  uint256 public constant MAX_UNIT = 2**256 - 2;

  constructor(address _token, address _earn, address _vault, address _treasuryWallet) 
    ERC20("DAO Tether USDT", "daoUSDT") { /// ********** This need to be change and create new .sol file for DAI, USDC and TUSD **********
      _setupDecimals(6); /// ********** This need to be change to 18 for yfDAI.sol and yfTUSD.sol **********
      token = IERC20(_token);

      earn = IYearn(address(_earn));
      vault = IYvault(address(_vault));
      approvePooling();

      treasuryWallet = _treasuryWallet;
  }

  /**
   * @notice Set new treasury wallet address in contract
   * @param _treasuryWallet address of new treasury wallet
   * Requirements:
   * - Only contract owner can call this function
   */
  function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
    treasuryWallet = _treasuryWallet;
  }

  /**
   * @notice Function to set deposit fee tier
   * @notice Details for deposit fee tier can view at deposit() function below
   * @param _depositFeeTier2  - array [tier2 minimun, tier2 maximun], view additional info below
   * Requirements:
   * - Only contract owner can call this function
   * - First element in array must greater than 0
   * - Second element must greater than first element
   */
  function setDepositFeeTier(uint256[] calldata _depositFeeTier2) external onlyOwner {
    require(_depositFeeTier2[0] != 0, "First amount(minimun) cannot be 0");
    require(_depositFeeTier2[1] > _depositFeeTier2[0], "Second amount(maximun) must be greater than first amount(minimun)");
    /**
     * Deposit fees have three tier, but it is enough to have minimun and maximun amount of tier 2
     * Tier 1: deposit amount < minimun amount of tier 2
     * Tier 2: minimun amount of tier 2 <= deposit amount <= maximun amount of tier 2
     * Tier 3: amount > maximun amount of tier 2
     */
    depositFeeTier2 = _depositFeeTier2;
  }

  /**
   * @notice Set deposit fee in percentage
   * @param _depositFeePercentage an array of integer, view additional info below
   * Requirements:
   * - Only contract owner can call this function
   * - Each of the element in the array must less than 400 (40%) 
   */
  function setDepositFeePercentage(uint256[] calldata _depositFeePercentage) external onlyOwner {
    /** 
     * _depositFeePercentage content a array of 3 element, representing deposit fee of tier 1, tier 2 and tier 3
     * For example depositFeePercentage is [100, 50, 25]
     * which mean deposit fee for Tier 1 = 1%, Tier 2 = 0.5% and Tier 3 = 0.25%
     */
    require(
      _depositFeePercentage[0] < 400 ||
      _depositFeePercentage[1] < 400 ||
      _depositFeePercentage[2] < 400, "Deposit fee percentage cannot be more than 40%"
    );
    depositFeePercentage = _depositFeePercentage;
  }

  /**
   * @notice Set profile sharing(withdraw with profit) fee in percentage
   * @param _percentage Integar that represent actual percentage
   * Requirements:
   * - Only contract owner can call this function
   * - Amount set must less than 40 (40%)
   */
  function setProfileSharingFeePercentage(uint256 _percentage) public onlyOwner {
    require(_percentage < 40, "Profile sharing fee percentage cannot be more than 40%");
    profileSharingFeePercentage = _percentage;
  }

  /**
   * @notice Set new Yearn Finance Earn contract address
   * @param _contract address of new Yearn Finance Earn contract
   * Requirements:
   * - Only contract owner can call this function
   */
  function setEarn(address _contract) public onlyOwner {
    earn = IYearn(address(_contract));
  }

  /**
   * @notice Set new Yearn Finance Vault contract address
   * @param _contract address of new Yearn Finance Vault contract
   * Requirements:
   * - Only contract owner can call this function
   */
  function setVault(address _contract) public onlyOwner {
    vault = IYvault(address(_contract));
  }

  /**
   * @notice Approve Yearn Finance contracts to deposit token from this contract
   * @dev This function only need execute once in contract contructor
   */
  function approvePooling() public {
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
   * @notice Check user's current total earn shares in contract
   * @param _address user's address
   * @return current total earn shares of input address in contract
   */
  function earnBalanceOf(address _address) public view returns (uint256) {
    return earnBalances[_address];
  }

  /**
   * @notice Check user's current total vault shares in contract
   * @param _address user's address
   * @return current total vault shares of input address in contract
   */
  function vaultBalanceOf(address _address) public view returns (uint256) {
    return vaultBalances[_address];
  }

  /**
   * @notice Check user's current total earn deposit in contract
   * @param _address user's address
   * @return current total earn deposit of input address in contract
   */
  function earnDepositBalanceOf(address _address) public view returns (uint256) {
    return earnDepositAmount[_address];
  }

  /**
   * @notice Check user's current total vault deposit in contract
   * @param _address user's address
   * @return current total vault deposit of input address in contract
   */
  function vaultDepositBalanceOf(address _address) public view returns (uint256) {
    return vaultDepositAmount[_address];
  }

  /**
   * @notice Deposit USDT into Yearn Earn and Vault contract
   * @notice Sender get daoUSDT token same amount of total shares after deposit
   * @param earnAmount amount of earn in deposit
   * @param vaultAmount amount of vault in deposit
   * Requirements:
   * - Sender must approve this contract to transfer USDT from sender to this contract
   * - Sender must be an EOA account
   * - Contract is not vesting
   * - Either earn deposit or vault deposit must greater than 0
   */
  function deposit(uint256 earnAmount, uint256 vaultAmount) public {
    require(address(msg.sender).isContract() == false, "Caller is a contract not EOA");
    require(isVesting == false, "Unable to deposit funds. The funds are vested.");
    require(earnAmount > 0 || vaultAmount > 0, "Deposit Amount must be greater than 0");
    
    uint256 depositAmount = earnAmount.add(vaultAmount);

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
      uint256 totalDepositFee = depositAmount.mul(depositFeePercentage[0]).div(10000);
      token.safeTransfer(treasuryWallet, totalDepositFee);
    } else if (depositAmount >= depositFeeTier2[0] && depositAmount <= depositFeeTier2[1]) {
      // Tier 2
      earnAmount = earnAmount.sub(earnAmount.mul(depositFeePercentage[1]).div(10000));
      vaultAmount = vaultAmount.sub(vaultAmount.mul(depositFeePercentage[1]).div(10000));
      uint256 totalDepositFee = depositAmount.mul(depositFeePercentage[1]).div(10000);
      token.safeTransfer(treasuryWallet, totalDepositFee);
    } else {
      // Tier 3
      earnAmount = earnAmount.sub(earnAmount.mul(depositFeePercentage[2]).div(10000));
      vaultAmount = vaultAmount.sub(vaultAmount.mul(depositFeePercentage[2]).div(10000));
      uint256 totalDepositFee = depositAmount.mul(depositFeePercentage[2]).div(10000);
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

  /**
   * @notice Withdraw USDT from Yearn Earn contract
   * @notice Sender's daoUSDT token been burned same amount with withdraw shares
   * @param _shares amount of shares to withdraw
   * @dev Current total amount of shares get from function earnBalanceOf() in this contract
   * Requirements:
   * - Sender must be an EOA account
   * - Contract is not vesting
   * - Amount input must greater than 0
   * - Amount input must less than or equal to sender current total amount of earn shares in contract
   */
  function withdrawEarn(uint256 _shares) public {
    require(address(msg.sender).isContract() == false, "Caller must be an EOA account");
    require(isVesting == false, "Unable to withdraw funds. The funds are vested.");
    require(_shares > 0, "Amount must be greater than 0");
    require(earnBalanceOf(msg.sender) >= _shares, "Insufficient Balances");

    uint256 d = _shares.mul(earnDepositAmount[msg.sender]).div(earnBalances[msg.sender]); // Initial Deposit Amount
    uint256 r = (earn.calcPoolValueInToken().mul(_shares)).div(earn.totalSupply()); // Convert profit into USDT
    // uint256 r = 200; // For testing purpose, will be removed on production

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

  /**
   * @notice Withdraw USDT from Yearn Vault contract
   * @notice Sender's daoUSDT token been burned same amount with withdraw shares
   * @param _shares amount of shares to withdraw
   * @dev Current total amount of shares get from function vaultBalanceOf() in this contract
   * Requirements:
   * - Sender must be an EOA account
   * - Contract is not vesting
   * - Amount input must greater than 0
   * - Amount input must less than or equal to sender current total amount of vault shares in contract
   */
  function withdrawVault(uint256 _shares) public {
    require(address(msg.sender).isContract() == false, "Caller must be an EOA account");
    require(isVesting == false, "Unable to withdraw funds. The funds are vested.");
    require(_shares > 0, "Amount must be greater than 0");
    require(vaultBalanceOf(msg.sender) >= _shares, "Insufficient Balances");

    uint256 d = _shares.mul(vaultDepositAmount[msg.sender]).div(vaultBalances[msg.sender]); // Initial Deposit Amount
    uint256 r = (vault.balance().mul(_shares)).div(vault.totalSupply()); // Convert profit into USDT
    // uint256 r = 400; // For testing purpose, will be removed on production

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

  /**
   * @notice Vesting this contract, withdraw all the token from Yearn contract for emergency uses
   * @notice Disabled the deposit and withdraw functions for public
   * @notice Only allowed users to do refund from this contract
   * Requirements:
   * - Only contract owner can call this function
   * - This contract is not in vesting state
   */
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

    unlockDate = block.timestamp.add(1 days); // Set Current Block Timestamp
  }

  /**
   * @notice Revert state of vesting, allow this contract work as usual
   * Requirements:
   * - Only contract owner can call this function
   * - This contract is in vesting state
   * - After 24 hours of vesting
   */
  function revertContract() public onlyOwner {
    require(isVesting == true, "It only can be reverted when the funds are vested.");
    require(block.timestamp >= unlockDate, "Revert contract only can be made after 24 hours of vesting.");

    isVesting = false;
    earnPrice = uint(0);
    vaultPrice = uint(0);
    unlockDate = uint(0);
  }

  /**
   * @notice Refund all sender's token that deposit to Yearn Earn contract after this contract is vested (Including profit)
   * @notice Sender's daoUSDT token been burned same amount with all earn withdraw shares
   * Requirement:
   * - Sender must be an EOA account
   * - This contract is in vesting state
   */
  function refundEarn() public {
    require(address(msg.sender).isContract() == false, "Caller must be an EOA account");
    require(isVesting == true, "The funds must be vested before refund.");

    uint256 shares = earnBalances[msg.sender];
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

  /**
   * @notice Refund all sender's token that deposit to Yearn Vault contract after this contract is vested (Including profit)
   * @notice Sender's daoUSDT token been burned same amount with all vault withdraw shares
   * Requirement:
   * - Sender must be an EOA account
   * - This contract is in vesting state
   */
  function refundVault() public {
    require(address(msg.sender).isContract() == false); // Caller is a contract not EOA
    require(isVesting == true, "The funds must be vested before refund.");

    uint256 shares = vaultBalances[msg.sender];
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