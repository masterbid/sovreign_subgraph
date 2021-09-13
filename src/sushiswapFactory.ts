import { Pair as PairEntity } from "../generated/schema"

import {
    PairCreated
} from "../generated/SushiswapFactory/SushiswapFactory"
import {
    getOrCreateERC20Token
} from "./common"
import { ZERO } from "./helpers/numbers";

const SOV_USDC = '0x9b98ff54446c7ccf3118f980b5f32520d7fa5207'

export function handlePairCreated(event: PairCreated): void {
    let pairAddress = event.params.pair.toHexString()
    if(pairAddress == SOV_USDC){
        
        // Create a tokens and market entity
        let token0 = getOrCreateERC20Token(event, event.params.token0)
        let token1 = getOrCreateERC20Token(event, event.params.token1)
        
        // Create pair
        let pair = new PairEntity(pairAddress)
        pair.token0 = token0.id
        pair.token1 = token1.id
        pair.totalSupply = ZERO.toBigDecimal()
        pair.reserve0 = ZERO.toBigDecimal()
        pair.reserve1 = ZERO.toBigDecimal()
        pair.blockNumber = event.block.number
        pair.timestamp = event.block.timestamp
        pair.save()

    }
    
}