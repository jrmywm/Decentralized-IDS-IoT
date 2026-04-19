const hre = require("hardhat");

async function main() {
  console.log("Memulai deployment IoTToken...");

  // Mengambil factory kontrak
  const IoTToken = await hre.ethers.getContractFactory("IoTToken");
  
  // Melakukan deploy
  const token = await IoTToken.deploy();

  // Menunggu hingga proses deploy selesai
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("----------------------------------------------");
  console.log("IoTToken berhasil di-deploy ke:", tokenAddress);
  console.log("----------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});