const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VaultFactory", function () {
  it("Should return the new greeting once it's changed", async function () {
    const vFactory = await ethers.getContractFactory("vaultFactory");
    const VFactory = await vFactory.deploy("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await VFactory.deployed();

    expect(await VFactory.greet()).to.equal("Hello, world!");

    const createtx = await VFactory.createVault("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8", 5000);
    

    console.log(await VFactory.getVaults("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"));

    const vault = contract.attach(await VFactory.getVaults("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"));
    console.log(vault);
  });
});