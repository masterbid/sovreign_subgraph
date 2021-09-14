import { BigDecimal, Bytes, BigInt, Address, ethereum } from '@graphprotocol/graph-ts'
import { IERC20 } from '../generated/SovUsdc/IERC20'

import { 
  Account,
  AccountPosition,
  Position,
  Token
} from '../generated/schema'

import { toDecimal, ONE, ZERO } from './helpers/numbers'
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export function getOrCreateAccount(accountAddress: Bytes): Account {
    let accountId = accountAddress.toHexString()
    let existingAccount = Account.load(accountId)
  
    if (existingAccount != null) {
      return existingAccount as Account
    }
  
    let newAccount = new Account(accountId)
    newAccount.address = accountAddress
    newAccount.save()
    return newAccount
}


export function getOrCreateERC20Token(event: ethereum.Event, address: Address): Token {
  let addressHex = address.toHexString()
  let token = Token.load(addressHex)
  if (token != null) {
      return token as Token
  }

  token = new Token(addressHex)
  token.address = address
  let tokenInstance = IERC20.bind(address)
  let tryName = tokenInstance.try_name()
  if (!tryName.reverted) {
      token.name = tryName.value
  }
  let trySymbol = tokenInstance.try_symbol()
  if (!trySymbol.reverted) {
      token.symbol = trySymbol.value
  }
  let tryDecimals = tokenInstance.try_decimals()
  if (!tryDecimals.reverted) {
      token.decimals = tryDecimals.value
  }
  token.save()
  return token as Token
}

export function getOrCreateOpenPosition(
  event: ethereum.Event,
  account: Account
): Position {
  let id = account.id
  let accountPosition = AccountPosition.load(id)
  if (accountPosition == null) {
      accountPosition = new AccountPosition(id)
      accountPosition.positionCounter = BigInt.fromI32(0)
      accountPosition.save()
  }

  let pid = accountPosition.id.concat("-").concat((accountPosition.positionCounter).toString())
  let lastPosition = Position.load(pid)

  if (lastPosition == null || lastPosition.closed) {
    let newCounter = accountPosition.positionCounter.plus(BigInt.fromI32(1))
    let newPositionId = id.concat("-").concat(newCounter.toString())
    let position = new Position(newPositionId)
    position.accountPosition = accountPosition.id
    position.account = account.id
    position.accountAddress = account.id
    position.outputTokenBalance = BigInt.fromI32(0).toBigDecimal()
    position.inputTokenBalances = []
    position.rewardTokenBalances = []
    position.transferredTo = []
    position.closed = false
    position.blockNumber = event.block.number
    position.timestamp = event.block.timestamp
    position.save()

    accountPosition.positionCounter = newCounter
    accountPosition.save()

    return position
  }

  return lastPosition as Position
}

export class TokenBalance {
  tokenAddress: string
  accountAddress: string
  balance: BigDecimal

  constructor(tokenAddress: string, accountAddress: string, balance: BigDecimal) {
      this.tokenAddress = tokenAddress
      this.accountAddress = accountAddress
      this.balance = balance
  }

  // Does not modify this or b TokenBalance, return new TokenBalance
  add(b: TokenBalance): TokenBalance {
      if (this.tokenAddress == b.tokenAddress) {
          return new TokenBalance(this.tokenAddress, this.accountAddress, this.balance.plus(b.balance))
      } else {
          return this
      }
  }

  toString(): string {
      return this.tokenAddress.concat("|").concat(this.accountAddress).concat("|").concat(this.balance.toString())
  }

  static fromString(tb: string): TokenBalance {
      let parts = tb.split("|")
      let tokenAddress = parts[0]
      let accountAddress = parts[1]
      let balance = BigInt.fromString(parts[2]).toBigDecimal()
      return new TokenBalance(tokenAddress, accountAddress, balance)
  }
}

function addTokenBalances(atbs: TokenBalance[], btbs: TokenBalance[]): TokenBalance[] {
  if (atbs.length == 0) {
      return btbs
  }

  if (btbs.length == 0) {
      return atbs
  }

  let atbsLength = atbs.length
  let btbsLength = btbs.length

  let sum: TokenBalance[] = []

  for (let i = 0; i < btbsLength; i = i + 1) {
      let bv = btbs[i]
      let found = false
      for (let j = 0; j < atbsLength; j = j + 1) {
          let av = atbs[j]
          if (av.tokenAddress == bv.tokenAddress) {
              found = true
              sum.push(av.add(bv))
          }
      }
      if (!found) {
          sum.push(bv)
      }
  }

  return sum
}

export function investInMarket(
  event: ethereum.Event,
  account: Account,
  outputTokenBalance: BigDecimal,
  inputTokenBalances: TokenBalance[],
  rewardTokenBalances: TokenBalance[],
): Position {
  let position = getOrCreateOpenPosition(event, account)
  
  position.inputTokenBalances = inputTokenBalances.map<string>(tb => tb.toString())
  position.outputTokenBalance = outputTokenBalance
  position.rewardTokenBalances = rewardTokenBalances.map<string>(tb => tb.toString())

  // Check if postion is closed
  if (position.outputTokenBalance == BigInt.fromI32(0).toBigDecimal()) {
      position.closed = true
  }
  position.save()

  return position
}

export function redeemFromMarket(
  event: ethereum.Event,
  account: Account,
  outputTokenBalance: BigDecimal,
  inputTokenBalances: TokenBalance[],
  rewardTokenBalances: TokenBalance[],
  transferredTo: string | null
): Position {
  let position = getOrCreateOpenPosition(event, account)
  
  // No change in investment amount as no new investment has been made
  position.inputTokenBalances = inputTokenBalances.map<string>(tb => tb.toString())
  position.outputTokenBalance = outputTokenBalance
  position.rewardTokenBalances = rewardTokenBalances.map<string>(tb => tb.toString())

  // Check if it is transferred to some other account
  if (transferredTo != null) {
      let exists = position.transferredTo.includes(transferredTo)
      if (!exists) {
          let newTransferredTo = position.transferredTo
          newTransferredTo.push(transferredTo)
          position.transferredTo = newTransferredTo
      }
  }

  // Check if postion is closed
  if (position.outputTokenBalance == BigInt.fromI32(0).toBigDecimal()) {
      position.closed = true
  }
  position.save()

  return position
}