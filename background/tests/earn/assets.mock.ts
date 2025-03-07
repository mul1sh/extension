import { AssetsState } from "../../redux-slices/assets"

const assets: AssetsState = [
  {
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    homeNetwork: {
      name: "Ethereum",
      baseAsset: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
      chainID: "1",
      family: "EVM",
    },
    contractAddress: "0x0",
    prices: [
      {
        pair: [
          {
            contractAddress: "0x0",
            decimals: 18,
            homeNetwork: {
              name: "Ethereum",
              baseAsset: {
                name: "Ether",
                symbol: "ETH",
                decimals: 18,
              },
              chainID: "1",
              family: "EVM",
            },
            name: "Wrapped Ether",
            symbol: "WETH",
          },
          {
            name: "United States Dollar",
            symbol: "USD",
            decimals: 10,
          },
        ],
        amounts: [1000000000000000000n, 30955400000000n],
        time: 1650536441,
      },
    ],
    recentPrices: {
      USD: {
        pair: [
          {
            contractAddress: "0x0",
            decimals: 18,
            homeNetwork: {
              name: "Ethereum",
              baseAsset: {
                name: "Ether",
                symbol: "ETH",
                decimals: 18,
              },
              chainID: "1",
              family: "EVM",
            },
            name: "Wrapped Ether",
            symbol: "WETH",
          },
          {
            name: "United States Dollar",
            symbol: "USD",
            decimals: 10,
          },
        ],
        amounts: [1000000000000000000n, 31288400000000n],
        time: 1650540050,
      },
    },
  },
  {
    name: "Uniswap",
    symbol: "UNI",
    decimals: 18,
    homeNetwork: {
      name: "Ethereum",
      baseAsset: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
      chainID: "1",
      family: "EVM",
    },
    contractAddress: "0x0",
    prices: [
      {
        pair: [
          {
            name: "Uniswap",
            symbol: "UNI",
            decimals: 18,
            contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
            homeNetwork: {
              name: "Ethereum",
              baseAsset: {
                name: "Ether",
                symbol: "ETH",
                decimals: 18,
              },
              chainID: "1",
              family: "EVM",
            },
          },
          {
            name: "United States Dollar",
            symbol: "USD",
            decimals: 10,
          },
        ],
        amounts: [1000000000000000000n, 93600000000n],
        time: 1650536467,
      },
    ],
    recentPrices: {
      USD: {
        pair: [
          {
            name: "Uniswap",
            symbol: "UNI",
            decimals: 18,
            homeNetwork: {
              name: "Ethereum",
              baseAsset: {
                name: "Ether",
                symbol: "ETH",
                decimals: 18,
              },
              chainID: "1",
              family: "EVM",
            },
            contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
          },
          {
            name: "United States Dollar",
            symbol: "USD",
            decimals: 10,
          },
        ],
        amounts: [1000000000000000000n, 90000000000n],
        time: 1650618496,
      },
    },
  },
]

export default assets
