import Web3 from "web3";
import { INFURA } from "./constants";
import { tickResult } from "./savedata";
import JSBI from "jsbi";
import { BigintIsh } from "@uniswap/sdk-core";
import { FeeAmount, FullMath, SqrtPriceMath } from "@uniswap/v3-sdk";

const web3 = new Web3(INFURA);

export async function blockNumberToTimestamp(blockNumber: number) {
  const block = await web3.eth.getBlock(blockNumber);
  console.log("block to timestamp : ", block.timestamp);
  return block.timestamp;
}

export async function getCurrentBlock(){
  return await web3.eth.getBlockNumber();
}

export function toWei(data: any, option?: any) {
  if (option) return web3.utils.toWei(data);
  else return web3.utils.toWei(data, option);
}

const ZERO = JSBI.BigInt(0);
const NEGATIVE_ONE = JSBI.BigInt(-1);

const MAX_FEE = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(6));

export abstract class SwapMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static computeSwapStep(
    sqrtRatioCurrentX96: JSBI,
    sqrtRatioTargetX96: JSBI,
    liquidity: JSBI,
    amountRemaining: JSBI,
    feePips: FeeAmount
  ): [JSBI, JSBI, JSBI, JSBI] {
    const returnValues: Partial<{
      sqrtRatioNextX96: JSBI;
      amountIn: JSBI;
      amountOut: JSBI;
      feeAmount: JSBI;
    }> = {};

    const zeroForOne = JSBI.greaterThanOrEqual(
      sqrtRatioCurrentX96,
      sqrtRatioTargetX96
    );
    const exactIn = JSBI.greaterThanOrEqual(amountRemaining, ZERO);

    if (exactIn) {
      const amountRemainingLessFee = JSBI.divide(
        JSBI.multiply(
          amountRemaining,
          JSBI.subtract(MAX_FEE, JSBI.BigInt(feePips))
        ),
        MAX_FEE
      );
      returnValues.amountIn = zeroForOne
        ? SqrtPriceMath.getAmount0Delta(
            sqrtRatioTargetX96,
            sqrtRatioCurrentX96,
            liquidity,
            true
          )
        : SqrtPriceMath.getAmount1Delta(
            sqrtRatioCurrentX96,
            sqrtRatioTargetX96,
            liquidity,
            true
          );
      if (
        JSBI.greaterThanOrEqual(amountRemainingLessFee, returnValues.amountIn!)
      ) {
        returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96;
      } else {
        returnValues.sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
          sqrtRatioCurrentX96,
          liquidity,
          amountRemainingLessFee,
          zeroForOne
        );
      }
    } else {
      returnValues.amountOut = zeroForOne
        ? SqrtPriceMath.getAmount1Delta(
            sqrtRatioTargetX96,
            sqrtRatioCurrentX96,
            liquidity,
            false
          )
        : SqrtPriceMath.getAmount0Delta(
            sqrtRatioCurrentX96,
            sqrtRatioTargetX96,
            liquidity,
            false
          );
      if (
        JSBI.greaterThanOrEqual(
          JSBI.multiply(amountRemaining, NEGATIVE_ONE),
          returnValues.amountOut
        )
      ) {
        returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96;
      } else {
        returnValues.sqrtRatioNextX96 =
          SqrtPriceMath.getNextSqrtPriceFromOutput(
            sqrtRatioCurrentX96,
            liquidity,
            JSBI.multiply(amountRemaining, NEGATIVE_ONE),
            zeroForOne
          );
      }
    }

    const max = JSBI.equal(sqrtRatioTargetX96, returnValues.sqrtRatioNextX96);

    if (zeroForOne) {
      returnValues.amountIn =
        max && exactIn
          ? returnValues.amountIn
          : SqrtPriceMath.getAmount0Delta(
              returnValues.sqrtRatioNextX96,
              sqrtRatioCurrentX96,
              liquidity,
              true
            );
      returnValues.amountOut =
        max && !exactIn
          ? returnValues.amountOut
          : SqrtPriceMath.getAmount1Delta(
              returnValues.sqrtRatioNextX96,
              sqrtRatioCurrentX96,
              liquidity,
              false
            );
    } else {
      returnValues.amountIn =
        max && exactIn
          ? returnValues.amountIn
          : SqrtPriceMath.getAmount1Delta(
              sqrtRatioCurrentX96,
              returnValues.sqrtRatioNextX96,
              liquidity,
              true
            );
      returnValues.amountOut =
        max && !exactIn
          ? returnValues.amountOut
          : SqrtPriceMath.getAmount0Delta(
              sqrtRatioCurrentX96,
              returnValues.sqrtRatioNextX96,
              liquidity,
              false
            );
    }

    if (
      !exactIn &&
      JSBI.greaterThan(
        returnValues.amountOut!,
        JSBI.multiply(amountRemaining, NEGATIVE_ONE)
      )
    ) {
      returnValues.amountOut = JSBI.multiply(amountRemaining, NEGATIVE_ONE);
    }

    if (
      exactIn &&
      JSBI.notEqual(returnValues.sqrtRatioNextX96, sqrtRatioTargetX96)
    ) {
      // we didn't reach the target, so take the remainder of the maximum input as fee
      returnValues.feeAmount = JSBI.subtract(
        amountRemaining,
        returnValues.amountIn!
      );
    } else {
      returnValues.feeAmount = FullMath.mulDivRoundingUp(
        returnValues.amountIn!,
        JSBI.BigInt(feePips),
        JSBI.subtract(MAX_FEE, JSBI.BigInt(feePips))
      );
    }

    return [
      returnValues.sqrtRatioNextX96!,
      returnValues.amountIn!,
      returnValues.amountOut!,
      returnValues.feeAmount!,
    ];
  }
}
export function findNextTick(
  curTick: number,
  ticks: tickResult[],
  zeroForOne: boolean
): number {
  let idx = 0;
  ticks.forEach((tick, index) => {
    if (tick.tick == curTick - (curTick % 60)) {
      idx = index;
    }
  });
  if (zeroForOne) {
    return curTick % 60 == 0 ? idx - 1 : idx;
  } else {
    return idx + 1;
  }
}

export function findTickIdx(curTick: number, ticks: tickResult[]): number {
  let idx = -1;
  ticks.forEach((tick, index) => {
    if (tick.tick == curTick - (curTick % 60)) {
      idx = index;
    }
  });
  return idx;
}

export function add(a: BigintIsh, b: BigintIsh): string {
  return JSBI.ADD(JSBI.BigInt(a), JSBI.BigInt(b)).toString();
}
export function sub(a: BigintIsh, b: BigintIsh): string {
  return JSBI.subtract(JSBI.BigInt(a), JSBI.BigInt(b)).toString();
}
