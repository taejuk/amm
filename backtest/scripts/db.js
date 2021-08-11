import { getPoolData, getDatafromquery } from './fetchdata.js';
import {PoolData, pastPoolData, pastPoolTicks, pastPositionData} from './querys.js';
import mongoose from 'mongoose';
import {testBlock, ID} from './constants.js';

export const Pools = mongoose.model('pools', mongoose.Schema({
    createdAtBlockNumber: 'number',
    createdAtTimestamp: 'number',
    poolId: {type: ['string'], index: true},
    feeTier: 'number',
    token0: 'string',
    token1: 'string',
}));

export const Positions = mongoose.model('positions', mongoose.Schema({
    block: { type: 'number', index: true},
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


async function savePositionsAtBlock(pool, block, db){
    //todo : add pool condition

    if(db.readyState !== 0 || db.readyState !== 3){
        for(var i = block; i < 12996142; i += 40){
            const datas = []
            var length = 1000;
            var check = 0;

            while(length === 1000){
                const fetched = await getDatafromquery(pastPositionData(i), {
                    id: ID,
                    num: 1000,
                    offset: check,
                });

                datas.concat(fetched.positions);
                length = Object.keys(fetched.positions).length
                //length = Object.keys(fetched.positions).length;
                check+=length;
                console.log("check : ", length);
            }

            console.log("length : ", length);

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
    else{
        console.log("fail", db.readyState);
    }



}

async function wow(){
    mongoose
    .connect("mongodb+srv://jw:1111@cluster0.yihvy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    });

    var db = mongoose.connection;

    // 4. 연결 실패
    db.on('error', function(){
        console.log('Connection Failed!');
    });
    // 5. 연결 성공
    db.once('open', function() {
        console.log('Connected!');
    });

    const set = await savePositionsAtBlock(1, testBlock, db);


}

wow();