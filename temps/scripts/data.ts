import {
  FeeAmount,
  TickMath,
} from "@uniswap/v3-sdk";
import { BigintIsh } from "@uniswap/sdk-core";

import axios from "axios";

import JSBI from "jsbi";
import fs from "fs";
import { blockNumberToTimestamp, SwapMath, toWei } from "./utils";
const NEGATIVE_ONE = JSBI.BigInt(-1);
const ZERO = JSBI.BigInt(0);
const ONE = JSBI.BigInt(1);

// used in liquidity amount math
const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));
const Q128 = JSBI.BigInt("0x100000000000000000000000000000000");
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
    amount0: toWei(swap.amount0, "picoether"),
    amount1: toWei(swap.amount1),
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
    return curTick % 60 == 0 ? idx - 1 : idx;
  } else {
    return idx + 1;
  }
}

function findTickIdx(curTick: number, ticks: tickResult[]): number {
  let idx = -1;
  ticks.forEach((tick, index) => {
    if (tick.tick == curTick - (curTick % 60)) {
      idx = index;
    }
  });
  return idx;
}

async function calculateFees(startBlockNumber: number, endBlockNumber: number) {
  let ticks = await getTicks(startBlockNumber - 1);
  let pool = await getPool(startBlockNumber - 1);
  let liquidity = JSBI.BigInt(pool.liquidity);
  const events = await getEvents(startBlockNumber, endBlockNumber);
  for (let event of events) {
    if (event.type === "mint") {
      let lowerIdx = -1;
      let upperIdx = -1;
      ticks.forEach((tick, idx) => {
        if (tick.tick == event.tickLower) {
          lowerIdx = idx;
        }
        if (tick.tick == event.tickUpper) {
          upperIdx = idx;
        }
      });

      if (lowerIdx == -1) {
        const data: tickResult = {
          tick: event.tickLower,
          liquidityGross: "0",
          liquidityNet: "0",
          feeGrowthInside0X: "0",
          feeGrowthInside1X: "0",
        };
        ticks.push(data);
        ticks = ticks.sort((a: any, b: any) => {
          return a.tick > b.tick ? 1 : -1;
        });
        ticks.forEach((tick, idx, array) => {
          if (array[idx].tick == event.tickLower) {
            array[idx].liquidityGross = array[idx - 1].liquidityGross;
            lowerIdx = idx;
          }
        });
      }
      if (upperIdx == -1) {
        const data: tickResult = {
          tick: event.tickUpper,
          liquidityGross: "0",
          liquidityNet: "0",
          feeGrowthInside0X: "0",
          feeGrowthInside1X: "0",
        };
        ticks.push(data);
        ticks = ticks.sort((a: any, b: any) => {
          return a.tick > b.tick ? 1 : -1;
        });
        ticks.forEach((tick, idx, array) => {
          if (array[idx].tick == event.tickUpper) {
            array[idx].liquidityGross = array[idx - 1].liquidityGross;
            upperIdx = idx;
          }
        });
      }
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

      liquidity = JSBI.add(liquidity, JSBI.BigInt(event.amount));
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
      liquidity = JSBI.subtract(liquidity, JSBI.BigInt(event.amount));
    } else {
      // swap 부분
      const zeroForOne = JSBI.greaterThan(
        JSBI.BigInt(event.amount0),
        JSBI.BigInt("0")
      );
      let curTick = event.tick;
      let sqrtPriceX96 = JSBI.BigInt(event.sqrtPriceX96);
      let amounts = zeroForOne
        ? JSBI.BigInt(event.amount0)
        : JSBI.BigInt(event.amount1);
      let curTickIdx = findTickIdx(curTick, ticks);
      //console.log(zeroForOne);
      while (amounts.toString() !== "0") {
        //let liquidity = JSBI.BigInt(ticks[curTickIdx].liquidityGross);
        let nextTickIdx = findNextTick(curTick, ticks, zeroForOne);
        let sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(
          ticks[nextTickIdx].tick
        );

        let [calsqrtPriceX96, amountIn, amountOut, feeAmount] =
          SwapMath.computeSwapStep(
            sqrtPriceX96,
            sqrtPriceNextX96,
            liquidity,
            amounts,
            FeeAmount.MEDIUM
          );

        sqrtPriceX96 = calsqrtPriceX96;
        // 토큰 양 업데이트
        amounts = JSBI.subtract(amounts, JSBI.add(amountIn, feeAmount));
        // 수수료 업데이트
        if (zeroForOne) {
          if (liquidity.toString() !== "0") {
            ticks[curTickIdx].feeGrowthInside0X = JSBI.add(
              JSBI.BigInt(ticks[curTickIdx].feeGrowthInside0X),
              JSBI.divide(JSBI.multiply(feeAmount, Q128), liquidity)
            ).toString();
          }
        } else {
          if (liquidity.toString() !== "0") {
            ticks[curTickIdx].feeGrowthInside1X = JSBI.add(
              JSBI.BigInt(ticks[curTickIdx].feeGrowthInside1X),
              JSBI.divide(JSBI.multiply(feeAmount, Q128), liquidity)
            ).toString();
          }
        }
        //
        if (JSBI.equal(calsqrtPriceX96, sqrtPriceNextX96)) {
          curTick = ticks[nextTickIdx].tick;
          curTickIdx = nextTickIdx;
        } else {
          curTick = TickMath.getTickAtSqrtRatio(calsqrtPriceX96);
        }
      }
    }
  }
  type Result = {
    liquidity: BigintIsh;
    feeGrowthInside0X: BigintIsh;
    feeGrowthInside1X: BigintIsh;
  };
  let resultss: { [id: string]: Result } = {};
  ticks.forEach((tick) => {
    let id = tick.tick.toString();

    resultss[`${id}`] = {
      liquidity: tick.liquidityGross,
      feeGrowthInside0X: tick.feeGrowthInside0X,
      feeGrowthInside1X: tick.feeGrowthInside1X,
    };
  });
  fs.writeFile(
    "hahass.txt",
    JSON.stringify(resultss, undefined, 2),
    function (error) {
      console.log("error!", error);
    }
  );
}
