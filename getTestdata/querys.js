const { GraphQLClient } = require('graphql-request');
const gql = require( 'graphql-tag' );


const PoolData = gql`
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
    }
}
`

const pastPoolData = (block) => gql`
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
`

const pastPoolTicks = (block) => gql`
query getTicksfromPool($id: String, $tick: BigInt){
    pools(
        block: {number: ${block}}
        where: {
        id: $id
    })
    {
        ticks(
            where: {tickIdx_gt: $tick}
            orderBy: tickIdx
            first: 500
        ){
            tickIdx
            liquidityGross
            feeGrowthOutside0X128
            feeGrowthOutside1X128
        }
    }
}
`

module.exports = {
    PoolData: PoolData,
    pastPoolData: pastPoolData,
    pastPoolTicks: pastPoolTicks,
}