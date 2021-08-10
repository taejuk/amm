import { GraphQLClient, gql } from 'graphql-request';
import {PoolData, pastPoolData, pastPoolTicks, pastPositionData} from './querys.js';
//import { PoolData, pastPoolTicks, pastPoolData, postPositionData } from 'querys.mjs';

const endpoint = `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`

const client = new GraphQLClient(endpoint)
export const id = `0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8`
const startblockd = "1620169800";

export function getPoolData (id) {
    var data = client.request(
        PoolData,
        {
            id: id,
    });

    return data;
}

export function getpastPoolData(id, block){
    var data = client.request(
        pastPoolData(block),
        {
            id: id,
    });

    return data;
}

export function getpastPoolTicks(id, tick, block){
    var data = client.request(
        pastPoolTicks(block),
        {
            id: id,
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

export function fetchpooldata(data){
    const [createdAtTimestamp, id, feeTier, token0, token1] = [data.pools[0].createdAtTimestamp, data.pools[0].id, data.pools[0].feeTier, data.pools[0].token0.symbol, data.pools[0].token1.symbol];

    return [createdAtTimestamp, id, feeTier, token0, token1];
}

const main = async() => {
    const blocknum = 12989464
    //const idlist = [];
    //todo : id list에 map함수 써서 돌리기
    const pooldata = await getPoolData(id);

    const [createdAtTimestamp, poolid, feeTier, token0, token1] = fetchpooldata(pooldata);

    const pastPools = await getpastPoolData(id, blocknum);
    //console.log(pastPools);

    //get past position datas -> put them into db
    const pastPositions = await getDatafromquery(pastPositionData(blocknum), {
        id: id,
    });

    //console.log(Object.keys(pastPositions.positions).length);
    //console.log(pastPositions.positions);

    const pastTicks = await getpastPoolTicks(id, 195799, blocknum);
    //console.log(typeof pastTicks.pools[0].ticks[0].tickIdx);
    // console.log("data test : ", pastPools.pools[0].feeGrowthGlobal0X128, pastPools.pools[0].feeGrowthGlobal1X128);
    // var index = 0;
    // for(index = 0; index < 50; index++){
    //     console.log(`index ${index}: `, getfeegrowthinside.calc(pastPools.pools[0].tick, pastPools.pools[0].feeGrowthGlobal0X128, pastPools.pools[0].feeGrowthGlobal1X128, pastTicks.pools[0].ticks[index], pastTicks.pools[0].ticks[index + 1]));
    // }

    //console.log()
}

main();