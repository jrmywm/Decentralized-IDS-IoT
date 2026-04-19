const hre = require("hardhat");

async function main() {
  // Alamat koin ISEC dari hasil deploy
  const TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  // Alamat wallet reporter (Account #0 dari npx hardhat node)
  const REPORTER_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  const token = await hre.ethers.getContractAt("IERC20", TOKEN_ADDRESS);
  const balance = await token.balanceOf(REPORTER_WALLET);

  console.log("------------------------------------------");
  console.log(`Saldo ISEC Reporter: ${hre.ethers.formatUnits(balance, 18)} ISEC`);
  console.log("------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});