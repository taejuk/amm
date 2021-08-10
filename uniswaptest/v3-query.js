const { GraphQLClient, gql } = require("graphql-request");
const JSBI = require("jsbi");
const { convertTypeAcquisitionFromJson } = require("typescript");
const endpoint = `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`;
const fs = require("fs");

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    authorization: "Bearer MY_TOKEN",
  },
});

const positionQueryMaker = (blockNumber, id) => gql`
{
  positions(
    where: {
      pool_contains:"0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
    	id_gt : "${id}"
    }
    block: {
      number: ${blockNumber}
    }
  	first: 1000
    orderBy: id
    orderDirection: asc
  ){
    feeGrowthInside0LastX128
    feeGrowthInside1LastX128
    tickLower {
      tickIdx
    }
    tickUpper {
      tickIdx
    }
    liquidity
  }
}
`;

const positionDataMaker = async (blockNumber) => {
  let length = 1;
  let id = "-1";
  let count = 0;
  let finished = false;
  let positions = [];
  let tickSet = new Set([]);
  while (length > 0) {
    const positionQuery = positionQueryMaker(blockNumber, id);
    const positionData = await graphQLClient.request(positionQuery);
    length = positionData.positions.length;
    if (length === 0) {
      break;
    }
    id = positionData.positions[length - 1].id;
    count = count + length;
    positions = [...positions, ...positionData.positions];
  }
  positions.forEach((position) => {
    tickSet.add(parseInt(position.tickLower.tickIdx));
    tickSet.add(parseInt(position.tickUpper.tickIdx));
  });
  return { positions, tickSet };
};

const calculateFee = async (blockNumber) => {
  const { positions, tickSet } = await positionDataMaker(blockNumber);
};

const calculate = (a, b) => {
  return JSBI.ADD(JSBI.BigInt(a), JSBI.BigInt(b)).toString();
};

const getTicksFromBlock = async (blockNumber) => {
  const { positions, tickSet } = await positionDataMaker(blockNumber);
  let ticks = {};
  tickSet.forEach((tick) => {
    ticks[tick] = {
      liquidity: "0",
      feeGrowthInside0LastX128: "0",
      feeGrowthInside1LastX128: "0",
    };
  });
  const orderedTicks = Object.keys(ticks).sort();
  positions.forEach((position) => {
    const {
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      liquidity,
      tickLower: { tickIdx: lowerTick },
      tickUpper: { tickIdx: upperTick },
    } = position;
    let startIdx;
    let endIdx;
    orderedTicks.forEach((tick, idx) => {
      if (lowerTick == tick) {
        startIdx = idx;
      }
      if (upperTick == tick) {
        endIdx = idx;
      }
    });
    for (let i = startIdx; i < endIdx + 1; i++) {
      ticks[orderedTicks[i]].feeGrowthInside0LastX128 = calculate(
        feeGrowthInside0LastX128,
        ticks[orderedTicks[i]].feeGrowthInside0LastX128
      );
      ticks[orderedTicks[i]].feeGrowthInside1LastX128 = calculate(
        feeGrowthInside1LastX128,
        ticks[orderedTicks[i]].feeGrowthInside1LastX128
      );
      ticks[orderedTicks[i]].liquidity = calculate(
        ticks[orderedTicks[i]].liquidity,
        liquidity
      );
    }
  });
  return ticks;
};

const calculateSub = (a, b) => {
  return JSBI.subtract(JSBI.BigInt(a), JSBI.BigInt(b)).toString();
};

const main = async () => {
  const ticksBefore = await getTicksFromBlock(12986980);
  const ticksAfter = await getTicksFromBlock(12990368);
  let results = {};
  const ticks = Object.keys(ticksAfter).sort();
  let count = 0;
  for (let tick of ticks) {
    if (ticksBefore[tick] !== undefined) {
      results[tick] = {
        liquidity: ticksAfter[tick].liquidity,
        feeGrowthInside0LastX128: calculateSub(
          ticksAfter[tick].feeGrowthInside0LastX128,
          ticksBefore[tick].feeGrowthInside0LastX128
        ),
        feeGrowthInside1LastX128: calculateSub(
          ticksAfter[tick].feeGrowthInside1LastX128,
          ticksBefore[tick].feeGrowthInside1LastX128
        ),
      };
    } else {
      results[tick] = ticksAfter[tick];
    }
  }
  fs.writeFile(
    "data1.txt",
    JSON.stringify(results, undefined, 2),
    function (error) {
      console.log("error!", error);
    }
  );
};
main();
