import axios from "axios";
import JSBI from "jsbi";
// usdc/eth pool 생성 시점: 1620169800
// 100개씩 계속 부르면서 timestamp를 기록하면 된다.

interface tick {
  tickIdx: string;
  feeGrowthOutside0X128: string;
  feeGrowthOutside1X128: string;
}

interface tickWithFee {
  tickIdx: string;
  feeGrowthOutside0X128: string;
  feeGrowthOutside1X128: string;
  feeGrowthInside0X128: string;
  feeGrowthInside1X128: string;
}

interface pool {
  feeGrowthGlobal0X128: string;
  feeGrowthGlobal1X128: string;
  liquidity: string;
  tick: string;
}
let ticks: { [timestamp: string]: tick[] } = {};
let ticksWithFee: { [timestamp: string]: tickWithFee[] } = {};
let ableTimestamps: string[] = [];

function makeTimestampquery(timestamp: string): string {
  return (
    `{
        positionSnapshots(first:100, where: {
          timestamp_gt:` +
    `"${timestamp}"` +
    `
        pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
        }
        orderBy: timestamp
        orderDirection: asc
        ){
          timestamp
        }
      }
    `
  );
}

function makePoolquery(timestamp: string): string {
  return (
    `{
          positionSnapshots(where: {
            timestamp:` +
    `"${timestamp}"` +
    `
          pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
          }
          ){
            pool{
                feeGrowthGlobal0X128
                feeGrowthGlobal1X128
                tick
                liquidity
              }
          }
        }
      `
  );
}
function makeTickquery(timestamp: string, tick: string): string {
  return (
    `{
        positionSnapshots(where: {
          timestamp:` +
    `"${timestamp}"` +
    `
          pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
        }
        orderBy: timestamp
        orderDirection: asc
        ){
          
          pool{
            ticks(
              first:10,
                where:{
                tickIdx_gt: ` +
    `"${tick}"` +
    `
              }
              orderBy: tickIdx
              orderDirection: asc
            ){
              tickIdx
              feeGrowthOutside0X128
              feeGrowthOutside1X128
            }
          }
        }
      }`
  );
}
async function getTicksWithFee(timestamp: string) {
  const tickWithoutFee: tick[] = ticks[timestamp];
  const pool: pool = pools[timestamp];
  ticksWithFee[timestamp] = tickWithoutFee.map(
    (tick: tick, index: number, array: tick[]) => {
      if (index == array.length - 1) {
        return {
          tickIdx: tick.tickIdx,
          feeGrowthOutside0X128: tick.feeGrowthOutside0X128,
          feeGrowthOutside1X128: tick.feeGrowthOutside1X128,
          feeGrowthInside0X128: "0",
          feeGrowthInside1X128: "0",
        };
      }
      const nextTick = array[index + 1];
      const feeGrowthGlobal0X128 = JSBI.BigInt(pool.feeGrowthGlobal0X128);
      const feeGrowthGlobal1X128 = JSBI.BigInt(pool.feeGrowthGlobal1X128);
      const BelowX0 = calculateBelow(
        pool.tick,
        tick.tickIdx,
        tick.feeGrowthOutside0X128,
        pool.feeGrowthGlobal0X128
      );
      const BelowX1 = calculateBelow(
        pool.tick,
        tick.tickIdx,
        tick.feeGrowthOutside1X128,
        pool.feeGrowthGlobal1X128
      );
      const AboveX0 = calculateAbove(
        pool.tick,
        nextTick.tickIdx,
        nextTick.feeGrowthOutside0X128,
        pool.feeGrowthGlobal0X128
      );
      const AboveX1 = calculateAbove(
        pool.tick,
        nextTick.tickIdx,
        nextTick.feeGrowthOutside1X128,
        pool.feeGrowthGlobal1X128
      );
      const feeGrowthInside0X128 = JSBI.subtract(
        feeGrowthGlobal0X128,
        JSBI.add(BelowX0, AboveX0)
      ).toString();
      const feeGrowthInside1X128 = JSBI.subtract(
        feeGrowthGlobal1X128,
        JSBI.add(BelowX1, AboveX1)
      ).toString();
      return {
        tickIdx: tick.tickIdx,
        feeGrowthOutside0X128: tick.feeGrowthOutside0X128,
        feeGrowthOutside1X128: tick.feeGrowthOutside1X128,
        feeGrowthInside0X128,
        feeGrowthInside1X128,
      };
    }
  );
}

function calculateBelow(
  currentTick: string,
  tick: string,
  feeGrowthOutside: string,
  feeGrowthGlobal: string
): JSBI {
  if (parseInt(currentTick) >= parseInt(tick)) {
    return JSBI.BigInt(feeGrowthOutside);
  }
  return JSBI.subtract(
    JSBI.BigInt(feeGrowthGlobal),
    JSBI.BigInt(feeGrowthOutside)
  );
}

function calculateAbove(
  currentTick: string,
  tick: string,
  feeGrowthOutside: string,
  feeGrowthGlobal: string
): JSBI {
  if (parseInt(currentTick) < parseInt(tick)) {
    return JSBI.BigInt(feeGrowthOutside);
  }
  return JSBI.subtract(
    JSBI.BigInt(feeGrowthGlobal),
    JSBI.BigInt(feeGrowthOutside)
  );
}

async function main() {
  let result;
  let initialTime = "1";
  let times: string[] = [];
  do {
    result = await axios.post(
      "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
      {
        query: makeTimestampquery(initialTime),
      }
    );
    if (result.data.data) {
      times = result.data.data.positionSnapshots.map(
        (data: any, index: any, array: any) => {
          if (array.length - 1 === index) {
            initialTime = data.timestamp;
          }
          return data.timestamp;
        }
      );
      ableTimestamps = ableTimestamps.concat(times);
      console.log(ableTimestamps.length);
      console.log(initialTime);
    }
  } while (result.data.data && times.length > 0);
  console.log(ableTimestamps.length);
  console.log(ableTimestamps);
}

let pools: { [timestamp: string]: pool } = {};
async function getPool(timestamp: string) {
  const result = await axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
      query: makePoolquery(timestamp),
    }
  );
  const pool = result.data.data.positionSnapshots[0].pool;
  pools[timestamp] = {
    feeGrowthGlobal0X128: pool.feeGrowthGlobal0X128,
    feeGrowthGlobal1X128: pool.feeGrowthGlobal1X128,
    liquidity: pool.liquidity,
    tick: pool.tick,
  };
}

async function getTicks(timestamp: string) {
  let result;
  let initializedTick = "-1000000";
  let results: tick[] = [];
  let temps: tick[];
  do {
    result = await axios.post(
      "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
      {
        query: makeTickquery(timestamp, initializedTick),
      }
    );
    temps = result.data.data.positionSnapshots[0].pool.ticks.map(
      (data: any, index: any, array: any) => {
        if (array.length - 1 === index) {
          initializedTick = data.tickIdx;
        }
        return {
          tickIdx: data.tickIdx,
          feeGrowthOutside0X128: data.feeGrowthOutside0X128,
          feeGrowthOutside1X128: data.feeGrowthOutside1X128,
        };
      }
    );
    results = results.concat(temps);
  } while (result.data.data && temps.length > 0);
  ticks[timestamp] = results;
}

// main();
async function temp() {
  await getTicks("1628122970");
  await getPool("1628122970");
  await getTicksWithFee("1628122970");
  console.log(ticksWithFee);
}
