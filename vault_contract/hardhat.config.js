require("@nomiclabs/hardhat-waffle");


task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    hardhat: {
      blockGasLimit: 2000000000,
      allowUnlimitedContractSize: true,
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/D73_ryQg6AXEruir7eSrcgqw0AgpArxc",
        blockNumber: 13093580
      }
    }
  },
  solidity: "0.7.6",
  mocha: {
    timeout: 50000
  },
};
