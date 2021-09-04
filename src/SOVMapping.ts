import { BigInt } from '@graphprotocol/graph-ts';
import { SovToken, Mint } from "../generated/SovToken/SovToken";
import {Vote} from "../generated/ReignDAO/ReignDAO";
import { Mint as mintEntity } from "../generated/schema"
import { Vote as voteEntity } from "../generated/schema"

import { 
  getOrCreateAccount,
  GENESIS_ADDRESS
} from "./common";

import { toDecimal, ONE, ZERO } from "./helpers/numbers";

export function handleMint(event: Mint): void {
  let contractInstance = SovToken.bind(event.address);
  let tryDecimals = contractInstance.try_decimals();
  // params
  let to = getOrCreateAccount(event.params.to);
  to.save()
  let value = toDecimal(event.params.value, tryDecimals.value);
  let timestamp = event.block.timestamp;
  let transaction = event.transaction.hash;
  let transactionHex = event.transaction.hash.toHexString();

  let mint = mintEntity.load(transactionHex);
  if(mint == null) {
    mint = new mintEntity(transactionHex)
    mint.to = to.id
    mint.value = value
    mint.timestamp = timestamp
    mint.transaction = transaction

    mint.save()
  }
}

export function handleVote(event: Vote): void {
  let votingPower = event.params.power
  let proposalId = event.params.proposalId
  let support = event.params.support
  let user = getOrCreateAccount(event.params.user)
  user.save()
  let proposalIdHex = event.params.proposalId.toHexString()

  let vote = voteEntity.load(proposalIdHex)
  if(vote == null) {
    vote = new voteEntity(proposalIdHex)
    vote.proposalId = proposalId
    vote.user = user.id
    vote.support = support
    vote.votingPower = votingPower

    vote.save()
  }
}
