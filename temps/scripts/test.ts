import {toWei, blockNumberToTimestamp, getCurrentBlock} from './utils';
import { getEvents, URI, ID, calculateFees, saveData } from './savedata';
import axios from 'axios';
import { getEventsQuery, getPoolQuery } from './querise';

const main = async () => {
    //const startTimestamp = await blockNumberToTimestamp(13002304);
    //const endTimestamp = await blockNumberToTimestamp(13002500);

    await saveData();
    const data = await calculateFees(13002304, 13002500);
    console.log(data)

}

main();