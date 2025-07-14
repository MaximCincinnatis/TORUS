# TORUS Dashboard

A comprehensive analytics dashboard for the TORUS smart contract ecosystem on Ethereum.

## Features

- **Real-time Blockchain Data**: Fetches live data directly from Ethereum blockchain
- **Staking Metrics**: Track active stakes, total staked TORUS, and maturity schedules
- **Create Metrics**: Monitor token creation events and TitanX usage
- **Interactive Charts**: Toggle between linear and logarithmic scales for better data visualization
- **Daily Projections**: View upcoming TORUS releases with accrued rewards
- **Shares Tracking**: Monitor share distribution and daily reward calculations
- **Performance Optimized**: Smart caching system for efficient data updates

## Smart Contracts

- **TORUS Token**: `0xb47f575807fc5466285e1277ef8acfbb5c6686e8`
- **Create & Stake**: `0xc7cc775b21f9df85e043c7fdd9dac60af0b69507`
- **Buy & Process**: `0xaa390a37006e22b5775a34f2147f81ebd6a63641`

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/MaximCincinnatis/TORUS.git
cd TORUS
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) to view the dashboard

## Usage

- **Update Data**: Click to fetch only new blockchain events (incremental update)
- **Full Refresh**: Click to clear cache and fetch complete blockchain history
- **Scale Toggle**: Switch between linear and logarithmic scales on supported charts

## Build

To create a production build:

```bash
npm run build
```

The build folder will contain the optimized production-ready files.

## Technical Stack

- React with TypeScript
- ethers.js for blockchain interaction
- Chart.js for data visualization
- Custom caching layer for performance

## Contributing

This is a community-built dashboard. Contributions are welcome!

## Disclaimer

This dashboard is an independent, community-created tool and is not affiliated with, endorsed by, or maintained by the official TORUS development team or founders. All data is sourced directly from the Ethereum blockchain for transparency and accuracy.

## License

This project is open source and available under the MIT License.