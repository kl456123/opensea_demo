// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from 'hardhat'
import { impersonateAccount } from './impersonate'

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const signers = await ethers.getSigners()
  await impersonateAccount(['0xEab86111f25438674c096F965af57dC489DC4CEe', '0x2CF4ea7dF75b513509d95946B43062E26bD88035'])

  const Greeter = await ethers.getContractFactory('Greeter')
  const greeter = await Greeter.deploy('Hello, Hardhat!')

  await greeter.deployed()

  const WyvernProxyRegistry = await ethers.getContractFactory('WyvernProxyRegistry')
  const wyvernProxyRegistry = await WyvernProxyRegistry.deploy()
  await wyvernProxyRegistry.deployed()

  console.log('wyvernProxyRegistry deployed to:', wyvernProxyRegistry.address)

  const TokenTransferProxy = await ethers.getContractFactory('WyvernTokenTransferProxy')
  const tokenTransferProxy = await TokenTransferProxy.deploy(wyvernProxyRegistry.address)

  await tokenTransferProxy.deployed()

  console.log('tokenTransferProxy deployed to:', tokenTransferProxy.address)

  const totalUtxoAmount = 1000000000
  const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle tree root'))
  const WyvernToken = await ethers.getContractFactory('WyvernToken')
  const wyvernToken = await WyvernToken.deploy(merkleRoot, totalUtxoAmount)

  await wyvernToken.deployed()

  console.log('wyvernToken deployed to:', wyvernToken.address)

  const protocolFeeAddress = signers[0].address
  const WyvernExchange = await ethers.getContractFactory('WyvernExchange')

  const wyvernExchange = await WyvernExchange.deploy(
    wyvernProxyRegistry.address,
    tokenTransferProxy.address,
    wyvernToken.address,
    protocolFeeAddress
  )

  await wyvernExchange.deployed()
  console.log('wyvernExchange deployed to:', wyvernExchange.address)
  await wyvernProxyRegistry.grantInitialAuthentication(wyvernExchange.address)

  const WyvernDAO = await ethers.getContractFactory('WyvernDAO')
  const wyvernDAO = await WyvernDAO.deploy(wyvernToken.address)

  await wyvernDAO.deployed()
  console.log('wyvernDAO deployed to:', wyvernDAO.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
