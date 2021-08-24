const { expect } = require("chai");
const { ethers } = require("hardhat");
const{ abi } = require("../artifacts/contracts/myVault.sol/myVault.json");
const { abi : IUniswapV3PoolABI } = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const { BigintIsh, Price, Token, CurrencyAmount, WETH9 } = require('@uniswap/sdk-core');
const { Pool, nearestUsableTick, toHex } = require("@uniswap/v3-sdk");



const provider  = new ethers.providers.getDefaultProvider("homestead", {alchemy: "https://eth-mainnet.alchemyapi.io/v2/D73_ryQg6AXEruir7eSrcgqw0AgpArxc"});
const token0 = WETH9[1];
const token1 = new Token(1, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 6, "usdc");

const poolAddress = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8";
const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
);

async function getPoolImmutables() {
  const immutables = {
    factory: await poolContract.factory(),
    token0: await poolContract.token0(),
    token1: await poolContract.token1(),
    fee: await poolContract.fee(),
    tickSpacing: await poolContract.tickSpacing(),
    maxLiquidityPerTick: await poolContract.maxLiquidityPerTick(),
  };
  return immutables;
}



describe("VaultFactory", function () {

  var vaultaddres;

  it("Should return the new greeting once it's changed", async function () {
    const vFactory = await ethers.getContractFactory("vaultFactory");
    const VFactory = await vFactory.deploy("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await VFactory.deployed();

    expect(await VFactory.greet()).to.equal("Hello, world!");

    const createtx = await VFactory.createVault("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8", 5000, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await createtx.wait();
    vaultaddres = await VFactory.getVaults("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8")
    console.log(vaultaddres);
  });

  it("connect to contract", async function(){
    const [owner, addr1] = await ethers.getSigners();
    const vault = new ethers.Contract(vaultaddres, abi, owner);

    const slot0 = await poolContract.slot0();
    console.log("tick : ", await poolContract.tickSpacing());
    const tickspacing = await poolContract.tickSpacing();

    //const rebalancer = await vault.getRebalancer();
    const rebalanceParam = {
      tickLower : nearestUsableTick(slot0.tick, tickspacing) - tickspacing * 2,
      tickUpper : nearestUsableTick(slot0.tick, tickspacing) + tickspacing * 2,
      swapAmount: 0,
      zeroforOne : true,
      sqrtPriceLimitX96: slot0.sqrtPriceX96,
    }
    console.log(rebalanceParam);

    const rebalancetx = await vault.rebalance(rebalanceParam);
    await rebalancetx.wait();

    const minttx = await vault.deposit(await owner.getAddress(),0,0,0,0)
    await minttx.wait();

    console.log(await vault.getPosition());

    expect(await vault.test()).to.equal("vault");
  });
});