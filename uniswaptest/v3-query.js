const { GraphQLClient, gql } = require('graphql-request')



const endpoint = `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`

const graphQLClient = new GraphQLClient(endpoint, {
    headers: {
        authorization: 'Bearer MY_TOKEN',
    },
})

const query = gql`
    {
        pools(whrer: {
            id: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
        })
        {
            createdAtBlockNumber
            liquidity
            sqrtPrice
            tick
            feeGrowthGlobal0X128
            feeGrowthGlobal1X128
            ticks{
                feeGrowthOutside0X128
                feeGrowthOutside0X128
            }
        }
    }
`
const wow = async () => {
    const data = await graphQLClient.request(query)
    //console.log(JSON.stringify(data, undefined, 2))
    console.log(data)
}

wow()

