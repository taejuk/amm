import axios from "axios";
import {getPoolQuery, getTicksQuery, getEventsQuery, queryData} from './querise';
import {toWei} from './blockNumberToTimestamp';



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

async function getPool(blockNumber: Number){
    const poolResult = await axios.post("https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
        query: getPoolQuery({
            id: id,
            blockNumber: blockNumber,
        })
    })

    const result: poolResult = poolResult.data.data.pools[0];
    const pool: poolResult = {
        liquidity: result.liquidity,
        sqrtPrice: result.sqrtPrice,
        tick: Number(result.tick),
    };
    return pool;
}

async function getTicks(blockNumber: Number){
    return await axios.post("https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
        query: getPoolQuery({
            id: id,
            blockNumber: blockNumber,
        })
    })
}

async function getPool(blockNumber: Number){
    return await axios.post("https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
        query: getPoolQuery({
            id: id,
            blockNumber: blockNumber,
        })
    })
}