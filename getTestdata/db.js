import * as querys from './fetchdata.js';
import mongoose from 'mongoose';

const Pools = mongoose.model('Schema', mongoose.Schema({
    createdAtTimestamp: 'number',
    poolId: {type: ['string'], index: true},
    feeTier: 'number',
    token0: 'string',
    token1: 'string',
}));


async function wow(){
  mongoose
    .connect("mongodb://127.0.0.1:27017/unitest", {
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

    querys.getPoolData(querys.id).then((data) => {
        const pool = data.pools[0];
        const pooldata = new Pools({
            createdAtTimestamp: pool.createdAtTimestamp,
            poolId: pool.id,
            feeTier: pool.feeTier,
            token0: pool.token0.symbol,
            token1: pool.token1.symbol
        });
        console.log(pooldata);
        //console.log(pool);

        return pooldata;
    }).then((data) =>{
        data.save((err, data)=>{
            if(err){
                console.log(err);
            } else{
                console.log("save!");
            }
        })
    });

    Pools.find((err, pool)=>{
        if(err){
            console.log(err);
        } else{
            console.log(pool);
        }
    })
    

// 



//         pooldata.save(function (err, ))
//     }
//   );


}
wow()