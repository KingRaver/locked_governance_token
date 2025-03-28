# Locked Governance Token

A Solidity implementation of a governance token that supports delegation and revenue sharing while remaining non-transferable until explicitly unlocked.

## Overview

This contract implements an ERC20 governance token with the following key features:

- **Token Locking**: Tokens cannot be transferred by default unless explicitly unlocked
- **Voting Delegation**: Token holders can delegate voting power without transferring tokens
- **Revenue Distribution**: Protocol revenue is distributed proportionally to token holders
- **Selective Unlocking**: The contract owner can unlock tokens globally or for specific users

## Features

### Token Locking Mechanism

All tokens are locked by default, preventing transfers between users. This ensures long-term alignment of governance participants and prevents speculation on governance rights. Tokens can be unlocked in two ways:

1. Global unlocking through contract upgrade (by contract owner)
2. Individual user unlocking (selective unlocking by contract owner)

### Governance & Delegation

The contract extends OpenZeppelin's ERC20Votes, enabling:

- Delegation of voting power without transferring tokens
- Tracking of voting power across token transfers (when unlocked)
- Snapshot-based voting compatible with standard governance frameworks

### Revenue Sharing

Token holders earn a proportional share of protocol revenue:

- Revenue can be deposited to the contract in ETH
- Distribution happens automatically based on token holdings
- Users can claim their earned revenue at any time
- Revenue claims do not require token transfers

## Installation

```bash
npm install
```

## Usage

### Deployment

Deploy the contract with the following parameters:

```solidity
constructor(
    string memory name, 
    string memory symbol, 
    uint256 initialSupply
)
```

Example deployment script:

```javascript
const LockedGovernanceToken = await ethers.getContractFactory("LockedGovernanceToken");
const token = await LockedGovernanceToken.deploy(
    "Protocol Governance Token",
    "PGT",
    ethers.utils.parseEther("10000000") // 10 million tokens
);
await token.deployed();
```

### Key Functions

#### Token Management

- `transfer(address to, uint256 amount)`: Transfer tokens (only if unlocked)
- `transferFrom(address from, address to, uint256 amount)`: Transfer tokens on behalf of another account (only if unlocked)
- `delegate(address delegatee)`: Delegate voting power to another address

#### Revenue Distribution

- `depositRevenue()`: Deposit ETH to be distributed to token holders
- `claimRevenue()`: Claim accumulated revenue
- `earned(address account)`: View the amount of revenue earned by an account

#### Contract Administration

- `upgradeContract()`: Enable transfers globally (owner only)
- `upgradeUser(address user)`: Enable transfers for a specific user (owner only)
- `withdrawExcessETH()`: Withdraw any excess ETH in the contract (owner only)

### Events

- `RevenueDeposited(uint256 amount)`: Emitted when revenue is deposited
- `RevenueDistributed(address indexed user, uint256 amount)`: Emitted when a user claims revenue
- `ContractUpgraded(bool transfersEnabled)`: Emitted when transfers are globally enabled
- `UserUpgraded(address indexed user)`: Emitted when a specific user is upgraded

## Security Considerations

- The contract owner has significant control (can enable transfers)
- Revenue distribution requires careful management of state variables
- Delegation allows for separation of capital and governance power

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
