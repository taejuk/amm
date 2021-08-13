import { BigintIsh } from "@uniswap/sdk-core";



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