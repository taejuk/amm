const {
  abi: NFPABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const MULTICALL2_ABI = require("./abis/multicall2.json");
const ERC20_ABI = require("./abis/erc20.json");
const {
  abi: poolABI,
} = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");

const NONFUNGIBLE_POSITION_MANAGER_ADDRESSES =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const MULTICALL2_ADDRESS = "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696";

function getNFPContract(web3) {
  return new web3.eth.Contract(NFPABI, NONFUNGIBLE_POSITION_MANAGER_ADDRESSES);
}

function getMulticallContract(web3) {
  return new web3.eth.Contract(MULTICALL2_ABI, MULTICALL2_ADDRESS);
}

function getPoolContract(tokenA, tokenB, feeAmount, web3) {
  tokenA = tokenA.wrapped;
  tokenB = tokenB.wrapped;
  const [token0, token1] = tokenA.sortsBefore(tokenB)
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
  const poolAddress = computePoolAddress({
    factoryAddress: FACTORY_ADDRESS,
    tokenA: token0,
    tokenB: token1,
    fee: feeAmount,
  });

  const poolContract = new web3.eth.Contract(poolABI, poolAddress);
  return poolContract;
}

function getTokenContract(tokenAddress, web3) {
  return new web3.eth.Contract(ERC20_ABI, tokenAddress);
}
exports.getNFPContract = getNFPContract;
exports.getMulticallContract = getMulticallContract;
exports.getPoolContract = getPoolContract;
exports.getTokenContract = getTokenContract;
