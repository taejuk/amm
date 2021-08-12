export interface queryData{
    id: string,
    blockNumber?: Number,
    startTimestamp?: Number,
    endTimestamp?: Number,
}

export const getPoolQuery = (data: queryData)=>{
    `{
        pools(
          where: {
            id: ${data.id}  
          }
          block: {
            number: ${data.blockNumber}
          }
        ) {
          liquidity
          tick
          sqrtPrice
        }   
    }
        `
}

export const getTicksQuery = (data:queryData) => {
    `{
        ticks(where: {
          pool_contains: ${data.id}
        },
        block: {
          number: ${data.blockNumber}
        }
        first: 1000,
        ) {
          tickIdx
          liquidityNet
          liquidityGross
        }
      }
      `
}

export const getEventsQuery = (
    data: queryData,
    type: String
    ) => {
        if(type === 'swaps'){
            `{
                ${type}(
                  where: {
                    timestamp_gt: "${data.startTimestamp}"
                    timestamp_lt: "${data.endTimestamp}"
                    pool_contains: ${data.id}
                  },
                  orderBy: timestamp
                  orderDirection: asc
                  first: 1000
                ){
                  amount0
                  amount1
                  sqrtPriceX96
                  tick
                  timestamp
                }
              }
              `
        }
        else if(type === "mints"){
            return `{
                mints(
                  where: {
                    timestamp_gt: "${data.startTimestamp}"
                    timestamp_lt: "${data.endTimestamp}"
                    pool_contains: ${data.id}
                  },
                  orderBy: timestamp
                  orderDirection: asc
                ){
                  amount
                  tickLower
                  tickUpper
                  timestamp
                }
              }`
        }
        else if(type === "burns"){
            return `{
                mints(
                  where: {
                    timestamp_gt: "${data.startTimestamp}"
                    timestamp_lt: "${data.endTimestamp}"
                    pool_contains: ${data.id}
                  },
                  orderBy: timestamp
                  orderDirection: asc
                ){
                  amount
                  tickLower
                  tickUpper
                  timestamp
                }
              }`
        }
}

