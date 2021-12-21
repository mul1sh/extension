import {
  AlchemyProvider,
  AlchemyWebSocketProvider,
} from "@ethersproject/providers"
import { BigNumber, utils } from "ethers"

import logger from "./logger"
import { HexString } from "../types"
import {
  AssetTransfer,
  FungibleAsset,
  SmartContractFungibleAsset,
} from "../assets"
import { ETH } from "../constants"
import { jtdValidatorFor } from "./validation"
import { AnyEVMTransaction, EVMNetwork } from "../networks"

// JSON Type Definition for the Alchemy assetTransfers API.
// https://docs.alchemy.com/alchemy/documentation/enhanced-apis/transfers-api
//
// See RFC 8927 or jsontypedef.com to learn more about JTD.
const alchemyAssetTransferJTD = {
  properties: {
    asset: { type: "string", nullable: true },
    hash: { type: "string" },
    blockNum: { type: "string" },
    category: { enum: ["token", "internal", "external"] },
    from: { type: "string", nullable: true },
    to: { type: "string", nullable: true },
    erc721TokenId: { type: "string", nullable: true },
  },
  optionalProperties: {
    rawContract: {
      properties: {
        address: { type: "string", nullable: true },
        decimal: { type: "string", nullable: true },
        value: { type: "string", nullable: true },
      },
    },
  },
  additionalProperties: true,
} as const

const alchemyGetAssetTransfersJTD = {
  properties: {
    transfers: {
      elements: alchemyAssetTransferJTD,
    },
  },
  additionalProperties: true,
} as const

const isValidAlchemyAssetTransferResponse = jtdValidatorFor(
  alchemyGetAssetTransfersJTD
)

/**
 * Use Alchemy's getAssetTransfers call to get historical transfers for an
 * account.
 *
 * Note that pagination isn't supported in this wrapper, so any responses after
 * 1k transfers will be dropped.
 *
 * More information https://docs.alchemy.com/alchemy/documentation/apis/enhanced-apis/transfers-api#alchemy_getassettransfers
 * @param provider an Alchemy ethers provider
 * @param account the account whose transfer history we're fetching
 * @param fromBlock the block height specifying how far in the past we want
 *        to look.
 */
export async function getAssetTransfers(
  provider: AlchemyProvider | AlchemyWebSocketProvider,
  network: EVMNetwork,
  account: string,
  fromBlock: number,
  toBlock?: number
): Promise<AssetTransfer[]> {
  const params = {
    fromBlock: utils.hexValue(fromBlock),
    toBlock: toBlock === undefined ? "latest" : utils.hexValue(toBlock),
    // excludeZeroValue: false,
  }

  // TODO handle partial failure
  const rpcResponses = await Promise.all([
    provider.send("alchemy_getAssetTransfers", [
      {
        ...params,
        fromAddress: account,
      },
    ]),
    provider.send("alchemy_getAssetTransfers", [
      {
        ...params,
        toAddress: account,
      },
    ]),
  ])

  return rpcResponses
    .flatMap((jsonResponse: unknown) => {
      if (isValidAlchemyAssetTransferResponse(jsonResponse)) {
        return jsonResponse.transfers
      }

      logger.warn(
        "Alchemy asset transfer response didn't validate, did the API change?",
        jsonResponse,
        isValidAlchemyAssetTransferResponse.errors
      )
      return []
    })
    .map((transfer) => {
      // TODO handle NFT asset lookup properly
      if (transfer.erc721TokenId) {
        return null
      }

      // we don't care about 0-value transfers
      // TODO handle nonfungible assets properly
      // TODO handle assets with a contract address and no name
      if (
        !transfer.rawContract ||
        !transfer.rawContract.value ||
        !transfer.rawContract.decimal ||
        !transfer.asset
      ) {
        return null
      }

      const asset = !transfer.rawContract.address
        ? {
            contractAddress: transfer.rawContract.address,
            decimals: Number(BigInt(transfer.rawContract.decimal)),
            symbol: transfer.asset,
            homeNetwork: network,
          }
        : ETH
      return {
        network,
        assetAmount: {
          asset,
          amount: BigInt(transfer.rawContract.value),
        },
        txHash: transfer.hash,
        to: transfer.to,
        from: transfer.from,
        dataSource: "alchemy",
      } as AssetTransfer
    })
    .filter((t): t is AssetTransfer => t !== null)
}

// JSON Type Definition for the Alchemy token balance API.
// https://docs.alchemy.com/alchemy/documentation/enhanced-apis/token-api
//
// See RFC 8927 or jsontypedef.com for more detail to learn more about JTD.
const alchemyTokenBalanceJTD = {
  properties: {
    address: { type: "string" },
    tokenBalances: {
      elements: {
        properties: {
          contractAddress: { type: "string" },
          error: { type: "string", nullable: true },
          tokenBalance: { type: "string", nullable: true },
        },
      },
    },
  },
  additionalProperties: false,
} as const

const isValidAlchemyTokenBalanceResponse = jtdValidatorFor(
  alchemyTokenBalanceJTD
)

/**
 * Use Alchemy's getTokenBalances call to get balances for a particular address.
 *
 *
 * More information https://docs.alchemy.com/alchemy/documentation/enhanced-apis/token-api
 *
 * @param provider an Alchemy ethers provider
 * @param address the address whose balances we're fetching
 * @param tokens An optional list of hex-string contract addresses. If the list
 *        isn't provided, Alchemy will choose based on the top 100 high-volume
 *        tokens on its platform
 */
export async function getTokenBalances(
  provider: AlchemyProvider | AlchemyWebSocketProvider,
  address: HexString,
  tokens?: HexString[]
): Promise<{ contractAddress: string; amount: bigint }[]> {
  const json: unknown = await provider.send("alchemy_getTokenBalances", [
    address,
    tokens || "DEFAULT_TOKENS",
  ])
  if (!isValidAlchemyTokenBalanceResponse(json)) {
    logger.warn(
      "Alchemy token balance response didn't validate, did the API change?",
      json,
      isValidAlchemyTokenBalanceResponse.errors
    )
    return []
  }

  // TODO log balances with errors, consider returning an error type
  return (
    json.tokenBalances
      .filter(
        (
          b
        ): b is typeof json["tokenBalances"][0] & {
          tokenBalance: Exclude<
            typeof json["tokenBalances"][0]["tokenBalance"],
            null
          >
        } => b.error === null && b.tokenBalance !== null
      )
      // A hex value of 0x without any subsequent numbers generally means "no
      // value" (as opposed to 0) in Ethereum implementations, so filter it out
      // as effectively undefined.
      .filter(({ tokenBalance }) => tokenBalance !== "0x")
      .map((tokenBalance) => {
        let balance = tokenBalance.tokenBalance
        if (balance.length > 66) {
          balance = balance.substring(0, 66)
        }
        return {
          contractAddress: tokenBalance.contractAddress,
          amount: BigInt(balance),
        }
      })
  )
}

// JSON Type Definition for the Alchemy token metadata API.
// https://docs.alchemy.com/alchemy/documentation/enhanced-apis/token-api#alchemy_gettokenmetadata
//
// See RFC 8927 or jsontypedef.com for more detail to learn more about JTD.
const alchemyTokenMetadataJTD = {
  properties: {
    decimals: { type: "uint32" },
    name: { type: "string" },
    symbol: { type: "string" },
    logo: { type: "string", nullable: true },
  },
  additionalProperties: false,
} as const

const isValidAlchemyTokenMetadataResponse = jtdValidatorFor(
  alchemyTokenMetadataJTD
)

/**
 * Use Alchemy's getTokenMetadata call to get metadata for a token contract on
 * Ethereum.
 *
 * More information https://docs.alchemy.com/alchemy/documentation/enhanced-apis/token-api
 *
 * @param provider an Alchemy ethers provider
 * @param contractAddress the address of the token smart contract whose
 *        metadata should be returned
 */
export async function getTokenMetadata(
  provider: AlchemyProvider | AlchemyWebSocketProvider,
  network: EVMNetwork,
  contractAddress: HexString
): Promise<SmartContractFungibleAsset | null> {
  const json: unknown = await provider.send("alchemy_getTokenMetadata", [
    contractAddress,
  ])
  if (!isValidAlchemyTokenMetadataResponse(json)) {
    logger.warn(
      "Alchemy token metadata response didn't validate, did the API change?",
      json
    )
    return null
  }
  return {
    decimals: json.decimals,
    name: json.name,
    symbol: json.symbol,
    metadata: {
      tokenLists: [],
      ...(json.logo ? { logoURL: json.logo } : {}),
    },
    homeNetwork: network,
    contractAddress,
  }
}

/**
 * Parse a transaction as returned by an Alchemy provider subscription.
 */
export function transactionFromAlchemyWebsocketTransaction(
  websocketTx: unknown,
  asset: FungibleAsset,
  network: EVMNetwork
): AnyEVMTransaction {
  // These are the props we expect here.
  const tx = websocketTx as {
    hash: string
    to: string
    from: string
    gas: string
    gasPrice: string
    maxFeePerGas: string | undefined | null
    maxPriorityFeePerGas: string | undefined | null
    input: string
    r: string
    s: string
    v: string
    nonce: string
    value: string
    blockHash: string | undefined | null
    blockHeight: string | undefined | null
    blockNumber: number | undefined | null
    type: string | undefined | null
  }

  return {
    hash: tx.hash,
    to: tx.to,
    from: tx.from,
    gasLimit: BigInt(tx.gas),
    gasPrice: BigInt(tx.gasPrice),
    maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : null,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas
      ? BigInt(tx.maxPriorityFeePerGas)
      : null,
    input: tx.input,
    r: tx.r || undefined,
    s: tx.s || undefined,
    v: BigNumber.from(tx.v).toNumber(),
    nonce: Number(tx.nonce),
    value: BigInt(tx.value),
    blockHash: tx.blockHash ?? null,
    blockHeight: tx.blockNumber ?? null,
    type:
      tx.type !== undefined
        ? (BigNumber.from(tx.type).toNumber() as AnyEVMTransaction["type"])
        : 0,
    asset,
    network,
  }
}
