import Web3 from "web3";

const web3 = new Web3(
    "https://mainnet.infura.io/v3/aaa10d98f1d144ca8d1c9d3b64e506fd"
  );

export async function blockNumberToTimestamp(blockNumber: number) {
    const block = await web3.eth.getBlock(blockNumber);
    return block.timestamp;
}

export function toWei(data: any, option?: any): Number{
    if(option)
        return web3.utils.toWei(data).toNumber();
    else
        return web3.utils.toWei(data, option).toNumber();
}