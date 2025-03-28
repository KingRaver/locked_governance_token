const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LockedGovernanceToken", function () {
  let LockedGovernanceToken;
  let token;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let addrs;

  // Constants for testing
  const TOKEN_NAME = "Locked Governance Token";
  const TOKEN_SYMBOL = "LGT";
  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000"); // 1 million tokens
  const REVENUE_AMOUNT = ethers.utils.parseEther("10"); // 10 ETH

  beforeEach(async function () {
    // Get contract factory and signers
    LockedGovernanceToken = await ethers.getContractFactory("LockedGovernanceToken");
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

    // Deploy contract
    token = await LockedGovernanceToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
    await token.deployed();

    // Transfer some tokens to test accounts
    await token.transfer(addr1.address, ethers.utils.parseEther("100000")); // 100k tokens
    await token.transfer(addr2.address, ethers.utils.parseEther("50000")); // 50k tokens
    await token.transfer(addr3.address, ethers.utils.parseEther("25000")); // 25k tokens
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(ownerBalance).to.equal(INITIAL_SUPPLY.sub(
        ethers.utils.parseEther("100000").add(
          ethers.utils.parseEther("50000").add(
            ethers.utils.parseEther("25000")
          )
        )
      ));
    });

    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should start with transfers disabled", async function () {
      expect(await token.transfersEnabled()).to.equal(false);
    });
  });

  describe("Token Locking", function () {
    it("Should allow owner to transfer tokens initially", async function () {
      await expect(
        token.transfer(addr1.address, ethers.utils.parseEther("1000"))
      ).to.not.be.reverted;
    });

    it("Should prevent non-owner from transferring locked tokens", async function () {
      await expect(
        token.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("1000"))
      ).to.be.revertedWith("Transfers are currently locked");
    });

    it("Should allow global transfer unlock", async function () {
      // Upgrade the contract to enable transfers
      await token.upgradeContract();
      expect(await token.transfersEnabled()).to.equal(true);

      // Now addr1 should be able to transfer
      await expect(
        token.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("1000"))
      ).to.not.be.reverted;
    });

    it("Should allow specific user unlock", async function () {
      // Upgrade specific user
      await token.upgradeUser(addr1.address);
      expect(await token.upgradedUsers(addr1.address)).to.equal(true);

      // Addr1 should be able to transfer
      await expect(
        token.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("1000"))
      ).to.not.be.reverted;

      // But addr2 should still be locked
      await expect(
        token.connect(addr2).transfer(addr1.address, ethers.utils.parseEther("1000"))
      ).to.be.revertedWith("Transfers are currently locked");
    });

    it("Should emit UserUpgraded event when user is upgraded", async function () {
      await expect(token.upgradeUser(addr1.address))
        .to.emit(token, "UserUpgraded")
        .withArgs(addr1.address);
    });

    it("Should emit ContractUpgraded event when contract is upgraded", async function () {
      await expect(token.upgradeContract())
        .to.emit(token, "ContractUpgraded")
        .withArgs(true);
    });
  });

  describe("Revenue Distribution", function () {
    beforeEach(async function () {
      // Deposit revenue to the contract
      await token.depositRevenue({ value: REVENUE_AMOUNT });
    });

    it("Should accept revenue deposits", async function () {
      expect(await ethers.provider.getBalance(token.address)).to.equal(REVENUE_AMOUNT);
    });

    it("Should emit RevenueDeposited event", async function () {
      await expect(token.depositRevenue({ value: REVENUE_AMOUNT }))
        .to.emit(token, "RevenueDeposited")
        .withArgs(REVENUE_AMOUNT);
    });

    it("Should calculate earned revenue correctly", async function () {
      // Advance time to simulate revenue accrual
      await time.increase(86400); // 1 day

      // Check earned revenue for addr1 (100k tokens out of 1M total)
      const expectedRevenue = REVENUE_AMOUNT.mul(100000).div(1000000);
      const earnedRevenue = await token.earned(addr1.address);
      
      // Allow for small rounding differences
      expect(earnedRevenue).to.be.closeTo(expectedRevenue, ethers.utils.parseEther("0.01"));
    });

    it("Should allow users to claim revenue", async function () {
      // Advance time
      await time.increase(86400); // 1 day

      // Get initial balance
      const initialBalance = await ethers.provider.getBalance(addr1.address);
      
      // Claim revenue
      const tx = await token.connect(addr1).claimRevenue();
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      // Get new balance
      const newBalance = await ethers.provider.getBalance(addr1.address);
      
      // Check that balance increased (minus gas costs)
      expect(newBalance).to.be.gt(initialBalance.sub(gasUsed));
    });

    it("Should emit RevenueDistributed event when revenue is claimed", async function () {
      // Advance time
      await time.increase(86400);
      
      // Estimate revenue (100k tokens out of 1M total)
      const expectedRevenue = REVENUE_AMOUNT.mul(100000).div(1000000);
      
      // Check for event
      await expect(token.connect(addr1).claimRevenue())
        .to.emit(token, "RevenueDistributed")
        .withArgs(addr1.address, expectedRevenue);
    });

    it("Should distribute revenue proportionally to holdings", async function () {
      // Advance time
      await time.increase(86400);
      
      // Claim for all users
      await token.connect(addr1).claimRevenue(); // 100k tokens
      await token.connect(addr2).claimRevenue(); // 50k tokens
      await token.connect(addr3).claimRevenue(); // 25k tokens
      
      // Verify contract balance is reduced appropriately
      // 175k out of 1M tokens claimed = 17.5% of revenue
      const expectedRemaining = REVENUE_AMOUNT.mul(825000).div(1000000);
      expect(await ethers.provider.getBalance(token.address)).to.be.closeTo(
        expectedRemaining,
        ethers.utils.parseEther("0.01")
      );
    });
  });

  describe("Governance Features", function () {
    it("Should allow delegation of voting power", async function () {
      // Initially addr1 should delegate to self
      expect(await token.delegates(addr1.address)).to.equal(ethers.constants.AddressZero);
      
      // Delegate voting power
      await token.connect(addr1).delegate(addr2.address);
      
      // Check delegation took effect
      expect(await token.delegates(addr1.address)).to.equal(addr2.address);
      
      // Check voting power was transferred
      const votingPower = await token.getVotes(addr2.address);
      expect(votingPower).to.equal(ethers.utils.parseEther("100000"));
    });

    it("Should track voting power correctly when transfers are enabled", async function () {
      // Enable transfers
      await token.upgradeContract();
      
      // Setup delegation
      await token.connect(addr1).delegate(addr1.address);
      await token.connect(addr2).delegate(addr2.address);
      
      // Check initial voting power
      expect(await token.getVotes(addr1.address)).to.equal(ethers.utils.parseEther("100000"));
      expect(await token.getVotes(addr2.address)).to.equal(ethers.utils.parseEther("50000"));
      
      // Transfer tokens
      const transferAmount = ethers.utils.parseEther("10000");
      await token.connect(addr1).transfer(addr2.address, transferAmount);
      
      // Check updated voting power
      expect(await token.getVotes(addr1.address)).to.equal(ethers.utils.parseEther("90000"));
      expect(await token.getVotes(addr2.address)).to.equal(ethers.utils.parseEther("60000"));
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to withdraw excess ETH", async function () {
      // First deposit some ETH
      await token.depositRevenue({ value: REVENUE_AMOUNT });
      
      // Get initial balance
      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      // Withdraw excess ETH
      const tx = await token.withdrawExcessETH();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      // Get new balance
      const newBalance = await ethers.provider.getBalance(owner.address);
      
      // Check that balance increased (minus gas costs)
      expect(newBalance).to.be.closeTo(
        initialBalance.add(REVENUE_AMOUNT).sub(gasUsed),
        ethers.utils.parseEther("0.01")
      );
      
      // Check contract balance is now zero
      expect(await ethers.provider.getBalance(token.address)).to.equal(0);
    });

    it("Should prevent non-owners from calling owner functions", async function () {
      await expect(token.connect(addr1).upgradeContract()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      
      await expect(token.connect(addr1).upgradeUser(addr2.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      
      await expect(token.connect(addr1).withdrawExcessETH()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });
});
