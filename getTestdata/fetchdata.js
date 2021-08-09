const { GraphQLClient } = require('graphql-request');
const gql = require( 'graphql-tag' );
const {PoolData, pastPoolData, pastPoolTicks} = require('./querys.js');
var mongoose = require('mongoose');
const getfeegrowthinside = require('./getFeegrowthinside.js');

const endpoint = `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`

const client = new GraphQLClient(endpoint)
const id = `0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8`;

async function getPoolData (id) {
    var data = await client.request(
        PoolData,
        {
            id: id,
    });

    return data;
}

async function getpastPoolData(id, block){
    var data = await client.request(
        pastPoolData(block),
        {
            id: id,
    });

    return data;
}

async function getpastPoolTicks(id, tick, block){
    var data = await client.request(
        pastPoolTicks(block),
        {
            id: id,
            tick: tick
    });

    return data;
}

function fetchpooldata(data){
    const [createdAtTimestamp, id, feeTier, token0, token1] = [data.pools[0].createdAtTimestamp, data.pools[0].id, data.pools[0].feeTier, data.pools[0].token0.symbol, data.pools[0].token1.symbol];

    return [createdAtTimestamp, id, feeTier, token0, token1];
}

const pool = mongoose.Schema({
    id: 'string',
    feeTier: 'number',
    token0: 'string',
    token1: 'string',
    createdAtTimestamp: 'number',
})

const main = async() => {
    //const idlist = [];
    //todo : id list에 map함수 써서 돌리기
    const pooldata = await getPoolData(id);
    const [createdAtTimestamp, poolid, feeTier, token0, token1] = fetchpooldata(pooldata);

    const pastPools = await getpastPoolData(id, 12984615);
    //console.log(pastPools);

    const pastTicks = await getpastPoolTicks(id, 195799, 12984615);
    //console.log(typeof pastTicks.pools[0].ticks[0].tickIdx);
    //console.log("data test : ", pastPools.pools[0].feeGrowthGlobal0X128, pastPools.pools[0].feeGrowthGlobal1X128);
    var index = 0;
    for(index = 0; index < 10; index++){
        console.log(`index ${index}: `, getfeegrowthinside.calc(pastPools.pools[0].tick, pastPools.pools[0].feeGrowthGlobal0X128, pastPools.pools[0].feeGrowthGlobal1X128, pastTicks.pools[0].ticks[index+100], pastTicks.pools[0].ticks[index + 101]));
    }

    //console.log()
}

main();