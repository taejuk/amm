import { nearestUsableTick } from '@uniswap/v3-sdk';
import {model, Schema, connect} from 'mongoose';
import { calculateFees }from './example';

interface Fee {
    startBlock: Number,
    endBlock: Number,
    tick: Number,
    liquidityNet: string,
    liquidityGross: string,
    feeGrowthInside0: string,
    feeGrowthInside1: string,
}

const schema = new Schema<Fee>({
    startBlock: { type: Number, required: true },
    endBlock: { type: Number, required: true },
    tick: { type: Number, required: true },
    liquidityNet: { type: String, required: true },
    liquidityGross: { type: String, required: true },
    feeGrowthInside0: { type: String, required: true },
    feeGrowthInside1: { type: String, required: true },
}) 

const tickFee = model<Fee>('Fees', schema);



async function run(): Promise<void> {
    // 4. Connect to MongoDB
    await connect("mongodb+srv://jw:1111@cluster0.yihvy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", {
        useFindAndModify: true,
        useCreateIndex: true,
    });
  
    const datas = await calculateFees(12999114, 13002308);
    
    //console.log(data);

    datas.map(async (data)=>{
        const Tick = new tickFee({
            startBlock: 12999114,
            endBlock: 13002308,
            tick: data.tick,
            liquidityNet: data.liquidityNet,
            liquidityGross: data.liquidityGross,
            feeGrowthInside0: data.feeGrowthInside0X,
            feeGrowthInside1: data.feeGrowthInside1X
        });

        await Tick.save();
    });
  }

  run().catch(err => console.log(err));
