import { GraphQLClient, gql } from 'graphql-request';
import {PoolData, pastPoolData, pastPoolTicks, pastPositionData} from './querys.js';
import { UNI_SUBGRAPH, ID, testBlock } from './constants.js';
//import { PoolData, pastPoolTicks, pastPoolData, postPositionData } from 'querys.mjs';

const client = new GraphQLClient(UNI_SUBGRAPH);

export function getPoolData () {
    var data = client.request(
        PoolData,
        {
            id: ID,
    });

    return data;
}

export function getpastPoolData(block){
    var data = client.request(
        pastPoolData(block),
        {
            id: ID,
    });

    return data;
}

export function getpastPoolTicks(tick, block){
    var data = client.request(
        pastPoolTicks(block),
        {
            id: ID,
            tick: tick
    });

    return data;
}


export function getDatafromquery(query, variable){
    var data = client.request(
        query,
        variable
    );

    return data;
}

// export function fetchpooldata(data){
//     const [createdAtTimestamp, id, feeTier, token0, token1] = [data.pools[0].createdAtTimestamp, data.pools[0].id, data.pools[0].feeTier, data.pools[0].token0.symbol, data.pools[0].token1.symbol];

//     return [createdAtTimestamp, id, feeTier, token0, token1];
// }

const main = async() => {
    const result = await getDatafromquery(pastPositionData(12989464), {
        id: ID,
        num: 200,
    });
    console.log(Object.keys(result.positions).length);

    const blocknum = 12989464
    //const idlist = [];
    //todo : id list에 map함수 써서 돌리기
    //const pooldata = await getPoolData();

    //const [createdAtTimestamp, poolid, feeTier, token0, token1] = fetchpooldata(pooldata);

    //const pastPools = await getpastPoolData(blocknum);
    //console.log(pastPools);

    //get past position datas -> put them into db
    const pastPositions = await getDatafromquery(pastPositionData(blocknum), {
        id: ID,
    });

    //console.log(Object.keys(pastPositions.positions).length);
    //console.log(pastPositions.positions);

    const pastTicks = await getpastPoolTicks(195799, blocknum);
    //console.log(typeof pastTicks.pools[0].ticks[0].tickIdx);
    // console.log("data test : ", pastPools.pools[0].feeGrowthGlobal0X128, pastPools.pools[0].feeGrowthGlobal1X128);
    // var index = 0;
    // for(index = 0; index < 50; index++){
    //     console.log(`index ${index}: `, getfeegrowthinside.calc(pastPools.pools[0].tick, pastPools.pools[0].feeGrowthGlobal0X128, pastPools.pools[0].feeGrowthGlobal1X128, pastTicks.pools[0].ticks[index], pastTicks.pools[0].ticks[index + 1]));
    // }

    //console.log()
}
//main();