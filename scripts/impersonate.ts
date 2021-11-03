import { network } from 'hardhat'

async function impersonateAccount(accounts: string[]) {
  for (const account of accounts) {
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [account],
    })
  }
}

export { impersonateAccount }
