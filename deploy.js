// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of LockedGovernanceToken contract...");

  // Get the contract factory
  const LockedGovernanceToken = await ethers.getContractFactory("LockedGovernanceToken");

  // Configuration for deployment
  const tokenName = "Protocol Governance Token";
  const tokenSymbol = "PGT";
  const initialSupply = ethers.utils.parseEther("10000000"); // 10 million tokens
  
  console.log(`Deploying with parameters:
    - Name: ${tokenName}
    - Symbol: ${tokenSymbol}
    - Initial Supply: ${ethers.utils.formatEther(initialSupply)} tokens
  `);

  // Deploy the contract
  const token = await LockedGovernanceToken.deploy(tokenName, tokenSymbol, initialSupply);
  
  // Wait for deployment transaction to be mined
  await token.deployed();

  console.log(`LockedGovernanceToken deployed to: ${token.address}`);
  console.log(`Contract owner: ${await token.owner()}`);
  
  // Verify initial state
  console.log(`Initial state verification:
    - Transfers enabled: ${await token.transfersEnabled()}
    - Total supply: ${ethers.utils.formatEther(await token.totalSupply())} tokens
  `);
  
  // For networks that support verification (like Etherscan)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    
    // Wait for 6 confirmations for Etherscan verification
    await token.deployTransaction.wait(6);
    
    console.log("Verifying contract on Etherscan...");
    
    // Verify the contract on Etherscan
    await hre.run("verify:verify", {
      address: token.address,
      constructorArguments: [tokenName, tokenSymbol, initialSupply],
    });
    
    console.log("Contract verified on Etherscan");
  }
  
  return token;
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
