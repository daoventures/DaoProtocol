pragma solidity ^0.6.2;

interface YfUSDT {
    function deposit(uint earnAmount, uint vaultAmount) external;
}

contract SampleContract {
    YfUSDT yfUSDT;

    constructor(address _yfUSDTAddress) public {
        yfUSDT = YfUSDT(_yfUSDTAddress);
    }

    function deposit() external {
        yfUSDT.deposit(100, 200);
    }
}