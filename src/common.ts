import { BigDecimal, Bytes, Address, ethereum } from '@graphprotocol/graph-ts'
// import { SovToken } from '../generated/SovToken/SovToken'

import { Account } from '../generated/schema'

// import { toDecimal, ONE, ZERO } from './helpers/numbers'
export const GENESIS_ADDRESS = '0x0000000000000000000000000000000000000000'

export function getOrCreateAccount(accountAddress: Bytes): Account {
    let accountId = accountAddress.toHexString()
    let existingAccount = Account.load(accountId)
  
    if (existingAccount != null) {
      return existingAccount as Account
    }
  
    let newAccount = new Account(accountId)
    newAccount.address = accountAddress
    
    return newAccount
  }