import { createSlice } from "@reduxjs/toolkit"
import { createBackgroundAsyncThunk } from "./utils"
import { AccountBalance, AddressOnNetwork, NameOnNetwork } from "../accounts"
import { EVMNetwork, Network } from "../networks"
import { AnyAsset, AnyAssetAmount, SmartContractFungibleAsset } from "../assets"
import {
  AssetMainCurrencyAmount,
  AssetDecimalAmount,
} from "./utils/asset-utils"
import { DomainName, HexString, URI } from "../types"
import { normalizeEVMAddress, sameEVMAddress } from "../lib/utils"

/**
 * The set of available UI account types. These may or may not map 1-to-1 to
 * internal account types, depending on how the UI chooses to display data.
 */
export const enum AccountType {
  ReadOnly = "read-only",
  Imported = "imported",
  Ledger = "ledger",
  Internal = "internal",
}

const availableDefaultNames = [
  "Phoenix",
  "Matilda",
  "Sirius",
  "Topa",
  "Atos",
  "Sport",
  "Lola",
  "Foz",
]

type AccountData = {
  address: HexString
  network: Network
  balances: {
    [assetSymbol: string]: AccountBalance
  }
  ens: {
    name?: DomainName
    avatarURL?: URI
  }
  defaultName: string
  defaultAvatar: string
}

export type AccountState = {
  account?: AddressOnNetwork
  accountLoading?: string
  hasAccountError?: boolean
  accountsData: {
    evm: {
      [chainID: string]: {
        [address: string]: AccountData | "loading"
      }
    }
  }
  combinedData: CombinedAccountData
}

export type CombinedAccountData = {
  totalMainCurrencyValue?: string
  assets: AnyAssetAmount[]
}

// Utility type, wrapped in CompleteAssetAmount<T>.
type InternalCompleteAssetAmount<
  E extends AnyAsset = AnyAsset,
  T extends AnyAssetAmount<E> = AnyAssetAmount<E>
> = T & AssetMainCurrencyAmount & AssetDecimalAmount

/**
 * An asset amount including localized and numeric main currency and decimal
 * equivalents, where applicable.
 */
export type CompleteAssetAmount<T extends AnyAsset = AnyAsset> =
  InternalCompleteAssetAmount<T, AnyAssetAmount<T>>

export type CompleteSmartContractFungibleAssetAmount =
  CompleteAssetAmount<SmartContractFungibleAsset>

export const initialState = {
  accountsData: { evm: {} },
  combinedData: {
    totalMainCurrencyValue: "",
    assets: [],
  },
} as AccountState

function newAccountData(
  address: HexString,
  network: EVMNetwork,
  existingAccountsCount: number
): AccountData {
  const defaultNameIndex =
    // Skip potentially-used names at the beginning of the array if relevant,
    // see below.
    (existingAccountsCount % availableDefaultNames.length) +
    Number(
      // Treat the address as a number and mod it to get an index into
      // default names.
      BigInt(address) %
        BigInt(
          availableDefaultNames.length -
            (existingAccountsCount % availableDefaultNames.length)
        )
    )
  const defaultAccountName = availableDefaultNames[defaultNameIndex]

  // Move used default names to the start so they can be skipped above.
  availableDefaultNames.splice(defaultNameIndex, 1)
  availableDefaultNames.unshift(defaultAccountName)

  const defaultAccountAvatar = `./images/avatars/${defaultAccountName.toLowerCase()}@2x.png`

  return {
    address,
    network,
    balances: {},
    ens: {},
    defaultName: defaultAccountName,
    defaultAvatar: defaultAccountAvatar,
  }
}

function getOrCreateAccountData(
  data: AccountData | "loading",
  account: HexString,
  network: EVMNetwork,
  existingAccountsCount: number
): AccountData {
  if (data === "loading" || !data) {
    return newAccountData(account, network, existingAccountsCount)
  }
  return data
}

// TODO Much of the combinedData bits should probably be done in a Reselect
// TODO selector.
const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    loadAccount: (
      immerState,
      { payload: { address, network } }: { payload: AddressOnNetwork }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)
      if (
        immerState.accountsData.evm[network.chainID]?.[normalizedAddress] !==
        undefined
      ) {
        // If the account data already exists, the account is already loaded.
        return
      }

      immerState.accountsData.evm[network.chainID] ??= {}

      immerState.accountsData.evm[network.chainID] = {
        ...immerState.accountsData.evm[network.chainID],
        [normalizedAddress]: "loading",
      }
    },
    deleteAccount: (
      immerState,
      { payload: { address } }: { payload: AddressOnNetwork }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)

      const { evm } = immerState.accountsData

      if (
        // One of the chains
        !Object.keys(evm ?? {}).some((chainID) =>
          // has an address equal to the one we're trying to remove
          Object.keys(evm[chainID]).some(
            (addressOnChain) => addressOnChain === normalizedAddress
          )
        )
      ) {
        // If none of the chains we're tracking has a matching address - this is a noop.
        return
      }

      // Delete the account from all chains.
      Object.keys(evm).forEach((chainId) => {
        const { [normalizedAddress]: _, ...withoutEntryToRemove } = evm[chainId]

        immerState.accountsData.evm[chainId] = withoutEntryToRemove
      })
    },
    updateAccountBalance: (
      immerState,
      { payload: accountsWithBalances }: { payload: AccountBalance[] }
    ) => {
      accountsWithBalances.forEach((updatedAccountBalance) => {
        const {
          address,
          network,
          assetAmount: {
            asset: { symbol: updatedAssetSymbol },
          },
        } = updatedAccountBalance

        const normalizedAddress = normalizeEVMAddress(address)
        const existingAccountData =
          immerState.accountsData.evm[network.chainID]?.[normalizedAddress]

        // Don't upsert, only update existing account entries.
        if (existingAccountData === undefined) {
          return
        }

        if (existingAccountData !== "loading") {
          existingAccountData.balances[updatedAssetSymbol] =
            updatedAccountBalance
        } else {
          immerState.accountsData.evm[network.chainID][normalizedAddress] = {
            // TODO Figure out the best way to handle default name assignment
            // TODO across networks.
            ...newAccountData(
              address,
              network,
              Object.keys(immerState.accountsData.evm[network.chainID]).filter(
                (key) => !sameEVMAddress(key, address)
              ).length
            ),
            balances: {
              [updatedAssetSymbol]: updatedAccountBalance,
            },
          }
        }
      })

      // A key assumption here is that the balances of two accounts in
      // accountsData are mutually exclusive; that is, that there are no two
      // accounts in accountsData all or part of whose balances are shared with
      // each other.
      const combinedAccountBalances = Object.values(immerState.accountsData.evm)
        .flatMap((accountDataByChain) => Object.values(accountDataByChain))
        .flatMap((ad) =>
          ad === "loading"
            ? []
            : Object.values(ad.balances).map((ab) => ab.assetAmount)
        )

      immerState.combinedData.assets = Object.values(
        combinedAccountBalances.reduce<{
          [symbol: string]: AnyAssetAmount
        }>((acc, combinedAssetAmount) => {
          const assetSymbol = combinedAssetAmount.asset.symbol
          acc[assetSymbol] = {
            ...combinedAssetAmount,
            amount:
              (acc[assetSymbol]?.amount || 0n) + combinedAssetAmount.amount,
          }
          return acc
        }, {})
      )
    },
    updateAccountName: (
      immerState,
      {
        payload: { address, network, name },
      }: { payload: AddressOnNetwork & { name: DomainName } }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)

      // No entry means this name doesn't correspond to an account we are
      // tracking.
      if (
        immerState.accountsData.evm[network.chainID]?.[normalizedAddress] ===
        undefined
      ) {
        return
      }

      immerState.accountsData.evm[network.chainID] ??= {}

      const baseAccountData = getOrCreateAccountData(
        // TODO Figure out the best way to handle default name assignment
        // TODO across networks.
        immerState.accountsData.evm[network.chainID][normalizedAddress],
        normalizedAddress,
        network,
        Object.keys(immerState.accountsData.evm[network.chainID]).filter(
          (key) => key !== normalizedAddress
        ).length
      )

      immerState.accountsData.evm[network.chainID][normalizedAddress] = {
        ...baseAccountData,
        ens: { ...baseAccountData.ens, name },
      }
    },
    updateENSAvatar: (
      immerState,
      {
        payload: { address, network, avatar },
      }: { payload: AddressOnNetwork & { avatar: URI } }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)

      // No entry means this avatar doesn't correspond to an account we are
      // tracking.
      if (
        immerState.accountsData.evm[network.chainID]?.[normalizedAddress] ===
        undefined
      ) {
        return
      }

      immerState.accountsData.evm[network.chainID] ??= {}

      // TODO Figure out the best way to handle default name assignment
      // TODO across networks.
      const baseAccountData = getOrCreateAccountData(
        immerState.accountsData.evm[network.chainID][normalizedAddress],
        normalizedAddress,
        network,
        Object.keys(immerState.accountsData.evm[network.chainID]).filter(
          (key) => key !== normalizedAddress
        ).length
      )

      immerState.accountsData.evm[network.chainID][normalizedAddress] = {
        ...baseAccountData,
        ens: { ...baseAccountData.ens, avatarURL: avatar },
      }
    },
  },
})

export const {
  loadAccount,
  updateAccountBalance,
  updateAccountName,
  updateENSAvatar,
} = accountSlice.actions

export default accountSlice.reducer

/**
 * Async thunk whose dispatch promise will return a resolved name or undefined
 * if the name cannot be resolved.
 */
export const resolveNameOnNetwork = createBackgroundAsyncThunk(
  "account/resolveNameOnNetwork",
  async (nameOnNetwork: NameOnNetwork, { extra: { main } }) => {
    return main.resolveNameOnNetwork(nameOnNetwork)
  }
)

/**
 * Async thunk whose dispatch promise will return when the account has been
 * added.
 *
 * Actual account data will flow into the redux store through other channels;
 * the promise returned from this action's dispatch will be fulfilled by a void
 * value.
 */
export const addAddressNetwork = createBackgroundAsyncThunk(
  "account/addAccount",
  async (addressNetwork: AddressOnNetwork, { dispatch, extra: { main } }) => {
    const normalizedAddressNetwork = {
      address: normalizeEVMAddress(addressNetwork.address),
      network: addressNetwork.network,
    }

    dispatch(loadAccount(normalizedAddressNetwork))
    await main.addAccount(normalizedAddressNetwork)
  }
)

export const addOrEditAddressName = createBackgroundAsyncThunk(
  "account/addOrEditAddressName",
  async (payload: AddressOnNetwork & { name: string }, { extra: { main } }) => {
    await main.addOrEditAddressName(payload)
  }
)

export const removeAccount = createBackgroundAsyncThunk(
  "account/removeAccount",
  async (addressOnNetwork: AddressOnNetwork, { dispatch, extra: { main } }) => {
    const normalizedAddress = normalizeEVMAddress(addressOnNetwork.address)

    await dispatch(accountSlice.actions.deleteAccount(addressOnNetwork))

    main.removeAccount(normalizedAddress, { type: "keyring" })
  }
)
