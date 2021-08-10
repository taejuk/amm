import { GraphQLClient, gql } from 'graphql-request';
import dayjs from 'dayjs';
//var duration = require('dayjs/plugin/duration');

import {duration, dayOfYear} from 'dayjs';
//import duration from'dayjs/plugin/duration'
dayjs.extend(duration);
dayjs.extend(dayOfYear);
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
//dayjs timestamp
function makeDayTimestamps (day){
    //onst dayduration = dayjs.duration(1, 'days');
    const minuteduration = dayjs().minute(10).unix();
    const endtime = day.add(1, 'd');
    const timestamps = [];

    console.log(day.unix(), " ", endtime.unix());
    for(var i = day.unix(); i < endtime.unix()-1; i+= minuteduration){
        timestamps.push(i);
    }
    console.log(timestamps.length);
    return timestamps
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

async function makeBlockNum(timestamp){
    const blockdata = await client.request(GET_BLOCKS([timestamp.unix()]));
    console.log(blockdata);
}

const wow = () => {
    //const qurey = GET_BLOCKS([1628332322]);
    //console.log(qurey);
    // const data = await makeTimestampList(1628300000);
    // const blocknums = await makeBlockNumList(data);
    // Promise.all(blocknums).then((num) => console.log(num));

    console.log(makeDayTimestamps(dayjs('2020-01-01').dayOfYear()));

    //console.log(await blocknums);
    //console.log(data)
}

wow()