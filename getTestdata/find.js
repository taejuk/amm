import { getPoolData, id, getDatafromquery } from './fetchdata.js';
import {PoolData, pastPoolData, pastPoolTicks, pastPositionData} from './querys.js';
import mongoose from 'mongoose';


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


async function main(){

    mongoose
    .connect("mongodb+srv://jw:1111@cluster0.yihvy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    });

    Positions.find({
        feeGrowthInside0LastX128: {$gt: 100},
    }, function(error, data){
        console.log('--- Read all ---');
        if(error){
            console.log(error);
        }else{
            console.log(data);
        }
    });
}

main();
// Person.
//   find({
//     occupation: /host/,
//     'name.last': 'Ghost',
//     age: { $gt: 17, $lt: 66 },
//     likes: { $in: ['vaporizing', 'talking'] }
//   }).
//   limit(10).
//   sort({ occupation: -1 }).
//   select({ name: 1, occupation: 1 }).
//   exec(callback);