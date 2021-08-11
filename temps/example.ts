import {
  FeeAmount,
  FullMath,
  isSorted,
  LiquidityMath,
  Pool,
  Tick,
  TickList,
  TickMath,
  TICK_SPACINGS,
} from "@uniswap/v3-sdk";
import { Token } from "@uniswap/sdk-core";
import { BigintIsh } from "@uniswap/sdk-core";
import invariant from "tiny-invariant";

import axios from "axios";
import { SwapMath } from "./swapMath";

import JSBI from "jsbi";
import Web3 from "web3";
import fs from "fs";
const NEGATIVE_ONE = JSBI.BigInt(-1);
const ZERO = JSBI.BigInt(0);
const ONE = JSBI.BigInt(1);

// used in liquidity amount math
const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));
const Q128 = JSBI.BigInt("0x100000000000000000000000000000000");
const web3 = new Web3(
  "https://mainnet.infura.io/v3/aaa10d98f1d144ca8d1c9d3b64e506fd"
);

async function getPool(blockNumber: number) {
  const poolResult = await axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
      query: `{
    pools(
      where: {
        id: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"  
      }
      block: {
        number: ${blockNumber}
      }
    ) {
      liquidity
      tick
      sqrtPrice
    }   }
    `,
    }
  );
  const result: poolResult = poolResult.data.data.pools[0];
  const pool: poolResult = {
    liquidity: result.liquidity,
    sqrtPrice: result.sqrtPrice,
    tick: Number(result.tick),
  };
  return pool;
}
async function getTicks(blockNumber: number) {
  const tickResult = await axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
      query: `{
        ticks(where: {
          pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
        },
        block: {
          number: ${blockNumber}
        }
        first: 1000,
        ) {
          tickIdx
          liquidityNet
          liquidityGross
        }
      }
      `,
    }
  );
  const results: tickResult[] = tickResult.data.data.ticks
    .map((tick: any) => {
      return {
        tick: Number(tick.tickIdx),
        liquidityNet: tick.liquidityNet,
        liquidityGross: tick.liquidityGross,
        feeGrowthInside0X: "0",
        feeGrowthInside1X: "0",
      };
    })
    .sort((a: any, b: any) => {
      return a.tick > b.tick ? 1 : -1;
    });
  return results;
}

async function blockNumberToTimestamp(blockNumber: number) {
  const block = await web3.eth.getBlock(blockNumber);
  return block.timestamp;
}
// swap, mints, burn 이벤트를 시간 순으로 정렬한다.
// 12994010
// 12994604
async function getEvents(startBlockNumber: number, endBlockNumber: number) {
  const startTimestamp = await blockNumberToTimestamp(startBlockNumber);
  const endTimestamp = await blockNumberToTimestamp(endBlockNumber);

  const swapsResult = await axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
      query: `{
        swaps(
          where: {
            timestamp_gt: "${startTimestamp}"
            timestamp_lt: "${endTimestamp}"
            pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
          },
          orderBy: timestamp
          orderDirection: asc
          first: 1000
        ){
          amount0
          amount1
          sqrtPriceX96
          tick
          timestamp
        }
      }
      `,
    }
  );
  const mintResult = await axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
      query: `{
      mints(
        where: {
          timestamp_gt: "${startTimestamp}"
          timestamp_lt: "${endTimestamp}"
          pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
        },
        orderBy: timestamp
        orderDirection: asc
      ){
        amount
        tickLower
        tickUpper
        timestamp
      }
    }`,
    }
  );
  const burnResult = await axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
      query: `{
        burns(
          where: {
            timestamp_gt: "${startTimestamp}"
            timestamp_lt: "${endTimestamp}"
            pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
          },
          orderBy: timestamp
          orderDirection: asc
        ){
          amount
          tickLower
          tickUpper
          timestamp
        }
      }`,
    }
  );
  const swaps = swapsResult.data.data.swaps.map((swap: any) => ({
    timestamp: Number(swap.timestamp),
    tick: Number(swap.tick),
    amount0: web3.utils.toWei(swap.amount0, "picoether"),
    amount1: web3.utils.toWei(swap.amount1),
    sqrtPriceX96: swap.sqrtPriceX96,
    type: "swap",
  }));
  const mints = mintResult.data.data.mints.map((mint: any) => ({
    amount: mint.amount,
    tickLower: Number(mint.tickLower),
    tickUpper: Number(mint.tickUpper),
    timestamp: Number(mint.timestamp),
    type: "mint",
  }));
  const burns = burnResult.data.data.burns.map((burn: any) => ({
    amount: burn.amount,
    tickLower: Number(burn.tickLower),
    tickUpper: Number(burn.tickUpper),
    timestamp: Number(burn.timestamp),
    type: "burn",
  }));
  const events = [...swaps, ...mints, ...burns];
  const eventsOrderedByTime = events.sort((a, b) => {
    return a.timestamp > b.timestamp ? 1 : -1;
  });
  return eventsOrderedByTime;
}

function add(a: BigintIsh, b: BigintIsh): string {
  return JSBI.ADD(JSBI.BigInt(a), JSBI.BigInt(b)).toString();
}
function sub(a: BigintIsh, b: BigintIsh): string {
  return JSBI.subtract(JSBI.BigInt(a), JSBI.BigInt(b)).toString();
}
function findNextTick(
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
    return idx + 1;
  } else {
    return curTick % 60 == 0 ? idx - 1 : idx;
  }
}

function findTickIdx(curTick: number, ticks: tickResult[]): number {
  let idx = -1;
  ticks.forEach((tick, index) => {
    if (tick.tick == curTick) {
      idx = index;
    }
  });
  return idx;
}

async function calculateFees(startBlockNumber: number, endBlockNumber: number) {
  let ticks = await getTicks(startBlockNumber);
  let pool = await getPool(startBlockNumber);
  const events = await getEvents(startBlockNumber, endBlockNumber);
  for (let event of events) {
    if (event.type === "mint") {
      ticks.forEach((tick) => {
        if (tick.tick == event.tickLower) {
          tick.liquidityGross = add(tick.liquidityGross, event.amount);
          tick.liquidityNet = add(tick.liquidityNet, event.amount);
        }
        if (tick.tick == event.tickUpper) {
          tick.liquidityGross = add(tick.liquidityGross, event.amount);
          tick.liquidityNet = sub(tick.liquidityNet, event.amount);
        }
      });
    } else if (event.type === "burn") {
      ticks.forEach((tick) => {
        if (tick.tick == event.tickLower) {
          tick.liquidityGross = sub(tick.liquidityGross, event.amount);
          tick.liquidityNet = sub(tick.liquidityNet, event.amount);
        }
        if (tick.tick == event.tickUpper) {
          tick.liquidityGross = sub(tick.liquidityGross, event.amount);
          tick.liquidityNet = add(tick.liquidityNet, event.amount);
        }
      });
    } else {
      console.log("swap!");
      let cacheLiquidity = JSBI.BigInt(pool.liquidity);
      const zeroForOne = JSBI.greaterThan(
        JSBI.BigInt(event.amount0),
        JSBI.BigInt("0")
      )
        ? true
        : false;

      let state = {
        amountSpecifiedRemaining: zeroForOne
          ? JSBI.BigInt(event.amount0)
          : JSBI.BigInt(event.amount1),
        tick: pool.tick,
        liquidity: cacheLiquidity,
        sqrtPriceX96: JSBI.BigInt(pool.sqrtPrice),
      };

      while (
        JSBI.greaterThan(state.amountSpecifiedRemaining, JSBI.BigInt("0"))
      ) {
        let step = {
          sqrtPriceStartX96: JSBI.BigInt("0"),
          tickNext: 0,
          sqrtPriceNextX96: JSBI.BigInt("0"),
          amountIn: JSBI.BigInt("0"),
          amountOut: JSBI.BigInt("0"),
          feeAmount: JSBI.BigInt("0"),
        };
        step.sqrtPriceStartX96 = state.sqrtPriceX96;
        const nextTickIdx = findNextTick(state.tick, ticks, zeroForOne);

        step.tickNext = ticks[nextTickIdx].tick;
        step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);
        [state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
          SwapMath.computeSwapStep(
            state.sqrtPriceX96,
            step.sqrtPriceNextX96,
            state.liquidity,
            state.amountSpecifiedRemaining,
            FeeAmount.MEDIUM
          );
        state.amountSpecifiedRemaining = JSBI.subtract(
          state.amountSpecifiedRemaining,
          JSBI.ADD(step.amountIn, step.feeAmount)
        );
        if (JSBI.greaterThan(state.liquidity, JSBI.BigInt("0"))) {
          const curTickIdx = findTickIdx(state.tick, ticks);
          const feeGrowthDelta = JSBI.divide(
            JSBI.multiply(step.feeAmount, Q128),
            state.liquidity
          ).toString();
          if (curTickIdx != -1) {
            if (zeroForOne) {
              ticks[curTickIdx].feeGrowthInside0X = add(
                ticks[curTickIdx].feeGrowthInside0X,
                feeGrowthDelta
              );
            } else {
              ticks[curTickIdx].feeGrowthInside1X = add(
                ticks[curTickIdx].feeGrowthInside1X,
                feeGrowthDelta
              );
            }
          }
        }
        if (JSBI.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
          if (zeroForOne) {
            state.liquidity = JSBI.subtract(
              state.liquidity,
              JSBI.BigInt(ticks[nextTickIdx].liquidityNet)
            );
          } else {
            state.liquidity = JSBI.ADD(
              state.liquidity,
              JSBI.BigInt(ticks[nextTickIdx].liquidityNet)
            );
          }
        } else {
          state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
        }
      }
      pool.liquidity = state.liquidity;
      pool.sqrtPrice = state.sqrtPriceX96;
      pool.tick = state.tick;
    }
  }
  console.log(ticks);
  fs.writeFile(
    "hahas.txt",
    JSON.stringify(ticks, undefined, 2),
    function (error) {
      console.log("error!", error);
    }
  );
}
calculateFees(12993010, 12994604);
interface TickConstructorArgs {
  index: number;
  liquidityGross: BigintIsh;
  liquidityNet: BigintIsh;
  fee0XGrowthInside: BigintIsh;
  fee1XGrowthInside: BigintIsh;
}

interface tickResult {
  liquidityGross: BigintIsh;
  liquidityNet: BigintIsh;
  tick: number;
  feeGrowthInside0X: BigintIsh;
  feeGrowthInside1X: BigintIsh;
}

interface poolResult {
  liquidity: BigintIsh;
  sqrtPrice: BigintIsh;
  tick: number;
}
// getTicks(12994027);
// getPool(12994027);
// getEvents(12994010, 12994604);
