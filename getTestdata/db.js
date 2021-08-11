import { getPoolData, id, getDatafromquery } from './fetchdata.js';
import {PoolData, pastPoolData, pastPoolTicks, pastPositionData} from './querys.js';
import mongoose from 'mongoose';

// const Pools = mongoose.model('Schema', mongoose.Schema({
//     createdAtBlockNumber: 'number',
//     createdAtTimestamp: 'number',
//     poolId: {type: ['string'], index: true},
//     feeTier: 'number',
//     token0: 'string',
//     token1: 'string',
// }));

const Positions = mongoose.model('Schema', mongoose.Schema({
    block: 'number',
    pool:{
        token0: 'string',
        tpken1: 'string',
        poolId: 'string',
    },
    id: 'string',
    tick: 'number',
    tickLower: 'number',
    tickUpper: 'number',
    liquidity: 'string',
    feeGrowthInside0LastX128: 'string',
    feeGrowthInside1LastX128: 'string',
}));

async function wow(){
  mongoose
    .connect("mongodb+srv://jw:1111@cluster0.yihvy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    });
    
    const db = mongoose.connection;

    // 4. 연결 실패
    db.on('error', function(){
        console.log('Connection Failed!');
    });
    // 5. 연결 성공
    db.once('open', function(data) {
        console.log('Connected!', data);
    });

    for(var i = 12370625; i < 12994616; i += 40){
        const datas = await getDatafromquery(pastPositionData(i), {
            id: id
        });

        const positiondatas = await datas.positions.map((position) =>{
            return new Positions({
                block: i,
                pool: {
                    token0: position.pool.token0.symbol,
                    tpken1: position.pool.token0.symbol,
                    poolId: position.pool.id,
                },
                id: position.id,
                tick: position.pool.tick,
                tickLower: position.tickLower.tickIdx,
                tickUpper: position.tickUpper.tickIdx,
                liquidity: position.liquidity,
                feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
                feeGrowthInside1LastX128: position.feeGrowthInside1LastX128,
            });
        });

        positiondatas.map((data) =>{
            data.save((err, data)=>{
                if(err){
                    console.log(err);
                } else{
                    console.log("save ", data.id);
                }
            })
        });
    }
}
wow()