/**
 * Uniswap V3 教育示例
 * 
 * 本文件提供教育示例，帮助理解 Uniswap V3 的关键概念：
 * 1. 集中流动性
 * 2. 价格范围和刻度
 * 3. 费率层级
 * 4. 交换执行和价格影响
 * 5. 与 V2 的资金效率比较
 */

// 导入计算模块
const uniswapV3 = require('./uniswap_v3_calculations');

// 常量
const FEE_TIER = 0.003; // 0.3%
const CURRENT_PRICE = 2000; // 每 ETH 的 USDC 价格
const CURRENT_TICK = uniswapV3.priceToTick(CURRENT_PRICE);

// 格式化数字的辅助函数
function formatNumber(num, decimals = 2) {
  if (num === 0) return '0';
  if (Math.abs(num) < 0.001) return num.toExponential(decimals);
  return num.toFixed(decimals);
}

// 可视化流动性分布的辅助函数
function visualizeLiquidity(positions) {
  // 按较低价格对仓位排序
  positions.sort((a, b) => a.lowerPrice - b.lowerPrice);
  
  // 找出范围的最小和最大价格
  const minPrice = Math.floor(positions[0].lowerPrice * 0.9);
  const maxPrice = Math.ceil(positions[positions.length - 1].upperPrice * 1.1);
  
  // 为可视化创建价格点
  const priceStep = (maxPrice - minPrice) / 50;
  const prices = [];
  for (let p = minPrice; p <= maxPrice; p += priceStep) {
    prices.push(p);
  }
  
  // 计算每个价格点的流动性
  const liquidityAtPrice = prices.map(price => {
    let totalLiquidity = 0;
    positions.forEach(pos => {
      if (price >= pos.lowerPrice && price <= pos.upperPrice) {
        totalLiquidity += pos.liquidity;
      }
    });
    return { price, liquidity: totalLiquidity };
  });
  
  // 找出最大流动性用于缩放
  const maxLiquidity = Math.max(...liquidityAtPrice.map(p => p.liquidity));
  
  // 找到最接近当前价格的价格点
  let closestPriceIndex = 0;
  let minDiff = Number.MAX_VALUE;
  liquidityAtPrice.forEach((point, index) => {
    const diff = Math.abs(point.price - CURRENT_PRICE);
    if (diff < minDiff) {
      minDiff = diff;
      closestPriceIndex = index;
    }
  });
  
  // 生成 ASCII 图表
  console.log('\n流动性分布:');
  console.log('价格 (USDC/ETH) | 流动性');
  console.log('-'.repeat(50));
  
  liquidityAtPrice.forEach((point, index) => {
    const barLength = Math.round((point.liquidity / maxLiquidity) * 30);
    const bar = '█'.repeat(barLength);
    const priceStr = `$${formatNumber(point.price, 0).padStart(4)}`;
    
    // 如果这是最接近当前价格的点，添加标记
    if (index === closestPriceIndex) {
      console.log(`${priceStr} | ${bar} ${formatNumber(point.liquidity)} ← 当前价格 ($${CURRENT_PRICE})`);
    } else {
      console.log(`${priceStr} | ${bar} ${formatNumber(point.liquidity)}`);
    }
  });
}

// ===== 第 1 部分：集中流动性 =====
console.log('\n===== 第 1 部分：集中流动性 =====');
console.log('Uniswap V3 引入了集中流动性，允许流动性提供者在特定价格范围内提供流动性。');

// 定义一些流动性仓位
const positions = [
  { 
    name: '宽范围仓位',
    lowerPrice: 1500, 
    upperPrice: 2500, 
    liquidity: 10000,
    ethAmount: 1,
    usdcAmount: 2000
  },
  { 
    name: '中等范围仓位',
    lowerPrice: 1800, 
    upperPrice: 2200, 
    liquidity: 20000,
    ethAmount: 0.5,
    usdcAmount: 1000
  },
  { 
    name: '窄范围仓位',
    lowerPrice: 1950, 
    upperPrice: 2050, 
    liquidity: 30000,
    ethAmount: 0.1,
    usdcAmount: 200
  }
];

// 显示仓位
console.log('\n流动性仓位:');
positions.forEach(pos => {
  console.log(`\n${pos.name}:`);
  console.log(`价格范围: $${formatNumber(pos.lowerPrice)} - $${formatNumber(pos.upperPrice)} USDC per ETH`);
  console.log(`流动性: ${formatNumber(pos.liquidity)}`);
  console.log(`ETH 数量: ${formatNumber(pos.ethAmount, 4)} ETH`);
  console.log(`USDC 数量: ${formatNumber(pos.usdcAmount)} USDC`);
  
  // 计算资金效率
  const fullRangeValue = pos.ethAmount * CURRENT_PRICE + pos.usdcAmount;
  const priceRange = pos.upperPrice - pos.lowerPrice;
  const percentOfFullRange = priceRange / CURRENT_PRICE * 100;
  const efficiency = 100 / percentOfFullRange;
  
  console.log(`价格范围宽度: ${formatNumber(percentOfFullRange)}% 的当前价格`);
  console.log(`资金效率: 与全范围相比 ${formatNumber(efficiency)}x`);
});

// 可视化流动性
visualizeLiquidity(positions);

// ===== 第 2 部分：价格范围和刻度 =====
console.log('\n\n===== 第 2 部分：价格范围和刻度 =====');
console.log('Uniswap V3 使用离散的刻度系统来表示价格。');

// 显示刻度信息
console.log('\n刻度信息:');
console.log(`当前价格: $${formatNumber(CURRENT_PRICE)} USDC per ETH`);
console.log(`当前刻度: ${CURRENT_TICK}`);

// 显示一些附近的刻度
const tickSpacing = 60; // 0.3% 费率层级的常见刻度间距
console.log('\n附近的初始化刻度:');
for (let i = -3; i <= 3; i++) {
  const tick = CURRENT_TICK + (i * tickSpacing);
  const price = uniswapV3.tickToPrice(tick);
  console.log(`刻度 ${tick}: $${formatNumber(price)} USDC per ETH`);
}

// ===== 第 3 部分：费率层级 =====
console.log('\n\n===== 第 3 部分：费率层级 =====');
console.log('Uniswap V3 提供多种费率层级以适应不同的资产波动性。');

const feeTiers = [
  { tier: '0.01%', tickSpacing: 1, volatility: '非常低', example: '稳定币对 (USDC/USDT)' },
  { tier: '0.05%', tickSpacing: 10, volatility: '低', example: '稳定资产对 (DAI/USDC)' },
  { tier: '0.3%', tickSpacing: 60, volatility: '中等', example: '蓝筹对 (ETH/USDC)' },
  { tier: '1%', tickSpacing: 200, volatility: '高', example: '小众对 (ALT/ETH)' }
];

console.log('\n可用费率层级:');
console.log('费率层级 | 刻度间距 | 波动性 | 示例对');
console.log('-'.repeat(70));
feeTiers.forEach(tier => {
  console.log(`${tier.tier.padEnd(9)} | ${String(tier.tickSpacing).padEnd(12)} | ${tier.volatility.padEnd(10)} | ${tier.example}`);
});

// 计算费用收益
const dailyVolume = 5000000; // 500 万美元日交易量
console.log('\n费用收益示例:');
console.log(`池: ETH/USDC`);
console.log(`日交易量: $${formatNumber(dailyVolume)}`);
console.log(`费率层级: ${FEE_TIER * 100}%`);

const totalFees = dailyVolume * FEE_TIER;
console.log(`日总费用: $${formatNumber(totalFees)}`);

// 假设我们的流动性占池的 5%
const ourLiquidityPercentage = 0.05;
const ourDailyFees = totalFees * ourLiquidityPercentage;
console.log(`我们的流动性: 池的 ${formatNumber(ourLiquidityPercentage * 100)}%`);
console.log(`我们的日费用: $${formatNumber(ourDailyFees)}`);
console.log(`我们的年费用 (估计): $${formatNumber(ourDailyFees * 365)}`);

// ===== 第 4 部分：交换执行 =====
console.log('\n\n===== 第 4 部分：交换执行 =====');
console.log('Uniswap V3 通过沿着集中流动性曲线移动来执行交换，可能会跨越多个刻度边界。');

// 定义一个交换
const swapAmountIn = 10; // 10 ETH
console.log(`\n交换示例: ${formatNumber(swapAmountIn)} ETH -> USDC`);
console.log(`初始价格: $${formatNumber(CURRENT_PRICE)} USDC per ETH`);

// 简化的多刻度交换模拟
function simulateMultiTickSwap(amountIn, positions, currentPrice, feeTier) {
  // 按价格排序仓位（ETH->USDC 为升序）
  positions.sort((a, b) => a.lowerPrice - b.lowerPrice);
  
  // 初始化变量
  let remainingAmountIn = amountIn * (1 - feeTier); // 应用费用
  const feeAmount = amountIn * feeTier;
  let totalAmountOut = 0;
  let currentPx = currentPrice;
  let steps = [];
  
  // 跟踪当前价格的活跃流动性
  let activeLiquidity = 0;
  positions.forEach(pos => {
    if (currentPx >= pos.lowerPrice && currentPx <= pos.upperPrice) {
      activeLiquidity += pos.liquidity;
    }
  });
  
  console.log(`初始活跃流动性: ${formatNumber(activeLiquidity)}`);
  
  // 模拟交换
  while (remainingAmountIn > 0 && activeLiquidity > 0) {
    // 找到下一个价格边界（仓位的较低或较高边界）
    let nextPrice = 0;
    positions.forEach(pos => {
      // 对于 ETH->USDC（价格下降），我们寻找下一个较低边界
      if (pos.lowerPrice < currentPx && (nextPrice === 0 || pos.lowerPrice > nextPrice)) {
        nextPrice = pos.lowerPrice;
      }
    });
    
    // 如果没有找到下一个价格，我们已经到达范围的底部
    if (nextPrice === 0) nextPrice = currentPx * 0.5; // 任意大移动
    
    // 计算移动到下一个价格所需的 ETH
    const priceRatio = nextPrice / currentPx;
    const amountToNextPrice = activeLiquidity * (1 - priceRatio);
    
    if (amountToNextPrice >= remainingAmountIn) {
      // 没有足够的输入到达下一个价格边界
      // 计算部分交换后的新价格
      const priceImpact = remainingAmountIn / activeLiquidity;
      const newPrice = currentPx * (1 - priceImpact);
      
      // 计算输出金额
      const outputAmount = remainingAmountIn * (currentPx + newPrice) / 2; // 平均价格
      
      steps.push({
        amountIn: remainingAmountIn,
        amountOut: outputAmount,
        priceAfter: newPrice,
        liquidityUsed: activeLiquidity,
        priceBoundary: null
      });
      
      totalAmountOut += outputAmount;
      currentPx = newPrice;
      remainingAmountIn = 0;
    } else {
      // 有足够的输入到达下一个价格边界
      // 计算此段的输出
      const outputAmount = amountToNextPrice * (currentPx + nextPrice) / 2; // 平均价格
      
      steps.push({
        amountIn: amountToNextPrice,
        amountOut: outputAmount,
        priceAfter: nextPrice,
        liquidityUsed: activeLiquidity,
        priceBoundary: nextPrice
      });
      
      totalAmountOut += outputAmount;
      remainingAmountIn -= amountToNextPrice;
      currentPx = nextPrice;
      
      // 在新价格重新计算活跃流动性
      activeLiquidity = 0;
      positions.forEach(pos => {
        if (currentPx >= pos.lowerPrice && currentPx <= pos.upperPrice) {
          activeLiquidity += pos.liquidity;
        }
      });
    }
  }
  
  return {
    amountIn: amountIn,
    amountOut: totalAmountOut,
    feePaid: feeAmount,
    finalPrice: currentPx,
    priceImpact: (currentPrice - currentPx) / currentPrice * 100,
    steps: steps
  };
}

// 执行交换
const swapResult = simulateMultiTickSwap(swapAmountIn, positions, CURRENT_PRICE, FEE_TIER);

// 显示交换结果
console.log(`\n交换结果:`);
console.log(`输入金额: ${formatNumber(swapResult.amountIn)} ETH`);
console.log(`支付的费用: ${formatNumber(swapResult.feePaid)} ETH (${FEE_TIER * 100}%)`);
console.log(`输出金额: ${formatNumber(swapResult.amountOut)} USDC`);
console.log(`有效价格: ${formatNumber(swapResult.amountOut / swapResult.amountIn)} USDC per ETH`);
console.log(`最终价格: ${formatNumber(swapResult.finalPrice)} USDC per ETH`);
console.log(`价格影响: ${formatNumber(swapResult.priceImpact)}%`);

// 显示交换步骤
console.log('\n交换步骤:');
swapResult.steps.forEach((step, i) => {
  console.log(`\n步骤 ${i + 1}:`);
  console.log(`输入金额: ${formatNumber(step.amountIn)} ETH`);
  console.log(`输出金额: ${formatNumber(step.amountOut)} USDC`);
  console.log(`交换后价格: ${formatNumber(step.priceAfter)} USDC per ETH`);
  console.log(`使用的流动性: ${formatNumber(step.liquidityUsed)}`);
  if (step.priceBoundary) {
    console.log(`跨越价格边界: ${formatNumber(step.priceBoundary)} USDC per ETH`);
  }
});

// ===== 第 5 部分：资金效率比较 =====
console.log('\n\n===== 第 5 部分：资金效率比较 =====');
console.log('Uniswap V3 通过集中流动性提供比 V2 更高的资金效率。');

// V2 vs V3 比较
const v2TotalValueLocked = 10000000; // 1000 万美元
const activeRangePercentage = 5; // 全范围的 5% 被积极使用
const v2ActiveCapital = v2TotalValueLocked * (activeRangePercentage / 100);
const v3CapitalNeeded = v2ActiveCapital;
const capitalEfficiencyRatio = v2TotalValueLocked / v3CapitalNeeded;

console.log('\n资金效率比较:');
console.log(`V2 总锁仓价值: $${formatNumber(v2TotalValueLocked)}`);
console.log(`活跃交易范围: 全范围的 ${activeRangePercentage}%`);
console.log(`V2 活跃资金: $${formatNumber(v2ActiveCapital)}`);
console.log(`V3 需要的资金以获得相同深度: $${formatNumber(v3CapitalNeeded)}`);
console.log(`资金效率比率: ${formatNumber(capitalEfficiencyRatio)}x`);
console.log(`这意味着 V3 可以用 V2 所需资金的 ${formatNumber(100/capitalEfficiencyRatio)}% 提供相同的交易深度。`);

// 结论
console.log('\n\n===== 结论 =====');
console.log('Uniswap V3 通过以下方面代表了 AMM 设计的重大进步:');
console.log('1. 集中流动性，允许流动性提供者将资金集中在最需要的地方');
console.log('2. 多种费率层级，以适应不同的资产波动性');
console.log('3. 与 V2 相比提高了资金效率');
console.log('4. 为流动性提供者提供更精细的控制');
console.log('\n这些创新使 Uniswap V3 对交易者和流动性提供者来说更加资金高效和灵活。'); 