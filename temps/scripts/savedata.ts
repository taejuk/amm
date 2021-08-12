import axios from "axios";
import {getPoolQuery, getTicksQuery, getEventsQuery, queryData} from './querise';
import {toWei, blockNumberToTimestamp, add, sub, findTickIdx, findNextTick} from './utils';
import { BigintIsh } from "@uniswap/sdk-core";
import * as Constants from './constants';
import JSBI from "jsbi";
import { TickMath, FeeAmount } from "@uniswap/v3-sdk";
import { SwapMath } from "../swapMath";

export const URI = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";
export const ID = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";

export interface tickResult {
    liquidityGross: BigintIsh;
    liquidityNet: BigintIsh;
    tick: number;
    feeGrowthInside0X: BigintIsh;
    feeGrowthInside1X: BigintIsh;
}
  
export interface poolResult {
    liquidity: BigintIsh;
    sqrtPrice: BigintIsh;
    tick: number;
}

export async function getPool(blockNumber: Number){
    const poolResult = await axios.post(URI,
    {
        query: getPoolQuery({
            id: ID,
            blockNumber: blockNumber,
        })
    });

    const result: poolResult = poolResult.data.data.pools[0];
    const pool: poolResult = {
        liquidity: result.liquidity,
        sqrtPrice: result.sqrtPrice,
        tick: Number(result.tick),
    };
    return pool;
}

async function getTicks(blockNumber: Number){
    const tickResult = await axios.post(URI,
    {
        query: getTicksQuery({
            id: ID,
            blockNumber: blockNumber,
        })
    });
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


//Todo: 이거 나중에 쿼리 하나로 합칠 수 있을듯???
export async function getEvents(startTimestamp: string | number, endTimestamp: string | number){

    const swapsResult = await axios.post(URI,
    {
        query: getEventsQuery({
            id: ID,
            startTimestamp: startTimestamp,
            endTimestamp: endTimestamp,
        }, "swaps")
    });

    const mintsResult = await axios.post(URI,
        {
            query: getEventsQuery({
                id: ID,
                startTimestamp: startTimestamp,
                endTimestamp: endTimestamp,
            }, "mints")
        }
    );
        
    const burnsResult = await axios.post(URI,
        {
            query: getEventsQuery({
                id: ID,
                startTimestamp: startTimestamp,
                endTimestamp: endTimestamp,
            }, "burns")
        }
    );

    const swaps = swapsResult.data.data.swaps.map((swap: any) => ({
        timestamp: Number(swap.timestamp),
        tick: Number(swap.tick),
        amount0: toWei(swap.amount0, "picoether"),
        amount1: toWei(swap.amount1),
        sqrtPriceX96: swap.sqrtPriceX96,
        type: "swap",
      })
    );
    const mints = mintsResult.data.data.mints.map((mint: any) => ({
        amount: mint.amount,
        tickLower: Number(mint.tickLower),
        tickUpper: Number(mint.tickUpper),
        timestamp: Number(mint.timestamp),
        type: "mint",
      })
    );
    const burns = burnsResult.data.data.burns.map((burn: any) => ({
        amount: burn.amount,
        tickLower: Number(burn.tickLower),
        tickUpper: Number(burn.tickUpper),
        timestamp: Number(burn.timestamp),
        type: "burn",
      })
    );
    const events = [...swaps, ...mints, ...burns];
    const eventsOrderedByTime = events.sort((a, b) => {
      return a.timestamp > b.timestamp ? 1 : -1;
    });
    return eventsOrderedByTime;
}


//todo : burn 시 해제되는 tick 삭제
export async function calculateFees(startBlockNumber: number, endBlockNumber: number) {
    let ticks = await getTicks(startBlockNumber-1);
    let pool = await getPool(startBlockNumber-1);
    let liquidity = JSBI.BigInt(pool.liquidity);
    let tickCurrent = pool.tick;
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
        if(tickCurrent >= event.tickLower && tickCurrent < event.tickUpper){
            liquidity = JSBI.add(liquidity, JSBI.BigInt(event.amount));
        }
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
        if(tickCurrent >= event.tickLower && tickCurrent < event.tickUpper){
            liquidity = JSBI.subtract(liquidity, JSBI.BigInt(event.amount));
        }
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
                        JSBI.divide(JSBI.multiply(feeAmount, Constants.Q128), liquidity)
                    ).toString();
                }
            } else {
                if (liquidity.toString() !== "0") {
                    ticks[curTickIdx].feeGrowthInside1X = JSBI.add(
                        JSBI.BigInt(ticks[curTickIdx].feeGrowthInside1X),
                        JSBI.divide(JSBI.multiply(feeAmount, Constants.Q128), liquidity)
                    ).toString();
                }
            }
            //
            if (JSBI.equal(calsqrtPriceX96, sqrtPriceNextX96)) {

                curTick = zeroForOne? ticks[nextTickIdx].tick - 1 : ticks[nextTickIdx].tick;
                curTickIdx = nextTickIdx;
                tickCurrent = zeroForOne? ticks[nextTickIdx].tick - 1 : ticks[nextTickIdx].tick;
                const liquidityNet = ticks[nextTickIdx].liquidityNet;
                if (zeroForOne){
                    liquidity = JSBI.subtract(liquidity, JSBI.BigInt(liquidityNet));
                }
                else{
                    liquidity = JSBI.add(liquidity, JSBI.BigInt(liquidityNet));
                }
            } else {
                curTick = TickMath.getTickAtSqrtRatio(calsqrtPriceX96);
                tickCurrent = curTick;
            }
        }//while 끝
      }
      console.log(`(${event.type}) liquidity : `, liquidity.toString());
      //console.log(`tick liquidity : `, ticks[findTickIdx(tickCurrent, ticks)]);
    }//for end
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
    return resultss;
    // fs.writeFile(
    //   "hahass.txt",
    //   JSON.stringify(resultss, undefined, 2),
    //   function (error) {
    //     console.log("error!", error);
    //   }
    // );
  }