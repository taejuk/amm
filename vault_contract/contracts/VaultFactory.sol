// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import "./myVault.sol";

/**
 * @title Storage
 * @dev Store & retrieve value in a variable
 */
contract vaultFactory {

    address public owner;
    
    event vaultCreate(address vault, int24 fee);
    
    modifier onlyOwner(){
        require(msg.sender == owner, "not owner");
        _;
    }
    
    mapping(address => address) getVaults;
    
    constructor(address _owner) public {
        owner = _owner;
    }
    
    function createVault(
        address _pool,
        int24 fee,
        address stratge
    ) external onlyOwner returns (address vault){
        //중복 방 지
        require(getVaults(_pool) == address(0));
        vault = address(new myVault{value: 10000, salt: keccak256(abi.encode(_pool, fee, stratge, address(this)))}(address(this), _pool, fee, stratge));
        getVaults[_pool] = vault;
        emit vaultCreate(vault, fee);
    }
    
    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
    }
}