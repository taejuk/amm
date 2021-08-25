const { expect } = require("chai");
const { Wallet } = require("ethers");
const { ethers } = require("hardhat");
const{ abi } = require("../artifacts/contracts/myVault.sol/myVault.json");
const { abi : IUniswapV3PoolABI } = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const { abi : UniPeriABI } = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const {abi: usdcABI} = require("./usdcabi.json");
const {abi: wethABI} = require("./wethabi.json");
const { BigintIsh, Price, Token, CurrencyAmount, WETH9 } = require('@uniswap/sdk-core');
const { nearestUsableTick } = require("@uniswap/v3-sdk");

const provider  = new ethers.providers.getDefaultProvider("homestead", {alchemy: "https://eth-mainnet.alchemyapi.io/v2/D73_ryQg6AXEruir7eSrcgqw0AgpArxc"});

const token1 = WETH9[1];
const token0 = new Token(1, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 6, "usdc");

const poolAddress = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8";
const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
);

const routerAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";


const usdc = new ethers.Contract(
  token0.address,
  usdcABI,
  provider
);

const weth = new ethers.Contract(
  token1.address,
  wethABI,
  provider
);


describe("VaultFactory", function () {

  var vault;
  var vaultaddres;
  var owner;
  var addr1;
  var addr2;
  var addr3;


  before("swap", async function(){
    var slot0 = await poolContract.slot0();
    console.log("before swap tick : ", slot0.tick);
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    var accounts = [owner, addr1, addr2, addr3];

    const routerContract = new ethers.Contract(
      routerAddress,
      UniPeriABI,
      owner
    );

    let override = {
      value: ethers.utils.parseEther("200")
    }

    for(var account of accounts){
      await weth.connect(account).deposit(override);
      await weth.connect(account).approve(routerAddress, ethers.BigNumber.from("100000000000000000000"));
    }

    const time = await provider.getBlock(13093580);
    for(var account of accounts){
      let param = {
        tokenIn : token1.address,
        tokenOut : token0.address,
        fee : 3000,
        recipient : account.address,
        deadline : time.timestamp + 1000,
        amountIn : ethers.BigNumber.from("100000000000000000000"),
        amountOutMinimum : ethers.BigNumber.from("1000000000"),
        sqrtPriceLimitX96 : 0,
      }

      let tx = await routerContract.connect(account).exactInputSingle(param);
      await tx.wait();
      console.log("weth balance : ", (await weth.connect(account).balanceOf(account.address)).toString());
      console.log("usdc balance : ", (await usdc.connect(account).balanceOf(account.address)).toString());
    }

    slot0 = await poolContract.connect(owner).slot0();
    console.log("after swap tick : ", slot0.tick);
  });

  it("vault Factory", async function () {
    const vFactory = await ethers.getContractFactory("vaultFactory");
    const VFactory = await vFactory.deploy("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await VFactory.deployed();

    expect(await VFactory.greet()).to.equal("Hello, world!");

    const createtx = await VFactory.createVault("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8", 5000, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await createtx.wait();
    vaultaddres = await VFactory.getVaults("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8");

    vault = new ethers.Contract(vaultaddres, abi, owner);
    expect(await vault.getToken0()).to.equal(token0.address);
    expect(await vault.getToken1()).to.equal(token1.address);
  });


  describe("vault", function(){

    it("first set position and mint", async function(){
      await weth.connect(owner).approve(vaultaddres, ethers.utils.parseEther("100"));
      await usdc.connect(owner).approve(vaultaddres, 100000000000);

      const slot0 = await poolContract.connect(owner).slot0();
      const tickspacing = await poolContract.tickSpacing();

      const rebalanceParam = {
        tickLower : nearestUsableTick(slot0.tick, tickspacing) - tickspacing * 2,
        tickUpper : nearestUsableTick(slot0.tick, tickspacing) + tickspacing * 2,
        swapAmount: 0,
        zeroforOne : true,
        sqrtPriceLimitX96: slot0.sqrtPriceX96,
      }
      console.log("cur tick : ", slot0.tick);
      console.log("cur tick sqrtprice : ", slot0.sqrtPriceX96.toString());
      console.log("usable tick : ", nearestUsableTick(slot0.tick, tickspacing) - tickspacing * 2);
      console.log("usable tick : ", nearestUsableTick(slot0.tick, tickspacing) + tickspacing * 2);

      const rebalancetx = await vault.rebalance(rebalanceParam);
      await rebalancetx.wait();

      const minttx = await vault.deposit(owner.address, 100000000000, ethers.utils.parseEther("100"));
      await minttx.wait();

      const tokenAmount = await vault.balanceOf(owner.address);
      console.log("token amount : ", tokenAmount.toString() );
    });

    it("mint another accounts", async function(){
      await weth.connect(addr1).approve(vaultaddres, ethers.utils.parseEther("100"));
      await usdc.connect(addr1).approve(vaultaddres, 100000000000);

      const slot0 = await poolContract.connect(owner).slot0();
      const tickspacing = await poolContract.tickSpacing();

      console.log("cur tick : ", slot0.tick);
      console.log("cur tick sqrtprice : ", slot0.sqrtPriceX96.toString());
      console.log("usable tick : ", nearestUsableTick(slot0.tick, tickspacing) - tickspacing * 2);
      console.log("usable tick : ", nearestUsableTick(slot0.tick, tickspacing) + tickspacing * 2);

      const minttx = await vault.connect(addr1).deposit(addr1.address, 100000000000, ethers.utils.parseEther("100"));
      await minttx.wait();

      const tokenAmount = await vault.connect(addr1).balanceOf(addr1.address);
      console.log("token amount : ", tokenAmount.toString());
    });

    it("mint another accounts", async function(){
      await weth.connect(addr2).approve(vaultaddres, ethers.utils.parseEther("100"));
      await usdc.connect(addr2).approve(vaultaddres, 100000000000);

      const slot0 = await poolContract.connect(owner).slot0();
      const tickspacing = await poolContract.tickSpacing();

      console.log("cur tick : ", slot0.tick);
      console.log("cur tick sqrtprice : ", slot0.sqrtPriceX96.toString());
      console.log("usable tick : ", nearestUsableTick(slot0.tick, tickspacing) - tickspacing * 2);
      console.log("usable tick : ", nearestUsableTick(slot0.tick, tickspacing) + tickspacing * 2);

      const minttx = await vault.connect(addr2).deposit(addr2.address, 50000000000, ethers.utils.parseEther("50"));
      await minttx.wait();

      const tokenAmount = await vault.connect(addr2).balanceOf(addr2.address);
      console.log("token amount : ", tokenAmount.toString());
    });

  });
});