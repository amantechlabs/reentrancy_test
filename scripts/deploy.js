const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const VulnerableVault = await ethers.getContractFactory("VulnerableVault");
  const vulnerable = await VulnerableVault.deploy();
  await vulnerable.waitForDeployment();

  const SecureVault = await ethers.getContractFactory("SecureVault");
  const secure = await SecureVault.deploy();
  await secure.waitForDeployment();

  const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
  const attacker = await Attacker.deploy();
  await attacker.waitForDeployment();

  // Seed each vault with 5 ETH from the deployer as a simulated victim deposit.
  const seedAmount = ethers.parseEther("5");
  await (await vulnerable.deposit({ value: seedAmount })).wait();
  await (await secure.deposit({ value: seedAmount })).wait();

  const deployment = {
    network: "localhost",
    chainId: 31337,
    deployer: deployer.address,
    vulnerableVault: await vulnerable.getAddress(),
    secureVault: await secure.getAddress(),
    attacker: await attacker.getAddress()
  };

  const outDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "deployed.json"), JSON.stringify(deployment, null, 2));

  console.log("Deployment complete:");
  console.log(deployment);
  console.log("Each vault has been seeded with 5 ETH from the deployer.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
