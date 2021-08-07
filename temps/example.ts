import {
  FeeAmount,
  isSorted,
  LiquidityMath,
  Tick,
  TickMath,
  TICK_SPACINGS,
} from "@uniswap/v3-sdk";
import { Token } from "@uniswap/sdk-core";
import { BigintIsh } from "@uniswap/sdk-core";
import invariant from "tiny-invariant";

import axios from "axios";
import { SwapMath } from "./swapMath";

import JSBI from "jsbi";

const NEGATIVE_ONE = JSBI.BigInt(-1);
const ZERO = JSBI.BigInt(0);
const ONE = JSBI.BigInt(1);

// used in liquidity amount math
const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));

interface TickConstructorArgs {
  index: number;
  liquidityGross: BigintIsh;
  liquidityNet: BigintIsh;
  fee0XGrowthInside: BigintIsh;
  fee1XGrowthInside: BigintIsh;
}

function tickComparator(a: TickWithFee, b: TickWithFee) {
  return a.index - b.index;
}

class TickList {
  private constructor() {}

  public static validateList(ticks: TickWithFee[], tickSpacing: number) {
    invariant(tickSpacing > 0, "TICK_SPACING_NONZERO");
    // ensure ticks are spaced appropriately
    invariant(
      ticks.every(({ index }) => index % tickSpacing === 0),
      "TICK_SPACING"
    );

    // ensure tick liquidity deltas sum to 0
    invariant(
      JSBI.equal(
        ticks.reduce(
          (accumulator, { liquidityNet }) =>
            JSBI.add(accumulator, liquidityNet),
          ZERO
        ),
        ZERO
      ),
      "ZERO_NET"
    );

    invariant(isSorted(ticks, tickComparator), "SORTED");
  }

  public static isBelowSmallest(ticks: TickWithFee[], tick: number): boolean {
    invariant(ticks.length > 0, "LENGTH");
    return tick < ticks[0].index;
  }

  public static isAtOrAboveLargest(
    ticks: TickWithFee[],
    tick: number
  ): boolean {
    invariant(ticks.length > 0, "LENGTH");
    return tick >= ticks[ticks.length - 1].index;
  }

  public static getTick(ticks: TickWithFee[], index: number): Tick {
    const tick = ticks[this.binarySearch(ticks, index)];
    invariant(tick.index === index, "NOT_CONTAINED");
    return tick;
  }

  public static binarySearch(ticks: TickWithFee[], tick: number): number {
    invariant(!this.isBelowSmallest(ticks, tick), "BELOW_SMALLEST");

    let l = 0;
    let r = ticks.length - 1;
    let i;
    while (true) {
      i = Math.floor((l + r) / 2);

      if (
        ticks[i].index <= tick &&
        (i === ticks.length - 1 || ticks[i + 1].index > tick)
      ) {
        return i;
      }

      if (ticks[i].index < tick) {
        l = i + 1;
      } else {
        r = i - 1;
      }
    }
  }

  public static nextInitializedTick(
    ticks: TickWithFee[],
    tick: number,
    lte: boolean
  ): Tick {
    if (lte) {
      invariant(!TickList.isBelowSmallest(ticks, tick), "BELOW_SMALLEST");
      if (TickList.isAtOrAboveLargest(ticks, tick)) {
        return ticks[ticks.length - 1];
      }
      const index = this.binarySearch(ticks, tick);
      return ticks[index];
    } else {
      invariant(!this.isAtOrAboveLargest(ticks, tick), "AT_OR_ABOVE_LARGEST");
      if (this.isBelowSmallest(ticks, tick)) {
        return ticks[0];
      }
      const index = this.binarySearch(ticks, tick);
      return ticks[index + 1];
    }
  }

  public static nextInitializedTickWithinOneWord(
    ticks: TickWithFee[],
    tick: number,
    lte: boolean,
    tickSpacing: number
  ): [number, boolean] {
    const compressed = Math.floor(tick / tickSpacing); // matches rounding in the code

    if (lte) {
      const wordPos = compressed >> 8;
      const minimum = (wordPos << 8) * tickSpacing;

      if (TickList.isBelowSmallest(ticks, tick)) {
        return [minimum, false];
      }

      const index = TickList.nextInitializedTick(ticks, tick, lte).index;
      const nextInitializedTick = Math.max(minimum, index);
      return [nextInitializedTick, nextInitializedTick === index];
    } else {
      const wordPos = (compressed + 1) >> 8;
      const maximum = ((wordPos + 1) << 8) * tickSpacing - 1;

      if (this.isAtOrAboveLargest(ticks, tick)) {
        return [maximum, false];
      }

      const index = this.nextInitializedTick(ticks, tick, lte).index;
      const nextInitializedTick = Math.min(maximum, index);
      return [nextInitializedTick, nextInitializedTick === index];
    }
  }
}

class TickWithFee extends Tick {
  public fee0XGrowthInside: JSBI;
  public fee1XGrowthInside: JSBI;
  constructor({
    index,
    liquidityGross,
    liquidityNet,
    fee0XGrowthInside,
    fee1XGrowthInside,
  }: TickConstructorArgs) {
    super({ index, liquidityGross, liquidityNet });
    this.fee0XGrowthInside = JSBI.BigInt(fee0XGrowthInside);
    this.fee1XGrowthInside = JSBI.BigInt(fee1XGrowthInside);
  }
}

class TickListDataProvider {
  public ticks: TickWithFee[];

  constructor(ticks: TickWithFee[], tickSpacing: number) {
    const ticksMapped: TickWithFee[] = ticks.map((t) =>
      t instanceof TickWithFee ? t : new TickWithFee(t)
    );
    TickList.validateList(ticksMapped, tickSpacing);
    this.ticks = ticksMapped;
  }

  async getTick(
    tick: number
  ): Promise<{ liquidityNet: BigintIsh; liquidityGross: BigintIsh }> {
    return TickList.getTick(this.ticks, tick);
  }

  async addFee(tick: number, fee: JSBI, zeroForOne: boolean): Promise<void> {
    const idx = TickList.binarySearch(this.ticks, tick);
    if (zeroForOne) {
      this.ticks[idx].fee0XGrowthInside = JSBI.ADD(
        this.ticks[idx].fee0XGrowthInside,
        fee
      );
    } else {
      this.ticks[idx].fee1XGrowthInside = JSBI.ADD(
        this.ticks[idx].fee1XGrowthInside,
        fee
      );
    }
  }

  async nextInitializedTickWithinOneWord(
    tick: number,
    lte: boolean,
    tickSpacing: number
  ): Promise<[number, boolean]> {
    return TickList.nextInitializedTickWithinOneWord(
      this.ticks,
      tick,
      lte,
      tickSpacing
    );
  }
}

interface StepComputations {
  sqrtPriceStartX96: JSBI;
  tickNext: number;
  initialized: boolean;
  sqrtPriceNextX96: JSBI;
  amountIn: JSBI;
  amountOut: JSBI;
  feeAmount: JSBI;
}
const ticks: TickWithFee[] = [];
const tickSpacing = TICK_SPACINGS[3000];
const TICK_DATA_PROVIDER = new TickListDataProvider(ticks, tickSpacing);

class PoolWithFee {
  public token0: Token;
  public token1: Token;
  public fee: FeeAmount;
  public sqrtRatioX96: JSBI;
  public liquidity: JSBI;
  public tickCurrent: number;
  public tickDataProvider: TickListDataProvider;
  public tickSpacing: number;

  public constructor(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    sqrtRatioX96: BigintIsh,
    liquidity: BigintIsh,
    tickCurrent: number,
    ticks: TickListDataProvider
  ) {
    invariant(Number.isInteger(fee) && fee < 1_000_000, "FEE");
    this.tickSpacing = TICK_SPACINGS[fee];
    const tickCurrentSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickCurrent);
    const nextTickSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickCurrent + 1);
    invariant(
      JSBI.greaterThanOrEqual(
        JSBI.BigInt(sqrtRatioX96),
        tickCurrentSqrtRatioX96
      ) &&
        JSBI.lessThanOrEqual(JSBI.BigInt(sqrtRatioX96), nextTickSqrtRatioX96),
      "PRICE_BOUNDS"
    );
    // always create a copy of the list since we want the pool's tick list to be immutable
    [this.token0, this.token1] = tokenA.sortsBefore(tokenB)
      ? [tokenA, tokenB]
      : [tokenB, tokenA];
    this.fee = fee;
    this.sqrtRatioX96 = JSBI.BigInt(sqrtRatioX96);
    this.liquidity = JSBI.BigInt(liquidity);
    this.tickCurrent = tickCurrent;
    this.tickDataProvider = Array.isArray(ticks)
      ? new TickListDataProvider(ticks, TICK_SPACINGS[fee])
      : ticks;
  }

  public async swap(
    zeroForOne: boolean,
    amountSpecified: JSBI,
    sqrtPriceLimitX96?: JSBI
  ): Promise<{
    amountCalculated: JSBI;
    sqrtRatioX96: JSBI;
    liquidity: JSBI;
    tickCurrent: number;
  }> {
    if (!sqrtPriceLimitX96)
      sqrtPriceLimitX96 = zeroForOne
        ? JSBI.add(TickMath.MIN_SQRT_RATIO, ONE)
        : JSBI.subtract(TickMath.MAX_SQRT_RATIO, ONE);

    if (zeroForOne) {
      invariant(
        JSBI.greaterThan(sqrtPriceLimitX96, TickMath.MIN_SQRT_RATIO),
        "RATIO_MIN"
      );
      invariant(
        JSBI.lessThan(sqrtPriceLimitX96, this.sqrtRatioX96),
        "RATIO_CURRENT"
      );
    } else {
      invariant(
        JSBI.lessThan(sqrtPriceLimitX96, TickMath.MAX_SQRT_RATIO),
        "RATIO_MAX"
      );
      invariant(
        JSBI.greaterThan(sqrtPriceLimitX96, this.sqrtRatioX96),
        "RATIO_CURRENT"
      );
    }

    const exactInput = JSBI.greaterThanOrEqual(amountSpecified, ZERO);

    // keep track of swap state

    const state = {
      amountSpecifiedRemaining: amountSpecified,
      amountCalculated: ZERO,
      sqrtPriceX96: this.sqrtRatioX96,
      tick: this.tickCurrent,
      liquidity: this.liquidity,
    };

    // start swap while loop
    while (
      JSBI.notEqual(state.amountSpecifiedRemaining, ZERO) &&
      state.sqrtPriceX96 != sqrtPriceLimitX96
    ) {
      let step: Partial<StepComputations> = {};
      step.sqrtPriceStartX96 = state.sqrtPriceX96;

      // because each iteration of the while loop rounds, we can't optimize this code (relative to the smart contract)
      // by simply traversing to the next available tick, we instead need to exactly replicate
      // tickBitmap.nextInitializedTickWithinOneWord
      [step.tickNext, step.initialized] =
        await this.tickDataProvider.nextInitializedTickWithinOneWord(
          state.tick,
          zeroForOne,
          this.tickSpacing
        );

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK;
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK;
      }

      step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);
      [state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
        SwapMath.computeSwapStep(
          state.sqrtPriceX96,
          (
            zeroForOne
              ? JSBI.lessThan(step.sqrtPriceNextX96, sqrtPriceLimitX96)
              : JSBI.greaterThan(step.sqrtPriceNextX96, sqrtPriceLimitX96)
          )
            ? sqrtPriceLimitX96
            : step.sqrtPriceNextX96,
          state.liquidity,
          state.amountSpecifiedRemaining,
          this.fee
        );
      this.tickDataProvider.addFee(state.tick, step.feeAmount, zeroForOne);

      if (exactInput) {
        state.amountSpecifiedRemaining = JSBI.subtract(
          state.amountSpecifiedRemaining,
          JSBI.add(step.amountIn, step.feeAmount)
        );
        state.amountCalculated = JSBI.subtract(
          state.amountCalculated,
          step.amountOut
        );
      } else {
        state.amountSpecifiedRemaining = JSBI.add(
          state.amountSpecifiedRemaining,
          step.amountOut
        );
        state.amountCalculated = JSBI.add(
          state.amountCalculated,
          JSBI.add(step.amountIn, step.feeAmount)
        );
      }

      // TODO
      if (JSBI.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
        // if the tick is initialized, run the tick transition
        if (step.initialized) {
          let liquidityNet = JSBI.BigInt(
            (await this.tickDataProvider.getTick(step.tickNext)).liquidityNet
          );
          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (zeroForOne)
            liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE);

          state.liquidity = LiquidityMath.addDelta(
            state.liquidity,
            liquidityNet
          );
        }

        state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
      } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
      }
    }

    return {
      amountCalculated: state.amountCalculated,
      sqrtRatioX96: state.sqrtPriceX96,
      liquidity: state.liquidity,
      tickCurrent: state.tick,
    };
  }
  public async modifyPosition(
    tickLower: number,
    tickUpper: number,
    liquidityDelta: number
  ) {}
  public async updatePosition(
    tickLower: number,
    tickUpper: number,
    liquidityDelta: number
  ) {}
  public async addLiquidity(
    tickLower: number,
    tickUpper: number,
    liquidityDelta: number
  ) {}
}

async function getPastPool() {
  const poolResult = await axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
      query: `{
        poolDayDatas(
          where: {
            pool: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
            date: 1628121600
          }
          ){
          liquidity
          feeGrowthGlobal0X128
          feeGrowthGlobal1X128
          sqrtPrice
          tick
        }
      }
      `,
    }
  );
  const Pool = poolResult.data.data.poolDayDatas[0];
  const pool: poolResult = {
    feeGrowthGlobal0X128: Pool.feeGrowthGlobal0X128,
    feeGrowthGlobal1X128: Pool.feeGrowthGlobal1X128,
    liquidity: Pool.liquidity,
    sqrtPrice: Pool.sqrtPrice,
    tick: Pool.tick,
  };
  console.log(Pool);
  const tickResult = await axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {
      query: `{
        tickDayDatas(
          first: 1000
          orderBy: liquidityGross
          orderDirection: desc
          where: {
            date: 1628121600
            pool: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
          }
          
          ){
          liquidityGross
          liquidityNet
          tick{
            tickIdx
          }
          feeGrowthOutside0X128
          feeGrowthOutside1X128
        }
      }`,
    }
  );
  const result = tickResult.data.data.tickDayDatas;

  let ticks: tickResult[] = result.map((value: any) => {
    return {
      ...value,
      tick: value.tick.tickIdx,
    };
  });
  // tick을 다 가져왔다고 가정하자 (연속적이라고 생각하자)

  ticks = ticks.sort(function (a, b): number {
    return a.tick < b.tick ? -1 : a.tick > b.tick ? 1 : 0;
  });
  const currentTick = pool.tick;
  const tickFinal: TickConstructorArgs[] = ticks.map(function (
    value,
    idx,
    array
  ) {
    if (idx === array.length - 1) {
      return {
        index: array[idx].tick,
        liquidityGross: array[idx].liquidityGross,
        liquidityNet: array[idx].liquidityNet,
        fee0XGrowthInside: "0",
        fee1XGrowthInside: "0",
      };
    }
    const [AboveX0, AboveX1] = getTickAbove(
      currentTick,
      pool.feeGrowthGlobal0X128,
      pool.feeGrowthGlobal1X128,
      array[idx + 1]
    );
    const [BelowX0, BelowX1] = getTickBelow(
      currentTick,
      pool.feeGrowthGlobal0X128,
      pool.feeGrowthGlobal1X128,
      array[idx]
    );
    const outside0x: JSBI = JSBI.ADD(BelowX0, AboveX0);
    const outside1x: JSBI = JSBI.ADD(BelowX1, AboveX1);
    return {
      index: array[idx].tick,
      liquidityGross: array[idx].liquidityGross,
      liquidityNet: array[idx].liquidityNet,
      fee0XGrowthInside: JSBI.subtract(
        JSBI.BigInt(pool.feeGrowthGlobal0X128),
        outside0x
      ),
      fee1XGrowthInside: JSBI.subtract(
        JSBI.BigInt(pool.feeGrowthGlobal1X128),
        outside1x
      ),
    };
  });
}

function getTickAbove(
  current: number,
  growth0XInside: BigintIsh,
  growth1XInside: BigintIsh,
  tick: tickResult
): [JSBI, JSBI] {
  // JSBI.BigInt로 바꿔야 한다.
  let fee0XAbove: JSBI;
  let fee1XAbove: JSBI;
  const foX0 = JSBI.BigInt(tick.feeGrowthOutside0X128);
  const foX1 = JSBI.BigInt(tick.feeGrowthOutside1X128);
  const global0X: JSBI = JSBI.BigInt(growth0XInside);
  const global1X = JSBI.BigInt(growth1XInside);
  if (current >= tick.tick) {
    fee0XAbove = JSBI.subtract(global0X, foX0);
    fee1XAbove = JSBI.subtract(global1X, foX1);
  } else {
    fee0XAbove = foX0;
    fee1XAbove = foX1;
  }
  return [fee0XAbove, fee1XAbove];
}

function getTickBelow(
  current: number,
  growth0XInside: BigintIsh,
  growth1XInside: BigintIsh,
  tick: tickResult
): [JSBI, JSBI] {
  // JSBI.BigInt로 바꿔야 한다.
  let fee0XBelow: JSBI;
  let fee1XBelow: JSBI;
  const foX0 = JSBI.BigInt(tick.feeGrowthOutside0X128);
  const foX1 = JSBI.BigInt(tick.feeGrowthOutside1X128);
  const global0X: JSBI = JSBI.BigInt(growth0XInside);
  const global1X: JSBI = JSBI.BigInt(growth1XInside);
  if (current >= tick.tick) {
    fee0XBelow = foX0;
    fee1XBelow = foX1;
  } else {
    fee0XBelow = JSBI.subtract(global0X, foX0);
    fee1XBelow = JSBI.subtract(global1X, foX1);
  }
  return [fee0XBelow, fee1XBelow];
}

interface TickConstructorArgs {
  index: number;
  liquidityGross: BigintIsh;
  liquidityNet: BigintIsh;
  fee0XGrowthInside: BigintIsh;
  fee1XGrowthInside: BigintIsh;
}

interface tickResult {
  feeGrowthOutside0X128: BigintIsh;
  feeGrowthOutside1X128: BigintIsh;
  liquidityGross: BigintIsh;
  liquidityNet: BigintIsh;
  tick: number;
}

interface poolResult {
  feeGrowthGlobal0X128: BigintIsh;
  feeGrowthGlobal1X128: BigintIsh;
  liquidity: BigintIsh;
  sqrtPrice: BigintIsh;
  tick: number;
}

getPastPool();
