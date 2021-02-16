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
    function getPoolBalance() external view returns (uint256);
}

contract daoVault is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    IERC20 public token;
    IStrategy public strategy;

    constructor(address _token) ERC20("DAO Tether USDT", "daoUSDT") {
        token = IERC20(_token);
    }

    function setStrategy(address _strategy) external onlyOwner {
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
}