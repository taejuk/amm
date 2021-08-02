const Web3 = require("web3");
const {
  Position,
  Pool,
  FeeAmount,
  computePoolAddress,
  FACTORY_ADDRESS,
  encodeSqrtRatioX96,
  nearestUsableTick,
  TICK_SPACINGS,
  TickMath,
  priceToClosestTick,
  tickToPrice,
} = require("@uniswap/v3-sdk/dist");
const { NonfungiblePositionManager } = require("@uniswap/v3-sdk");
const {
  Token,
  WETH9,
  CurrencyAmount,
  Price,
  Percent,
  Ether,
  Fraction,
} = require("@uniswap/sdk-core");

const daimain = new Token(
  1,
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  18,
  "DAI",
  "Dai Stablecoin"
);

const Tx = require("ethereumjs-tx").Transaction;
const {
  abi: NFPABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const MULTICALL2_ABI = require("./abis/multicall2.json");
const ERC20_ABI = require("./abis/erc20.json");
const ERC20_BYTES32_ABI = require("./abis/erc20_bytes32.json");
const JSBI = require("jsbi");

const ONE = new Fraction(1, 1);
const {
  abi: poolABI,
} = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");
const { parseUnits } = require("@ethersproject/units");
const {
  abi: IUniswapV3PoolStateABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json");
const { Route } = require("@uniswap/v3-sdk/dist/v3-sdk.cjs.development");
const { BigNumber } = require("ethers");

const NONFUNGIBLE_POSITION_MANAGER_ADDRESSES =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const MULTICALL2_ADDRESS = "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696";

const address = "0xB2eE48A4CDCDe4DeEA3D93057B9e4cDBc8b6E2B6";
const privateKey = Buffer.from(
  "1967496fd5d6ca4edfa3033430de8e35325e7fadb702dfe88575ff3346b351fd",
  "hex"
);

const web3 = new Web3(
  "https://mainnet.infura.io/v3/aaa10d98f1d144ca8d1c9d3b64e506fd"
);

const BN = web3.utils.BN;

const slippage = new Percent(50, 10_000);
const remove_slippage = new Percent(80, 10_000);
const DAI = new Token(
  3,
  "0xaD6D458402F60fD3Bd25163575031ACDce07538D",
  18,
  "DAI",
  "Dai Stablecoin"
);

const multicallContract = new web3.eth.Contract(
  MULTICALL2_ABI,
  MULTICALL2_ADDRESS
);

const NFPcontract = new web3.eth.Contract(
  NFPABI,
  NONFUNGIBLE_POSITION_MANAGER_ADDRESSES
);

// 이건 내가 넣은 pool에 대한 position을 가져오는 거고
async function getTotalPools() {
  const totals = await NFPcontract.methods.balanceOf(address).call();
  let positions = [];
  for (let i = 0; i < totals; i++) {
    const tokenId = await NFPcontract.methods
      .tokenOfOwnerByIndex(address, i)
      .call();
    const position = await NFPcontract.methods.positions(tokenId).call();
    positions = [...positions, position];
  }
  return positions;
}

async function getTokenIds() {
  const totals = await NFPcontract.methods.balanceOf(address).call();
  let tokenIds = [];
  for (let i = 0; i < totals; i++) {
    const tokenId = await NFPcontract.methods
      .tokenOfOwnerByIndex(address, i)
      .call();
    tokenIds = [...tokenIds, tokenId];
  }
  return tokenIds;
}

function parseAmount(value, token) {
  const typedValueParsed = parseUnits(value, token.decimals).toString();
  return CurrencyAmount.fromRawAmount(token, typedValueParsed);
}

async function getPoolContract(tokenA, tokenB, feeAmount) {
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

async function usePool(tokenA, tokenB, feeAmount) {
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

  const poolContract = new web3.eth.Contract(
    IUniswapV3PoolStateABI,
    poolAddress
  );
  const slot0s = await poolContract.methods.slot0().call();
  const liquidities = await poolContract.methods.liquidity().call();
  return new Pool(
    token0,
    token1,
    feeAmount,
    slot0s.sqrtPriceX96,
    liquidities,
    parseInt(slot0s.tick)
  );
}

function parseTick(baseToken, quoteToken, feeAmount, value) {
  const amount = parseAmount(value, quoteToken);
  const amountOne = parseAmount("1", baseToken);

  const price = new Price(
    baseToken,
    quoteToken,
    amountOne.quotient,
    amount.quotient
  );

  let tick;

  const sqrtRatioX96 = encodeSqrtRatioX96(price.numerator, price.denominator);

  if (JSBI.greaterThanOrEqual(sqrtRatioX96, TickMath.MAX_SQRT_RATIO)) {
    tick = TickMath.MAX_TICK;
  } else if (JSBI.lessThanOrEqual(sqrtRatioX96, TickMath.MIN_SQRT_RATIO)) {
    tick = TickMath.MIN_TICK;
  } else {
    // this function is agnostic to the base, will always return the correct tick
    tick = priceToClosestTick(price);
  }

  return nearestUsableTick(tick, TICK_SPACINGS[feeAmount]);
}

// 현재 tick을 기준으로 100tick씩 차이나게 만들기
async function createPosition(token0, token1, fee) {
  const pool = await usePool(token0, token1, fee);
  const tickLower = parseTick(token0, token1, fee, "0.003");
  const tickUpper = parseTick(token0, token1, fee, "0.004");
  const amount = parseAmount("10", token0);
  console.log(amount.quotient);
  const position = Position.fromAmount0({
    pool,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0: amount.quotient,
    useFullPrecision: true,
  });
  return position;
}

async function getDeadline() {
  let blockTimestamp = await multicallContract.methods
    .getCurrentBlockTimestamp()
    .call();
  blockTimestamp = BigNumber.from(blockTimestamp);
  const deadline = blockTimestamp.add(1800);
  return deadline;
}

async function addLiquidity() {
  const position = await createPosition(DAI, WETH9[3], FeeAmount.MEDIUM);
  /*
  const blockTimestamp = await multicallContract.methods
    .getCurrentBlockTimestamp()
    .call();
  const deadline = blockTimestamp + 1800;

  const useNative = Ether.onChain(3);
  const { calldata, value } = NonfungiblePositionManager.addCallParameters(
    position,
    {
      slippageTolerance: slippage,
      recipient: address,
      deadline: deadline.toString(),
      useNative,
      createPool: false,
    }
  );
  console.log(value);
  const rawTx = await makeRawTx(
    address,
    NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
    calldata,
    value
  );
  sendTx(rawTx);
  */
}

async function makeRawTx(from, to, data, value) {
  const block = await web3.eth.getBlock("latest");
  //const gasLimit = block.gasLimit;
  //const gasPrice = await web3.eth.getGasPrice();
  const nonce = await web3.eth.getTransactionCount(from);
  const gasLimit = await console.log(value);
  const rawTx = {
    from,
    to,
    data,
    value,
    nonce: "0x" + nonce.toString(16),
    gasLimit: "0x" + gasLimit.toString(16),
    //gasPrice: "0x" + gasPrice.toString(16),
  };
  console.log(rawTx);
  return rawTx;
}

async function sendTx(rawTx) {
  let tx = new Tx(rawTx, { chain: "ropsten" });
  tx.sign(privateKey);
  const serializedTx = tx.serialize();
  const result = await web3.eth.sendSignedTransaction(
    "0x" + serializedTx.toString("hex")
  );
  console.log(result);
  return result;
}

async function getCurrentPrice(baseToken, quoteToken, feeAmount) {
  const pool = await usePool(baseToken, quoteToken, feeAmount);
  const tickCurrent = pool.tickCurrent;
  return tickToPrice(baseToken, quoteToken, tickCurrent);
}
// upper: 위로 몇 틱 움직일 것인가
// lower: 아래로 몇 틱 움직일 것인가
async function getRangeByTicks(upper, lower, baseToken, quoteToken, feeAmount) {
  const pool = await usePool(baseToken, quoteToken, feeAmount);
  const tickCurrent = pool.tickCurrent;
  const lowerPrice = tickToPrice(
    baseToken,
    quoteToken,
    tickCurrent - TICK_SPACINGS[feeAmount] * lower
  );
  const upperPrice = tickToPrice(
    baseToken,
    quoteToken,
    tickCurrent + TICK_SPACINGS[feeAmount] * upper
  );
  return [lowerPrice, upperPrice];
}

function calculateSlippageAmount(value) {
  return [
    value.multiply(ONE.subtract(slippage)).quotient,
    value.multiply(ONE.add(slippage).quotient),
  ];
}

function getTokenContract(tokenAddress) {
  return new web3.eth.Contract(ERC20_ABI, tokenAddress);
}

async function useToken(tokenAddress) {
  const tokenContract = getTokenContract(tokenAddress);
  const tokenName = await tokenContract.methods.name().call();
  const symbol = await tokenContract.methods.symbol().call();
  const decimals = await tokenContract.methods.decimals().call();

  return new Token(3, tokenAddress, parseInt(decimals), symbol, tokenName);
}

const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);

async function getPositionFees(pool, tokenId) {
  const owner = await NFPcontract.methods.ownerOf(tokenId).call();

  const tokenIdHexString = "0x" + tokenId.toString(16);
  const latestBlockNumber = await web3.eth.getBlockNumber();

  const { calldata, value } = NonfungiblePositionManager.collectCallParameters({
    tokenId: tokenId,
    recipient: owner,
    expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(
      pool.token0,
      MAX_UINT128.toHexString()
    ),
    expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(
      pool.token1,
      MAX_UINT128.toHexString()
    ),
  });
  const result = await web3.eth.call({
    to: NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
    data: calldata,
  });
  const feeAmount0 = BigNumber.from(result.substring(0, 66));
  const feeAmount1 = BigNumber.from("0x" + result.substring(66, 130));

  const feeValue0 = CurrencyAmount.fromRawAmount(pool.token0, feeAmount0);
  const feeValue1 = CurrencyAmount.fromRawAmount(Ether.onChain(3), feeAmount1);
  console.log(feeValue0);
  console.log(feeValue1);
  return [feeValue0, feeValue1];
}

async function derivedBurnInfo(position, tokenId) {
  const token0 = await useToken(position.token0);
  const token1 = await useToken(position.token1);

  const pool = await usePool(token0, token1, parseInt(position.fee));
  const positionSDK = new Position({
    pool,
    liquidity: position.liquidity.toString(),
    tickLower: parseInt(position.tickLower),
    tickUpper: parseInt(position.tickUpper),
  });
  const liquidityPercentage = new Percent(100, 100);
  const discountedAmount0 = liquidityPercentage.multiply(
    positionSDK.amount0.quotient
  ).quotient;
  const discountedAmount1 = liquidityPercentage.multiply(
    positionSDK.amount1.quotient
  ).quotient;
  const liquidityValue0 = CurrencyAmount.fromRawAmount(
    token0,
    discountedAmount0
  );
  const liquidityValue1 = CurrencyAmount.fromRawAmount(
    token1,
    discountedAmount1
  );

  const [feeValue0, feeValue1] = await getPositionFees(pool, tokenId);
  const outOfRange =
    pool.tickCurrent < positionSDK.tickLower ||
    pool.tickCurrent > positionSDK.tickUpper;
  return {
    positionSDK,
    liquidityPercentage,
    liquidityValue0,
    liquidityValue1,
    feeValue0,
    feeValue1,
    outOfRange,
  };
}

async function burnLiquidity(tokenId) {
  // 첫번째 tokenId를 없애보자
  const position = await NFPcontract.methods.positions(tokenId).call();
  const percent = 100;
  const {
    positionSDK,
    liquidityPercentage,
    liquidityValue0,
    liquidityValue1,
    feeValue0,
    feeValue1,
    outOfRange,
  } = await derivedBurnInfo(position, tokenId);

  const removed = position.liquidity == "0";
  const deadline = await getDeadline();
  const { calldata, value } = NonfungiblePositionManager.removeCallParameters(
    positionSDK,
    {
      tokenId: tokenId,
      liquidityPercentage,
      slippageTolerance: remove_slippage,
      deadline: deadline.toString(),
      collectOptions: {
        expectedCurrencyOwed0: feeValue0,
        expectedCurrencyOwed1: feeValue1,
        recipient: address,
      },
    }
  );
  console.log(deadline.toString());
  //  console.log("slippages::", remove_slippage);
  //  console.log(liquidityPercentage);
  console.log("calldata:", calldata);
  const rawTx = makeRawTx(
    address,
    NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
    calldata,
    value
  );
  sendTx(rawTx);
}
// 0xac9650d80000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000000a40c49ccbe00000000000000000000000000000000000000000000000000000000000008ec000000000000000000000000000000000000000000000002ee6e31314c08785a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004910e49b1159c00000000000000000000000000000000000000000000000000000000610775c1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084fc6f786500000000000000000000000000000000000000000000000000000000000008ec000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffff00000000000000000000000000000000ffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004449404b7c000000000000000000000000000000000000000000000000000491a40079d96e000000000000000000000000b2ee48a4cdcde4deea3d93057b9e4cdbc8b6e2b6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000064df2ab5bb000000000000000000000000ad6d458402f60fd3bd25163575031acdce07538d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b2ee48a4cdcde4deea3d93057b9e4cdbc8b6e2b600000000000000000000000000000000000000000000000000000000
// 0xac9650d8000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000a40c49ccbe00000000000000000000000000000000000000000000000000000000000008ec000000000000000000000000000000000000000000000002ee6e31314c08785a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004910e49b1159c00000000000000000000000000000000000000000000000000000000610781db000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084fc6f786500000000000000000000000000000000000000000000000000000000000008ec000000000000000000000000b2ee48a4cdcde4deea3d93057b9e4cdbc8b6e2b600000000000000000000000000000000ffffffffffffffffffffffffffffffff00000000000000000000000000000000ffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000
// 0xac9650d80000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000000a40c49ccbe00000000000000000000000000000000000000000000000000000000000008ec000000000000000000000000000000000000000000000002ee6e31314c08785a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004910e49b1159c0000000000000000000000000000000000000000000000000000000061078bb8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084fc6f786500000000000000000000000000000000000000000000000000000000000008ec000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffff00000000000000000000000000000000ffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004449404b7c000000000000000000000000000000000000000000000000000491a40079d96e000000000000000000000000b2ee48a4cdcde4deea3d93057b9e4cdbc8b6e2b6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000064df2ab5bb000000000000000000000000ad6d458402f60fd3bd25163575031acdce07538d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b2ee48a4cdcde4deea3d93057b9e4cdbc8b6e2b600000000000000000000000000000000000000000000000000000000
async function main() {
  // DAI = await useToken("0xaD6D458402F60fD3Bd25163575031ACDce07538D");
  // addLiquidity();
  // const tokenIds = await getTokenIds();
  // burnLiquidity(tokenIds[1]);
  // console.log(remove_slippage);
  // console.dir(NFPcontract.methods);
  // console.log();
  const USDC = new Token(
    1,
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    6,
    "USDC",
    "USD//C"
  );

  const poolContract = await getPoolContract(USDC, WETH9[1], FeeAmount.MEDIUM);
  // const aa = await poolContract.methods.tickBitmap().call();
  // const a = await poolContract.methods.ticks(-78465).call();
  // console.log(a);
  const a = await poolContract.methods.slot0().call();
  // console.log(price);
  // const tickSpacing = await poolContract.methods.tickSpacing().call();
  const b = await poolContract.methods.ticks(190020).call();

  console.log(b);
}

main();
// 1627881577
// 1627879763
// 1627881995
// 16278797631800
