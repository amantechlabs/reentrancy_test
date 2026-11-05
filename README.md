# Reentrancy Attack & Defense Lab

An educational Ethereum DApp that demonstrates a reentrancy vulnerability in a deliberately unsafe vault and compares it with a protected vault.

**Safety:** This is for local educational use only. Never deploy or fund `VulnerableVault` with real assets.

## Requirements

- Node.js 18 or 20+
- npm
- MetaMask browser extension (for the frontend)
- A terminal

## 1. Install dependencies

From the project root:

```bash
npm install
cd frontend
npm install
cd ..
```

## 2. Compile and run tests

```bash
npm run compile
npm test
```

The tests cover normal deposits/withdrawals, a controlled reentrancy attack against the vulnerable vault, and the guarded vault rejecting the same attack.

## 3. Start the local blockchain

In terminal 1, from the project root:

```bash
npm run node
```

Keep this terminal running. Hardhat prints local test accounts and their private keys.

## 4. Deploy the contracts

In terminal 2, from the project root:

```bash
npm run deploy:local
```

This deploys both vaults and the attacker contract, seeds each vault with 5 local test ETH from the deployer, and writes the addresses to `frontend/src/contracts/deployed.json`.

If you restart the Hardhat node, redeploy the contracts because the local chain state is reset.

## 5. Configure MetaMask for local Hardhat

Add a network manually:

- Network name: Hardhat Local
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

For a demo, import one of the private keys printed by the local Hardhat node. These keys are public test keys and must never be used for real funds.

## 6. Start the frontend

In terminal 3, from the project root:

```bash
npm run frontend
```

Open `http://127.0.0.1:5173`, connect MetaMask to Hardhat Local, and use the test controls.

## Demo walkthrough

1. Check the vulnerable and secure vault balances (each starts with 5 ETH).
2. Set the attack deposit to `1` ETH and max re-entries to `3`.
3. Click **Run controlled attack** for the vulnerable vault. In this demonstration, the attacker contract deposits 1 ETH and may withdraw four times (the initial withdrawal plus up to three re-entries), draining 4 ETH total from the vault. Actual results depend on available vault funds and gas.
4. Refresh balances. The vulnerable vault should drop from 6 ETH after the attacker's deposit to 2 ETH after four 1 ETH withdrawals, if it began with 5 ETH.
5. Click **Test defense** for the secure vault. The attack transaction should revert; the entire transaction, including the attacker's deposit, is rolled back.
6. Run the automated tests for repeatable evidence.

The demo can also use the amount field for normal deposits. The UI shows contract balances, the connected user's recorded vault balance, and recent transactions.

## Project structure

```text
contracts/
  VulnerableVault.sol
  SecureVault.sol
  ReentrancyAttacker.sol
scripts/deploy.js
test/ReentrancyAttack.test.js
frontend/
  src/App.jsx
  src/style.css
  src/contracts/deployed.json
```

## Security notes and limitations

- The vulnerable vault is intentionally insecure and should only run on a disposable local chain.
- The secure vault applies checks-effects-interactions and OpenZeppelin `ReentrancyGuard`.
- A reverted attack against the secure vault reverts all state changes from that transaction, including the attacker's deposit.
- This project demonstrates one class of reentrancy. It is not a full smart-contract audit and does not prove that a contract is safe against all vulnerabilities.
- The dashboard is an educational interface, not a security oracle.


## Wallet-free local demo mode (Codespaces/Safari)

This mode signs transactions on the Vite development server using a disposable Hardhat account. The private key is never bundled into React/browser code. Use only the local Hardhat chain; keep Codespaces port 5173 private, and never use this mode on a production deployment or with real funds.

1. Terminal A: run `npm run node` and keep it running.
2. Terminal B: run `npm run compile`, then `npm run deploy:local`. Repeat deployment whenever you restart the Hardhat node.
3. Terminal C: copy a private key printed by the local Hardhat node and export it in this terminal only: `export DEMO_PRIVATE_KEY='PASTE_LOCAL_HARDHAT_TEST_PRIVATE_KEY_HERE'`. Do not commit the key or put it in a `VITE_` variable.
4. In the same Terminal C run `npm run frontend:demo`.
5. In Codespaces Ports, keep port 5173 set to **Private**, then open its forwarded browser URL. Click **Connect demo signer**.

The API is deliberately enabled only when `DEMO_MODE=true`, accepts same-origin browser requests, and only exposes bounded local actions. Stop the frontend when finished. The demo signer is the account whose key you exported; its recorded vault balance will be displayed.
