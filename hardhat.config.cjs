require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId: 1337,
    },
    // polygonAmoy is commented out because it contains placeholder keys
    // polygonAmoy: {
    //   url: "https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY",
    //   accounts: ["0xYOUR_PRIVATE_KEY"]
    // }
  }
};
