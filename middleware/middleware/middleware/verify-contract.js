import { ethers } from 'ethers';

async function verify() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const abi = ["function getTotalLogs() external view returns (uint256)"];
  const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  try {
    const contract = new ethers.Contract(address, abi, provider);
    const logs = await contract.getTotalLogs();
    console.log("Contract is reachable. Total logs:", logs.toString());
  } catch (e) {
    console.error("Contract verification failed:", e.message);
  }
}

verify();
