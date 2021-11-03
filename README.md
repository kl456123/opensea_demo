# Opensea demo

## INSTRO

- a opensea demo to demostrate how to trade NFTs in orderbook based marketplace.
  There are some kinds of sales in the project, including dutch auction english
  auction and fixedprice sale.

## INSTALL

```bash
# 1. install packages
npm i

# 2. set environments
cp env_example .env
# then set two accounts and infura node key
ALICE_ADDR=0x124112521512414112
ALICE_PASSWD=esga1241512414124124214
INFURA_KEY=xxxxxxx

# 3. run
ts-node demo.ts
```

## Todo

1. REST api based server and database
2. UI
