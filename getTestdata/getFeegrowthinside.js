const JSBI =require( "jsbi" );

module.exports.calc = (
    tickCurrent,
    feeGrowthGlobal0X128_in,
    feeGrowthGlobal1X128_in,
    lowerTick,
    upperTick
) => {

    console.log(lowerTick.tickIdx, " : ", lowerTick.feeGrowthOutside0X128, " ", lowerTick.liquidityNet);
    console.log(upperTick.tickIdx, " : ", upperTick.feeGrowthOutside0X128, " ", upperTick.liquidityNet);
    //console.log(tickCurrent);
    //console.log(feeGrowthGlobal0X128_in);
    //console.log(feeGrowthGlobal1X128_in);
    //console.log(lowerTick);
    //console.log(upperTick);

    feeGrowthGlobal0X128 = JSBI.BigInt(feeGrowthGlobal0X128_in);
    feeGrowthGlobal1X128 = JSBI.BigInt(feeGrowthGlobal1X128_in);
    var flag = 0000;
    // calculate fee growth below
    var feeGrowthBelow0X128;
    var feeGrowthBelow1X128;
    if (tickCurrent >= lowerTick.tickIdx) {
        feeGrowthBelow0X128 = JSBI.BigInt(lowerTick.feeGrowthOutside0X128);
        feeGrowthBelow1X128 = JSBI.BigInt(lowerTick.feeGrowthOutside1X128);
        flag += 1000;
    } else {
        feeGrowthBelow0X128 = JSBI.subtract(feeGrowthGlobal0X128, JSBI.BigInt(lowerTick.feeGrowthOutside0X128));
        feeGrowthBelow1X128 = JSBI.subtract(feeGrowthGlobal1X128, JSBI.BigInt(lowerTick.feeGrowthOutside1X128));
        flag += 100;
    }

    console.log("a : ", feeGrowthBelow0X128.toString()," ",
    feeGrowthBelow1X128.toString());

    // calculate fee growth above
    var feeGrowthAbove0X128;
    var feeGrowthAbove1X128;
    if (tickCurrent < upperTick.tickIdx) {
        feeGrowthAbove0X128 = JSBI.BigInt(upperTick.feeGrowthOutside0X128);
        feeGrowthAbove1X128 = JSBI.BigInt(upperTick.feeGrowthOutside1X128);
        flag += 10;
    } else {
        feeGrowthAbove0X128 = JSBI.subtract(feeGrowthGlobal0X128, JSBI.BigInt(upperTick.feeGrowthOutside0X128));
        feeGrowthAbove1X128 = JSBI.subtract(feeGrowthGlobal1X128, JSBI.BigInt(upperTick.feeGrowthOutside1X128));
        flag += 1;
    }

    console.log("b : ", feeGrowthAbove0X128.toString(), " ",
    feeGrowthAbove1X128.toString());

    console.log("case : ", flag);

    feeGrowthInside0X128 = JSBI.subtract(feeGrowthGlobal0X128, feeGrowthBelow0X128 );
    feeGrowthInside0X128 = JSBI.subtract(feeGrowthInside0X128, feeGrowthAbove0X128);

    feeGrowthInside1X128 = JSBI.subtract(feeGrowthGlobal1X128, feeGrowthBelow1X128 );
    feeGrowthInside1X128 = JSBI.subtract(feeGrowthInside1X128, feeGrowthAbove1X128);


    return [feeGrowthInside0X128.toString(), feeGrowthInside1X128.toString()];
}