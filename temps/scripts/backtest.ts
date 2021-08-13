import {
  maxLiquidityForAmounts,
  SqrtPriceMath,
  TickMath,
} from "@uniswap/v3-sdk";
import { BigintIsh, MaxUint256, sqrt, Token, WETH9 } from "@uniswap/sdk-core";
import JSBI from "jsbi";
interface tickResult {
  liquidityGross: BigintIsh;
  liquidityNet: BigintIsh;
  tick: number;
  feeGrowthInside0X: BigintIsh;
  feeGrowthInside1X: BigintIsh;
}

const USDC = new Token(
  1,
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  6,
  "USDC",
  "USD//C"
);

interface feeResult {
  feeGrowthInside0X: BigintIsh;
  feeGrowthInside1X: BigintIsh;
}
// sqrtRatioCurrent는 시작 지점의 sqrtPrice
function backtest(
  lower: number,
  upper: number,
  sqrtRatioCurrentX96: JSBI,
  ticks: tickResult[]
): feeResult {
  let result: feeResult = {
    feeGrowthInside0X: "0",
    feeGrowthInside1X: "0",
  };
  const sqrtRatioLowerX96: JSBI = TickMath.getSqrtRatioAtTick(lower);
  const sqrtRatioUpperX96: JSBI = TickMath.getSqrtRatioAtTick(upper);
  // 10ETH를 예시로 든다.
  //
  const liquidity: JSBI = maxLiquidityForAmounts(
    sqrtRatioCurrentX96,
    sqrtRatioLowerX96,
    sqrtRatioUpperX96,
    MaxUint256,
    JSBI.BigInt("10000000000000000000"),
    true
  );
  ticks.forEach((tick) => {
    if (tick.tick >= lower && tick.tick <= upper) {
      result.feeGrowthInside0X = JSBI.ADD(
        result.feeGrowthInside0X,
        JSBI.multiply(liquidity, JSBI.BigInt(tick.feeGrowthInside0X))
      ).toString();
      result.feeGrowthInside1X = JSBI.ADD(
        result.feeGrowthInside1X,
        JSBI.multiply(liquidity, JSBI.BigInt(tick.feeGrowthInside1X))
      ).toString();
    }
  });
  return result;
}
