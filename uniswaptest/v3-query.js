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

const tickQueryMaker = (blockNumber, tick) => gql`
{
    ticks(
      where: {
        pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
          tickIdx_gt: ${tick}
      }
      block: {number: ${blockNumber}}
      orderBy: tickIdx
      orderDirection: asc
    ) {
      tickIdx
      feeGrowthOutside0X128
      feeGrowthOutside1X128
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

const poolDataMaker = async (blockNumber) => {
  const poolQuery = poolQueryMaker(blockNumber);
  const poolData = await graphQLClient.request(poolQuery);
  return {
    feeGrowthGlobal0X128: poolData.pools[0].feeGrowthGlobal0X128,
    feeGrowthGlobal1X128: poolData.pools[0].feeGrowthGlobal1X128,
    tick: Number(poolData.pools[0].tick),
  };
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
  const ticks = await tickDataMaker(blockNumber);
  const ticksWithFee = ticks.map((tick, idx, ticks) => {
    if (idx === ticks.length - 1) {
      return {
        ...tick,
        feeGrowthInside0X128: "0",
        feeGrowthInside1X128: "0",
      };
    }
    const nextTick = ticks[idx + 1];
    const above0X = calculateAbove(
      pool.tick,
      nextTick.tickIdx,
      pool.feeGrowthGlobal0X128,
      nextTick.feeGrowthOutside0X128
    );
    const above1X = calculateAbove(
      pool.tick,
      nextTick.tickIdx,
      pool.feeGrowthGlobal1X128,
      nextTick.feeGrowthOutside1X128
    );
    const below0X = calculateBelow(
      pool.tick,
      tick.tickIdx,
      pool.feeGrowthGlobal0X128,
      tick.feeGrowthOutside0X128
    );
    const below1X = calculateBelow(
      pool.tick,
      tick.tickIdx,
      pool.feeGrowthGlobal1X128,
      tick.feeGrowthOutside1X128
    );

    // calculate fg - fa(tickUpper) - fb(tickLower)
    const feeGrowthInside0X128 = JSBI.subtract(
      JSBI.BigInt(pool.feeGrowthGlobal0X128),
      JSBI.ADD(above0X, below0X)
    ).toString();
    const feeGrowthInside1X128 = JSBI.subtract(
      JSBI.BigInt(pool.feeGrowthGlobal1X128),
      JSBI.ADD(above1X, below1X)
    ).toString();
    return {
      ...tick,
      feeGrowthInside0X128,
      feeGrowthInside1X128,
    };
  });
  return ticksWithFee;
};

const calculateAbove = (currentTick, tick, global, outside) => {
  if (currentTick >= tick) {
    return JSBI.subtract(JSBI.BigInt(global), JSBI.BigInt(outside));
  }
  return JSBI.BigInt(outside);
};

const calculateBelow = (currentTick, tick, global, outside) => {
  if (currentTick >= tick) {
    return JSBI.BigInt(outside);
  }
  return JSBI.subtract(JSBI.BigInt(global), JSBI.BigInt(outside));
};

// tickDataMaker(12473624);
// poolDataMaker(12473624);
TickWithFeeDataMaker(12974642);

// 16213700878322990241550871627801
