/**
 * Uniswap V3 交换计算
 * 
 * 本模块提供函数用于计算 Uniswap V3 交易的交换输出、流动性值和费用，
 * 适用于具有集中流动性的 Uniswap V3 交易。
 * 
 * 基于 Uniswap V3 白皮书和核心合约：
 * https://uniswap.org/whitepaper-v3.pdf
 */

// 用于价格和刻度计算的常量
const Q96 = Math.pow(2, 96);
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const TICK_SPACING = {
  LOW_FEE: 1,     // 0.05% 费率层级
  MEDIUM_FEE: 10, // 0.3% 费率层级
  HIGH_FEE: 60    // 1% 费率层级
};
const FEE_TIERS = {
  LOW: 0.0005,    // 0.05%
  MEDIUM: 0.003,  // 0.3%
  HIGH: 0.01      // 1%
};

/**
 * 将价格转换为对应的刻度索引
 * @param {number} price - 要转换的价格
 * @returns {number} - 刻度索引
 */
function priceToTick(price) {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

/**
 * 将刻度索引转换为对应的价格
 * @param {number} tick - 刻度索引
 * @returns {number} - 价格
 */
function tickToPrice(tick) {
  return Math.pow(1.0001, tick);
}

/**
 * 将价格转换为其平方根价格表示（在 Uniswap V3 中使用）
 * @param {number} price - 要转换的价格
 * @returns {number} - 平方根价格
 */
function priceToSqrtPriceX96(price) {
  return Math.sqrt(price) * Q96;
}

/**
 * 将平方根价格转换为常规价格
 * @param {number} sqrtPriceX96 - 平方根价格表示
 * @returns {number} - 常规价格
 */
function sqrtPriceX96ToPrice(sqrtPriceX96) {
  return Math.pow((sqrtPriceX96 / Q96), 2);
}

/**
 * 计算给定代币数量和价格范围所需的流动性
 * @param {number} sqrtPriceX96 - 当前平方根价格
 * @param {number} sqrtPriceAX96 - 较低平方根价格边界
 * @param {number} sqrtPriceBX96 - 较高平方根价格边界
 * @param {number} amount0 - token0 的数量
 * @param {number} amount1 - token1 的数量
 * @returns {number} - 流动性值
 */
function getLiquidityForAmounts(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, amount0, amount1) {
  // 确保价格边界有序
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }

  let liquidity0 = 0;
  let liquidity1 = 0;

  if (sqrtPriceX96 <= sqrtPriceAX96) {
    // 当前价格位于或低于下边界
    // 只需要 token0
    liquidity0 = calculateLiquidity0(sqrtPriceAX96, sqrtPriceBX96, amount0);
    return liquidity0;
  } else if (sqrtPriceX96 < sqrtPriceBX96) {
    // 当前价格在范围内
    // 需要两种代币
    liquidity0 = calculateLiquidity0(sqrtPriceX96, sqrtPriceBX96, amount0);
    liquidity1 = calculateLiquidity1(sqrtPriceAX96, sqrtPriceX96, amount1);
    // 返回两个流动性值中的最小值
    return Math.min(liquidity0, liquidity1);
  } else {
    // 当前价格位于或高于上边界
    // 只需要 token1
    liquidity1 = calculateLiquidity1(sqrtPriceAX96, sqrtPriceBX96, amount1);
    return liquidity1;
  }
}

/**
 * 计算 token0 的流动性值
 * @param {number} sqrtPriceAX96 - 较低平方根价格边界
 * @param {number} sqrtPriceBX96 - 较高平方根价格边界
 * @param {number} amount0 - token0 的数量
 * @returns {number} - token0 的流动性值
 */
function calculateLiquidity0(sqrtPriceAX96, sqrtPriceBX96, amount0) {
  const numerator = amount0 * sqrtPriceAX96 * sqrtPriceBX96;
  const denominator = sqrtPriceBX96 - sqrtPriceAX96;
  return numerator / denominator;
}

/**
 * 计算 token1 的流动性值
 * @param {number} sqrtPriceAX96 - 较低平方根价格边界
 * @param {number} sqrtPriceBX96 - 较高平方根价格边界
 * @param {number} amount1 - token1 的数量
 * @returns {number} - token1 的流动性值
 */
function calculateLiquidity1(sqrtPriceAX96, sqrtPriceBX96, amount1) {
  return amount1 / (sqrtPriceBX96 - sqrtPriceAX96);
}

/**
 * 计算给定流动性值和价格范围的代币数量
 * @param {number} sqrtPriceX96 - 当前平方根价格
 * @param {number} sqrtPriceAX96 - 较低平方根价格边界
 * @param {number} sqrtPriceBX96 - 较高平方根价格边界
 * @param {number} liquidity - 流动性值
 * @returns {Object} - 代币数量 { amount0, amount1 }
 */
function getAmountsForLiquidity(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, liquidity) {
  // 确保价格边界有序
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }

  let amount0 = 0;
  let amount1 = 0;

  if (sqrtPriceX96 <= sqrtPriceAX96) {
    // 当前价格位于或低于下边界
    amount0 = calculateAmount0(sqrtPriceAX96, sqrtPriceBX96, liquidity);
  } else if (sqrtPriceX96 < sqrtPriceBX96) {
    // 当前价格在范围内
    amount0 = calculateAmount0(sqrtPriceX96, sqrtPriceBX96, liquidity);
    amount1 = calculateAmount1(sqrtPriceAX96, sqrtPriceX96, liquidity);
  } else {
    // 当前价格位于或高于上边界
    amount1 = calculateAmount1(sqrtPriceAX96, sqrtPriceBX96, liquidity);
  }

  return { amount0, amount1 };
}

/**
 * 计算给定流动性和价格范围的 token0 数量
 * @param {number} sqrtPriceAX96 - 较低平方根价格边界（或当前价格）
 * @param {number} sqrtPriceBX96 - 较高平方根价格边界
 * @param {number} liquidity - 流动性值
 * @returns {number} - token0 的数量
 */
function calculateAmount0(sqrtPriceAX96, sqrtPriceBX96, liquidity) {
  return liquidity * (sqrtPriceBX96 - sqrtPriceAX96) / (sqrtPriceAX96 * sqrtPriceBX96);
}

/**
 * 计算给定流动性和价格范围的 token1 数量
 * @param {number} sqrtPriceAX96 - 较低平方根价格边界
 * @param {number} sqrtPriceBX96 - 较高平方根价格边界（或当前价格）
 * @param {number} liquidity - 流动性值
 * @returns {number} - token1 的数量
 */
function calculateAmount1(sqrtPriceAX96, sqrtPriceBX96, liquidity) {
  return liquidity * (sqrtPriceBX96 - sqrtPriceAX96);
}

/**
 * 计算精确输入交换的输出数量
 * 这是一个简化版本，不处理多刻度范围
 * @param {number} amountIn - 输入代币数量
 * @param {number} sqrtPriceX96 - 当前平方根价格
 * @param {number} liquidity - 当前范围内的流动性
 * @param {number} feeTier - 费率层级（0.0005、0.003 或 0.01）
 * @param {boolean} zeroForOne - 交换是否从 token0 到 token1
 * @returns {Object} - 输出数量和新平方根价格 { amountOut, newSqrtPriceX96 }
 */
function computeSwapStep(amountIn, sqrtPriceX96, liquidity, feeTier, zeroForOne) {
  // 对输入数量应用费用
  const amountInWithFee = amountIn * (1 - feeTier);
  
  let newSqrtPriceX96;
  let amountOut;
  
  // 对于非常小的数量，使用简化计算
  if (amountIn < 1e-10) {
    if (zeroForOne) {
      // 对于 token0 -> token1，使用现货价格
      amountOut = amountInWithFee * sqrtPriceX96ToPrice(sqrtPriceX96);
      // 小幅价格变化
      newSqrtPriceX96 = sqrtPriceX96 * (1 - amountIn / (liquidity * 1000));
    } else {
      // 对于 token1 -> token0，使用现货价格的倒数
      amountOut = amountInWithFee / sqrtPriceX96ToPrice(sqrtPriceX96);
      // 小幅价格变化
      newSqrtPriceX96 = sqrtPriceX96 * (1 + amountIn / (liquidity * 1000));
    }
    return { amountOut, newSqrtPriceX96 };
  }
  
  if (zeroForOne) {
    // 交换 token0 -> token1
    // 价格将下降
    const priceDelta = (amountInWithFee * sqrtPriceX96) / liquidity;
    newSqrtPriceX96 = sqrtPriceX96 - priceDelta;
    
    // 计算收到的 token1
    amountOut = liquidity * (sqrtPriceX96 - newSqrtPriceX96);
  } else {
    // 交换 token1 -> token0
    // 价格将上升
    const priceDelta = amountInWithFee / liquidity;
    newSqrtPriceX96 = sqrtPriceX96 + priceDelta;
    
    // 计算收到的 token0
    amountOut = liquidity * (1/newSqrtPriceX96 - 1/sqrtPriceX96) * (sqrtPriceX96 * newSqrtPriceX96);
  }
  
  return { amountOut, newSqrtPriceX96 };
}

/**
 * 模拟跨越价格范围的多个刻度的交换
 * 这是一个用于教育目的的简化版本
 * @param {number} amountIn - 输入代币数量
 * @param {Array} ticks - 带有流动性的刻度数组
 * @param {number} currentTick - 当前刻度索引
 * @param {number} feeTier - 费率层级（0.0005、0.003 或 0.01）
 * @param {boolean} zeroForOne - 交换是否从 token0 到 token1
 * @returns {Object} - 输出数量和新刻度 { amountOut, newTick }
 */
function simulateSwap(amountIn, ticks, currentTick, feeTier, zeroForOne) {
  let remainingAmount = amountIn;
  let currentSqrtPrice = Math.sqrt(tickToPrice(currentTick)) * Q96;
  let totalAmountOut = 0;
  let newTick = currentTick;
  
  // 按交换方向对刻度进行排序
  const sortedTicks = [...ticks].sort((a, b) => 
    zeroForOne ? a.index - b.index : b.index - a.index
  );
  
  for (let i = 0; i < sortedTicks.length - 1; i++) {
    const currentTickData = sortedTicks[i];
    const nextTickData = sortedTicks[i + 1];
    
    // 跳过不在交换路径上的刻度
    if (zeroForOne && currentTickData.index > currentTick) continue;
    if (!zeroForOne && currentTickData.index < currentTick) continue;
    
    // 获取当前范围的流动性
    const liquidity = currentTickData.liquidityNet;
    
    // 计算下一个刻度的价格
    const nextTickPrice = Math.sqrt(tickToPrice(nextTickData.index)) * Q96;
    
    // 在当前刻度范围内计算交换
    const { amountOut, newSqrtPriceX96 } = computeSwapStep(
      remainingAmount,
      currentSqrtPrice,
      liquidity,
      feeTier,
      zeroForOne
    );
    
    // 检查是否已跨越到下一个刻度
    const crossedNextTick = zeroForOne 
      ? newSqrtPriceX96 <= nextTickPrice
      : newSqrtPriceX96 >= nextTickPrice;
    
    if (crossedNextTick) {
      // 我们需要将这个交换分成两部分
      // 第一部分：交换到下一个刻度
      const partialSwap = computeSwapStep(
        remainingAmount,
        currentSqrtPrice,
        liquidity,
        feeTier,
        zeroForOne
      );
      
      totalAmountOut += partialSwap.amountOut;
      remainingAmount -= partialSwap.amountIn;
      currentSqrtPrice = nextTickPrice;
      newTick = nextTickData.index;
    } else {
      // 我们已经在当前范围内用完了所有输入
      totalAmountOut += amountOut;
      remainingAmount = 0;
      currentSqrtPrice = newSqrtPriceX96;
      newTick = priceToTick(sqrtPriceX96ToPrice(newSqrtPriceX96));
      break;
    }
  }
  
  return { amountOut: totalAmountOut, newTick };
}

/**
 * 计算给定交换的价格影响（滑点）
 * @param {number} amountIn - 输入代币数量
 * @param {number} amountOut - 输出代币数量
 * @param {number} spotPrice - 当前现货价格
 * @param {boolean} zeroForOne - 交换是否从 token0 到 token1
 * @returns {number} - 价格影响百分比
 */
function calculatePriceImpact(amountIn, amountOut, spotPrice, zeroForOne) {
  const executionPrice = zeroForOne ? amountOut / amountIn : amountIn / amountOut;
  const priceImpact = Math.abs((executionPrice - spotPrice) / spotPrice) * 100;
  return priceImpact;
}

/**
 * 计算仓位赚取的费用
 * @param {number} liquidity - 流动性数量
 * @param {number} volumeUSD - 以美元计的交易量
 * @param {number} totalLiquidity - 池中的总流动性
 * @param {number} feeTier - 费率层级（0.0005、0.003 或 0.01）
 * @returns {number} - 赚取的费用数量
 */
function calculateFees(liquidity, volumeUSD, totalLiquidity, feeTier) {
  return (liquidity / totalLiquidity) * volumeUSD * feeTier;
}

// 导出函数以在其他模块中使用
module.exports = {
  priceToTick,
  tickToPrice,
  priceToSqrtPriceX96,
  sqrtPriceX96ToPrice,
  getLiquidityForAmounts,
  getAmountsForLiquidity,
  computeSwapStep,
  simulateSwap,
  calculatePriceImpact,
  calculateFees,
  FEE_TIERS,
  TICK_SPACING
}; 