import { GraphQLClient, gql } from 'graphql-request';


export const PoolData = gql`
query pooldata($id: String){
    pools(
        where: {
        id: $id
    })
    {
        id
        token0{ symbol }
        token1{ symbol }
        feeTier
        createdAtTimestamp
        createdAtBlockNumber
    }
}
`;

export const pastPoolData = (block) => gql`
query getPoolAtBlock($id: String){
    pools(
        block: {number: ${block}}
        where: {
        id: $id
    })
    {
        liquidity
        sqrtPrice
        tick
        feeGrowthGlobal0X128
        feeGrowthGlobal1X128
    }
}
`;

export const pastPoolTicks = (block) => gql`
query getTicksfromPool($id: String, $tick: BigInt){
    pools(
        block: {number: ${block}}
        where: {
        id: $id
    })
    {
        ticks(
            where: {tickIdx_lt: $tick}
            orderBy: tickIdx
            first: 500
        ){
            tickIdx
            liquidityNet
            liquidityGross
            feeGrowthOutside0X128
            feeGrowthOutside1X128
        }
    }
}
`;

export const pastPositionData = (block) => gql`
    query positionsAtblock($id: String){
        positions(
        block: {number: ${block}}
        where: {
            pool_contains: $id
        }
        orderBy: id
        first:50
        ){
        pool{
            token0{
                symbol
            }
            token1{
                symbol
            }
            id
            tick
        }
        id
        tickLower{
            tickIdx
        }
        tickUpper{
            tickIdx
        }
        liquidity
        feeGrowthInside0LastX128
        feeGrowthInside1LastX128
        }
    }
`;
