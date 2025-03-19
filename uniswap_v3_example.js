/**
 * Uniswap V3 计算 - 使用示例
 * 
 * 本文件演示如何使用 Uniswap V3 计算库，
 * 提供交换计算和流动性提供的具体示例。
 */

const uniswapV3 = require('./uniswap_v3_calculations');

// 示例 1：基本价格和刻度转换
console.log('===== 示例 1：基本价格和刻度转换 =====');

const price = 2000; // ETH/USDC 价格为每 ETH 2000 USDC
const tick = uniswapV3.priceToTick(price);
const priceFromTick = uniswapV3.tickToPrice(tick);

console.log(`价格: ${price}`);
console.log(`对应的刻度: ${tick}`);
console.log(`从刻度恢复的价格: ${priceFromTick}`);
console.log(`SqrtPriceX96: ${uniswapV3.priceToSqrtPriceX96(price)}`);
console.log();

// 示例 2：价格范围的流动性计算
console.log('===== 示例 2：价格范围的流动性计算 =====');

// ETH/USDC 池，其中：
const currentPrice = 2000;            // 当前 ETH 价格：2000 USDC
const lowerPriceBound = 1900;         // 价格范围的下限
const upperPriceBound = 2100;         // 价格范围的上限
const ethAmount = 1;                  // 1 ETH
const usdcAmount = 2000;              // 2000 USDC

// 将价格转换为 sqrtPriceX96 格式
const currentSqrtPriceX96 = uniswapV3.priceToSqrtPriceX96(currentPrice);
const lowerSqrtPriceX96 = uniswapV3.priceToSqrtPriceX96(lowerPriceBound);
const upperSqrtPriceX96 = uniswapV3.priceToSqrtPriceX96(upperPriceBound);

// 计算流动性
const liquidity = uniswapV3.getLiquidityForAmounts(
  currentSqrtPriceX96,
  lowerSqrtPriceX96,
  upperSqrtPriceX96,
  ethAmount,
  usdcAmount
);

console.log(`ETH 数量: ${ethAmount}`);
console.log(`USDC 数量: ${usdcAmount}`);
console.log(`价格范围: [${lowerPriceBound} USDC, ${upperPriceBound} USDC]`);
console.log(`计算的流动性: ${liquidity}`);
console.log();

// 示例 3：计算给定流动性的代币数量
console.log('===== 示例 3：计算给定流动性的代币数量 =====');

// 使用示例 2 中的流动性，计算不同价格下的代币数量
const prices = [1900, 1950, 2000, 2050, 2100];
for (const p of prices) {
  const sqrtPriceX96 = uniswapV3.priceToSqrtPriceX96(p);
  const amounts = uniswapV3.getAmountsForLiquidity(
    sqrtPriceX96,
    lowerSqrtPriceX96,
    upperSqrtPriceX96,
    liquidity
  );
  
  console.log(`价格 ${p} USDC 时:`);
  console.log(`  ETH: ${amounts.amount0.toFixed(6)}`);
  console.log(`  USDC: ${amounts.amount1.toFixed(2)}`);
  console.log(`  总价值: $${(amounts.amount0 * p + amounts.amount1).toFixed(2)}`);
}
console.log();

// 示例 4：模拟交换
console.log('===== 示例 4：模拟基本交换 =====');

// 模拟 0.1 ETH 换取 USDC
const amountIn = 0.1; // 0.1 ETH
const poolLiquidity = 100000; // 当前范围内的流动性
const feeTier = uniswapV3.FEE_TIERS.MEDIUM; // 0.3% 费率层级
const zeroForOne = true; // 交换 token0 (ETH) 换取 token1 (USDC)

const swapResult = uniswapV3.computeSwapStep(
  amountIn,
  currentSqrtPriceX96,
  poolLiquidity,
  feeTier,
  zeroForOne
);

const newPrice = uniswapV3.sqrtPriceX96ToPrice(swapResult.newSqrtPriceX96);

console.log(`交换 ${amountIn} ETH 换取 USDC，费率 0.3%`);
console.log(`输出数量: ${swapResult.amountOut.toFixed(6)} USDC`);
console.log(`交换后的新价格: ${newPrice.toFixed(2)} USDC per ETH`);
console.log(`价格影响: ${((currentPrice - newPrice) / currentPrice * 100).toFixed(4)}%`);
console.log();

// 示例 5：计算赚取的费用
console.log('===== 示例 5：计算赚取的费用 =====');

const myLiquidity = 5000; // 我的流动性仓位
const totalPoolLiquidity = 1000000; // 池中的总流动性
const dailyVolumeUSD = 5000000; // 500 万美元日交易量

const dailyFees = uniswapV3.calculateFees(
  myLiquidity,
  dailyVolumeUSD,
  totalPoolLiquidity,
  feeTier
);

const yearlyFees = dailyFees * 365;
const apy = (yearlyFees / (myLiquidity * 2000)) * 100; // 假设 myLiquidity 以 ETH 计价

console.log(`日交易量: $${dailyVolumeUSD.toLocaleString()}`);
console.log(`我的流动性仓位: ${myLiquidity} (占池的 ${(myLiquidity / totalPoolLiquidity * 100).toFixed(4)}%)`);
console.log(`每日赚取的费用: $${dailyFees.toFixed(2)}`);
console.log(`估计年费: $${yearlyFees.toFixed(2)}`);
console.log(`估计费用 APY: ${apy.toFixed(2)}%`);
console.log();

// 示例 6：多刻度交换模拟（简化）
console.log('===== 示例 6：多刻度交换模拟 =====');

// 定义一些带有流动性的模拟刻度
const mockTicks = [
  { index: uniswapV3.priceToTick(1900), liquidityNet: 50000 },
  { index: uniswapV3.priceToTick(1950), liquidityNet: 75000 },
  { index: uniswapV3.priceToTick(2000), liquidityNet: 100000 },
  { index: uniswapV3.priceToTick(2050), liquidityNet: 75000 },
  { index: uniswapV3.priceToTick(2100), liquidityNet: 50000 }
];

// 模拟跨多个刻度的交换
const largeAmountIn = 10; // 10 ETH，足够大以跨越多个刻度
const multiTickSwap = uniswapV3.simulateSwap(
  largeAmountIn,
  mockTicks,
  uniswapV3.priceToTick(2000), // 当前刻度
  feeTier,
  zeroForOne // true = ETH -> USDC
);

console.log(`跨多个刻度交换 ${largeAmountIn} ETH 换取 USDC`);
console.log(`输出数量: ${multiTickSwap.amountOut.toFixed(2)} USDC`);
console.log(`交换后的新刻度: ${multiTickSwap.newTick}`);
console.log(`交换后的新价格: ${uniswapV3.tickToPrice(multiTickSwap.newTick).toFixed(2)} USDC per ETH`);
console.log();

// 示例 7：V2 和 V3 之间的集中流动性比较
console.log('===== 示例 7：集中流动性比较 (V2 vs V3) =====');

// 在 V2 中，流动性分布在整个价格范围 [0, ∞)
// 在 V3 中，流动性可以集中在特定价格范围 [A, B]

// 假设：
// - 总投资：两种情况下都是 $10,000
// - V2：全范围，V3：当前价格周围 5% 的范围
// - 在活跃范围内相同的交易量

const investmentUSD = 10000;
const v2LiquidityEfficiency = 0.01; // V2 流动性的 1% 被积极使用
const v3Range = 0.05; // V3 中 5% 的范围（当前价格周围 ±2.5%）

// 计算资金效率比率
const capitalEfficiencyRatio = 1 / v3Range;

console.log(`V2: $${investmentUSD} 分布在整个价格范围 [0, ∞)`)
console.log(`V3: $${investmentUSD} 集中在当前价格周围 ±2.5% 的范围内`);
console.log(`资金效率比率: ${capitalEfficiencyRatio.toFixed(1)}x`);
console.log(`V2 中的活跃资金: $${(investmentUSD * v2LiquidityEfficiency).toFixed(2)}`);
console.log(`V3 中的活跃资金: $${investmentUSD.toFixed(2)} (范围内 100% 利用)`);
console.log(`V3 费用 APY vs V2 费用 APY: 在相同交易量下高 ${capitalEfficiencyRatio.toFixed(1)}x`);
console.log(); 