// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

interface IDaoVault {
    function deposit(uint256[] memory _amounts) external;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/**
 * @notice This is a sample contract to test deposit token to Yearn Farmer contract
 * By default the deposit transaction will be reverted
 */
contract SampleContract {
    IDaoVault daoVault;
    IERC20 token;

    constructor(address _daoVaultAddress, address _tokenAddress) {
        daoVault = IDaoVault(_daoVaultAddress);
        token = IERC20(_tokenAddress);
    }

    function approve(address _address) external {
        token.approve(_address, 1000);
    }

    function deposit() external {
        uint256[] memory depositAmount = new uint256[](2);
        depositAmount[0] = 100;
        depositAmount[1] = 200;
        daoVault.deposit(depositAmount);
    }

    function transfer(address _recipient) external {
        token.transfer(_recipient, token.balanceOf(address(this)));
    }
}