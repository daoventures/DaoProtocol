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

    bool public canSetPendingStrategy = true;
    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 5 days;

    event MigrateFunds(address indexed fromStrategy, address indexed toStrategy, uint256 amount);

    constructor(address _token, address _strategy) ERC20("DAO Tether USDT", "daoUSDT") {
        token = IERC20(_token);
        strategy = IStrategy(_strategy);
    }

    function deposit(uint256[] memory _amounts) external {
        require(address(msg.sender).isContract() == false, "Caller is a contract not EOA");
        uint256 _before = strategy.balanceOf(address(this));
        strategy.deposit(_amounts);
        uint256 _after = strategy.balanceOf(address(this));
        
        if (_after > _before) {
            uint256 _shares = _after.sub(_before);
            _mint(msg.sender, _shares);
        }
    }

    function withdraw(uint256[] memory _shares) external {
        uint256 _before = strategy.balanceOf(address(this));
        strategy.withdraw(_shares);
        uint256 _after = strategy.balanceOf(address(this));

        _burn(msg.sender, _before.sub(_after));
    }

    function refund() external {
        require(address(msg.sender).isContract() == false, "Caller is a contract not EOA");
        require(balanceOf(msg.sender) > 0, "No balance to refund");

        uint256 _shares = balanceOf(msg.sender);
        uint256 _before = strategy.balanceOf(address(this));
        strategy.refund(_shares);
        uint256 _after = strategy.balanceOf(address(this));
        _burn(msg.sender, _before.sub(_after));
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

    function unlockMigrateFunds() external onlyOwner {
        unlockTime = block.timestamp + LOCKTIME;
        canSetPendingStrategy = false;
    }

    function migrateFunds() external onlyOwner {
        require(unlockTime <= block.timestamp && unlockTime + 1 days >= block.timestamp, "Function locked");
        require(token.balanceOf(address(strategy)) > 0, "No balance to migrate");
        require(pendingStrategy != address(0), "No pendingStrategy");
        uint256 _amount = token.balanceOf(address(strategy));
        emit MigrateFunds(address(strategy), pendingStrategy, _amount);

        token.safeTransferFrom(address(strategy), pendingStrategy, _amount);
        // Remove balance of old strategy token
        IERC20 oldStrategyToken = IERC20(address(strategy));
        oldStrategyToken.safeTransfer(address(strategy), oldStrategyToken.balanceOf(address(this)));

        _setStrategy();
        unlockTime = 0;
    }
}