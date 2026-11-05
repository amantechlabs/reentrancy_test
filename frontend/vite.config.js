import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { JsonRpcProvider, Wallet, Contract, parseEther, formatEther } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(frontendDir, "..");
const deploymentPath = path.join(frontendDir, "src", "contracts", "deployed.json");

function localDemoApi() {
  let provider;
  let signer;
  let deployment;
  let vulnerableAbi;
  let secureAbi;
  let attackerAbi;

  function initialize() {
    if (process.env.DEMO_MODE !== "true") throw new Error("Demo API disabled. Start the frontend with DEMO_MODE=true.");
    const key = process.env.DEMO_PRIVATE_KEY;
    if (!key) throw new Error("DEMO_PRIVATE_KEY is missing. Export a disposable Hardhat local test key in this terminal.");
    if (!provider) {
      provider = new JsonRpcProvider("http://127.0.0.1:8545", 31337, { staticNetwork: true });
      signer = new Wallet(key, provider);
      deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      const artifact = (name) => JSON.parse(fs.readFileSync(path.join(projectRoot, "artifacts", "contracts", `${name}.sol`, `${name}.json`), "utf8"));
      vulnerableAbi = artifact("VulnerableVault").abi;
      secureAbi = artifact("SecureVault").abi;
      attackerAbi = artifact("ReentrancyAttacker").abi;
      for (const name of ["vulnerableVault", "secureVault", "attacker"]) {
        if (!deployment[name] || !/^0x[a-fA-F0-9]{40}$/.test(deployment[name])) throw new Error("Contracts are not deployed. Run npm run deploy:local after starting Hardhat.");
      }
    }
    return { provider, signer, deployment, vulnerableAbi, secureAbi, attackerAbi };
  }

  const json = (res, status, data) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
  };

  async function readBody(req) {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 10_000) throw new Error("Request body too large.");
    }
    return JSON.parse(body || "{}");
  }

  return {
    name: "local-hardhat-demo-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__demo/")) return next();
        try {
          // Same-origin only; keep Codespaces port 5173 private.
          // Validate requests against the actual Codespaces forwarded origin.
// Validate requests from Codespaces or local development.
const origin = req.headers.origin;
const host = req.headers.host;

const codespaceName = process.env.CODESPACE_NAME;
const forwardingDomain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

const forwardedHost = req.headers["x-forwarded-host"];
const forwardedProto = req.headers["x-forwarded-proto"];

let trustedCodespacesProxy = false;

if (
  codespaceName &&
  forwardingDomain &&
  typeof forwardedHost === "string" &&
  forwardedProto === "https"
) {
  const prefix = `${codespaceName}-`.toLowerCase();
  const suffix = `.${forwardingDomain}`.toLowerCase();
  const normalizedForwardedHost = forwardedHost.toLowerCase();

  if (
    normalizedForwardedHost.startsWith(prefix) &&
    normalizedForwardedHost.endsWith(suffix)
  ) {
    const port = normalizedForwardedHost.slice(
      prefix.length,
      -suffix.length
    );

    const localPort = host?.split(":").pop();

    trustedCodespacesProxy =
      /^\d+$/.test(port) &&
      port === localPort;
  }
}

let trustedLocalOrigin = false;

if (origin && host) {
  try {
    const parsedOrigin = new URL(origin);

    trustedLocalOrigin =
      parsedOrigin.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname) &&
      parsedOrigin.host === host;
  } catch {
    trustedLocalOrigin = false;
  }
}

let trustedForwardedOrigin = false;

if (origin && trustedCodespacesProxy) {
  try {
    const parsedOrigin = new URL(origin);

    trustedForwardedOrigin =
      parsedOrigin.protocol === "https:" &&
      parsedOrigin.host.toLowerCase() ===
        forwardedHost.toLowerCase();
  } catch {
    trustedForwardedOrigin = false;
  }
}

if (!trustedLocalOrigin && !trustedForwardedOrigin &&
    !trustedCodespacesProxy) {
  return json(res, 403, {
    error: "Cross-origin requests are not allowed."
  });
}
          const ctx = initialize();
          const { provider: rpc, signer: wallet, deployment: d, vulnerableAbi: vAbi, secureAbi: sAbi, attackerAbi: aAbi } = ctx;
          const url = new URL(req.url, `http://${host}`);

          if (req.method === "GET" && url.pathname === "/__demo/state") {
            const vulnerable = new Contract(d.vulnerableVault, vAbi, rpc);
            const secure = new Contract(d.secureVault, sAbi, rpc);
            const [vb, sb, ab, vu, su] = await Promise.all([
              rpc.getBalance(d.vulnerableVault), rpc.getBalance(d.secureVault), rpc.getBalance(d.attacker),
              vulnerable.balances(wallet.address), secure.balances(wallet.address)
            ]);
            return json(res, 200, {
              account: wallet.address,
              stats: {
                vulnerableBalance: Number(formatEther(vb)).toFixed(4),
                secureBalance: Number(formatEther(sb)).toFixed(4),
                attackerBalance: Number(formatEther(ab)).toFixed(4),
                vulnerableUserBalance: Number(formatEther(vu)).toFixed(4),
                secureUserBalance: Number(formatEther(su)).toFixed(4)
              }
            });
          }

          if (req.method === "POST" && url.pathname === "/__demo/transaction") {
            const body = await readBody(req);
            const { action, vault, amount, maxReentries } = body;
            if (!["vulnerable", "secure"].includes(vault)) return json(res, 400, { error: "Unknown vault." });
            const address = vault === "vulnerable" ? d.vulnerableVault : d.secureVault;
            const abi = vault === "vulnerable" ? vAbi : sAbi;
            let tx;
            if (action === "deposit") {
              if (typeof amount !== "string" || amount.length > 30) return json(res, 400, { error: "Invalid deposit amount." });
              const value = parseEther(amount);
              if (value <= 0n || value > parseEther("10")) return json(res, 400, { error: "Use an amount greater than zero and no more than 10 ETH." });
              tx = await new Contract(address, abi, wallet).deposit({ value });
            } else if (action === "withdraw") {
              tx = await new Contract(address, abi, wallet).withdraw();
            } else if (action === "attack") {
              if (typeof amount !== "string" || amount.length > 30) return json(res, 400, { error: "Invalid attack amount." });
              const value = parseEther(amount);
              if (value <= 0n || value > parseEther("10")) return json(res, 400, { error: "Use an attack amount greater than zero and no more than 10 ETH." });
              if (!Number.isInteger(maxReentries) || maxReentries < 0 || maxReentries > 8) return json(res, 400, { error: "Reentries must be an integer between 0 and 8." });
              tx = await new Contract(d.attacker, aAbi, wallet).attack(address, BigInt(maxReentries), { value, gasLimit: 1_500_000n });
            } else {
              return json(res, 400, { error: "Unknown action." });
            }
            const receipt = await tx.wait();
            return json(res, 200, { hash: receipt.hash, status: receipt.status, blockNumber: receipt.blockNumber });
          }
          return json(res, 404, { error: "Unknown demo endpoint." });
        } catch (error) {
          return json(res, 400, { error: error.shortMessage || error.reason || error.message || "Local demo request failed." });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), localDemoApi()],
  server: { port: 5173, host: "127.0.0.1" }
});
