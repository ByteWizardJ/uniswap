/**
 * 简单的 Uniswap V3 交换计算示例
 * 
 * 本文件演示了 Uniswap V3 交换的核心计算，
 * 不包含完整模拟的复杂性。
 */

const uniswapV3 = require('./uniswap_v3_calculations.js');

// 常量
const Q96 = Math.pow(2, 96);
const FEE_TIER = 0.003; // 0.3%

// 示例 1：基本价格和刻度转换
console.log('\n===== 示例 1：价格和刻度转换 =====');
const price = 2000; // 每 ETH 2000 USDC
const tick = uniswapV3.priceToTick(price);
const recoveredPrice = uniswapV3.tickToPrice(tick);

console.log(`价格: ${price} USDC per ETH`);
console.log(`刻度: ${tick}`);
console.log(`恢复的价格: ${recoveredPrice.toFixed(2)} USDC per ETH`);

// 示例 2：计算仓位的流动性
console.log('\n===== 示例 2：流动性计算 =====');
const lowerPrice = 1900;
const upperPrice = 2100;
const ethAmount = 1; // 1 ETH
const usdcAmount = 2000; // 2000 USDC

const sqrtPriceX96 = uniswapV3.priceToSqrtPriceX96(price);
const sqrtPriceAX96 = uniswapV3.priceToSqrtPriceX96(lowerPrice);
const sqrtPriceBX96 = uniswapV3.priceToSqrtPriceX96(upperPrice);

const liquidity = uniswapV3.getLiquidityForAmounts(
  sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, ethAmount, usdcAmount
);

console.log(`仓位: ${lowerPrice}-${upperPrice} USDC per ETH`);
console.log(`ETH 数量: ${ethAmount}`);
console.log(`USDC 数量: ${usdcAmount}`);
console.log(`计算的流动性: ${liquidity}`);

// 示例 3：计算给定流动性的代币数量
console.log('\n===== 示例 3：流动性对应的代币数量 =====');
const amounts = uniswapV3.getAmountsForLiquidity(
  sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, liquidity
);

console.log(`流动性: ${liquidity}`);
console.log(`ETH 数量: ${amounts.amount0.toFixed(6)}`);
console.log(`USDC 数量: ${amounts.amount1.toFixed(6)}`);
console.log(`当前价格下的总价值: $${(amounts.amount0 * price + amounts.amount1).toFixed(2)}`);

// 示例 4：简单交换计算
console.log('\n===== 示例 4：简单交换计算 =====');
const amountIn = 0.1; // 0.1 ETH
const zeroForOne = true; // ETH -> USDC

// 对输入金额应用费用
const amountInWithFee = amountIn * (1 - FEE_TIER);

// 使用现货价格计算输出金额（简化）
const amountOut = amountInWithFee * price;

// 计算价格影响（简化）
const newPrice = price * (1 - amountIn / 100); // 简化的价格影响计算
const priceImpact = (price - newPrice) / price * 100;

console.log(`交换: ${amountIn} ETH -> USDC`);
console.log(`费率: ${FEE_TIER * 100}%`);
console.log(`费用金额: ${(amountIn * FEE_TIER).toFixed(6)} ETH`);
console.log(`扣除费用后的输入金额: ${amountInWithFee.toFixed(6)} ETH`);
console.log(`输出金额: ${amountOut.toFixed(6)} USDC`);
console.log(`初始价格: ${price.toFixed(2)} USDC per ETH`);
console.log(`新价格: ${newPrice.toFixed(2)} USDC per ETH`);
console.log(`价格影响: ${priceImpact.toFixed(4)}%`);

// 示例 5：费用计算
console.log('\n===== 示例 5：费用计算 =====');
const positionLiquidity = 5000;
const poolLiquidity = 100000;
const dailyVolume = 5000000; // 每日交易量 500 万美元

const dailyFees = uniswapV3.calculateFees(
  positionLiquidity, dailyVolume, poolLiquidity, FEE_TIER
);

console.log(`仓位流动性: ${positionLiquidity}`);
console.log(`池流动性: ${poolLiquidity}`);
console.log(`日交易量: $${(dailyVolume).toFixed(2)}`);
console.log(`费率: ${FEE_TIER * 100}%`);
console.log(`每日赚取的费用: $${dailyFees.toFixed(2)}`);
console.log(`预计年费: $${(dailyFees * 365).toFixed(2)}`);

// 示例 6：多刻度交换模拟
console.log('\n===== 示例 6：多刻度交换模拟 =====');

// 简化的多刻度交换模拟
function simulateMultiTickSwap(amountIn, currentTick, currentPrice, feeTier) {
  // 定义一些带有流动性的刻度
  const ticks = [
    { tick: 75800, price: 1957.89, liquidity: 10000 },
    { tick: 76000, price: 1997.44, liquidity: 20000 },
    { tick: 76012, price: 2000.00, liquidity: 30000 }, // 当前刻度
    { tick: 76200, price: 2037.58, liquidity: 20000 },
    { tick: 76400, price: 2078.31, liquidity: 10000 }
  ];
  
  // 查找当前刻度索引
  const currentTickIndex = ticks.findIndex(t => t.tick === currentTick);
  if (currentTickIndex === -1) return null;
  
  let remainingAmountIn = amountIn;
  let totalAmountOut = 0;
  let currentTickIdx = currentTickIndex;
  let currentPx = currentPrice;
  
  // 应用费用
  const amountInWithFee = amountIn * (1 - feeTier);
  const feeAmount = amountIn * feeTier;
  
  // 模拟跨刻度交换（简化）
  while (remainingAmountIn > 0 && currentTickIdx > 0) {
    // 获取当前和下一个刻度
    const currentT = ticks[currentTickIdx];
    const nextT = ticks[currentTickIdx - 1];
    
    // 计算价格范围
    const priceDelta = currentT.price - nextT.price;
    
    // 计算移动到下一个刻度所需的输入量
    const amountToNextTick = (priceDelta / currentT.price) * currentT.liquidity;
    
    if (amountToNextTick >= remainingAmountIn) {
      // 没有足够的输入到达下一个刻度
      // 基于当前价格和剩余输入计算输出
      const outputAmount = remainingAmountIn * currentPx;
      totalAmountOut += outputAmount;
      
      // 计算新价格（简化）
      const priceImpact = (remainingAmountIn / currentT.liquidity) * 100;
      currentPx = currentPx * (1 - priceImpact / 100);
      
      remainingAmountIn = 0;
    } else {
      // 有足够的输入跨越到下一个刻度
      // 计算此段的输出
      const outputAmount = amountToNextTick * currentPx;
      totalAmountOut += outputAmount;
      
      // 移动到下一个刻度
      remainingAmountIn -= amountToNextTick;
      currentTickIdx--;
      currentPx = nextT.price;
    }
  }
  
  return {
    amountIn: amountIn,
    amountOut: totalAmountOut,
    feePaid: feeAmount,
    finalPrice: currentPx,
    finalTick: ticks[currentTickIdx].tick,
    priceImpact: (currentPrice - currentPx) / currentPrice * 100
  };
}

const multiTickSwapResult = simulateMultiTickSwap(
  10, // 10 ETH
  76012, // 当前刻度
  2000, // 当前价格
  FEE_TIER
);

console.log(`交换: 10 ETH -> USDC`);
console.log(`初始刻度: 76012 (价格: 2000.00 USDC per ETH)`);
console.log(`输入金额: ${multiTickSwapResult.amountIn.toFixed(6)} ETH`);
console.log(`支付的费用: ${multiTickSwapResult.feePaid.toFixed(6)} ETH`);
console.log(`输出金额: ${multiTickSwapResult.amountOut.toFixed(6)} USDC`);
console.log(`最终刻度: ${multiTickSwapResult.finalTick} (价格: ${multiTickSwapResult.finalPrice.toFixed(2)} USDC per ETH)`);
console.log(`价格影响: ${multiTickSwapResult.priceImpact.toFixed(4)}%`);

// 示例 7：集中流动性比较（V2 vs V3）
console.log('\n===== 示例 7：集中流动性比较 =====');
// V2：流动性分布在整个价格范围（0 到无穷大）
// V3：流动性集中在特定价格范围

// 假设一个拥有 1000 万美元 TVL 的 V2 池
const v2Tvl = 10000000;
// 假设只有 5% 的价格范围被积极用于交易
const activeRangePercentage = 0.05;
// 在 V2 中，所有流动性都分布在整个范围内
const v2ActiveCapital = v2Tvl * activeRangePercentage;

// 在 V3 中，流动性可以集中在活跃范围内
const v3ActiveCapital = v2ActiveCapital;
// 资金效率比率
const capitalEfficiencyRatio = v2Tvl / v3ActiveCapital;

console.log(`V2 总锁仓价值: $${v2Tvl.toFixed(2)}`);
console.log(`活跃交易范围: ${activeRangePercentage * 100}% 的完整范围`);
console.log(`V2 活跃资金: $${v2ActiveCapital.toFixed(2)}`);
console.log(`V3 需要的资金以获得相同深度: $${v3ActiveCapital.toFixed(2)}`);
console.log(`资金效率比率: ${capitalEfficiencyRatio.toFixed(1)}x`);
console.log(`这意味着 V3 可以用 V2 所需资金的 ${(1/capitalEfficiencyRatio * 100).toFixed(1)}% 提供相同的交易深度。`); 