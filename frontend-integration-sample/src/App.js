import { useState } from "react";
import { ethers } from "ethers";

import dVaultUSDT_JSON from "./abis/daoVaultUSDT.json";
import yearnFarmerUSDT_JSON from "./abis/yfUSDTv2.json";
import IERC20_JSON from "./abis/IERC20.json";

import { Container, Row, Col, Button } from "react-bootstrap";

import "./App.css";

function App() {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const dVaultUSDT = new ethers.Contract(
    "0x690018E242e3B92B4FF13487e2391E8D9783D432",
    dVaultUSDT_JSON.abi,
    provider
  );
  const yearnFarmerUSDT = new ethers.Contract(
    "0x9a6950ADc6f0E33dC32fd6606F3F23E6Eeeb9f1e",
    yearnFarmerUSDT_JSON.abi,
    provider
  );
  const USDT = new ethers.Contract(
    "0xE4D19EE2c88BE068d5a04a8984dDEe3B62C0FE68",
    IERC20_JSON.abi,
    provider
  );

  const [connectStatus, setConnectStatus] = useState(false);
  const connectMetamask = async () => {
    if (window.ethereum) {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      setConnectStatus(true);
      init();
    } else {
      alert("Please install MetaMask to use this dApp!");
    }
  };

  const [strategyName, setStrategyName] = useState("");
  const [accountAddress, setAccountAddress] = useState("");
  const [waitingText, setWaitingText] = useState("");

  const [totalValueLocked, setTotalValueLocked] = useState("");
  const [vestingState, setVestingState] = useState(false);

  const [earnBalance, setEarnBalance] = useState("");
  const [vaultBalance, setVaultBalance] = useState("");
  const [sharesBalance, setSharesBalance] = useState("");
  const [tokenApproved, setTokenApproved] = useState(false);

  const getTotalValueLocked = async () => {
    const totalValueLocked = ethers.utils
      .formatUnits(await yearnFarmerUSDT.pool(), 6)
      .split(".")[0];
    setTotalValueLocked(totalValueLocked);
  };

  const getEarnBalance = async () => {
    const signer = provider.getSigner();
    const userAccount = await signer.getAddress();
    const earnBalance = ethers.utils
      .formatUnits(await yearnFarmerUSDT.getEarnDepositBalance(userAccount), 6)
      .split(".")[0];
    setEarnBalance(earnBalance);
  };

  const getVaultBalance = async () => {
    const signer = provider.getSigner();
    const userAccount = await signer.getAddress();
    const vaultBalance = ethers.utils
      .formatUnits(await yearnFarmerUSDT.getVaultDepositBalance(userAccount), 6)
      .split(".")[0];
    setVaultBalance(vaultBalance);
  };

  const getSharesBalance = async () => {
    const signer = provider.getSigner();
    const userAccount = await signer.getAddress();
    const sharesBalance = ethers.utils
      .formatUnits(await yearnFarmerUSDT.getSharesValue(userAccount), 6)
      .split(".")[0];
    setSharesBalance(sharesBalance);
  };

  const getLatestData = () => {
    getEarnBalance();
    getVaultBalance();
    getTotalValueLocked();
  };

  const init = async () => {
    const signer = provider.getSigner();
    const userAccount = await signer.getAddress();
    setAccountAddress(userAccount);

    if (vestingState == false) {
      getLatestData();
    } else {
      getSharesBalance();
    }
    setTokenApproved(
      (await USDT.allowance(userAccount, yearnFarmerUSDT.address)) == 0
        ? false
        : true
    );

    setStrategyName(await yearnFarmerUSDT.name());
    const totalValueLocked = ethers.utils
      .formatUnits(await yearnFarmerUSDT.pool(), 6)
      .split(".")[0];
    setTotalValueLocked(totalValueLocked);
    setVestingState(await yearnFarmerUSDT.isVesting());
  };

  const approveToken = async () => {
    const signer = provider.getSigner();
    const USDTSigner = USDT.connect(signer);
    const tx = await USDTSigner.approve(
      yearnFarmerUSDT.address,
      (2 ** 64).toString()
    );
    setWaitingText("Waiting for transaction to be completed...");
    await tx.wait();
    setWaitingText("");
    setTokenApproved(true);
  };

  const deposit = async (event) => {
    event.preventDefault();
    const earnDepositAmount =
      event.target[0].value == "" ? "0" : event.target[0].value + "000000";
    const vaultDepositAmount =
      event.target[1].value == "" ? "0" : event.target[1].value + "000000";
    const signer = provider.getSigner();
    const dVaultUSDTSigner = dVaultUSDT.connect(signer);
    const tx = await dVaultUSDTSigner.deposit([
      earnDepositAmount,
      vaultDepositAmount,
    ]);
    setWaitingText("Waiting for transaction to be completed...");
    await tx.wait();
    setWaitingText("");
    getLatestData();
  };

  const withdraw = async (event) => {
    event.preventDefault();
    const earnWithdrawAmount =
      event.target[0].value == "" ? "0" : event.target[0].value + "000000";
    const vaultWithdrawAmount =
      event.target[1].value == "" ? "0" : event.target[1].value + "000000";
    const signer = provider.getSigner();
    const dVaultUSDTSigner = dVaultUSDT.connect(signer);
    const tx = await dVaultUSDTSigner.withdraw([
      earnWithdrawAmount,
      vaultWithdrawAmount,
    ]);
    setWaitingText("Waiting for transaction to be completed...");
    await tx.wait();
    setWaitingText("");
    getLatestData();
  };

  const refund = async () => {
    const signer = provider.getSigner();
    const dVaultUSDTSigner = dVaultUSDT.connect(signer);
    const tx = await dVaultUSDTSigner.refund();
    setWaitingText("Waiting for transaction to be completed...");
    await tx.wait();
    setWaitingText("");
    getSharesBalance();
    getTotalValueLocked();
  };

  const TopTitle = () => {
    return (
      <Col>
        <h3>Strategy name: {strategyName}</h3>
        <h3>Your account: {accountAddress}</h3>
        <h4 className="mt-1 text-danger">{waitingText}</h4>
      </Col>
    );
  };

  const LeftColumn = () => {
    return (
      <Col className="my-auto">
        <h1>Total Value Locked: ${totalValueLocked}</h1>
      </Col>
    );
  };

  const Divider = () => {
    return (
      <Col xs={0.1} className="my-auto">
        <div
          style={{ border: "1px solid grey", width: "1px", height: "30em" }}
        ></div>
      </Col>
    );
  };

  const RightColumn = () => {
    let txMethod;
    if (!vestingState) {
      if (tokenApproved == true) {
        txMethod = (
          <div>
            <form onSubmit={deposit}>
              <label>
                Earn
                <input type="text" className="ml-1" />
              </label>
              <label className="ml-2">
                Vault
                <input type="text" className="ml-1" />
              </label>
              <input type="submit" value="Deposit" className="ml-1" />
            </form>

            <form onSubmit={withdraw}>
              <label>
                Earn
                <input type="text" className="ml-1" />
              </label>
              <label className="ml-2">
                Vault
                <input type="text" className="ml-1" />
              </label>
              <input type="submit" value="Withdraw" className="ml-1" />
            </form>
          </div>
        );
      } else {
        txMethod = (
          <div>
            <h5>You need to approve {strategyName} to use your token 1st.</h5>
            <Button variant="info" onClick={approveToken}>
              Approve
            </Button>
          </div>
        );
      }
    } else {
      txMethod = (
        <Button variant="Danger" onClick={refund}>
          Refund
        </Button>
      );
    }

    let showBalance;
    if (vestingState == false) {
      showBalance = (
        <div>
          <h3>Your Earn Deposit Balance: ${earnBalance}</h3>
          <h3>Your Vault Deposit Balance: ${vaultBalance}</h3>
        </div>
      );
    } else {
      showBalance = <h3>Your shares Balance: ${sharesBalance}</h3>;
    }

    if (connectStatus == true) {
      return (
        <Col className="my-auto">
          <div>{showBalance}</div>
          <div className="mt-4">{txMethod}</div>
        </Col>
      );
    }
    return (
      <Col className="my-auto">
        <Button onClick={connectMetamask}>Connect with MetaMask</Button>
      </Col>
    );
  };

  return (
    <Container fluid className="vw-100 vh-100">
      <Row className="text-center mt-2">
        <TopTitle />
      </Row>
      <Row className="text-center h-75">
        <LeftColumn />
        <Divider />
        <RightColumn />
      </Row>
    </Container>
  );
}

export default App;
