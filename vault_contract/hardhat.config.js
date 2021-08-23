require("@nomiclabs/hardhat-waffle");


task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  //networks: {
  //  hardhat: {
  //    forking: {
  //      url: "https://eth-mainnet.alchemyapi.io/v2/D73_ryQg6AXEruir7eSrcgqw0AgpArxc"
  //    }
  //  }
  //},
  solidity: "0.7.6",
};
