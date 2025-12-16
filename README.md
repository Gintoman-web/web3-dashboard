# 🦄 Ultimate Crypto Dashboard

A modern, decentralized application (dApp) built to demonstrate advanced Web3 interactions, including real-time asset tracking and token swapping via Uniswap V3.

![Project Status](https://img.shields.io/badge/status-active-success)
![License](https://img.shields.io/badge/license-MIT-blue)

## ⚡️ Tech Stack

**Core:**
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)

**Web3 & Blockchain:**
![Wagmi](https://img.shields.io/badge/Wagmi-v2-black?logo=wagmi)
![Viem](https://img.shields.io/badge/Viem-2.x-1E1E1E)
![RainbowKit](https://img.shields.io/badge/RainbowKit-2.0-3B82F6)
![Uniswap](https://img.shields.io/badge/Uniswap-V3-FF007A)

**Styling:**
![CSS3](https://img.shields.io/badge/CSS3-Variables-1572B6?logo=css3&logoColor=white)

---

## 🚀 Key Features

*   **🌈 Seamless Wallet Connection:** Integrated **RainbowKit** for a polished UI/UX when connecting wallets (MetaMask, WalletConnect, etc.).
*   **⛓️ Multichain Support:** Fully functional on **Sepolia** and **Arbitrum Sepolia** testnets.
*   **💰 Real-time Balances:** Fetches native ETH and ERC-20 (USDC) balances instantly using `wagmi` hooks.
*   **🔄 Uniswap V3 Integration:** Direct interaction with the Uniswap V3 Router and Quoter contracts for accurate pricing and swapping.
*   **🛡️ Smart Approval System:** Automatically detects if an ERC-20 `approve` transaction is needed before swapping (e.g., for USDC -> ETH).
*   **📊 Live Price Feeds:** Integrates **CoinGecko API** to display approximate USD values for ETH assets.
*   **✅ Transaction Feedback:** Provides real-time UI updates for transaction states (Pending, Confirming, Success) with direct links to **Etherscan**.

---

## 🏗️ Architecture Highlights

This project focuses on **Logic/View Separation** to ensure maintainability and testability.

### 1. Custom `useSwap` Hook
Instead of cluttering the UI component with blockchain logic, all swap operations are encapsulated in a custom hook `src/hooks/useSwap.ts`.
*   **Responsibility:** Manages state (`sellAmount`, `isEthToUsdc`), fetches quotes, handles allowances, and executes transactions.
*   **Benefit:** The UI component remains "dumb" and focused solely on rendering.

### 2. Wagmi v2 & Viem
Leverages the latest **Wagmi v2** hooks (`useReadContract`, `useWriteContract`, `useSimulateContract`) powered by **Viem** for type-safe and performant Ethereum interactions.

### 3. UX-First Design
*   **Dynamic Buttons:** Buttons change state and color based on context (Approve vs Swap, Loading vs Idle).
*   **Optimistic UI:** Instant feedback on user actions (hover effects, loading spinners).

---

## 🛠️ Getting Started

Follow these steps to run the project locally.

### Prerequisites
*   Node.js (v18+)
*   npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Gintoman-web/web3-dashboard.git
    cd ultimate-crypto-dashboard
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open in browser:**
    Navigate to `http://localhost:5173`.

---

## 🔮 Future Improvements

*   [ ] **Token List Modal:** Allow users to select from a wider range of tokens.
*   [ ] **Price Charts:** Integrate Recharts to show historical price data.
*   [ ] **Transaction History:** A sidebar showing the user's recent swaps.
*   [ ] **Gas Estimation:** Display estimated gas fees before swapping.

---

## 📄 License

This project is licensed under the MIT License.