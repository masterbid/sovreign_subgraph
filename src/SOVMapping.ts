import { BigInt, BigDecimal, Address, ethereum } from '@graphprotocol/graph-ts';
import { Mint, Burn, Sync } from "../generated/SovUsdc/SovUsdc";
import { IERC20 } from '../generated/SovUsdc/IERC20'
import { 
  Mint as MintEntity,
  Burn as BurnEntity,
  Pair as PairEntity,
  Token,
  Account as AccountEntity,
  AccountLiquidity as AccountLiquidityEntity,
  AccountPosition as AccountPositionEntity
} from "../generated/schema"

import { 
  getOrCreateAccount,
  TokenBalance,
  investInMarket,
  redeemFromMarket,
  ADDRESS_ZERO,
  getOrCreateERC20Token
} from "./common";

import { toDecimal } from "./helpers/numbers";

function getOrCreateMint(event: ethereum.Event, pair: PairEntity): MintEntity {
  let mint = MintEntity.load(event.transaction.hash.toHexString())
  if (mint != null) {
      return mint as MintEntity
  }

  let token0 = getOrCreateERC20Token(event, Address.fromString(pair.token0))
  let token1 = getOrCreateERC20Token(event, Address.fromString(pair.token1))
  token0.save()
  token1.save()

  mint = new MintEntity(event.transaction.hash.toHexString())
  mint.token0 = token0.id
  mint.token1 = token1.id
  mint.transferEventApplied = false
  mint.syncEventApplied = false
  mint.mintEventApplied = false
  mint.block = event.block.number
  mint.timestamp = event.block.timestamp
  mint.transaction = event.transaction.hash

  return mint as MintEntity
}

function getOrCreateBurn(event: ethereum.Event, pair: PairEntity): BurnEntity {
  let burn = BurnEntity.load(event.transaction.hash.toHexString())
  if (burn != null) {
      return burn as BurnEntity
  }

  burn = new BurnEntity(event.transaction.hash.toHexString())
  let token0 = getOrCreateERC20Token(event, Address.fromString(pair.token0))
  let token1 = getOrCreateERC20Token(event, Address.fromString(pair.token1))
  token0.save()
  token1.save()
  burn.transferEventApplied = false
  burn.syncEventApplied = false
  burn.burnEventApplied = false
  burn.block = event.block.number
  burn.timestamp = event.block.timestamp
  burn.transaction = event.transaction.hash
 
  return burn as BurnEntity
}

export function getOrCreateLiquidity(pair: PairEntity, accountAddress: Address): AccountLiquidityEntity {
  let id = pair.id.concat("-").concat(accountAddress.toHexString())
  let liqudity = AccountLiquidityEntity.load(id)
  if (liqudity != null) {
      return liqudity as AccountLiquidityEntity
  }
  liqudity = new AccountLiquidityEntity(id)
  liqudity.pair = pair.id
  liqudity.account = getOrCreateAccount(accountAddress).id
  liqudity.balance = BigInt.fromI32(0).toBigDecimal()
 
  return liqudity as AccountLiquidityEntity
}

function createOrUpdatePositionOnMint(event: ethereum.Event, pair: PairEntity, mint: MintEntity): void {
  let isComplete = mint.transferEventApplied && mint.syncEventApplied && mint.mintEventApplied
  if (!isComplete) {
      return
  }

  let accountAddress = Address.fromString(mint.sender)

  let account = new AccountEntity(mint.sender)
  let accountLiquidity = getOrCreateLiquidity(pair, accountAddress)

  let inputTokenAmounts: TokenBalance[] = []
  inputTokenAmounts.push(new TokenBalance(pair.token0, mint.sender, mint.amount0 as BigDecimal))
  inputTokenAmounts.push(new TokenBalance(pair.token1, mint.sender, mint.amount1 as BigDecimal))

  let outputTokenBalance = accountLiquidity.balance
  let token0Balance = outputTokenBalance.times(pair.reserve0).div(pair.totalSupply)
  let token1Balance = outputTokenBalance.times(pair.reserve1).div(pair.totalSupply)
  let inputTokenBalances: TokenBalance[] = []
  inputTokenBalances.push(new TokenBalance(pair.token0, mint.sender, token0Balance))
  inputTokenBalances.push(new TokenBalance(pair.token1, mint.sender, token1Balance))

  investInMarket(
    event,
    account,
    outputTokenBalance,
    inputTokenBalances,
    []
  )
}

function createOrUpdatePositionOnBurn(event: ethereum.Event, pair: PairEntity, burn: BurnEntity): void {
  let isComplete = burn.transferEventApplied && burn.syncEventApplied && burn.burnEventApplied
  if (!isComplete) {
      return
  }

  let accountAddress = Address.fromString(burn.sender)

  let account = new AccountEntity(burn.sender)
  let accountLiquidity = getOrCreateLiquidity(pair, accountAddress)

  let inputTokenAmounts: TokenBalance[] = []
  inputTokenAmounts.push(new TokenBalance(pair.token0, burn.sender, burn.amount0 as BigDecimal))
  inputTokenAmounts.push(new TokenBalance(pair.token1, burn.sender, burn.amount1 as BigDecimal))

  let outputTokenBalance = accountLiquidity.balance
  let token0Balance = outputTokenBalance.times(pair.reserve0).div(pair.totalSupply)
  let token1Balance = outputTokenBalance.times(pair.reserve1).div(pair.totalSupply)
  let inputTokenBalances: TokenBalance[] = []
  inputTokenBalances.push(new TokenBalance(pair.token0, burn.sender, token0Balance))
  inputTokenBalances.push(new TokenBalance(pair.token1, burn.sender, token1Balance))

  redeemFromMarket(
    event,
    account,
    outputTokenBalance,
    inputTokenBalances,
    [],
    null
  )
}


export function handleMint(event: Mint): void {
  let pair = PairEntity.load(event.address.toHexString()) as PairEntity
  let token0 = getOrCreateERC20Token(event, Address.fromString(pair.token0))
  let token1 = getOrCreateERC20Token(event, Address.fromString(pair.token1))
  let mint = getOrCreateMint(event, pair)
  mint.mintEventApplied = true
  mint.amount0 = toDecimal(event.params.amount0, token0.decimals)
  mint.amount1 = toDecimal(event.params.amount1, token1.decimals)
  mint.sender = getOrCreateAccount(event.params.sender).id
  mint.save()
  createOrUpdatePositionOnMint(event, pair, mint)
}

export function handleBurn(event: Burn): void {
  let pair = PairEntity.load(event.address.toHexString()) as PairEntity
  let token0 = getOrCreateERC20Token(event, Address.fromString(pair.token0))
  let token1 = getOrCreateERC20Token(event, Address.fromString(pair.token1))
  let burn = getOrCreateBurn(event, pair)
  burn.burnEventApplied = true
  burn.sender = getOrCreateAccount(event.params.sender).id
  burn.amount0 = toDecimal(event.params.amount0, token0.decimals)
  burn.amount1 = toDecimal(event.params.amount1, token1.decimals)
  burn.save()
  createOrUpdatePositionOnBurn(event, pair, burn)
}
export function handleSync(event: Sync): void {
  
}


