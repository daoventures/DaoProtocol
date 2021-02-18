// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IStrategy {
    function deposit(uint256[] memory _amounts) external;
    function withdraw(uint256[] memory _shares) external;
    function refund(uint256 _shares) external;
    function balanceOf(address _address) external view returns (uint256);
}

contract daoVault is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    IERC20 public token;
    IStrategy public strategy;
    address public pendingStrategy;

    bool public contractAllowed = false;
    bool public canSetPendingStrategy = true;

    enum Functions { CONTRACT, MIGRATE }
    uint256 private constant _LOCKTIME = 5 days;
    mapping(Functions => uint256) public timelock;

    event UnlockFunction(uint256 indexed fn);
    event MigrateFunds(address indexed fromStrategy, address indexed toStrategy, uint256 amount);
    event AllowContract(bool indexed contractAllowed);

    constructor(address _token, address _strategy) ERC20("DAO Tether USDT", "daoUSDT") {
        token = IERC20(_token);
        strategy = IStrategy(_strategy);
    }

    modifier checkContract {
        if (contractAllowed == false) {
            require(address(msg.sender).isContract() == false, "Caller is a contract not EOA");
        }
        _;
    }

    modifier notLocked(Functions _fn) {
        require(timelock[_fn] <= block.timestamp && timelock[_fn] + 1 days >= block.timestamp, "Function is locked");
        _;
    }

    function deposit(uint256[] memory _amounts) external checkContract {
        uint256 _before = strategy.balanceOf(address(this));
        strategy.deposit(_amounts);
        uint256 _after = strategy.balanceOf(address(this));
        
        if (_after > _before) {
            uint256 _shares = _after.sub(_before);
            _mint(msg.sender, _shares);
        }
    }

    function withdraw(uint256[] memory _shares) external checkContract {
        uint256 _before = strategy.balanceOf(address(this));
        strategy.withdraw(_shares);
        uint256 _after = strategy.balanceOf(address(this));

        _burn(msg.sender, _after.sub(_before));
    }

    function refund() external checkContract {
        require(balanceOf(msg.sender) > 0, "No balance to refund");

        uint256 _shares = balanceOf(msg.sender);
        uint256 _before = strategy.balanceOf(address(this));
        strategy.refund(_shares);
        uint256 _after = strategy.balanceOf(address(this));
        _burn(msg.sender, _after.sub(_before));
    }

    function unlockFunction(Functions _fn) external onlyOwner {
        timelock[_fn] = block.timestamp.add(_LOCKTIME);

        if (_fn == Functions.MIGRATE) {
            canSetPendingStrategy = false;
        }

        emit UnlockFunction(uint256(_fn));
    }

    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(canSetPendingStrategy == true, "Cannot set pending strategy now");
        require(_pendingStrategy.isContract() == true, "New strategy is not contract");

        pendingStrategy = _pendingStrategy;
    }

    function _setStrategy() private {
        strategy = IStrategy(pendingStrategy);
        pendingStrategy = address(0);
        canSetPendingStrategy = true;
    }

    function migrateFunds() external onlyOwner notLocked(Functions.MIGRATE) {
        uint256 _amount = token.balanceOf(address(strategy));
        emit MigrateFunds(address(strategy), pendingStrategy, _amount);

        token.safeTransferFrom(address(strategy), pendingStrategy, _amount);
        _setStrategy();
    }

    function allowContract() external onlyOwner notLocked(Functions.CONTRACT) {
        emit AllowContract(contractAllowed);

        contractAllowed = true;
    }
}