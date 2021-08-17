// SPDX-License-Identifier: GPL-3.0


/**
~ TODO ~

lock 설정 왜? withdraw시 금액부족방지

burn 은 포지션에서 빼서 tokenowed로 옮긴다...



 */



pragma solidity >=0.7.0 <0.9.0;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract myVault {

    address public factory;
    IUniswapV3Pool public pool;
    uint24 public fee;

    int24 private tickLower;
    int24 private tickUpper;
    
    IERC20 public token0;
    IERC20 public token1;

    address public stratgy;

    struct PositionInfo{
        uint256 tokenId;
        uint128 liquidit;
        uint256 amount0;
        uint256 amount1;
    }

    PositionInfo public position;

    modifier onlyFactory(){
        require(msg.sender == factory, "not Factory");
        _;
    }
    
    /**
     * @dev Set contract deployer as owner
     */
    constructor(address _factory, address _pool, uint24 _fee, address _stratgy) {
        factory = _factory;
        pool = IUniswapV3Pool(_pool);
        fee = _fee;
        stratgy = _stratgy;
        
        token0 = IERC20(IUniswapV3Pool(_pool).token0);
        token1 = IERC20(IUniswapV3Pool(_pool).token1);
    }
    /** 
    * @notice user가 vault에 예치할때 amount 비율 계산해서 토큰 받고 자체 발행 토큰 주고(mint) vault에 토큰 저장
    */
    function deposit(){}

    /**
    * @notice user가 예치해 둔 토큰 태우고 유저에게 해당 토큰만큼 비율에 맞게 예치토큰 준다. vault에 임시로 예치된 liquidity로
    * 해결되면 그걸로 지급. 부족하면 position에서 decreaseliquidity후 지급 fee 계산은 어떻게 하지?????????
    */
    function withdraw(){}

    /**
    * @notice stragy 컨트랙트에서 볼트 리벨런싱 호출하면 인자로 버뮈 받아서 이자랑 볼트에 있던 돈 빼서 새로운 포지션 생성. 필요한 양만큼 스왑
    */
    function rebalance(){}


    function addDecimal() internal returns (uint256 result){
        uint8 decimal0 = token0.decimals();
        uint8 decimal1 = token1.decimals();
        result = add(decimal0, decimal1);
    }

    ///@notice update position fee using IUniswapV3Pool.burn with zero liquidity
    function updatePosition() internal {
        require(position.liquidit > 0, "not enough liquidity to update");
        pool.burn(tickLower, tickUpper, 0);
    }

    ///@notice collect fee from current position
    ///@dev after update position, collect fee and calculate protocolfee
    function collectFee() private returns (uint128 collected0, uint128 collected1) {
        //1.update fee
        updatePosition();
        //poisition liquidity > 0 인지 확인해보기

        //2.collect
        uint24 protocolFee = fee;

        (uint128 amount0, uint128 amount1) = pool.collect(
            address(this),
            tickLower,
            tickUpper,
            type(uint128).max,
            type(uint128).max
        );
        
        protocolfee0 = amount0.mul(protocolFee).div(1e6);
        protocolfee1 = feesToVault1.mul(protocolFee).div(1e6);

        collected0 = protocolfee0.sub(protocolfee0);
        collected1 = protocolfee1.sub(protocolfee1);
    }
    
    function getBalance0() external view returns (uint256 balance){
        (,balance) = token0.balanceOf(address(this));
    }
    function getBalance1() external view returns (uint256 balance){
        (,balance) = token1.balanceOf(address(this));
    }
    function setStragy(address _stratgy) external onlyFactory {
        stratgy = _stratgy;
    }
    function setFactory(address _factory) external onlyFactory{
        factory = _factory;
    }
}