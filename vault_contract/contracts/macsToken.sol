pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract macsToken is IERC20{
    string public constant name = 'ChangWooVault';
    string public constant symbol = 'CWV';
    uint8 public constant decimals = 6;
    uint  public totalSupply;

    mapping(address => uint256) balances;
    mapping(address => mapping (address => uint256)) allowed;
    uint256 totalSupply_;

    using SafeMath for uint256;

    constructor(){
        
    }
}