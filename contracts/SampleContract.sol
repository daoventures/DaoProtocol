// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface YfUSDT {
    function deposit(uint256 earnAmount, uint256 vaultAmount) external;
}

contract SampleContract {
    YfUSDT yfUSDT;

    constructor(address _yfUSDTAddress) {
        yfUSDT = YfUSDT(_yfUSDTAddress);
    }

    function deposit() external {
        yfUSDT.deposit(100, 200);
    }
}