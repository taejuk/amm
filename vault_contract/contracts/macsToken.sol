pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract macsToken is IERC20{
    string public constant name = 'ChangWooVault';
    string public constant symbol = 'CWV';
    uint8 public constant decimals = 18;
    uint  public totalSupply;


}