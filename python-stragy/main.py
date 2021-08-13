import numpy as np
from pymongo import MongoClient

if __name__ == "__main__":
    # with open('./data1.txt','r') as f:
    #     json_data = json.load(f)

    client = MongoClient(
        "mongodb+srv://ncw:S2bSOviZTYNtMrZn@cluster0.yihvy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority")
    print(client)
    db = client['myFirstDatabase']
    print(db)
    ticks = db['blockdatas'].find()
    print(ticks)
    results = {}
    currentTick = 195836
    currentSqrtPrice = 1416420785473901422353916045772284
    plusTick = []
    minusTick = []
    for tick in ticks:
        print(tick)
        # tickInfo = json_data[tick]
        results[tick["tick"]] = {
            'liquidityNet': int(tick["liquidityGross"]),
            'feeGrowthInside0LastX128': int(tick["feeGrowthInside0"]),
            'feeGrowthInside1LastX128': int(tick["feeGrowthInside1"])
        }
        if (int(tick["tick"]) - currentTick > 0):
            plusTick.append(tick["tick"])
        else:
            minusTick.append(tick["tick"])
    plusTick.sort()
    minusTick.sort(reverse=True)
    maxTotals = 0
    maxIdx = -1
    for i in range(0, 50):
        total = 0
        liquidityDelta = pow(10, 20) / (currentSqrtPrice / pow(2, 96) - pow(1.0001, minusTick[i] / 2))

        for j in range(0, i + 1):
            total += results[plusTick[j]]['feeGrowthInside1LastX128'] * np.exp(
                -pow(abs(plusTick[j] - currentTick) * np.log(1.0001), 2)) * (
                             liquidityDelta / (liquidityDelta + results[plusTick[j]]['liquidityNet']))
            total += results[minusTick[j]]['feeGrowthInside1LastX128'] * np.exp(
                -pow(abs(minusTick[j] - currentTick) * np.log(1.0001), 2)) * (
                             liquidityDelta / (liquidityDelta + results[minusTick[j]]['liquidityNet']))

        if (maxTotals < total):
            maxIdx = i
            maxTotals = total
    print("maxIdx: ", maxIdx)
