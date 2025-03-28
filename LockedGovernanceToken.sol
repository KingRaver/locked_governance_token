// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title LockedGovernanceToken
 * @dev A governance token that can be used for delegation and earns protocol revenue,
 * but cannot be transferred unless unlocked by a contract upgrade.
 */
contract LockedGovernanceToken is ERC20, ERC20Votes, Ownable {
    using SafeMath for uint256;
    
    // Struct to track user's revenue share
    struct UserRevenueInfo {
        uint256 lastClaimedTimestamp;
        uint256 revenuePerTokenClaimed;
    }
    
    // Contract state variables
    bool public transfersEnabled = false;
    uint256 public totalRevenue = 0;
    uint256 public revenuePerTokenStored = 0;
    uint256 public lastUpdateTime = 0;
    
    // User data mappings
    mapping(address => bool) public upgradedUsers;
    mapping(address => uint256) public userRevenuePerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => UserRevenueInfo) public userRevenueInfo;
    
    // Events
    event RevenueDeposited(uint256 amount);
    event RevenueDistributed(address indexed user, uint256 amount);
    event ContractUpgraded(bool transfersEnabled);
    event UserUpgraded(address indexed user);
    
    constructor(
        string memory name, 
        string memory symbol, 
        uint256 initialSupply
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }
    
    /**
     * @dev Updates the revenue distribution state
     */
    modifier updateRevenueReward(address account) {
        revenuePerTokenStored = revenuePerToken();
        lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRevenuePerTokenPaid[account] = revenuePerTokenStored;
        }
        _;
    }
    
    /**
     * @dev Calculate revenue per token
     */
    function revenuePerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return revenuePerTokenStored;
        }
        return revenuePerTokenStored.add(
            totalRevenue.sub(lastUpdateTime).mul(1e18).div(totalSupply())
        );
    }
    
    /**
     * @dev Calculate earned revenue for a specific account
     */
    function earned(address account) public view returns (uint256) {
        return balanceOf(account)
            .mul(revenuePerToken().sub(userRevenuePerTokenPaid[account]))
            .div(1e18)
            .add(rewards[account]);
    }
    
    /**
     * @dev Deposit revenue to be distributed among token holders
     */
    function depositRevenue() external payable updateRevenueReward(address(0)) {
        require(msg.value > 0, "Must deposit some revenue");
        totalRevenue = totalRevenue.add(msg.value);
        emit RevenueDeposited(msg.value);
    }
    
    /**
     * @dev Claim accumulated revenue
     */
    function claimRevenue() external updateRevenueReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            userRevenueInfo[msg.sender].lastClaimedTimestamp = block.timestamp;
            userRevenueInfo[msg.sender].revenuePerTokenClaimed = 
                userRevenueInfo[msg.sender].revenuePerTokenClaimed.add(reward);
            
            (bool success, ) = msg.sender.call{value: reward}("");
            require(success, "Revenue transfer failed");
            
            emit RevenueDistributed(msg.sender, reward);
        }
    }
    
    /**
     * @dev Allow the owner to enable transfers globally (contract upgrade)
     */
    function upgradeContract() external onlyOwner {
        transfersEnabled = true;
        emit ContractUpgraded(transfersEnabled);
    }
    
    /**
     * @dev Allow the owner to enable transfers for specific users
     */
    function upgradeUser(address user) external onlyOwner {
        upgradedUsers[user] = true;
        emit UserUpgraded(user);
    }
    
    /**
     * @dev Check if a transfer is allowed
     */
    function _isTransferAllowed(address from) internal view returns (bool) {
        // Allow transfers if global transfers are enabled or the user has been upgraded
        return transfersEnabled || upgradedUsers[from];
    }
    
    /**
     * @dev Override transfer function to enforce locking
     */
    function transfer(address to, uint256 amount) 
        public 
        override 
        updateRevenueReward(msg.sender) 
        updateRevenueReward(to) 
        returns (bool) 
    {
        require(_isTransferAllowed(msg.sender), "Transfers are currently locked");
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Override transferFrom function to enforce locking
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        updateRevenueReward(from) 
        updateRevenueReward(to) 
        returns (bool) 
    {
        require(_isTransferAllowed(from), "Transfers are currently locked");
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev Required overrides for the ERC20Votes functionality
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);
    }
    
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {
        super._afterTokenTransfer(from, to, amount);
        _moveVotingPower(delegates(from), delegates(to), amount);
    }
    
    function _mint(address account, uint256 amount) internal override {
        super._mint(account, amount);
        _moveVotingPower(address(0), delegates(account), amount);
    }
    
    function _burn(address account, uint256 amount) internal override {
        super._burn(account, amount);
        _moveVotingPower(delegates(account), address(0), amount);
    }
    
    // Enable withdrawing any excess ETH
    function withdrawExcessETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "ETH transfer failed");
    }
    
    receive() external payable {
        // Allow the contract to receive ETH for revenue distribution
    }
}
