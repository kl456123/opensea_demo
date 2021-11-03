import Web3 from 'web3'
import { OpenSeaPort, Network, EventType } from 'opensea-js'
import { personalSignAsync } from 'opensea-js/lib/utils/utils'
import dotenv from 'dotenv'
import {
  OrderSide,
  WyvernSchemaName,
  Order,
  OpenSeaAsset,
  OpenSeaFungibleToken,
  WyvernAtomicMatchParameters,
} from 'opensea-js/lib/types'
import { WyvernProtocol } from 'wyvern-js'
const HDWalletProvider = require('@truffle/hdwallet-provider')

dotenv.config()

const alice = process.env.ALICE_ADDR as string
const bob = process.env.BOB_ADDR as string
const alice_priv = process.env.ALICE_PASSWD as string
const bob_priv = process.env.BOB_PASSWD as string
// const node_url = 'https://rinkeby.infura.io/v3/' + process.env.INFURA_KEY
const node_url = 'https://eth-rinkeby.alchemyapi.io/v2/' + process.env.ALCHEMY_KEY
// const node_url = 'http://localhost:8545'
const privateKeys = [bob_priv, alice_priv]
const providerEngine = new HDWalletProvider({
  providerOrUrl: node_url,
  privateKeys: privateKeys,
  addressIndex: 0,
  numberOfAddresses: 2,
})

const web3 = new Web3(providerEngine)
const seaport = new OpenSeaPort(providerEngine, {
  networkName: Network.Rinkeby,
})
const wyvernProtocol = new WyvernProtocol(providerEngine, {
  network: Network.Rinkeby,
})

const NFT_CONTRACT_ADDRESS = '0x88B48F654c30e99bc2e4A1559b4Dcf1aD93FA656'
const NFT_TOKEN_ID = '20334494426157831016322978441194141312817876053725246429694930766026973904897'
let WETH: string
const NULL_BLOCK_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'

async function checkBalance(accounts: string[], asset: OpenSeaAsset, token: OpenSeaFungibleToken) {
  for (const account of accounts) {
    console.log('account: ', account)
    //////////////////////////////
    // ETH balance
    const eth_balance = await web3.eth.getBalance(account)
    console.log('eth balance: ', eth_balance.toString())

    //////////////////////////////
    // ERC20 balance
    const weth_balance = await seaport.getTokenBalance({
      accountAddress: account,
      tokenAddress: token.address,
    })
    console.log('weth balance: ', weth_balance.toString())

    //////////////////////////////
    // NFT balance
    const balance = await seaport.getAssetBalance({
      accountAddress: account, // string
      asset, // Asset,
    })
    console.log('NFT balance: ', balance.toString())
    console.log('\n')
  }
}

async function fixedPriceTest(buyer: string, seller: string, asset: OpenSeaAsset) {
  console.log('Auctioning an item for a fixed price...')

  // post order to server
  const fixedPriceSellOrder: Order = await seaport.createSellOrder({
    asset,
    startAmount: 0.1,
    expirationTime: 0,
    accountAddress: seller,
  })

  if (fixedPriceSellOrder && fixedPriceSellOrder.asset) {
    console.log(`Successfully created a fixed-price sell order!\
            ${fixedPriceSellOrder.asset.openseaLink}\n`)
  }

  // const sellValid = await seaport._validateOrder(fixedPriceSellOrder);

  // get order from server
  const order = await seaport.api.getOrder({
    side: OrderSide.Sell,
    token_id: NFT_TOKEN_ID,
    asset_contract_address: NFT_CONTRACT_ADDRESS,
  })

  // fulfill order on chain
  const transactionHash = await seaport.fulfillOrder({ order, accountAddress: buyer })
  console.log('Sales done in the transaction: ', transactionHash)
}

async function dutchAuctionTest(buyer: string, seller: string, asset: OpenSeaAsset) {
  const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24) // one day
  console.log('Dutch auctioning an item...')
  const dutchAuctionSellOrder = await seaport.createSellOrder({
    asset: asset,
    accountAddress: seller,
    startAmount: 0.05,
    endAmount: 0.01,
    expirationTime,
    paymentTokenAddress: WETH,
  })

  if (dutchAuctionSellOrder && dutchAuctionSellOrder.asset) {
    console.log(`Successfully created a dutch auction sell order! \
            ${dutchAuctionSellOrder.asset.openseaLink}\n`)
  }

  const order = await seaport.api.getOrder({
    side: OrderSide.Sell,
    token_id: NFT_TOKEN_ID,
    asset_contract_address: NFT_CONTRACT_ADDRESS,
  })
  console.log(order)
  // await seaport.cancelOrder({order: order, accountAddress: buyer});

  const transactionHash = await seaport.fulfillOrder({ order, accountAddress: buyer })
  console.log(transactionHash)
}

/**
 * submit matched orders to blockchain
 **/
async function submitOrders(
  {
    buy,
    sell,
    accountAddress,
  }: {
    buy: Order
    sell: Order
    accountAddress: string
  },
  retries?: number
) {
  let value = 0
  let shouldValidateBuy = true
  let shouldValidateSell = true
  // If using ETH to pay, set the value of the transaction to the current price
  if (buy.paymentToken == WyvernProtocol.NULL_ADDRESS) {
    throw new Error('Oops! ETH is not supported for english auction.')
    // value = sell.currentPrice.mul(sell.quantity);
  }

  await seaport._validateMatch({ buy, sell, accountAddress, shouldValidateBuy, shouldValidateSell })
  const txnData: any = { from: accountAddress, value }
  const args: WyvernAtomicMatchParameters = [
    [
      buy.exchange,
      buy.maker,
      buy.taker,
      buy.feeRecipient,
      buy.target,
      buy.staticTarget,
      buy.paymentToken,
      sell.exchange,
      sell.maker,
      sell.taker,
      sell.feeRecipient,
      sell.target,
      sell.staticTarget,
      sell.paymentToken,
    ],
    [
      buy.makerRelayerFee,
      buy.takerRelayerFee,
      buy.makerProtocolFee,
      buy.takerProtocolFee,
      buy.basePrice,
      buy.extra,
      buy.listingTime,
      buy.expirationTime,
      buy.salt,
      sell.makerRelayerFee,
      sell.takerRelayerFee,
      sell.makerProtocolFee,
      sell.takerProtocolFee,
      sell.basePrice,
      sell.extra,
      sell.listingTime,
      sell.expirationTime,
      sell.salt,
    ],
    [buy.feeMethod, buy.side, buy.saleKind, buy.howToCall, sell.feeMethod, sell.side, sell.saleKind, sell.howToCall],
    buy.calldata,
    sell.calldata,
    buy.replacementPattern,
    sell.replacementPattern,
    buy.staticExtradata,
    sell.staticExtradata,
    [buy.v || 0, sell.v || 0],
    [buy.r || NULL_BLOCK_HASH, buy.s || NULL_BLOCK_HASH, sell.r || NULL_BLOCK_HASH, sell.s || NULL_BLOCK_HASH, ''],
  ]

  const txHash = await wyvernProtocol.wyvernExchange.atomicMatch_.sendTransactionAsync(
    args[0],
    args[1],
    args[2],
    args[3],
    args[4],
    args[5],
    args[6],
    args[7],
    args[8],
    args[9],
    args[10],
    txnData
  )
  console.log('submit transaction: ', txHash)
}

async function englishAuctionTest(buyer: string, seller: string, asset: OpenSeaAsset) {
  const second = 20
  const expirationTime = Math.round(Date.now() / 1000 + second) // one minute
  console.log('English auctioning an item in WETH...')

  // sell order
  const englishAuctionSellOrder = await seaport.createSellOrder({
    asset: asset,
    startAmount: 1,
    expirationTime,
    waitForHighestBid: true,
    // englishAuctionReservePrice: 1.1,
    paymentTokenAddress: WETH,
    accountAddress: seller,
  })

  if (englishAuctionSellOrder && englishAuctionSellOrder.asset) {
    console.log(
      `Successfully created an English auction sell order! \
            ${englishAuctionSellOrder.asset.openseaLink}\n`
    )
  }

  // buy order
  const offer = await seaport.createBuyOrder({
    sellOrder: englishAuctionSellOrder,
    asset: asset,
    accountAddress: buyer,
    startAmount: 1,
  })

  if (offer && offer.asset) {
    console.log(
      `Successfully created an offer for the english auction! \
            ${offer.asset.openseaLink}\n`
    )
  }

  const sellOrder = englishAuctionSellOrder
  const buyOrder = offer
  if (sellOrder.r == null) {
    console.log('signing order...')
    const signature = await personalSignAsync(web3, sellOrder.hash, sellOrder.maker)
    sellOrder.r = signature.r
    sellOrder.s = signature.s
    sellOrder.v = signature.v
  }
  console.log('---------sellOrder------------\n')
  console.log(sellOrder)
  console.log('---------buyOrder------------\n')
  console.log(buyOrder)

  // const buyOrder = await seaport.api.getOrder({
  // side: OrderSide.Buy,
  // asset_contract_address: NFT_CONTRACT_ADDRESS,
  // token_id: NFT_TOKEN_ID,
  // })

  // order matching, the tx can be submited by anyone, operated by admin commonly
  await new Promise((resolve) => setTimeout(resolve, 1000 * second))

  const isMatch = await seaport._validateMatch({ buy: buyOrder, sell: sellOrder, accountAddress: buyer })
  console.log('ismatch: ', isMatch)
  if (isMatch) {
    await submitOrders({ buy: buyOrder, sell: sellOrder, accountAddress: buyer })
  } else {
    console.log('------------cancel orders---------------')
    await seaport.cancelOrder({ order: sellOrder, accountAddress: seller })
    await seaport.cancelOrder({ order: buyOrder, accountAddress: buyer })
  }
}

function registerListeners() {
  seaport.addListener(EventType.TransactionCreated, ({ transactionHash, event }) => {
    console.info({ transactionHash, event })
  })

  seaport.addListener(EventType.TransactionConfirmed, ({ transactionHash, event }) => {
    console.info({ transactionHash, event })
  })

  seaport.addListener(EventType.OrderDenied, ({ order, accountAddress }) => {
    console.info({ order, accountAddress })
  })
}

async function main() {
  // listener events
  registerListeners()

  ///////////////////////////////////////////////////
  //////// balance information NFT and ERC20 ////////
  // get nft
  const asset = await seaport.api.getAsset({
    tokenAddress: NFT_CONTRACT_ADDRESS,
    tokenId: NFT_TOKEN_ID,
  })
  // get erc20
  const token = (await seaport.api.getPaymentTokens({ symbol: 'WETH' })).tokens[0]
  console.log(token.address)

  // overwrite schemaName
  asset.schemaName = WyvernSchemaName.ERC1155
  WETH = token.address

  await checkBalance([alice, bob], asset, token)
  // await seaport.transfer({fromAddress: alice, toAddress: bob, asset, quantity: 1})

  ////////////////////////////////////////////////////////////
  // Post Order to OrderBook
  ////////////////////////////////////////////////////////////

  // Example: simple fixed-price sale of an item owned by a user.
  await fixedPriceTest(alice, bob, asset)

  // // Example: Dutch auction.
  // await dutchAuctionTest(alice, bob, asset);

  // // Example: English auction.
  // await englishAuctionTest(alice, bob, asset)
}

main().catch(console.error)
