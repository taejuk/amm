import csv
from binance.client import Client
from binance.helpers import convert_ts_str
api_key = "qakqlyHObZY6zzfwlW28Db0Fw1WfRncS5TFIQg4BmWSPU9vZBqkoT0mvJMBS3hpF"
api_secret = "VUdsg8bFQN9Qkf4lH0zRk070g2NI7xM9F3rbp1vwhgYT6Va9tiBFKoEX9sIQOkIQ"

client = Client(api_key, api_secret)

#client.API_URL = "https://testnet.binance.vision/api"
# start와 end 표기법은 http://dateparser.readthedocs.io/en/latest/
# 예를 들어 2021.7.28 = "28 7 2021"
# 28일 데이터를 추출하려면 28 7 2021, 29 7 2021 넣으면 된다.


def get_price_per_10m(symbol, start, end):
    klines = client.get_historical_klines(symbol, Client.KLINE_INTERVAL_5MINUTE, start, end)
    price_per_10m = []
    i = 0
    for kline in klines:
        if (i%2 == 0):
            price_per_10m.append(float(kline[1]))
        i = i+1
    return price_per_10m[:-1]

def calculatePercent(prices):
    percents = []
    for i in range(0, len(prices)-1):
        percent = ((prices[i+1] - prices[i]) / prices[i]) * 100
        percents.append(percent)
    return percents

def writeCSV(filename, datas):
    f = open(filename, "w")
    wr = csv.writer(f)
    for data in datas:
        wr.writerow([str(data)])
    f.close()

def makeFileName(symbol, startDate):
    temp = startDate.split()
    fileName = symbol + "/" +temp[2]+'-'+temp[1]+'-'+temp[0]+".csv"
    return fileName


if __name__=="__main__":

    for i in range(1, 30):
        startDate = str(i)+" July 2021"
        endDate = str(i+1)+" July 2021"
        prices = get_price_per_10m("ETHUSDT", startDate, endDate)
        percents = calculatePercent(prices)
        fileName = makeFileName("ETHUSDT", startDate)
        writeCSV(fileName, percents)





