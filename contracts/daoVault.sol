// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

interface IStrategy {
    function deposit(uint256[] memory _amounts) external;
    function withdraw(uint256[] memory _shares) external;
    function refund(uint256 _shares) external;
    function getPoolBalance() external view returns (uint256);
}

contract daoVault is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    IERC20 public token;
    IStrategy public strategy;
    address public pendingStrategy;

    // Timelock related variable
    bool public lockFunctions = false;
    uint256 public unlockTime;

    constructor(address _token, address _strategy) ERC20("DAO Tether USDT", "daoUSDT") {
        token = IERC20(_token);
        strategy = IStrategy(_strategy);
    }

    function deposit(uint256[] memory _amounts) external {
        uint256 _total = _amounts[0].add(_amounts[1]);
        token.safeTransferFrom(msg.sender, address(this), _total);

        strategy.deposit(_amounts);

        uint256 shares = 0;
        if (totalSupply() == 0) {
            shares = _total;
        } else {
            shares = (_total.mul(totalSupply())).div(strategy.getPoolBalance());
        }
        _mint(msg.sender, shares);
    }

    function withdraw(uint256[] memory _shares) external {
        strategy.withdraw(_shares);
        uint256 _total = _shares[0].add(_shares[1]);
        _burn(msg.sender, _total);
    }

    function refund() external {
        uint256 _shares = balanceOf(msg.sender);
        strategy.refund(_shares);
        _burn(msg.sender, _shares);
    }

    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(lockFunctions == false, "Function locked");
        require(_pendingStrategy.isContract() == true, "New strategy is not contract");

        pendingStrategy = _pendingStrategy;
    }

    function _setStrategy() private {
        strategy = IStrategy(pendingStrategy);
        pendingStrategy = address(0);
        lockFunctions = false;
    }

    function unlockMigrateFunds() external onlyOwner {
        unlockTime = block.timestamp + 5 days;
        lockFunctions = true;
    }

    function migrateFunds() external onlyOwner {
        require(unlockTime <= block.timestamp && unlockTime + 1 days >= block.timestamp, 'Function locked');
        token.safeTransferFrom(address(strategy), pendingStrategy, token.balanceOf(address(strategy)));
        _setStrategy();
    }
}