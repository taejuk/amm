import JSBI from "jsbi";


export const INFURA = "https://mainnet.infura.io/v3/aaa10d98f1d144ca8d1c9d3b64e506fd";
export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
export const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));
export const Q128 = JSBI.BigInt("0x100000000000000000000000000000000");
export const NEGATIVE_ONE = JSBI.BigInt(-1);
export const ZERO = JSBI.BigInt(0);
export const ONE = JSBI.BigInt(1);