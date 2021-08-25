const { expect } = require("chai");
const { Wallet } = require("ethers");
const { ethers } = require("hardhat");
const{ abi } = require("../artifacts/contracts/myVault.sol/myVault.json");
const { abi : IUniswapV3PoolABI } = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const { abi : UniPeriABI } = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const {abi: usdcABI} = require("./usdcabi.json");
const {abi: wethABI} = require("./wethabi.json");
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

const routerAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";


const usdc = new ethers.Contract(
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  usdcABI,
  provider
);
const weth = new ethers.Contract(
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  wethABI,
  provider
);


describe("VaultFactory", function () {

  let wallet;
  let trader;
  var vaultaddres;
  var owner;
  var addr1;


  it("pool test", async function(){
    [owner, addr1] = await ethers.getSigners();
    const ownerAddr = owner.address;
    let override = {
      value: ethers.utils.parseEther("50")
    }
    await weth.connect(owner).deposit(override);
    await weth.connect(owner).approve(routerAddress, ethers.BigNumber.from("16000000000000000000"));
    await weth.connect(owner).approve(poolAddress, ethers.BigNumber.from("16000000000000000000"));

    console.log("balance : \t\t", (await owner.getBalance()).toString());
    console.log("weth balance : \t\t", (await weth.connect(owner).balanceOf(ownerAddr)).toString());

    const time = await provider.getBlock(13093580);

    const param = {
      tokenIn : token0.address,
      tokenOut : token1.address,
      fee : 3000,
      recipient : ownerAddr,
      deadline : time.timestamp + 1000,
      amountIn : ethers.BigNumber.from("15000000000000000000"),
      amountOutMinimum : ethers.BigNumber.from("1000000000"),
      sqrtPriceLimitX96 : 0,
    }

    const routerContract = new ethers.Contract(
      routerAddress,
      UniPeriABI,
      owner
    );

    override.value = ethers.utils.parseEther("0.5");

    const tx = await routerContract.exactInputSingle(param, override);
    const t = await tx.wait();

    console.log("weth balance : ", (await weth.connect(owner).balanceOf(owner.address)).toString());
    console.log("money ", (await usdc.connect(owner).balanceOf(owner.address)).toString());
  });

  it("vault Factory", async function () {
    const vFactory = await ethers.getContractFactory("vaultFactory");
    const VFactory = await vFactory.deploy("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await VFactory.deployed();

    expect(await VFactory.greet()).to.equal("Hello, world!");

    const createtx = await VFactory.createVault("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8", 5000, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await createtx.wait();
    vaultaddres = await VFactory.getVaults("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8");
    //const vault = new ethers.Contract(vaultaddres, abi, provider);

  });

  it("connect to contract", async function(){
    const vault = new ethers.Contract(vaultaddres, abi, owner);

    console.log("pares ether test : ", ethers.utils.parseEther("100").toString());

    await weth.connect(owner).approve(poolAddress, ethers.utils.parseEther("10"));
    await usdc.connect(owner).approve(poolAddress, 5003136287);
    await weth.connect(owner).approve(vaultaddres, ethers.utils.parseEther("10"));
    await usdc.connect(owner).approve(vaultaddres, 5003136287);
    console.log("money ", (await usdc.connect(owner).balanceOf(owner.address)).toString());

    const slot0 = await poolContract.slot0();
    //console.log("tick : ", await poolContract.tickSpacing());
    const tickspacing = await poolContract.tickSpacing();
    console.log("cur tick : ", slot0.tick);
    console.log("usable tick : ", nearestUsableTick(slot0.tick, tickspacing));

    // const rebalancer = await vault.getRebalancer();
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

    const minttx = await vault.deposit(await owner.getAddress(),ethers.utils.parseEther("1"),200000000);
    await minttx.wait();

    expect(await vault.test()).to.equal("vault");
  });

});