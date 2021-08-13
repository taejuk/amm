import {toWei, blockNumberToTimestamp, getCurrentBlock} from './utils';
import { getEvents, URI, ID, calculateFees, saveData } from './savedata';
import axios from 'axios';
import { getEventsQuery, getPoolQuery } from './querise';

const main = async () => {
    //const startTimestamp = await blockNumberToTimestamp(13002304);
    //const endTimestamp = await blockNumberToTimestamp(13002500);

    const data = await calculateFees(13002304, 1300250);
    //console.log(data)
    data.map((d)=>{
        if(d.feeGrowthInside0X !== )
            console.log(data);
    })
}

main();