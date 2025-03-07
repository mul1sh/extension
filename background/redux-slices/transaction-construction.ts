import { createSlice, createSelector } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { FORK } from "../constants"
import {
  EXPRESS,
  INSTANT,
  MAX_FEE_MULTIPLIER,
  REGULAR,
  CUSTOM,
} from "../constants/network-fees"
import { USE_MAINNET_FORK } from "../features"

import {
  BlockEstimate,
  BlockPrices,
  EIP1559TransactionRequest,
  SignedEVMTransaction,
} from "../networks"
import {
  EnrichedEIP1559TransactionRequest,
  EnrichedEVMTransactionSignatureRequest,
} from "../services/enrichment"
import { SigningMethod } from "../utils/signing"

import { createBackgroundAsyncThunk } from "./utils"

export const enum TransactionConstructionStatus {
  Idle = "idle",
  Pending = "pending",
  Loaded = "loaded",
  Signed = "signed",
}

export type NetworkFeeSettings = {
  feeType: NetworkFeeTypeChosen
  gasLimit: bigint | undefined
  suggestedGasLimit: bigint | undefined
  values: {
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
  }
}

export enum NetworkFeeTypeChosen {
  Regular = "regular",
  Express = "express",
  Instant = "instant",
  Custom = "custom",
}
export type TransactionConstruction = {
  status: TransactionConstructionStatus
  transactionRequest?: EnrichedEIP1559TransactionRequest
  signedTransaction?: SignedEVMTransaction
  broadcastOnSign?: boolean
  transactionLikelyFails?: boolean
  estimatedFeesPerGas: EstimatedFeesPerGas | undefined
  lastGasEstimatesRefreshed: number
  feeTypeSelected: NetworkFeeTypeChosen
}

export type EstimatedFeesPerGas = {
  baseFeePerGas?: bigint
  instant?: BlockEstimate
  express?: BlockEstimate
  regular?: BlockEstimate
  custom?: BlockEstimate
}

export const initialState: TransactionConstruction = {
  status: TransactionConstructionStatus.Idle,
  feeTypeSelected: NetworkFeeTypeChosen.Regular,
  estimatedFeesPerGas: {
    custom: {
      maxFeePerGas: 1n,
      confidence: CUSTOM,
      maxPriorityFeePerGas: 1n,
    },
  },
  lastGasEstimatesRefreshed: Date.now(),
}

export interface SignatureRequest {
  transaction: EIP1559TransactionRequest
  method: SigningMethod
}

export type Events = {
  updateOptions: EnrichedEVMTransactionSignatureRequest
  requestSignature: SignatureRequest
  signatureRejected: never
  broadcastSignedTransaction: SignedEVMTransaction
}

export type GasOption = {
  confidence: string
  estimatedSpeed: string
  type: NetworkFeeTypeChosen
  estimatedGwei: string
  maxPriorityGwei: string
  maxGwei: string
  dollarValue: string
  estimatedFeePerGas: bigint // wei
  baseMaxFeePerGas: bigint // wei
  baseMaxGwei: string
  maxFeePerGas: bigint // wei
  maxPriorityFeePerGas: bigint // wei
}

export const emitter = new Emittery<Events>()

const makeBlockEstimate = (
  type: number,
  estimatedFeesPerGas: BlockPrices
): BlockEstimate => {
  return {
    maxFeePerGas:
      (estimatedFeesPerGas.baseFeePerGas * MAX_FEE_MULTIPLIER[type]) / 10n,
    confidence: type,
    maxPriorityFeePerGas:
      estimatedFeesPerGas.estimatedPrices.find((el) => el.confidence === type)
        ?.maxPriorityFeePerGas ?? 0n,
    price:
      estimatedFeesPerGas.estimatedPrices.find((el) => el.confidence === type)
        ?.price ?? 0n,
  }
}

// Async thunk to pass transaction options from the store to the background via an event
export const updateTransactionOptions = createBackgroundAsyncThunk(
  "transaction-construction/update-options",
  async (options: EnrichedEVMTransactionSignatureRequest) => {
    await emitter.emit("updateOptions", options)
  }
)

export const signTransaction = createBackgroundAsyncThunk(
  "transaction-construction/sign",
  async (request: SignatureRequest) => {
    if (USE_MAINNET_FORK) {
      request.transaction.chainID = FORK.chainID
    }

    await emitter.emit("requestSignature", request)
  }
)

const transactionSlice = createSlice({
  name: "transaction-construction",
  initialState,
  reducers: {
    transactionRequest: (
      state,
      {
        payload: { transactionRequest, transactionLikelyFails },
      }: {
        payload: {
          transactionRequest: EIP1559TransactionRequest
          transactionLikelyFails: boolean
        }
      }
    ) => ({
      ...state,
      status: TransactionConstructionStatus.Loaded,
      signedTransaction: undefined,
      transactionRequest: {
        ...transactionRequest,
        maxFeePerGas:
          state.estimatedFeesPerGas?.[state.feeTypeSelected]?.maxFeePerGas ??
          transactionRequest.maxFeePerGas,
        maxPriorityFeePerGas:
          state.estimatedFeesPerGas?.[state.feeTypeSelected]
            ?.maxPriorityFeePerGas ?? transactionRequest.maxPriorityFeePerGas,
      },
      transactionLikelyFails,
    }),
    clearTransactionState: (
      state,
      { payload }: { payload: TransactionConstructionStatus }
    ) => ({
      estimatedFeesPerGas: state.estimatedFeesPerGas,
      lastGasEstimatesRefreshed: state.lastGasEstimatesRefreshed,
      status: payload,
      feeTypeSelected: state.feeTypeSelected ?? NetworkFeeTypeChosen.Regular,
      broadcastOnSign: false,
      signedTransaction: undefined,
    }),
    setFeeType: (
      state,
      { payload }: { payload: NetworkFeeTypeChosen }
    ): TransactionConstruction => ({
      ...state,
      feeTypeSelected: payload,
    }),

    signed: (state, { payload }: { payload: SignedEVMTransaction }) => ({
      ...state,
      status: TransactionConstructionStatus.Signed,
      signedTransaction: payload,
    }),
    broadcastOnSign: (state, { payload }: { payload: boolean }) => ({
      ...state,
      broadcastOnSign: payload,
    }),
    transactionLikelyFails: (state) => ({
      ...state,
      transactionLikelyFails: true,
    }),
    estimatedFeesPerGas: (
      immerState,
      { payload: estimatedFeesPerGas }: { payload: BlockPrices }
    ) => {
      immerState.estimatedFeesPerGas = {
        ...immerState.estimatedFeesPerGas,
        baseFeePerGas: estimatedFeesPerGas.baseFeePerGas,
        instant: makeBlockEstimate(INSTANT, estimatedFeesPerGas),
        express: makeBlockEstimate(EXPRESS, estimatedFeesPerGas),
        regular: makeBlockEstimate(REGULAR, estimatedFeesPerGas),
      }
      immerState.lastGasEstimatesRefreshed = Date.now()
    },
    setCustomGas: (
      immerState,
      {
        payload: { maxPriorityFeePerGas, maxFeePerGas },
      }: { payload: { maxPriorityFeePerGas: bigint; maxFeePerGas: bigint } }
    ) => {
      immerState.estimatedFeesPerGas = {
        ...immerState.estimatedFeesPerGas,
        custom: {
          maxFeePerGas,
          confidence: CUSTOM,
          maxPriorityFeePerGas,
        },
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(updateTransactionOptions.pending, (immerState) => {
      immerState.status = TransactionConstructionStatus.Pending
      immerState.signedTransaction = undefined
    })
  },
})

export const {
  transactionRequest,
  clearTransactionState,
  transactionLikelyFails,
  broadcastOnSign,
  signed,
  setFeeType,
  estimatedFeesPerGas,
  setCustomGas,
} = transactionSlice.actions

export default transactionSlice.reducer

export const broadcastSignedTransaction = createBackgroundAsyncThunk(
  "transaction-construction/broadcast",
  async (transaction: SignedEVMTransaction) => {
    await emitter.emit("broadcastSignedTransaction", transaction)
  }
)

export const transactionSigned = createBackgroundAsyncThunk(
  "transaction-construction/transaction-signed",
  async (transaction: SignedEVMTransaction, { dispatch, getState }) => {
    await dispatch(signed(transaction))

    const { transactionConstruction } = getState() as {
      transactionConstruction: TransactionConstruction
    }

    if (transactionConstruction.broadcastOnSign ?? false) {
      await dispatch(broadcastSignedTransaction(transaction))
    }
  }
)

export const rejectTransactionSignature = createBackgroundAsyncThunk(
  "transaction-construction/reject",
  async (_, { dispatch }) => {
    await emitter.emit("signatureRejected")
    // Provide a clean slate for future transactions.
    dispatch(
      transactionSlice.actions.clearTransactionState(
        TransactionConstructionStatus.Idle
      )
    )
  }
)

export const selectDefaultNetworkFeeSettings = createSelector(
  ({
    transactionConstruction,
  }: {
    transactionConstruction: TransactionConstruction
  }) => ({
    feeType: transactionConstruction.feeTypeSelected,
    selectedFeesPerGas:
      transactionConstruction.estimatedFeesPerGas?.[
        transactionConstruction.feeTypeSelected
      ],
    suggestedGasLimit: transactionConstruction.transactionRequest?.gasLimit,
  }),
  ({ feeType, selectedFeesPerGas, suggestedGasLimit }): NetworkFeeSettings => ({
    feeType,
    gasLimit: undefined,
    suggestedGasLimit,
    values: {
      maxFeePerGas: selectedFeesPerGas?.maxFeePerGas ?? 0n,
      maxPriorityFeePerGas: selectedFeesPerGas?.maxPriorityFeePerGas ?? 0n,
    },
  })
)

export const selectEstimatedFeesPerGas = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.estimatedFeesPerGas,
  (gasData) => gasData
)

export const selectFeeType = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.feeTypeSelected,
  (feeTypeChosen) => feeTypeChosen
)

export const selectLastGasEstimatesRefreshTime = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.lastGasEstimatesRefreshed,
  (updateTime) => updateTime
)

export const selectTransactionData = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.transactionRequest,
  (transactionRequestData) => transactionRequestData
)

export const selectIsTransactionPendingSignature = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.status,
  (status) => status === "loaded" || status === "pending"
)

export const selectIsTransactionLoaded = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.status,
  (status) => status === "loaded"
)

export const selectIsTransactionSigned = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.status,
  (status) => status === "signed"
)

export const selectCurrentlyChosenNetworkFees = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction?.estimatedFeesPerGas?.[
      state.transactionConstruction.feeTypeSelected
    ],
  (feeData) => feeData
)
