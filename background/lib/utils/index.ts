import { utils } from "ethers"
import { normalizeHexAddress } from "@tallyho/hd-keyring"
import { HexString } from "../../types"
import { isEVMNetwork, EVMNetwork, Network } from "../../networks"
import {
  NETWORKS,
  ETHEREUM,
  ROPSTEN,
  RINKEBY,
  GOERLI,
  KOVAN,
} from "../../constants"

export function normalizeEVMAddress(address: string | Buffer): HexString {
  return normalizeHexAddress(address)
}

export function truncateDecimalAmount(
  value: number | string,
  decimalLength: number
): string {
  const valueString = value.toString()
  if (valueString.includes(".")) {
    const [integers, decimals] = valueString.split(".")
    return `${integers}.${decimals.substr(0, decimalLength)}`
  }
  return valueString
}

export function sameEVMAddress(
  address1: string | Buffer | undefined,
  address2: string | Buffer | undefined
): boolean {
  if (typeof address1 === "undefined" || typeof address2 === "undefined") {
    return false
  }
  return normalizeHexAddress(address1) === normalizeHexAddress(address2)
}

export function gweiToWei(value: number | bigint): bigint {
  return BigInt(utils.parseUnits(value.toString(), "gwei").toString())
}

export function convertToEth(value: string | number | bigint): string {
  if (value && value >= 1) {
    return utils.formatUnits(BigInt(value))
  }
  return ""
}

export function weiToGwei(value: string | number | bigint): string {
  if (value && value >= 1) {
    return truncateDecimalAmount(utils.formatUnits(BigInt(value), "gwei"), 2)
  }
  return ""
}

/**
 * Encode an unknown input as JSON, special-casing bigints and undefined.
 *
 * @param input an object, array, or primitive to encode as JSON
 */
export function encodeJSON(input: unknown): string {
  return JSON.stringify(input, (_, value) => {
    if (typeof value === "bigint") {
      return { B_I_G_I_N_T: value.toString() }
    }
    return value
  })
}

/**
 * Decode a JSON string, as encoded by `encodeJSON`, including bigint support.
 * Note that the functions aren't invertible, as `encodeJSON` discards
 * `undefined`.
 *
 * @param input a string output from `encodeJSON`
 */
export function decodeJSON(input: string): unknown {
  return JSON.parse(input, (_, value) =>
    value !== null && typeof value === "object" && "B_I_G_I_N_T" in value
      ? BigInt(value.B_I_G_I_N_T)
      : value
  )
}

/**
 * Determine which Ethereum network should be used based on the .env file
 */
export function getEthereumNetwork(): EVMNetwork {
  const ethereumNetwork = process.env.ETHEREUM_NETWORK?.toUpperCase()

  if (ethereumNetwork === "ROPSTEN") {
    return ROPSTEN
  }

  if (ethereumNetwork === "RINKEBY") {
    return RINKEBY
  }

  if (ethereumNetwork === "GOERLI") {
    return GOERLI
  }

  if (ethereumNetwork === "KOVAN") {
    return KOVAN
  }

  // Default to mainnet
  return ETHEREUM
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-5)}`
}

const networksByChainID: { [chainID: string]: EVMNetwork } = NETWORKS.reduce(
  (acc: { [chainID: string]: EVMNetwork }, network: Network) => {
    if (isEVMNetwork(network)) {
      acc[network.chainID] = network
    }
    return acc
  },
  {}
)

export function getEthereumNetworkFromChainID(
  chainID: string | number
): EVMNetwork | undefined {
  return networksByChainID[Number.parseInt(chainID as string, 10)]
}
