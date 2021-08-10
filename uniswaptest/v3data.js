const { GraphQLClient, gql } = require("graphql-request");
const JSBI = require("jsbi");
const endpoint = `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`;

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    authorization: "Bearer MY_TOKEN",
  },
});

const poolQueryMaker = (blockNumber) => gql`
  {
    pools(
      where: { id: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8" }
      block: { number: ${blockNumber} }
    ) {
      tick
      feeGrowthGlobal0X128
      feeGrowthGlobal1X128
    }
  }
`;

const findLowerTick = async (blockNumber) => {
  const tickData = await graphQLClient.request(`
    {
      ticks(
          first:1,
          where: {
          pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
          }
          block: {number: ${blockNumber}}
          orderBy: tickIdx
          orderDirection: asc
        ) {
          tickIdx
          feeGrowthOutside0X128
          feeGrowthOutside1X128
      }
    }`);
  return Number(tickData.ticks[0].tickIdx);
};

const tickDataMaker = async (blockNumber) => {
  const tickQuery = tickQueryMaker(blockNumber);
  const lowerTick = await findLowerTick(blockNumber);
  let startTick = lowerTick - 1;
  let finished = false;
  let ticks = [];
  while (!finished) {
    const tickQuery = tickQueryMaker(blockNumber, startTick);
    const result = await graphQLClient.request(tickQuery);
    console.log(result.ticks.length);
    if (result.ticks.length == 0) {
      finished = true;
    } else {
      const tickResults = result.ticks.map((tick, idx, ticks) => {
        if (idx == ticks.length - 1) {
          startTick = Number(tick.tickIdx);
        }
        return {
          feeGrowthOutside0X128: tick.feeGrowthOutside0X128,
          feeGrowthOutside1X128: tick.feeGrowthOutside1X128,
          tickIdx: Number(tick.tickIdx),
        };
      });
      ticks = ticks.concat(tickResults);
    }
  }
  return ticks;
};

const TickWithFeeDataMaker = async (blockNumber) => {
  const pool = await poolDataMaker(blockNumber);
  let ticks = await tickDataMaker(blockNumber);

  ticks = ticks.sort((a, b) => {
    return a.tickIdx > b.tickIdx ? 1 : 0;
  });
  const ticksWithFee = ticks.map((tick, idx, ticks) => {
    if (idx === ticks.length - 1) {
      return {
        ...tick,
        feeGrowthInside0X128: "0",
        feeGrowthInside1X128: "0",
      };
    }
    const nextTick = ticks[idx + 1];
    let feeGrowthBelow0X128;
    let feeGrowthBelow1X128;
    let feeGrowthAbove0X128;
    let feeGrowthAbove1X128;
    if (parseInt(pool.tick) >= parseInt(tick.tickIdx)) {
      feeGrowthBelow0X128 = JSBI.BigInt(tick.feeGrowthOutside0X128);
      feeGrowthBelow1X128 = JSBI.BigInt(tick.feeGrowthOutside1X128);
    } else {
      feeGrowthBelow0X128 = JSBI.subtract(
        JSBI.BigInt(pool.feeGrowthGlobal0X128),
        JSBI.BigInt(tick.feeGrowthOutside0X128)
      );
      feeGrowthBelow1X128 = JSBI.subtract(
        JSBI.BigInt(pool.feeGrowthGlobal1X128),
        JSBI.BigInt(tick.feeGrowthOutside1X128)
      );
    }
    if (parseInt(pool.tick) < parseInt(nextTick.tickIdx)) {
      feeGrowthAbove0X128 = JSBI.BigInt(nextTick.feeGrowthOutside0X128);
      feeGrowthAbove1X128 = JSBI.BigInt(nextTick.feeGrowthOutside1X128);
    } else {
      feeGrowthAbove0X128 = JSBI.subtract(
        JSBI.BigInt(pool.feeGrowthGlobal0X128),
        JSBI.BigInt(nextTick.feeGrowthOutside0X128)
      );
      feeGrowthAbove1X128 = JSBI.subtract(
        JSBI.BigInt(pool.feeGrowthGlobal1X128),
        JSBI.BigInt(nextTick.feeGrowthOutside1X128)
      );
    }
    let total0X = JSBI.ADD(feeGrowthBelow0X128, feeGrowthAbove0X128);
    let total1X = JSBI.ADD(feeGrowthBelow1X128, feeGrowthAbove1X128);
    let feeGrowthInside0X128 = JSBI.subtract(
      JSBI.BigInt(pool.feeGrowthGlobal0X128),
      total0X
    ).toString();
    let feeGrowthInside1X128 = JSBI.subtract(
      JSBI.BigInt(pool.feeGrowthGlobal1X128),
      total1X
    ).toString();
    return {
      ...tick,
      feeGrowthInside0X128,
      feeGrowthInside1X128,
      idx,
    };
  });
  return ticksWithFee;
};

const calculateA = (currentTick, tick, global, outside) => {
  if (parseInt(currentTick) >= parseInt(tick)) {
    return JSBI.subtract(JSBI.BigInt(global), JSBI.BigInt(outside));
  }
  return JSBI.BigInt(outside);
};

const calculateB = (currentTick, tick, global, outside) => {
  if (parseInt(currentTick) >= parseInt(tick)) {
    return JSBI.BigInt(outside);
  }
  return JSBI.subtract(JSBI.BigInt(global), JSBI.BigInt(outside));
};

// tickDataMaker(12473624);
// poolDataMaker(12473624);
// 676968905519057272871242372593752
// 18806119136388047080789267109353

const main = async () => {
  const pool = await poolDataMaker(12987961);
  const ticks = await TickWithFeeDataMaker(12987961);
  console.log(ticks);
};
main();

// 16213700878322990241550871627801
/*
const a = JSBI.BigInt("947220131397869900021662874023566");
const b = JSBI.BigInt(
  "2350988701644575015937473074444491355637331113544175043017503412556834518909454345703125"
); // 5^128
const liquidity = JSBI.BigInt("18695887497124593912");

let c = JSBI.BigInt("1");
const d = JSBI.BigInt("5");
for (let i = 0; i < 125; i++) {
  c = JSBI.multiply(c, d);
}

// console.log(JSBI.multiply(JSBI.multiply(a, b), liquidity).toString().length);
*/
