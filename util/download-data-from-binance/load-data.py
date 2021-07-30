from datetime import date, timedelta
import requests
import zipfile
import sys
import os

BASEURL = "https://data.binance.vision/data/spot/daily/klines"
#add tokens to 'token.txt'
TOKEN = []
#set path to save datas.
DATAPATH = ""
FILES = []


def req(filename, token):
    interval = "5m"
    url = f"{BASEURL}/{token}/{interval}/{filename}"
    print("download data : {}".format(url))

    with open(DATAPATH + filename, 'wb') as f:
        response = requests.get(url)
        #예외처리 추가
        FILES.append(DATAPATH + filename)
        f.write(response.content)

def datarange(start, end):
    datelist = []
    for i in range((enddate - startdate).days+1):
        delta = timedelta(days=i)
        datelist.append(startdate+delta)

    return datelist

def unzip():
    for f in FILES:
        zipfile.ZipFile(f).extractall(DATAPATH)
        os.remove(f)


#arg1 = startdate as isoformat
#arg2 = enddate as isoformat
#DATAPATH 경로 확인 추가
if __name__ == "__main__":
    args = sys.argv

    if len(args) == 2:
        startdate = date.fromisoformat(args[1])
        enddate = date.today() - timedelta(days=1)
        
    if len(args) >2:
        exit(2)
    
    startdate = date.fromisoformat( args[1])
    enddate = date.fromisoformat(args[2])

    '''
    startdate = date(2021, 7, 22)
    enddate = date(2021, 7, 24)
    '''
    datelist = datarange(startdate, enddate)

    with open("binance/token.txt", 'r') as f:
        tokens = f.read()
        TOKEN = tokens.split()

    for t in TOKEN:
        for d in datelist:
            filename = f"{t}-5m-{d.isoformat()}.zip"
            req(filename, t)
    
    unzip()