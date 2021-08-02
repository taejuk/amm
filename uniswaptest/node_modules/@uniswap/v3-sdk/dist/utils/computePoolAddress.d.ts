import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '../constants';
/**
 * Computes a pool address
 * @param factoryAddress The Uniswap V3 factory address
 * @param tokenA The first token of the pair, irrespective of sort order
 * @param tokenB The second token of the pair, irrespective of sort order
 * @param fee The fee tier of the pool
 * @returns The pool address
 */
export declare function computePoolAddress({ factoryAddress, tokenA, tokenB, fee, initCodeHashManualOverride }: {
    factoryAddress: string;
    tokenA: Token;
    tokenB: Token;
    fee: FeeAmount;
    initCodeHashManualOverride?: string;
}): string;
