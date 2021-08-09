const { GraphQLClient } = require('graphql-request');
const gql = require( 'graphql-tag' );
const dayjs = require('dayjs');
var duration = require('dayjs/plugin/duration');
dayjs.extend(duration);
//var Web3 = require("web3");

const endpoint = `https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks`

const client = new GraphQLClient(endpoint);

const GET_BLOCKS = (timestamps) => {
    let queryString = 'query blocks {'
    queryString += timestamps.map((timestamp) => {
      return `blocks(first: 1, orderBy: timestamp, orderDirection: desc, where: { timestamp_gt: ${timestamp}, timestamp_lt: ${
        timestamp + 600
      } }) {
          number
        }`
    })
    queryString += '}'
    return gql(queryString)
}

async function makeTimestampList(starttime){
    const utcCurrentTime = dayjs();
    const timelist = [];
    var t = dayjs.unix(starttime);
    const d = dayjs.duration(10, 'm');

    //console.log("teswt : ", t.unix());

    while(t.unix() < utcCurrentTime.unix()){
        timelist.push(t);
        console.log("cur time = ", t.unix());
        t = t.add(d);
        //console.log("add time = ", t.unix());
    }
    return timelist;
}

async function makeBlockNumList(timelist){
    const blockdata = timelist.map(
        async (timestamp) => {
            const data = await client.request(GET_BLOCKS([timestamp.unix()]));
            //console.log(await data);
            return data.blocks[0].number;
        }
    )
    return blockdata;
}



function useDeltaTimestamps(){
    const utcCurrentTime = dayjs()
    const t1 = utcCurrentTime.subtract(1, 'day').startOf('minute').unix()
    const t2 = utcCurrentTime.subtract(2, 'day').startOf('minute').unix()
    const tWeek = utcCurrentTime.subtract(1, 'week').startOf('minute').unix()
    return [t1, t2, tWeek]
}

const wow = async () => {
    //const qurey = GET_BLOCKS([1628332322]);
    //console.log(qurey);
    const data = await makeTimestampList(1628300000);
    const blocknums = await makeBlockNumList(data);
    Promise.all(blocknums).then((num) => console.log(num));
    //console.log(await blocknums);
    //console.log(data)
}

wow()