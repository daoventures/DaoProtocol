// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface YfContract {
    function deposit(uint256 earnAmount, uint256 vaultAmount) external;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external;
}

/**
 * @notice This is a sample contract to test deposit token to Yearn Farmer contract
 * By default the deposit transaction will be reverted
 */
contract SampleContract {
    YfContract yfContract;
    IERC20 token;

    constructor(address _yfUSDTAddress, address _tokenAddress) {
        yfContract = YfContract(_yfUSDTAddress);
        token = IERC20(_tokenAddress);
    }

    function approve() external {
        token.approve(address(yfContract), 1000);
    }

    function deposit() external {
        yfContract.deposit(100, 200);
    }
}