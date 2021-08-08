const sqlite3 = require('sqlite3').verbose();
const { GraphQLClient , gql} = require('graphql-request');


const endpoint = `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`

//const graphQLClient = new GraphQLClient(endpoint, {
//    headers: {
//        authorization: 'Bearer MY_TOKEN',
//    },
//})
const id = `0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8`;

const pooldata = gql`
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
            createdAtBlockNumber
        }
    }
`

const prePoolData = (block) => gql`
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

const preePoolTicks = (block) => gql`
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
            feeGrowthOutside0X128
            feeGrowthOutside1X128
        }
        ticks(
            where: {tickIdx_lt: $tick}
            orderBy: tickIdx
            first: 500
        ){
            tickIdx
            feeGrowthOutside0X128
            feeGrowthOutside1X128
        }
    }
}
`

const variables = {
    id: id,
};

const client = new GraphQLClient(endpoint);


const wow = async () => {
    //const data = await graphQLClient.request(query)
    //console.log(JSON.stringify(data, undefined, 2))
    //console.log(data)

    const data = await client.request(
        preePoolTicks(12984615),
        {
            id: id,
            tick: 195799,
        }
        );
    //console.log(Query("12984615"));
    //console.log(JSON.stringify(data, undefined, 2))
    console.log(Object.keys(data.pools[0].ticks).length)
    //console.log(parseInt(data.pools[0].feeTier, 10));
}

wow().catch(err=>{console.log("err~~~~", err)});




//1. variables... 해결 완료
//2. block 계산
//3. json 처리 -> sqlite에 저장
//4. feeinside 계산함수