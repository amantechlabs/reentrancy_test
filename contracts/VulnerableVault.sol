// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Intentionally vulnerable educational contract. Never use with real funds.
contract VulnerableVault {
    mapping(address => uint256) public balances;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    function deposit() external payable {
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // INTENTIONALLY VULNERABLE:
        // external control is handed over before the balance is updated.
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);
    }
}
