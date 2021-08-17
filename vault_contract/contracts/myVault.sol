// SPDX-License-Identifier: GPL-3.0


/**
~ TODO ~

lock 설정 왜? withdraw시 금액부족방지

burn 은 포지션에서 빼서 tokenowed로 옮긴다...

tx.gasprice 비교해서 미뤄도 될듯?

 */



pragma solidity >=0.7.0 <0.9.0;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract myVault is IERC20 {

    //tokensssss
    uint8 public decimals;
    mapping(address => uint256) balances;
    //mapping(address => mapping (address => uint256)) allowed;
    uint256 public totalSupply;

    address public factory;
    IUniswapV3Pool public pool;
    uint24 public fee;

    //update when call rebalance
    int24 private tickLower;
    int24 private tickUpper;
    
    IERC20 public token0;
    IERC20 public token1;

    address public stratgy;
    uint private previousTime;

    mapping(address => bool) participants;
    address[] public waiters;

    struct PositionInfo{
        uint256 tokenId;
        uint128 liquidit;
        uint256 amount0;
        uint256 amount1;
    }

    PositionInfo public position;
    bool unlocked;

    modifier onlyFactory(){
        require(msg.sender == factory, "not Factory");
        _;
    }

    modifier lock() {
        require(unlocked, 'locked');
        unlocked = false;
        _;
        unlocked = true;
    }
    
    /**
     * @dev Set contract deployer as owner
     */
    constructor(address _factory, address _pool, uint24 _fee, address _stratgy) {
        token0 = IERC20(IUniswapV3Pool(_pool).token0);
        token1 = IERC20(IUniswapV3Pool(_pool).token1);

        factory = _factory;
        pool = IUniswapV3Pool(_pool);
        fee = _fee;
        stratgy = _stratgy;

        unlocked = true;

        totalSupply = 0;
        //to calculate liquidity
        decimals = token0.decimals() + token1.decimals();
    }
    /** 
    * @notice user가 vault에 예치할때 amount 비율 계산해서 토큰 받고 자체 발행 토큰 주고(mint) vault에 토큰 저장
    * @dev payable????????????
    * @dev msg.sender랑 recipient이 다를까?
    * @param amount0 amount of token 0 want to add
    * @param amount1 amount of token 1
    */
    function deposit(
        uint256 amount0,
        uint256 amount1
    ) external {
        //calculate amount
        //어마운트 작은쪽이 맞춰서 토큰 가져오기
        //자체토큰발행
        //큐에 주소 등록
        //이벤트
        
    }

    /**
    * @notice user가 예치해 둔 토큰 태우고 유저에게 해당 토큰만큼 비율에 맞게 예치토큰 준다. vault에 임시로 예치된 liquidity로
    * 해결되면 그걸로 지급. 부족하면 position에서 decreaseliquidity후 지급 fee 계산은 어떻게 하지?????????
    */
    function withdraw(
        uint256 share,
        uint256 amount0min,
        uint256 amount1min
    )external lock {
        //share에 따른 줘야할 토큰 양 계산
        //amountmin과 비교
        //현재 볼트 잔고로 지급 가능한지 계산
        //불가능하면 포지션에서 collect
        //토큰 보내기
        //잔고 0이면 맵에서 제거
        //이벤트
    }

    /**
    * @notice stragy 컨트랙트에서 볼트 리벨런싱 호출하면 인자로 버뮈 받아서 이자랑 볼트에 있던 돈 빼서 새로운 포지션 생성. 필요한 양만큼 스왑
    */
    function rebalance(
        int24 tickLower,
        int24 tickUpper
    ) external lock{
        //나중에 상수 조정
        //가스비 계산해서 이득보기
        require(now - previousTime > 10000, "rebalance perioud error");
        previousTime = now;


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