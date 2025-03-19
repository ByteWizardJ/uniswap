/**
 * Uniswap V3 SDK 概念示例
 * 
 * 本文件演示如何使用官方 Uniswap V3 SDK 的核心概念，
 * 包括代币、费率层级、池地址计算和与合约交互的方法。
 * 
 * 需要安装以下依赖:
 * npm install @uniswap/v3-sdk @uniswap/sdk-core ethers jsbi
 */

// 导入必要的依赖
const { ethers } = require('ethers');
const { 
  Pool, 
  Position, 
  nearestUsableTick, 
  TickMath, 
  TICK_SPACINGS, 
  FeeAmount, 
  computePoolAddress,
  SwapQuoter,
  SwapRouter
} = require('@uniswap/v3-sdk');
const { 
  Token, 
  CurrencyAmount, 
  Percent, 
  TradeType, 
  Fraction 
} = require('@uniswap/sdk-core');
const JSBI = require('jsbi');

// 格式化数字的辅助函数
function formatNumber(num, decimals = 2) {
  if (num === 0) return '0';
  if (Math.abs(num) < 0.001) return num.toExponential(decimals);
  return num.toFixed(decimals);
}

console.log('===== Uniswap V3 SDK 概念示例 =====');

// ===== 第 1 部分：创建代币 =====
console.log('\n===== 第 1 部分：创建代币 =====');

// 定义常量
const MAINNET_CHAIN_ID = 1;

// 创建代币实例
const WETH = new Token(
  MAINNET_CHAIN_ID,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  18,
  'WETH',
  'Wrapped Ether'
);

const USDC = new Token(
  MAINNET_CHAIN_ID,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6,
  'USDC',
  'USD Coin'
);

console.log('已创建代币:');
console.log(`WETH: ${WETH.name} (${WETH.symbol})`);
console.log(`地址: ${WETH.address}`);
console.log(`小数位: ${WETH.decimals}`);
console.log();
console.log(`USDC: ${USDC.name} (${USDC.symbol})`);
console.log(`地址: ${USDC.address}`);
console.log(`小数位: ${USDC.decimals}`);

// ===== 第 2 部分：费率层级 =====
console.log('\n\n===== 第 2 部分：费率层级 =====');
console.log('Uniswap V3 提供多种费率层级以适应不同的资产波动性。');

const feeTiers = [
  { name: 'LOWEST', fee: FeeAmount.LOWEST, percent: '0.01%', tickSpacing: TICK_SPACINGS[FeeAmount.LOWEST], volatility: '非常低', example: '稳定币对 (USDC/USDT)' },
  { name: 'LOW', fee: FeeAmount.LOW, percent: '0.05%', tickSpacing: TICK_SPACINGS[FeeAmount.LOW], volatility: '低', example: '稳定资产对 (DAI/USDC)' },
  { name: 'MEDIUM', fee: FeeAmount.MEDIUM, percent: '0.3%', tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM], volatility: '中等', example: '蓝筹对 (ETH/USDC)' },
  { name: 'HIGH', fee: FeeAmount.HIGH, percent: '1%', tickSpacing: TICK_SPACINGS[FeeAmount.HIGH], volatility: '高', example: '小众对 (ALT/ETH)' }
];

console.log('\n可用费率层级:');
console.log('名称 | 费率 | 百分比 | 刻度间距 | 波动性 | 示例对');
console.log('-'.repeat(90));
feeTiers.forEach(tier => {
  console.log(`${tier.name.padEnd(8)} | ${tier.fee.toString().padEnd(6)} | ${tier.percent.padEnd(6)} | ${String(tier.tickSpacing).padEnd(10)} | ${tier.volatility.padEnd(10)} | ${tier.example}`);
});

// ===== 第 3 部分：计算池地址 =====
console.log('\n\n===== 第 3 部分：计算池地址 =====');
console.log('Uniswap V3 使用确定性工厂模式创建池。');

// 选择费率层级
const FEE_TIER = FeeAmount.MEDIUM; // 0.3%

// 计算池地址
const POOL_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'; // Uniswap V3 工厂地址
const poolAddress = computePoolAddress({
  factoryAddress: POOL_FACTORY_ADDRESS,
  tokenA: WETH,
  tokenB: USDC,
  fee: FEE_TIER
});

console.log(`WETH/USDC 池地址 (${FEE_TIER / 10000}% 费率): ${poolAddress}`);
console.log('注意: 在实际应用中，您需要使用此地址从链上查询池数据。');

// ===== 第 4 部分：价格和刻度 =====
console.log('\n\n===== 第 4 部分：价格和刻度 =====');
console.log('Uniswap V3 使用离散的刻度系统来表示价格。');

// 价格和刻度转换
const CURRENT_PRICE = 2000; // 每 ETH 的 USDC 价格
console.log(`当前价格: $${CURRENT_PRICE} USDC per ETH`);

// 计算对应的刻度
// 公式: tick = log(price) / log(1.0001)
const CURRENT_TICK = Math.floor(Math.log(CURRENT_PRICE) / Math.log(1.0001));
console.log(`对应的刻度: ${CURRENT_TICK}`);

// 从刻度计算价格
// 公式: price = 1.0001^tick
const calculatedPrice = Math.pow(1.0001, CURRENT_TICK);
console.log(`从刻度计算的价格: $${formatNumber(calculatedPrice)} USDC per ETH`);

// 显示一些附近的刻度
const tickSpacing = TICK_SPACINGS[FEE_TIER];
console.log('\n附近的初始化刻度:');
for (let i = -3; i <= 3; i++) {
  const tick = Math.floor(CURRENT_TICK / tickSpacing) * tickSpacing + (i * tickSpacing);
  const price = Math.pow(1.0001, tick);
  console.log(`刻度 ${tick}: $${formatNumber(price)} USDC per ETH`);
}

// ===== 第 5 部分：流动性范围 =====
console.log('\n\n===== 第 5 部分：流动性范围 =====');
console.log('Uniswap V3 允许流动性提供者在特定价格范围内提供流动性。');

// 定义价格范围
const LOWER_PRICE = 1800;
const UPPER_PRICE = 2200;
console.log(`价格范围: $${LOWER_PRICE} - $${UPPER_PRICE} USDC per ETH`);

// 计算对应的刻度
const LOWER_TICK = Math.floor(Math.log(LOWER_PRICE) / Math.log(1.0001));
const UPPER_TICK = Math.floor(Math.log(UPPER_PRICE) / Math.log(1.0001));

// 找到最近的可用刻度
const lowerTick = nearestUsableTick(LOWER_TICK, tickSpacing);
const upperTick = nearestUsableTick(UPPER_TICK, tickSpacing);

console.log(`价格范围对应的刻度: ${LOWER_TICK} - ${UPPER_TICK}`);
console.log(`最近的可用刻度: ${lowerTick} - ${upperTick}`);

// 计算资金效率
const priceRange = UPPER_PRICE - LOWER_PRICE;
const percentOfFullRange = priceRange / CURRENT_PRICE * 100;
const efficiency = 100 / percentOfFullRange;

console.log(`价格范围宽度: ${formatNumber(percentOfFullRange)}% 的当前价格`);
console.log(`资金效率: 与全范围相比 ${formatNumber(efficiency)}x`);

// ===== 第 6 部分：与合约交互 =====
console.log('\n\n===== 第 6 部分：与合约交互 =====');
console.log('在实际应用中，您需要与以太坊网络上的 Uniswap V3 合约交互。');

// 定义重要的合约地址
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const NONFUNGIBLE_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

console.log('\n重要的合约地址:');
console.log(`Uniswap V3 工厂: ${UNISWAP_V3_FACTORY}`);
console.log(`非同质化头寸管理器: ${NONFUNGIBLE_POSITION_MANAGER}`);
console.log(`交换路由器: ${SWAP_ROUTER}`);
console.log(`报价器: ${QUOTER}`);

// ===== 第 7 部分：实际应用中的完整流程 =====
console.log('\n\n===== 第 7 部分：实际应用中的完整流程 =====');
console.log('以下是在实际应用中使用 Uniswap V3 SDK 的完整流程示例代码。');

console.log(`
// ===== 连接到以太坊网络 =====
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/YOUR_INFURA_KEY');
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// ===== 查询池数据 =====
// 定义 Uniswap V3 池 ABI（仅包含我们需要的函数）
const IUniswapV3PoolABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)'
];

// 创建池合约实例
const poolContract = new ethers.Contract(poolAddress, IUniswapV3PoolABI, provider);

// 查询池数据
async function getPoolData() {
  const [slot0, liquidity] = await Promise.all([
    poolContract.slot0(),
    poolContract.liquidity()
  ]);
  
  const { sqrtPriceX96, tick } = slot0;
  
  console.log('池数据:');
  console.log(\`当前刻度: \${tick}\`);
  console.log(\`当前价格: $\${formatNumber(Math.pow(1.0001, tick))} USDC per ETH\`);
  console.log(\`流动性: \${liquidity.toString()}\`);
  
  // 创建池实例
  const pool = new Pool(
    WETH,
    USDC,
    FEE_TIER,
    sqrtPriceX96.toString(),
    liquidity.toString(),
    tick
  );
  
  return pool;
}

// ===== 添加流动性 =====
// 定义 NonfungiblePositionManager ABI（仅包含我们需要的函数）
const INonfungiblePositionManagerABI = [
  'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
];

// 定义 ERC20 ABI（仅包含我们需要的函数）
const IERC20ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)'
];

// 批准代币转账
async function approveToken(tokenAddress, spender, amount) {
  const tokenContract = new ethers.Contract(tokenAddress, IERC20ABI, wallet);
  const tx = await tokenContract.approve(spender, amount);
  await tx.wait();
  console.log(\`已批准 \${spender} 使用 \${amount} 代币 \${tokenAddress}\`);
}

// 添加流动性
async function addLiquidity(pool, lowerTick, upperTick, ethAmount, usdcAmount) {
  // 创建代币金额
  const ethCurrencyAmount = CurrencyAmount.fromRawAmount(
    WETH,
    ethers.utils.parseUnits(ethAmount.toString(), WETH.decimals).toString()
  );
  
  const usdcCurrencyAmount = CurrencyAmount.fromRawAmount(
    USDC,
    ethers.utils.parseUnits(usdcAmount.toString(), USDC.decimals).toString()
  );
  
  // 创建仓位
  const position = Position.fromAmounts({
    pool,
    tickLower: lowerTick,
    tickUpper: upperTick,
    amount0: ethCurrencyAmount.quotient,
    amount1: usdcCurrencyAmount.quotient,
    useFullPrecision: true
  });
  
  console.log('仓位信息:');
  console.log(\`刻度范围: \${position.tickLower} - \${position.tickUpper}\`);
  console.log(\`流动性: \${position.liquidity.toString()}\`);
  
  // 创建 NonfungiblePositionManager 合约实例
  const positionManager = new ethers.Contract(
    NONFUNGIBLE_POSITION_MANAGER,
    INonfungiblePositionManagerABI,
    wallet
  );
  
  // 批准代币转账
  await approveToken(WETH.address, NONFUNGIBLE_POSITION_MANAGER, position.amount0.quotient.toString());
  await approveToken(USDC.address, NONFUNGIBLE_POSITION_MANAGER, position.amount1.quotient.toString());
  
  // 获取铸造参数
  const mintParams = {
    token0: position.pool.token0.address,
    token1: position.pool.token1.address,
    fee: position.pool.fee,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    amount0Desired: position.amount0.quotient.toString(),
    amount1Desired: position.amount1.quotient.toString(),
    amount0Min: '0',
    amount1Min: '0',
    recipient: wallet.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20
  };
  
  // 铸造仓位
  const tx = await positionManager.mint(mintParams);
  const receipt = await tx.wait();
  console.log('仓位已创建，交易哈希:', receipt.transactionHash);
  
  return receipt;
}

// ===== 执行交换 =====
// 定义 SwapRouter ABI（仅包含我们需要的函数）
const ISwapRouterABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
];

// 定义 Quoter ABI（仅包含我们需要的函数）
const IQuoterABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
];

// 获取交换报价
async function getSwapQuote(tokenIn, tokenOut, fee, amountIn) {
  // 创建 Quoter 合约实例
  const quoter = new ethers.Contract(QUOTER, IQuoterABI, provider);
  
  // 获取报价
  const amountOut = await quoter.callStatic.quoteExactInputSingle(
    tokenIn.address,
    tokenOut.address,
    fee,
    ethers.utils.parseUnits(amountIn.toString(), tokenIn.decimals).toString(),
    0
  );
  
  return ethers.utils.formatUnits(amountOut, tokenOut.decimals);
}

// 执行交换
async function executeSwap(tokenIn, tokenOut, fee, amountIn, amountOutMinimum) {
  // 创建 SwapRouter 合约实例
  const swapRouter = new ethers.Contract(SWAP_ROUTER, ISwapRouterABI, wallet);
  
  // 批准代币转账
  const amountInWei = ethers.utils.parseUnits(amountIn.toString(), tokenIn.decimals).toString();
  await approveToken(tokenIn.address, SWAP_ROUTER, amountInWei);
  
  // 创建交换参数
  const swapParams = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    fee: fee,
    recipient: wallet.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
    amountIn: amountInWei,
    amountOutMinimum: ethers.utils.parseUnits(amountOutMinimum.toString(), tokenOut.decimals).toString(),
    sqrtPriceLimitX96: '0'
  };
  
  // 执行交换
  const tx = await swapRouter.exactInputSingle(swapParams);
  const receipt = await tx.wait();
  console.log('交换已执行，交易哈希:', receipt.transactionHash);
  
  return receipt;
}

// ===== 主函数 =====
async function main() {
  try {
    // 1. 获取池数据
    const pool = await getPoolData();
    
    // 2. 添加流动性
    const ethAmount = 0.5; // 0.5 ETH
    const usdcAmount = 1000; // 1000 USDC
    await addLiquidity(pool, lowerTick, upperTick, ethAmount, usdcAmount);
    
    // 3. 获取交换报价
    const swapAmount = 0.1; // 0.1 ETH
    const amountOut = await getSwapQuote(WETH, USDC, FEE_TIER, swapAmount);
    console.log(\`交换 \${swapAmount} ETH 预计获得 \${amountOut} USDC\`);
    
    // 4. 执行交换
    const minAmountOut = parseFloat(amountOut) * 0.99; // 允许 1% 的滑点
    await executeSwap(WETH, USDC, FEE_TIER, swapAmount, minAmountOut);
    
    console.log('所有操作已完成！');
  } catch (error) {
    console.error('发生错误:', error);
  }
}

// 运行主函数
// main();
`);

// ===== 第 8 部分：与自定义模拟的比较 =====
console.log('\n\n===== 第 8 部分：与自定义模拟的比较 =====');
console.log('使用官方 SDK 与自定义模拟相比的优缺点。');

console.log('\n官方 Uniswap V3 SDK 的优点:');
console.log('1. 准确性 - 使用与链上相同的计算逻辑，确保结果与实际交易一致');
console.log('2. 维护 - 由 Uniswap 团队维护，随着协议更新而更新');
console.log('3. 完整性 - 提供与协议交互所需的所有功能');
console.log('4. 安全性 - 经过审计和广泛使用，减少错误风险');

console.log('\n自定义模拟的优点:');
console.log('1. 简单性 - 可以简化复杂概念，更容易理解');
console.log('2. 灵活性 - 可以根据特定需求进行定制');
console.log('3. 教育价值 - 有助于理解底层机制');
console.log('4. 无依赖 - 不需要安装多个依赖包');

console.log('\n结论:');
console.log('- 对于教育和理解概念，自定义模拟很有价值');
console.log('- 对于实际应用和生产环境，应该使用官方 SDK');
console.log('- 理想的方法是先使用自定义模拟理解概念，然后过渡到官方 SDK 进行实际应用');

// ===== 结论 =====
console.log('\n\n===== 结论 =====');
console.log('Uniswap V3 SDK 提供了与 Uniswap V3 协议交互的强大工具。');
console.log('在实际应用中，您需要:');
console.log('1. 从链上获取实时数据');
console.log('2. 处理代币批准和交易签名');
console.log('3. 管理交易失败和错误情况');
console.log('4. 考虑价格影响和滑点');
console.log('\n有关更多信息，请参阅 Uniswap V3 文档: https://docs.uniswap.org/');
console.log('GitHub 仓库: https://github.com/Uniswap/v3-sdk'); 