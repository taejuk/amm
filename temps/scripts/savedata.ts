import axios from "axios";
import {getPoolQuery, getTicksQuery, getEventsQuery} from './querise';
import {toWei, add, sub, findTickIdx, findNextTick, SwapMath, getCurrentBlock, blockNumberToTimestamp} from './utils';
import { BigintIsh } from "@uniswap/sdk-core";
import * as Constants from './constants';
import JSBI from "jsbi";
import { TickMath, FeeAmount } from "@uniswap/v3-sdk";
import mongoose from 'mongoose';
import fs from 'fs';
import { timestampToBlockNumber } from "./timestampToBlockNumber";

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

// type Result = {
//     liquidity: BigintIsh;
//     feeGrowthInside0X: BigintIsh;
//     feeGrowthInside1X: BigintIsh;
// };

interface TickFee {
  tickIdx: Number,
  liquidity: string,
  feeGrowthInside0X: string,
  feeGrowthInside1X: string,
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
    const startTimestamp = await blockNumberToTimestamp(startBlockNumber);
    const endTimestamp = await blockNumberToTimestamp(endBlockNumber);
    //console.log("calculateFees getticks : ", ticks);
    let pool = await getPool(startBlockNumber-1);
    let liquidity = JSBI.BigInt(pool.liquidity);
    let tickCurrent = pool.tick;
    const events = await getEvents( startTimestamp , endTimestamp);
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
      //console.log(`(${event.type}) liquidity : `, liquidity.toString());
      //console.log(`tick liquidity : `, ticks[findTickIdx(tickCurrent, ticks)]);
    }//for end
    let resultDatas: TickFee[] = [];
    ticks.forEach((tick) =>{
        resultDatas.push({
          tickIdx : tick.tick,
          liquidity: tick.liquidityGross.toString(),
          feeGrowthInside0X: tick.feeGrowthInside0X.toString(),
          feeGrowthInside1X: tick.feeGrowthInside1X.toString(),
        });
      }
    );
    return resultDatas;
    // fs.writeFile(
    //   "results.txt",
    //   JSON.stringify(resultDatas, undefined, 2),
    //   function (error) {
    //     console.log("error!", error);
    //   }
    // );
}

const tickFee = new mongoose.Schema({
    tickIdx: 'number',
    liquidity: 'string',
    feeGrowthInside0X: 'string',
    feeGrowthInside1X: 'string',
});

const blockData = new mongoose.Schema({
    startBlockNumner : {type : 'number', index: true},
    startTime: 'string',
    endBlockNumber: 'number',
    endTime: 'string',
    pool: 'string',
    price: 'string',
    sqrtPrice: 'string',
    startBlockLiquidity : 'string',
    endBlockLiquidity: 'string',
    //start time, end time
    tickFees: [tickFee],
})

const BlockDatas = mongoose.model('blockDatas', blockData);

const curTime = () => {return new Date().getTime().toString().substring(0,10); }

export async function saveData(){
    //calc start block, end block
    mongoose
    .connect("mongodb+srv://jw:1111@cluster0.yihvy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    });

    var db = mongoose.connection;
    // 4. 연결 실패
    db.on('error', function(){
        console.log('Connection Failed!');
    });
    // 5. 연결 성공
    db.once('open', function() {
        console.log('Connected!');
    });

    var pooldata = await axios.post(URI,
      {
          query: getPoolQuery({
              id: ID,
              blockNumber: await getCurrentBlock()-30,
          })
    });
    //console.log("pool data: ", poolData);
    //let startblock = pooldata.data.data.pools[0].createdAtBlockNumber;
    let startTime = parseInt( pooldata.data.data.pools[0].createdAtTimestamp);
    //const endTime = parseInt(curTime());
    const endTime = 1628789000;

    //첫 24시간은 데이터가 없으니까 생략
    startTime += 86400;
    let startblock = await timestampToBlockNumber(startTime);
    //console.log("start Block: ", startblock);
    //console.log("start time : ", startTime);
    //console.log("my time:", new Date(startTime*1000));
    //console.log("next Block: ", startblock);

    while(startTime < endTime - 86400){
      const nextTime = startTime + 86400;
      console.log("nt: " , nextTime);
      const nextBlock = await timestampToBlockNumber(nextTime);
      console.log("nb: " , nextBlock);
      const tickFeeList = await calculateFees(startblock, nextBlock);

      const endPool = await getPool(nextBlock);
      const startPool = await getPool(startblock);
      //console.log("pool data ", endPool);
      const newdata = new BlockDatas({
        startBlockNumner : startblock,
        startTime: new Date(startTime*1000),
        endBlockNumber: nextBlock,
        endTime: new Date(nextTime*1000),
        pool: ID,
        price: endPool.tick,
        sqrtPrice: endPool.sqrtPrice,
        startBlockLiquidity : startPool.liquidity,
        endBlockLiquidity: endPool.liquidity,
        tickFees: tickFeeList,
      });
      //console.log(newdata);

      await newdata.save((err, data)=>{
        {
          if(err){
              console.log(err);
          } else{
              console.log("save ", data.id);
          }
        }
      });

      startblock = nextBlock;
      //const temp = await blockNumberToTimestamp(startblock);
      startTime += 86400
    }
}
