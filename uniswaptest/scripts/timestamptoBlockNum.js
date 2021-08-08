const { GraphQLClient } = require('graphql-request');
const gql = require( 'graphql-tag' );

const GET_BLOCKS = (timestamps) => {
    let queryString = 'query blocks {'
    queryString += timestamps.map((timestamp) => {
      return `t${timestamp}:blocks(first: 1, orderBy: timestamp, orderDirection: desc, where: { timestamp_gt: ${timestamp}, timestamp_lt: ${
        timestamp + 600
      } }) {
          number
        }`
    })
    queryString += '}'
    return gql(queryString)
}


function useDeltaTimestamps(){
    const utcCurrentTime = dayjs()
    const t1 = utcCurrentTime.subtract(1, 'day').startOf('minute').unix()
    const t2 = utcCurrentTime.subtract(2, 'day').startOf('minute').unix()
    const tWeek = utcCurrentTime.subtract(1, 'week').startOf('minute').unix()
    return [t1, t2, tWeek]
}

const endpoint = `https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks`

const client = new GraphQLClient(endpoint);

const wow = async () => {
    //const qurey = GET_BLOCKS([1628332322]);
    //console.log(qurey);
    const data = await client.request(GET_BLOCKS([1628330000]))
    console.log(JSON.stringify(data, undefined, 2))
    //console.log(data)
}

wow()