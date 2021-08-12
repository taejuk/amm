import {toWei, blockNumberToTimestamp} from './utils';
import { getEvents, URI, ID, calculateFees } from './savedata';
import axios from 'axios';
import { getEventsQuery, getPoolQuery } from './querise';

const main = async () => {
    const startTimestamp = await blockNumberToTimestamp(13002304);
    const endTimestamp = await blockNumberToTimestamp(13002500);

    const result = await getEvents(startTimestamp, endTimestamp);


    console.log(await calculateFees(13002304, 13002500));
}

main();