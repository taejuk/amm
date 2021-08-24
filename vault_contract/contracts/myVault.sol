// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "../libraries/SafeMath.sol";
import "../libraries/ERC20.sol";
//import "../libraries/IERC20.sol";
import "../libraries/SafeCast.sol";
// import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolImmutables.sol';
// import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolState.sol';
// import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolDerivedState.sol';
// import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolActions.sol';
// import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolOwnerActions.sol';
// import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolEvents.sol';
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import "@uniswap/v3-periphery/contracts/libraries/PositionKey.sol";
import "@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";


contract myVault is mERC20, IUniswapV3MintCallback, IUniswapV3SwapCallback
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
    address public Rebalancer;
    IUniswapV3Pool public pool;
    uint24 public fee;

    uint256 private protocolFee0;
    uint256 private protocolFee1;

    //update when call rebalance
    
    address public immutable token0;
    address public immutable token1;

    uint private previousTime;

    struct SqrtRatios{
        uint160 sqrtPriceX96;
        uint160 sqrtRatioAX96;
        uint160 sqrtRatioBX96;
    }

    struct PositionInfo{
        bool initialized;
        bytes32 positionKey;
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

    modifier onlyRebalancer(){
        require(msg.sender == Rebalancer, "not rebalancer");
        _;
    }
    
    /**
     * @dev Set contract deployer as owner
     */
    constructor(address _factory, address _pool, uint24 _fee, address _rebalancer) mERC20 ("CWC", "CWC") {
        token0 = IUniswapV3Pool(_pool).token0();
        token1 = IUniswapV3Pool(_pool).token1();

        factory = _factory;
        pool = IUniswapV3Pool(_pool);
        fee = _fee;
        Rebalancer = _rebalancer;

        position.unlocked = true;
        position.initialized = false;
    }

    function test() public pure returns (string memory) {
        return "vault";
    }

    function getPosition() public view returns(PositionInfo memory){
        return position;
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
        PositionInfo memory _position = position;
        require(_position.tickUpper > _position.tickLower, "range unvailidate");
        //require(_position.initialized, "uninitialized position");

        SqrtRatios memory ratios = getRatios(_position.tickLower, _position.tickUpper);

        if(_position.initialized){
            updatePosition(_position);
        }
        tokenAmount = AmountToMint(ratios, _position, amount0Desired, amount1Desired);
        _mint(recipient, tokenAmount);

        (amount0, amount1) = addLiquidity(_position, ratios, amount0Desired, amount1Desired, recipient);

        require(amount0 > amount0min && amount1 > amount1min, "deposit slippage");
    }

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
        //updatePosition();

        PositionInfo memory _position = position;
        require(_position.tickUpper > _position.tickLower, "range unvailidate");

        // burn liquidity from position
        (uint256 Amount0toCollect, uint256 Amount1toCollect) = _burnAstoken(_position, token);
        // collect burned liquidity and earned fee
        pool.collect(
            address(this),
            _position.tickLower,
            _position.tickUpper,
            SafeCast.toUint128(Amount0toCollect),
            SafeCast.toUint128(Amount1toCollect)
        );
        //r : rate, To : tokenowed after burn liquiditydelta, L : liquidity
        //(To - L(1-r))r
        _burn(recipient, _token);

        require(amount0 >= amount0min && amount1 >= amount1min, "withdraw slippage");
    }
    struct RebalanceParams{
        int24 tickLower;
        int24 tickUpper;
        int256 swapAmount;
        bool zeroforOne;
        uint160 sqrtPriceLimitX96;
    }

    function rebalance(
        RebalanceParams memory param
    ) external lock onlyRebalancer returns (uint256 amount0, uint256 amount1){
        require(param.tickLower < param.tickUpper, "range invalid");
        require(block.timestamp - previousTime > 10000 || previousTime == 0, "rebalance perioud error");

        previousTime = block.timestamp;
        
        PositionInfo memory _position = position;
        SqrtRatios memory ratios = getRatios(param.tickLower, param.tickUpper);
        //require(zeroforOne ? 
        //swapAmount < LiquidityAmounts.getAmount0ForLiquidity(ratios.sqrtRatioAX96, ratios.sqrtRatioBX96, _position.liquidity) : 
        //swapAmount < LiquidityAmounts.getAmount1ForLiquidity(ratios.sqrtRatioAX96, ratios.sqrtRatioBX96, _position.liquidity));

        if(_position.initialized){
            updatePosition(_position);
            (uint128 liquidity,,,,) =
             pool.positions(PositionKey.compute(address(this), _position.tickLower, _position.tickUpper));
             
            (uint256 pureInterest0, uint256 pureInterest1,,) = _calcPureInterest(_position, liquidity);
            //pureinterest = tokenowed(fee + burned liquidty) - collectAmount

            (uint256 protocolfee0, uint256 protocolfee1) = (FullMath.mulDiv(pureInterest0, fee, 1e6), FullMath.mulDiv(pureInterest1, fee, 1e6));

            protocolFee0 += protocolfee0;
            protocolFee1 += protocolfee1;

            pool.collect(
                address(this),
                _position.tickLower,
                _position.tickUpper,
                type(uint128).max,
                type(uint128).max
            );

            position.initialized = false;

            //safe convert
            if(param.swapAmount > 0){
                _swap(param);
            }

            amount0 = IERC20(token0).balanceOf(address(this)) - protocolFee0;
            amount1 = IERC20(token1).balanceOf(address(this)) - protocolFee1;

            _position.tickLower = param.tickLower;
            _position.tickUpper = param.tickUpper;
            (amount0, amount1) = addLiquidity(_position, ratios, amount0, amount1, address(this));
            position.initialized = true;
            position.positionKey = PositionKey.compute(address(this), param.tickLower, param.tickUpper);
        }
        // else {
        //     _position.tickLower = param.tickLower;
        //     _position.tickUpper = param.tickUpper;
        //     //addLiquidity(_position, ratios, 0, 0, address(this));
        // }
        
        {
            position.tickLower = param.tickLower;
            position.tickUpper = param.tickUpper;
            //position.initialized = true;
            //position.positionKey = PositionKey.compute(address(this), param.tickLower, param.tickUpper);
        }
    }

    
    function _burnAstoken(PositionInfo memory _position, uint256 tokenAmount) internal returns (uint256 amount0, uint256 amount1) {
        updatePosition(_position);
        (uint128 liquidity,,,,) = pool.positions(PositionKey.compute(address(this), _position.tickLower, _position.tickUpper));
        uint256 liquidityDelta = FullMath.mulDiv(uint256(liquidity), tokenAmount, this.totalSupply());

        (uint256 pureInterest0, uint256 pureInterest1, uint256 burnedamount0 , uint256 burnedamount1) = _calcPureInterest(_position, SafeCast.toUint128(liquidityDelta));

        (uint256 fee0, uint256 fee1) = _calcProtocolFee(pureInterest0, pureInterest1);
        amount0 = fee0 + burnedamount0;
        amount1 = fee1 + burnedamount1;
    }

    function _calcProtocolFee(
        uint256 pureInterest0,
        uint256 pureInterest1
    ) internal returns(uint256 amountfeeCollect0, uint256 amountfeeCollect1) {
        uint256 protocolfee0 = FullMath.mulDiv(pureInterest0, fee, 1e6);
        uint256 protocolfee1 = FullMath.mulDiv(pureInterest1, fee, 1e6);

        protocolFee0 += protocolfee0;
        protocolFee1 += protocolfee1;

        amountfeeCollect0 = pureInterest0 - protocolfee0;
        amountfeeCollect1 = pureInterest1 - protocolfee1;
    }

    /**
    * @notice user가 예치해 둔 토큰 태우고 유저에게 해당 토큰만큼 비율에 맞게 예치토큰 준다. vault에 임시로 예치된 liquidity로
    * 해결되면 그걸로 지급. 부족하면 position에서 decreaseliquidity후 지급 fee 계산은 어떻게 하지?????????
    */
    
    function _calcPureInterest(
        PositionInfo memory _position,
        uint128 liquidityDelta
    ) internal returns(
        uint256 pureInterest0,
        uint256 pureInterest1,
        uint256 collectAmount0,
        uint256 collectAmount1
    ){
        (collectAmount0, collectAmount1) = pool.burn(_position.tickLower, _position.tickUpper, liquidityDelta);

        (,,,uint128 tokenOwed0, uint128 tokenOwed1) = pool.positions(PositionKey.compute(address(this), _position.tickLower, _position.tickUpper));

        pureInterest0 = uint256(tokenOwed0) - (collectAmount0);
        pureInterest1 = uint256(tokenOwed1) - (collectAmount1);
    }

    function _swap(RebalanceParams memory param) internal {
        pool.swap(
            address(this),
            param.zeroforOne,
            param.swapAmount,
            param.sqrtPriceLimitX96,
            ""
        );
    }

    function getRatios(
        int24 tickLower,
        int24 tickUpper
    ) internal view returns (SqrtRatios memory ratios){
        (ratios.sqrtPriceX96, , , , , , ) = pool.slot0();
        ratios.sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        ratios.sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    }

    function addLiquidity(
        PositionInfo memory _position,
        SqrtRatios memory _ratios,
        uint256 amount0,
        uint256 amount1,
        address recipient
    ) internal returns (uint256 mintamount0, uint256 mintamount1){
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
                _ratios.sqrtPriceX96,
                _ratios.sqrtRatioAX96,
                _ratios.sqrtRatioBX96,
                amount0,
                amount1
        );

        (mintamount0, mintamount1) = pool.mint(
            address(this),
            _position.tickLower,
            _position.tickUpper,
            liquidity,
            abi.encode(address(recipient))
        );
    }

    function AmountToMint(
        SqrtRatios memory ratios,
        PositionInfo memory _position,
        uint256 addAmount0,
        uint256 addAmount1
    ) internal view returns (uint256 tokenAmount){

        uint256 _fee = fee;
        (uint128 liquidity,,,uint128 tokenOwed0, uint128 tokenOwed1) = pool.positions(PositionKey.compute(address(this), _position.tickLower, _position.tickUpper));

        
        (uint256 interest0, uint256 interest1) =
            _fee > 0 ? (FullMath.mulDiv(uint256(tokenOwed0), _fee, 1e6), FullMath.mulDiv(uint256(tokenOwed1), _fee, 1e6)) :
            (0, 0);
        
        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            ratios.sqrtPriceX96,
            ratios.sqrtRatioAX96,
            ratios.sqrtRatioBX96,
            liquidity
        );

        if(this.totalSupply() == 0){
            tokenAmount = addAmount0 > addAmount1 ? addAmount0 : addAmount1;
        } else if(amount0 == 0 ){
            tokenAmount = _calcTokentoMint(amount1.add(interest1), addAmount1);
        } else if(amount1 == 0){
            tokenAmount = _calcTokentoMint(amount0.add(interest0), addAmount0);
        } else {
            tokenAmount = interest0.mul(amount1) > interest1.mul(amount0) ?
                _calcTokentoMint(amount0.add(interest0), addAmount0):
                _calcTokentoMint(amount1.add(interest1), addAmount1);
        }
    
    }

    function _calcTokentoMint(uint256 prevAmount, uint256 myAmount) internal view returns(uint256){
        return FullMath.mulDiv(myAmount, this.totalSupply(), prevAmount);
    }

    function updatePosition(PositionInfo memory _position) internal {
        pool.burn(_position.tickLower, _position.tickUpper, 0);
    }
    
    function uniswapV3MintCallback(
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override {
        address payer = abi.decode(data, (address));
        require(msg.sender == address(pool));

        if(payer == address(this)){
            if(amount0 > 0) TransferHelper.safeTransfer(token0, msg.sender, amount0);
            if(amount1 > 0) TransferHelper.safeTransfer(token1, msg.sender, amount1);
        } else{
            if(amount0 > 0) TransferHelper.safeTransferFrom(token0, payer, msg.sender, amount0);
            if(amount1 > 0) TransferHelper.safeTransferFrom(token1, payer, msg.sender, amount1);
        }
    }
    
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        require(msg.sender == address(pool));
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
     
        (bool tokenToPay, uint256 amountToPay) = amount0Delta > 0 ? (true, uint256(amount0Delta)) : (false, uint256(amount1Delta));
        
        if(tokenToPay){
            TransferHelper.safeTransfer(token0, msg.sender, amountToPay);
        } else{
            TransferHelper.safeTransfer(token1, msg.sender, amountToPay);
        }
        
    }

    //function collectProtocol() external onlyFactory {}
    
    function setFactory(address _factory) external onlyFactory{
        factory = _factory;
    }
    function getProtocolFees() external view returns (uint256, uint256){
        return (protocolFee0, protocolFee1);
    }
    function setRebalancer(address _rebalancer) external onlyRebalancer{
        Rebalancer = _rebalancer;
    }
    function getRebalancer() external view returns(address){
        return Rebalancer;
    }
}