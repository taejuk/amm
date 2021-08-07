const { GraphQLClient, gql } = require('graphql-request')



const endpoint = `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`

const graphQLClient = new GraphQLClient(endpoint, {
    headers: {
        authorization: 'Bearer MY_TOKEN',
    },
})

const query = gql`
    {
        tickDayDatas(
            first:50
            orderBy: date
            where: {
                pool: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
                # date_gte: 1622419200
                # date_lte: 1622422800
                tick: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8#161160"
            }
        )
        {
            date
            # tick{
            #   tickIdx
            #   id
            # }
            liquidityGross
            liquidityNet
            volumeToken0
            volumeToken1
        }
    }
`
const wow = async () => {
    const data = await graphQLClient.request(query)
    console.log(JSON.stringify(data, undefined, 2))
}

wow()

