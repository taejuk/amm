// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import "./myVault.sol";
/**
 * @title Storage
 * @dev Store & retrieve value in a variable
 */
contract vaultFactory {

    address public owner;
    
    event vaultCreate(address vault, uint24 fee);
    
    modifier onlyOwner(){
        require(msg.sender == owner, "not owner");
        _;
    }
    
    mapping(address => address) public getVaults;
    
    constructor(address _owner) {
        owner = _owner;
    }
    
    function createVault(
        address _pool,
        uint24 fee,
        address _rebalancer
    ) external onlyOwner returns (address vault){
        //중복 방 지
        require(getVaults[_pool] == address(0));
        vault = address(new myVault(_pool, fee, _rebalancer));
        getVaults[_pool] = vault;
        emit vaultCreate(vault, fee);
    }
    
    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
    }

    function greet() public pure returns (string memory) {
        return "Hello, world!";
    }
}