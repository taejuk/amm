import Web3 from "web3";
import {INFURA} from './constants';
import { tickResult } from "./savedata";
import JSBI from "jsbi";
import { BigintIsh } from "@uniswap/sdk-core";

const web3 = new Web3( INFURA );

export async function blockNumberToTimestamp(blockNumber: number) {
    const block = await web3.eth.getBlock(blockNumber);
    return block.timestamp;
}

export function toWei(data: any, option?: any){
    if(option)
        return web3.utils.toWei(data);
    else
        return web3.utils.toWei(data, option);
}


export function findNextTick(
    curTick: number,
    ticks: tickResult[],
    zeroForOne: boolean
  ): number {
    let idx = 0;
    ticks.forEach((tick, index) => {
      if (tick.tick == curTick - (curTick % 60)) {
        idx = index;
      }
    });
    if (zeroForOne) {
      return curTick % 60 == 0 ? idx - 1 : idx;
    } else {
      return idx + 1;
    }
}

export function findTickIdx(curTick: number, ticks: tickResult[]): number {
    let idx = -1;
    ticks.forEach((tick, index) => {
      if (tick.tick == curTick - (curTick % 60)) {
        idx = index;
      }
    });
    return idx;
}

export function add(a: BigintIsh, b: BigintIsh): string {
    return JSBI.ADD(JSBI.BigInt(a), JSBI.BigInt(b)).toString();
  }
export function sub(a: BigintIsh, b: BigintIsh): string {
    return JSBI.subtract(JSBI.BigInt(a), JSBI.BigInt(b)).toString();
  }
