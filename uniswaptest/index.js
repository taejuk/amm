const Web3 = require("web3");
const {
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
const { Position } = require("@uniswap/v3-sdk");
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

const Tx = require("ethereumjs-tx").Transaction;

const JSBI = require("jsbi");
const NONFUNGIBLE_POSITION_MANAGER_ADDRESSES =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const ONE = new Fraction(1, 1);
const { parseUnits } = require("@ethersproject/units");
const {
  abi: IUniswapV3PoolStateABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json");
const { Route } = require("@uniswap/v3-sdk/dist/v3-sdk.cjs.development");
const { BigNumber } = require("ethers");
const {
  getMulticallContract,
  getTokenContract,
  getNFPContract,
} = require("./contracts");
const { DAI, ETH } = require("./tokens");

const address = "0xB2eE48A4CDCDe4DeEA3D93057B9e4cDBc8b6E2B6";
const privateKey = Buffer.from(
  "1967496fd5d6ca4edfa3033430de8e35325e7fadb702dfe88575ff3346b351fd",
  "hex"
);
// web3 instance:
const web3 = new Web3(
  "https://ropsten.infura.io/v3/aaa10d98f1d144ca8d1c9d3b64e506fd"
);

const BN = web3.utils.BN;

const slippage = new Percent(50, 10_000);
const remove_slippage = new Percent(80, 10_000);

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
  const NFPContract = getNFPContract(web3);
  console.log;
  const totals = await NFPContract.methods.balanceOf(address).call();
  let tokenIds = [];
  for (let i = 0; i < totals; i++) {
    const tokenId = await NFPContract.methods
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
    tick = priceToClosestTick(price);
  }

  return nearestUsableTick(tick, TICK_SPACINGS[feeAmount]);
}

async function createPosition(
  token0,
  token1,
  fee,
  lowerPrice,
  upperPrice,
  amount0
) {
  const pool = await usePool(token0, token1, fee);
  const tickLower = parseTick(token0, token1, fee, lowerPrice);
  const tickUpper = parseTick(token0, token1, fee, upperPrice);
  const amount = parseAmount(amount0, token0);
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
  const multicallContract = getMulticallContract(web3);
  let blockTimestamp = await multicallContract.methods
    .getCurrentBlockTimestamp()
    .call();
  blockTimestamp = BigNumber.from(blockTimestamp);
  const deadline = blockTimestamp.add(1800);
  return deadline;
}

async function addLiquidity(
  tokenA,
  tokenB,
  fee,
  lowerPrice,
  upperPrice,
  amount
) {
  const position = await createPosition(
    tokenA,
    tokenB,
    fee,
    lowerPrice,
    upperPrice,
    amount
  );
  const deadline = await getDeadline();

  const useNative =
    tokenA == WETH9[3] || tokenB == WETH9[3]
      ? Ether.onChain(3)
      : tokenA.isNative
      ? tokenA
      : tokenB.isNative
      ? tokenB
      : undefined;
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
  const NONFUNGIBLE_POSITION_MANAGER_ADDRESSES =
    "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
  const rawTx = await makeRawTx(
    address,
    NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
    calldata,
    value
  );
  sendTx(rawTx);
}

async function makeRawTx(from, to, data, value) {
  let gasPrice = await web3.eth.getGasPrice();

  let gas = await web3.eth.estimateGas({
    to: to,
    data: data,
    value,
  });
  const nonce = await web3.eth.getTransactionCount(from);
  const rawTx = {
    from: from,
    to: to,
    data: data,
    value: "0x00",
    nonce: "0x" + nonce.toString(16),
    gasLimit: "0x" + gas.toString(16),
    gasPrice: "0x" + gasPrice.toString(16),
  };
  return rawTx;
}
async function sendTx(rawTx) {
  let tx = new Tx(rawTx, { chain: "ropsten" });
  tx.sign(privateKey);
  const serializedTx = tx.serialize();
  const result = await web3.eth.sendSignedTransaction(
    "0x" + serializedTx.toString("hex")
  );
  return result;
}

async function getCurrentPrice(baseToken, quoteToken, feeAmount) {
  const pool = await usePool(baseToken, quoteToken, feeAmount);
  const tickCurrent = pool.tickCurrent;
  return tickToPrice(baseToken, quoteToken, tickCurrent);
}
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

async function useToken(tokenAddress) {
  const tokenContract = getTokenContract(tokenAddress, web3);
  const tokenName = await tokenContract.methods.name().call();
  const symbol = await tokenContract.methods.symbol().call();
  const decimals = await tokenContract.methods.decimals().call();

  return new Token(3, tokenAddress, parseInt(decimals), symbol, tokenName);
}

const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);

async function getPositionFees(pool, tokenId) {
  const NFPcontract = await getNFPContract(web3);
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
    token0.wrapped,
    discountedAmount0
  );
  const liquidityValue1 = CurrencyAmount.fromRawAmount(
    token1.wrapped,
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
  const NFPcontract = getNFPContract(web3);
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
  const rawTx = await makeRawTx(
    address,
    NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
    calldata,
    value
  );
  sendTx(rawTx);
}
async function main() {
  burnLiquidity("4707");
}

main();
