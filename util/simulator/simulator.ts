import { BigintIsh } from "@uniswap/sdk-core";
import axios from "axios";
import JSBI from "jsbi";
import Web3 from "web3";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();
const { MONGO_URI } = process.env;
const web3 = new Web3(
  "https://mainnet.infura.io/v3/aaa10d98f1d144ca8d1c9d3b64e506fd"
);

interface SwapAmounts {
  startBlockNumber: number;
  endBlockNumber: number;
  amount0: string;
  amount1: string;
}

const blockNumberToTimestamp = async (blockNumber: number) => {
  const block = await web3.eth.getBlock(blockNumber);
  return block.timestamp;
};

const swapQuery = (
  startTimestamp: string | number,
  endTimestamp: string | number
) => `{
      swaps(
        where: {
          timestamp_gt: "${startTimestamp}"
          timestamp_lt: "${endTimestamp}"
          pool_contains: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
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
    }`;
const getSwapsAmounts = async (
  startBlockNumber: number,
  endBlockNumber: number
)=> {
  let startTimestamp = await blockNumberToTimestamp(startBlockNumber);
  const endTimestamp = await blockNumberToTimestamp(endBlockNumber);
  let swaps: any[] = [];
  let swapAmounts: SwapAmounts = {
    amount0: "0",
    amount1: "0",
    startBlockNumber: startBlockNumber,
    endBlockNumber: endBlockNumber,
  };
  while (1) {
    const result = await axios.post(
      "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
      {
        query: swapQuery(startTimestamp, endTimestamp),
      }
    );
    if (result.data.data.swaps.length == 0) {
      break;
    }
    startTimestamp =
      result.data.data.swaps[result.data.data.swaps.length - 1].timestamp;
    const swapsResult = result.data.data.swaps.map((swap: any) => ({
      timestamp: Number(swap.timestamp),
      tick: Number(swap.tick),
      amount0: web3.utils.toWei(swap.amount0, "picoether"),
      amount1: web3.utils.toWei(swap.amount1),
      sqrtPriceX96: swap.sqrtPriceX96,
      type: "swap",
    }));
    swaps = swaps.concat(swapsResult);
    for (let swap of swaps) {
      if (JSBI.greaterThan(JSBI.BigInt(swap.amount0), JSBI.BigInt("0"))) {
        swapAmounts.amount0 = JSBI.add(
          JSBI.BigInt(swapAmounts.amount0),
          JSBI.BigInt(swap.amount0)
        ).toString();
      } else {
        swapAmounts.amount1 = JSBI.add(
          JSBI.BigInt(swapAmounts.amount1),
          JSBI.BigInt(swap.amount1)
        ).toString();
      }
    }
  }
  swapAmounts.amount0 = web3.utils.fromWei(swapAmounts.amount0, "picoether");
  swapAmounts.amount1 = web3.utils.fromWei(swapAmounts.amount1);
  //return swapAmounts;
  return swaps;
};



getSwapsAmounts(13093580, 13096535).then((data)=>{
    fs.writeFile ("swaps.json", JSON.stringify(data), function(err) {
        if (err) throw err;
        console.log('complete');
        }
    );
})
