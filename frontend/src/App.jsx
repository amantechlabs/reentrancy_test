import React, { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import deployment from "./contracts/deployed.json";
import { ShieldAlert, ShieldCheck, Wallet, RefreshCw, Play, Activity, ExternalLink } from "lucide-react";

const vaultAbi = [
  "function deposit() external payable",
  "function withdraw() external",
  "function balances(address) view returns (uint256)",
  "event Deposited(address indexed account, uint256 amount)",
  "event Withdrawn(address indexed account, uint256 amount)"
];
const attackerAbi = [
  "function attack(address payable vaultAddress, uint256 maxReentries_) external payable",
  "function reentries() view returns (uint256)"
];

const short = (s) => s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "Not deployed";
const eth = (n) => {
  try { return Number(formatEther(n)).toFixed(4); } catch { return "0.0000"; }
};

async function demoRequest(path, options = {}) {
  const response = await fetch(`/__demo${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Demo request failed (${response.status})`);
  return data;
}

export default function App() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [amount, setAmount] = useState("1");
  const [maxReentries, setMaxReentries] = useState("3");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "info", text: "Connect the local development signer to begin (no browser wallet required)." });
  const [stats, setStats] = useState({
    vulnerableBalance: "—", secureBalance: "—", attackerBalance: "—",
    vulnerableUserBalance: "—", secureUserBalance: "—"
  });
  const [history, setHistory] = useState([]);

  const configured = Boolean(deployment.vulnerableVault && deployment.secureVault && deployment.attacker);

  const connect = async () => {
    try {
      const data = await demoRequest("/state");
      setAccount(data.account);
      setNotice({ type: "success", text: `Development signer connected: ${short(data.account)} on Hardhat Local.` });
      setStats(data.stats);
    } catch (e) {
      setNotice({ type: "error", text: e.message || "Could not connect to the local demo signer." });
    }
  };

  const loadStats = useCallback(async () => {
    if (!configured) return;
    try {
      const data = await demoRequest("/state");
      setAccount(data.account);
      setStats(data.stats);
    } catch (e) {
      setNotice({ type: "error", text: `Could not read local contract state: ${e.message}` });
    }
  }, [configured]);

  useEffect(() => { loadStats(); }, [loadStats]);


  const transact = async (label, payload) => {
    setBusy(true);
    setNotice({ type: "info", text: `${label}: sending transaction to the local Hardhat node…` });
    try {
      const data = await demoRequest("/transaction", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setHistory((old) => [{
        label, hash: data.hash, status: data.status === 1 ? "Confirmed" : "Failed",
        block: data.blockNumber, time: new Date().toLocaleTimeString()
      }, ...old].slice(0, 8));
      setNotice({ type: data.status === 1 ? "success" : "error", text: `${label}: ${data.status === 1 ? "confirmed" : "failed"}.` });
      await loadStats();
    } catch (e) {
      setNotice({ type: "error", text: e.message || `${label} failed.` });
      await loadStats();
    } finally {
      setBusy(false);
    }
  };

  const deposit = (which) => {
    try {
      if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error("Enter an amount greater than zero.");
      parseEther(amount);
    } catch (e) {
      return setNotice({ type: "error", text: e.message || "Invalid ETH amount." });
    }
    return transact(`Deposit to ${which} vault`, { action: "deposit", vault: which, amount });
  };

  const withdraw = (which) => transact(`Withdraw from ${which} vault`, {
    action: "withdraw", vault: which
  });

  const runAttack = (which) => {
    try {
      if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error("Enter an attack deposit greater than zero.");
      parseEther(amount);
      if (!Number.isInteger(Number(maxReentries)) || Number(maxReentries) < 0 || Number(maxReentries) > 8) {
        throw new Error("Reentries must be an integer between 0 and 8.");
      }
    } catch (e) {
      return setNotice({ type: "error", text: e.message || "Invalid attack settings." });
    }
    return transact(`Attack ${which} vault`, {
      action: "attack", vault: which, amount, maxReentries: Number(maxReentries)
    });
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={23}/></div>
          <div><div className="brand-title">Reentrancy Lab</div><div className="brand-subtitle">Smart Contract Security · Local Demo</div></div>
        </div>
        <button className="button secondary" onClick={connect}><Wallet size={17}/>{account ? short(account) : "Connect demo signer"}</button>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="pulse"/> EDUCATIONAL SECURITY LAB</div>
        <h1>See the vulnerability.<br/><span>Verify the defense.</span></h1>
        <p>Run a controlled reentrancy demonstration against two local vault contracts, then compare their on-chain balances and transaction outcomes.</p>
        <div className="hero-tags"><span>Solidity</span><span>Hardhat</span><span>ethers.js</span><span>Server-side demo signer</span></div>
      </section>

      {!configured && <div className="notice error">Contracts are not deployed yet. Follow the README instructions, then run the deployment script.</div>}
      <div className={`notice ${notice.type}`} role="status">{notice.text}</div>

      <section className="metrics">
        <Metric label="Vulnerable vault" value={stats.vulnerableBalance} unit="ETH" icon={<ShieldAlert size={18}/>} kind="danger"/>
        <Metric label="Secure vault" value={stats.secureBalance} unit="ETH" icon={<ShieldCheck size={18}/>} kind="safe"/>
        <Metric label="Attacker contract" value={stats.attackerBalance} unit="ETH" icon={<Activity size={18}/>} kind="neutral"/>
      </section>

      <section className="controls card">
        <div className="section-heading"><div><div className="eyebrow">SIMULATION CONTROLS</div><h2>Configure a test</h2></div><button className="icon-button" onClick={loadStats} title="Refresh balances"><RefreshCw size={17}/></button></div>
        <div className="form-grid">
          <label>Test ETH amount<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="1.0"/></label>
          <label>Maximum re-entries (0–8)<input value={maxReentries} onChange={e => setMaxReentries(e.target.value)} inputMode="numeric"/></label>
        </div>
        <p className="helper">The attack contract deposits this amount and attempts bounded recursive withdrawals. Use only the local Hardhat chain and test accounts.</p>
      </section>

      <section className="vault-grid">
        <div className="vault-card vulnerable">
          <div className="vault-title"><div className="vault-icon"><ShieldAlert size={22}/></div><div><h2>Vulnerable Vault</h2><span className="status danger-text">Intentionally unsafe</span></div></div>
          <p>The external ETH transfer happens before the recorded balance is cleared. The receiver can re-enter during that transfer.</p>
          <div className="vault-stat"><span>Demo signer recorded balance</span><strong>{stats.vulnerableUserBalance} ETH</strong></div>
          <div className="button-row">
            <button className="button secondary" disabled={busy || !configured} onClick={() => deposit("vulnerable")}>Deposit</button>
            <button className="button secondary" disabled={busy || !configured} onClick={() => withdraw("vulnerable")}>Withdraw</button>
          </div>
          <button className="button danger-button full" disabled={busy || !configured} onClick={() => runAttack("vulnerable")}><Play size={16}/> Run controlled attack</button>
        </div>

        <div className="vault-card secure">
          <div className="vault-title"><div className="vault-icon"><ShieldCheck size={22}/></div><div><h2>Secure Vault</h2><span className="status safe-text">CEI + ReentrancyGuard</span></div></div>
          <p>The recorded balance is cleared before the transfer, and a reentrancy guard prevents nested withdrawal calls.</p>
          <div className="vault-stat"><span>Demo signer recorded balance</span><strong>{stats.secureUserBalance} ETH</strong></div>
          <div className="button-row">
            <button className="button secondary" disabled={busy || !configured} onClick={() => deposit("secure")}>Deposit</button>
            <button className="button secondary" disabled={busy || !configured} onClick={() => withdraw("secure")}>Withdraw</button>
          </div>
          <button className="button safe-button full" disabled={busy || !configured} onClick={() => runAttack("secure")}><ShieldCheck size={16}/> Test defense</button>
        </div>
      </section>

      <section className="card results">
        <div className="section-heading"><div><div className="eyebrow">ON-CHAIN ACTIVITY</div><h2>Transaction history</h2></div><span className="count">{history.length} recent</span></div>
        {history.length === 0 ? <div className="empty">No transactions yet. Connect the demo signer and run a test to see results here.</div> : (
          <div className="history-list">{history.map((item, i) => <div className="history-row" key={`${item.hash}-${i}`}>
            <div className="history-icon"><Activity size={17}/></div>
            <div className="history-main"><strong>{item.label}</strong><span>Block {item.block} · {item.time} · {short(item.hash)}</span></div>
            <span className={`history-status ${item.status === "Confirmed" ? "safe-text" : "danger-text"}`}>{item.status}</span>
          </div>)}</div>
        )}
      </section>

      <footer><span>For education only · Never use the vulnerable contract with real assets.</span><span>Local network · Chain ID 31337</span></footer>
    </main>
  );
}

function Metric({ label, value, unit, icon, kind }) {
  return <div className={`metric card ${kind}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className="metric-value">{value}<small> {unit}</small></div></div>;
}
