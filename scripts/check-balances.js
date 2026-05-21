const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const accounts = await hre.ethers.getSigners();
  
  const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;
  if (!tokenAddress) {
      console.error("Error: TOKEN_CONTRACT_ADDRESS is not set in .env");
      process.exit(1);
  }

  const token = await hre.ethers.getContractAt("IoTToken", tokenAddress);

  console.log("=== ISEC TOKEN BALANCES ===");
  console.log("Checking the first 5 local nodes...\n");

  for (let i = 0; i < 5; i++) {
      const address = accounts[i].address;
      const balance = await token.balanceOf(address);
      const formattedBalance = hre.ethers.formatEther(balance);
      
      let label = `Node ${i}`;
      if (i === 0) label = "Your Node (Trusted)";
      
      console.log(`[${label}]`);
      console.log(`Address: ${address}`);
      console.log(`Wallet Balance: ${formattedBalance} ISEC\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
