// SPDX-License-Identifier: GPL-3.0


/**
~ TODO ~

burn 은 포지션에서 빼서 tokenowed로 옮긴다...

tx.gasprice 비교해서 미뤄도 될듯?

 */



pragma solidity >=0.7.0 <0.9.0;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolImmutables.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolState.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolDerivedState.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolActions.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolOwnerActions.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolEvents.sol';
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import "@uniswap/v3-periphery/contracts/libraries/PositionKey.sol";
import "@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v3.4/contracts/math/SafeMath.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v3.4/contracts/token/ERC20/ERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v3.4/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v3.4/contracts/utils/SafeCast.sol";



contract myVault is ERC20, IUniswapV3MintCallback 
{
    //using SafeMath for uint128;
    using SafeMath for uint256;
    using SafeCast for uint256;
    
    //tokensssss
    //uint8 public constant decimals = 18;
    //mapping(address => uint256) balances;
    //mapping(address => mapping (address => uint256)) allowed;
    //uint256 public totalSupply;

    address public factory;
    IUniswapV3Pool public pool;
    uint24 public fee;

    uint256 private cumulatedFee0;
    uint256 private cumulatedFee1;

    //update when call rebalance
    
    IERC20 public immutable token0;
    IERC20 public immutable token1;

    address private stratgy;
    uint private previousTime;

    struct SqrtRatios{
        uint160 sqrtPriceX96;
        uint160 sqrtRatioAX96;
        uint160 sqrtRatioBX96;
    }

    struct PositionInfo{
        bool initialized;
        bytes32 positionKey;
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
        bool unlocked;
    }

    PositionInfo private position;

    modifier onlyFactory(){
        require(msg.sender == factory, "not Factory");
        _;
    }

    modifier lock() {
        require(position.unlocked, 'locked');
        position.unlocked = false;
        _;
        position.unlocked = true;
    }
    
    /**
     * @dev Set contract deployer as owner
     */
    constructor(address _factory, address _pool, uint24 _fee, address _stratgy) ERC20 ("CWC", "CWC") {
        token0 = IERC20(IUniswapV3Pool(_pool).token0());
        token1 = IERC20(IUniswapV3Pool(_pool).token1());

        factory = _factory;
        pool = IUniswapV3Pool(_pool);
        fee = _fee;
        stratgy = _stratgy;

        position.unlocked = true;

        //totalSupply = 0;
        //to calculate liquidity
    }
    /** 
    * @notice user가 vault에 예치할때 amount 비율 계산해서 토큰 받고 자체 발행 토큰 주고(mint) vault에 토큰 저장
    * @dev payable????????????
    * @dev msg.sender랑 recipient이 다를까?
    * @param amount0 amount of token 0 want to add
    * @param amount1 amount of token 1
    */
    function deposit(
        address recipient,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0min,
        uint256 amount1min
    ) external lock returns (uint256 tokenAmount, uint256 amount0, uint256 amount1){
        // amount로 liquidity delta 계산 o
        // (사용자검증 돈 있는지)
        // mint o
        // 자체 토큰 발행 o
        // 변수 업데이트 o
        // 이벤트

        PositionInfo memory _position = position;
        require(_position.tickUpper > _position.tickLower, "range unvailidate");

        // (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        // uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(_position.tickLower);
        // uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(_position.tickUpper);

        SqrtRatios memory ratios = getRatios(_position);


        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            ratios.sqrtPriceX96,
            ratios.sqrtRatioAX96,
            ratios.sqrtRatioBX96,
            amount0Desired,
            amount1Desired
        );

        //callback 추가
        (amount0, amount1) = addLiquidity(_positoin.tickLower, _position.tickUpper, liquidity, recipient);

        tokenAmount = mintTokento(recipient, ratios, _position.liquidity, amount0, amount1);

        //position이 없을때 새로운 포지션 생성
        if(!_position.initialized){
            position.initialized = true;
            position.positionKey = PositionKey.compute(address(this), _position.tickLower, _position.tickUpper);
        }
        position.liquidity += liquidity;

        require(amount0 > amount0min && amount1 > amount1min, "deposit slippage");
    }

    /**
    * @notice user가 예치해 둔 토큰 태우고 유저에게 해당 토큰만큼 비율에 맞게 예치토큰 준다. vault에 임시로 예치된 liquidity로
    * 해결되면 그걸로 지급. 부족하면 position에서 decreaseliquidity후 지급 fee 계산은 어떻게 하지?????????
    */
    function withdraw(
        address recipient,
        uint256 _token,
        uint256 amount0min,
        uint256 amount1min
    )external lock returns (uint128 amount0, uint128 amount1){
        require(balanceOf(recipient) >= _token, "not enough token");
        uint256 totalSupply = this.totalSupply();
        require(_token < totalSupply, "token value error");

        uint256 token = _token;
        _burn(recipient, _token);

        PositionInfo memory _position = position;
        require(_position.tickUpper > _position.tickLower, "range unvailidate");
        require(_position.liquidity > 0, "not enough liquidity");

        //get prices
        // (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        // uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(_position.tickLower);
        // uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(_position.tickUpper);

        //SqrtRatios memory ratios = getRatios(_position);

        //소수점 계산?
        uint128 liquidityDelta = SafeCast.toUint128(mulTokenRate(_position.liquidity, token));

        //r : rate, To : tokenowed after burn liquiditydelta, L : liquidity
        //(To - L(1-r))r
    

        //calculate amount from liquidity in position
        //get tokenOwed 
        (amount0, amount1) = _calcwithdrawAmount(_position, liquidityDelta, token);
        
        (uint128 collect0, uint128 collect1) = pool.collect(
            recipient,
            _position.tickLower,
            _position.tickUpper,
            amount0,
            amount1
        );
        position.liquidity -= liquidityDelta;

        // if(_position.liquidity - liquidityDelta == 0){
        //     position.initialized = false;
        // }

        require(amount0 >= amount0min && amount1 >= amount1min, "withdraw slippage");
        //add event
    }
    
    function _calcPureFee(
        PositionInfo memory _position,
        uint128 liquidityDelta
    ) internal returns(uint256 pureFee0, uint256 pureFee1, uint256 collectAmount0, uint256 collectAmount1){
        (,,,uint128 tokenOwed0, uint128 tokenOwed1) = pool.positions(PositionKey.compute(address(this), _position.tickLower, _position.tickUpper));

        (collectAmount0, collectAmount1) = pool.burn(_position.tickLower, _position.tickUpper, liquidityDelta);

        pureFee0 = uint256(tokenOwed0) - (collectAmount0);
        pureFee1 = uint256(tokenOwed1) - (collectAmount1);
    }

    function _calcwithdrawAmount(
        PositionInfo memory _position,
        uint128 liquidityDelta,
        uint256 token
    ) internal returns(uint128 amount0, uint128 amount1){
        (uint256 pureFee0, uint256 pureFee1, uint256 collectAmount0, uint256 collectAmount1) = _calcPureFee(_position, liquidityDelta);

        uint128 collectFee0 = SafeCast.toUint128(mulTokenRate(pureFee0, token));
        uint128 collectFee1 = SafeCast.toUint128(mulTokenRate(pureFee1, token));
        
        amount0 = SafeCast.toUint128(collectAmount0) + collectFee0;
        amount1 = SafeCast.toUint128(collectAmount1) + collectFee1;
    }

    
    function mulTokenRate(uint256 value, uint256 token) internal
    returns (uint256) {
        return value.mul(token).div(this.totalSupply());
    }

    function _calcTokenAmount(
        uint256 amount0,
        uint256 amount1,
        uint256 totalAmount0,
        uint256 totalAmount1
        ) internal view returns (uint256 tokenAmount) {
        //uint256 tokenAmount = FullMath.mulDiv(amount0, totalSupply, totalAmount0);
        tokenAmount = FullMath.mulDiv(amount0, this.totalSupply(), totalAmount0);
    }
    
    function unsafemuldiv(uint256 a, uint256 b, uint256 c) internal returns (uint256){
        return a.mul(b).div(c);
    }

    /**
    * @notice stragy 컨트랙트에서 볼트 리벨런싱 호출하면 인자로 버뮈 받아서 이자랑 볼트에 있던 돈 빼서 새로운 포지션 생성. 필요한 양만큼 스왑
    */
    function rebalance(
        int24 tickLower,
        int24 tickUpper,
        uint256 swapAmount0,
        uint256 swapAmount1
    ) external lock{
        require(tickLower < tickUpper, "range invalid");
        require(block.timestamp - previousTime > 10000, "rebalance perioud error");
        previousTime = block.timestamp;
        
        PositionInfo memory _position = position;

        /// @dev burn and collect
        //calculate amount from liquidity in position

        if(_position.initialized){
        //get tokenOwed 
            (uint128 liquidity,,,uint128 tokenOwed0, uint128 tokenOwed1) =
            pool.positions(PositionKey.compute(address(this), _position.tickLower, _position.tickUpper));

            pool.burn(_position.tickLower, _position.tickUpper, liquidity);

            //collect all
            (uint128 collect0, uint128 collect1) = pool.collect(
                address(this),
                _position.tickLower,
                _position.tickUpper,
                type(uint128).max,
                type(uint128).max
            );

            //pureFee = tokenowed(fee + burned liquidty) - collectAmount
            if(fee > 0){
                uint128 protocolFee0 = SafeCast.toUint128(FullMath.mulDiv(tokenOwed0, fee, 1e6));
                uint128 protocolFee1 = SafeCast.toUint128(FullMath.mulDiv(tokenOwed1, fee, 1e6));
            }

            //uint128 totalAmount0 = collect0 - protocolFee0;
            //uint128 totalAmount1 = collect1 - protocolFee1;
            //swap fee 얼마나오는지 보는건 나중에 인터페이스 뜯어보자. 일단 무지성스왑


        }
    }


    function getRatios(
        PositionInfo memory _position
    ) internal returns (SqrtRatios memory ratios){
        (ratios.sqrtPriceX96, , , , , , ) = pool.slot0();
        ratios.sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(_position.tickLower);
        ratios.sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(_position.tickUpper);
    }

    function addLiquidity(
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        address recipient
    ) internal returns (uint256 amount0, uint256 amount1){
        (amount0, amount1) = pool.mint(
            address(this),
            tickLower,
            tickUpper,
            liquidity,
            abi.encode(address(recipient))
        );
    }

    function mintTokento(
        address recipient,
        SqrtRatios memory ratios,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    ) internal returns (uint256 tokenAmount){
        (uint256 totalAmount0, uint256 totalAmount1) = LiquidityAmounts.getAmountsForLiquidity(
            ratios.sqrtPriceX96,
            ratios.sqrtRatioAX96,
            ratios.sqrtRatioBX96,
            liquidity
        );

        tokenAmount = _calcTokenAmount(amount0, amount1, totalAmount0, totalAmount1);
        _mint(recipient, tokenAmount);
    }
    
    ///@notice update position fee using IUniswapV3Pool.burn with zero liquidity
    function updatePosition() internal {
        require(position.liquidity > 0, "not enough liquidity to update");
        pool.burn(position.tickLower, position.tickUpper, 0);
    }

    ///@notice collect fee from current position
    ///@dev after update position, collect fee and calculate protocolfee
/**    function collectFee() private returns (uint128 collected0, uint128 collected1) {
        //1.update fee
        updatePosition();
        //poisition liquidity > 0 인지 확인해보기

        //2.collect
        uint24 protocolFee = fee;

        (uint128 amount0, uint128 amount1) = pool.collect(
            address(this),
            position.tickLower,
            position.tickUpper,
            type(uint128).max,
            type(uint128).max
        );
        
        uint128 protocolfee0 = amount0.mul(protocolFee).div(1e6);
        uint128 protocolfee1 = amount1.mul(protocolFee).div(1e6);

        collected0 = amount0.sub(protocolfee0);
        collected1 = amount1.sub(protocolfee1);
    }
*/
    function uniswapV3MintCallback(
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override {
        address payer = abi.decode(data, (address));
        require(msg.sender == address(pool));

        if(payer == address(this)){
            token0.transfer(msg.sender, amount0);
            token1.transfer(msg.sender, amount1);
        } else{
            token0.transferFrom(payer, msg.sender, amount0);
            token1.transferFrom(payer, msg.sender, amount1);
        }
    }

    //function collectProtocol() external onlyFactory {}
    
    function getBalance0() external view returns (uint256 balance){
        balance = token0.balanceOf(address(this));
    }
    function getBalance1() external view returns (uint256 balance){
        balance = token1.balanceOf(address(this));
    }
    function setStragy(address _stratgy) external onlyFactory {
        stratgy = _stratgy;
    }
    function setFactory(address _factory) external onlyFactory{
        factory = _factory;
    }
}