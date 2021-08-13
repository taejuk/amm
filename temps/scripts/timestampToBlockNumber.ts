import { GraphQLClient, gql } from 'graphql-request'
import {blockNumberToTimestamp} from './utils';
//import dayjs from 'dayjs';


const endpoint = `https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks`

const client = new GraphQLClient(endpoint);

const GET_BLOCKS = (timestamp: number) => {
    let queryString = `query blocks {`
    queryString +=  `blocks(first: 10, orderBy: timestamp, orderDirection: asc, where: { timestamp_gt: ${timestamp}, timestamp_lt: ${
        timestamp + 100
      } }) {
          number
        }`

    queryString += `}`
    return gql`${queryString}`
}

export async function timestampToBlockNumber(timestamp: number): Promise<number>{
  //console.log("getTime from : ", timestamp);
  const data= await client.request(GET_BLOCKS(timestamp));
  //console.log("data : ", data.blocks[0].number);
  return data.blocks[0].number;
}

//timestampToBlockNumber(1628837480).then((data)=>console.log(data));
