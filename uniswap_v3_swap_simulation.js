/**
 * Uniswap V3 交换模拟
 * 
 * 本文件包含 Uniswap V3 交换计算的更详细实现，
 * 演示了交换如何在集中流动性的多个刻度之间工作。
 */

// 导入基础计算模块
const uniswapV3 = require('./uniswap_v3_calculations');

/**
 * Uniswap V3 交换的更详细模拟，跟踪并可视化
 * 刻度交叉和流动性变化
 */
class UniswapV3SwapSimulator {
  constructor(initialPrice, feeTier = uniswapV3.FEE_TIERS.MEDIUM) {
    this.feeTier = feeTier;
    this.initialPrice = initialPrice;
    this.currentPrice = initialPrice;
    this.currentSqrtPriceX96 = uniswapV3.priceToSqrtPriceX96(initialPrice);
    this.currentTick = uniswapV3.priceToTick(initialPrice);
    
    // 使用空数组初始化流动性刻度
    this.liquidityTicks = [];
    
    // 跟踪交换步骤以便可视化
    this.swapSteps = [];
  }
  
  /**
   * 添加一个刻度及其关联的流动性
   * @param {number} tickIndex - 刻度索引
   * @param {number} liquidityNet - 此刻度的净流动性变化（正数表示添加，负数表示移除）
   * @param {number} liquidityGross - 此刻度可用的总流动性
   */
  addTick(tickIndex, liquidityNet, liquidityGross) {
    this.liquidityTicks.push({
      index: tickIndex,
      liquidityNet,
      liquidityGross
    });
    
    // 保持刻度按索引排序
    this.liquidityTicks.sort((a, b) => a.index - b.index);
  }
  
  /**
   * 从价格范围添加多个刻度
   * @param {number} lowerPrice - 较低价格边界
   * @param {number} upperPrice - 较高价格边界
   * @param {number} liquidity - 流动性数量
   * @param {number} tickSpacing - 刻度间距（例如，0.3% 池的间距为 10）
   */
  addLiquidityInRange(lowerPrice, upperPrice, liquidity, tickSpacing = 10) {
    const lowerTick = Math.floor(uniswapV3.priceToTick(lowerPrice) / tickSpacing) * tickSpacing;
    const upperTick = Math.floor(uniswapV3.priceToTick(upperPrice) / tickSpacing) * tickSpacing;
    
    // 添加较低刻度（添加流动性）
    this.addTick(lowerTick, liquidity, liquidity);
    
    // 添加较高刻度（移除流动性）
    this.addTick(upperTick, -liquidity, liquidity);
  }
  
  /**
   * 基于多个价格范围和流动性仓位初始化池
   * @param {Array} positions - {lowerPrice, upperPrice, liquidity} 对象数组
   * @param {number} tickSpacing - 刻度间距
   */
  initializePoolFromPositions(positions, tickSpacing = 10) {
    positions.forEach(position => {
      this.addLiquidityInRange(
        position.lowerPrice,
        position.upperPrice,
        position.liquidity,
        tickSpacing
      );
    });
  }
  
  /**
   * 获取当前刻度的活跃流动性
   * @returns {number} - 活跃流动性
   */
  getActiveLiquidity() {
    let activeLiquidity = 0;
    
    // 对当前刻度或以下的所有刻度的 liquidityNet 值求和
    for (const tick of this.liquidityTicks) {
      if (tick.index <= this.currentTick) {
        activeLiquidity += tick.liquidityNet;
      } else {
        break;
      }
    }
    
    return activeLiquidity;
  }
  
  /**
   * 在交换方向上查找下一个刻度
   * @param {boolean} zeroForOne - 交换方向（true 表示 0->1，false 表示 1->0）
   * @returns {Object|null} - 下一个刻度，如果不存在则返回 null
   */
  findNextTick(zeroForOne) {
    if (zeroForOne) {
      // 当交换 0->1 时，我们在刻度空间中向下移动（价格下降）
      for (let i = this.liquidityTicks.length - 1; i >= 0; i--) {
        if (this.liquidityTicks[i].index < this.currentTick) {
          return this.liquidityTicks[i];
        }
      }
    } else {
      // 当交换 1->0 时，我们在刻度空间中向上移动（价格上升）
      for (let i = 0; i < this.liquidityTicks.length; i++) {
        if (this.liquidityTicks[i].index > this.currentTick) {
          return this.liquidityTicks[i];
        }
      }
    }
    
    return null; // 未找到下一个刻度
  }
  
  /**
   * 执行交换，详细跟踪每一步
   * @param {number} amountIn - 输入数量
   * @param {boolean} zeroForOne - 交换方向（true 表示 0->1，false 表示 1->0）
   * @returns {Object} - 带有详细步骤的交换结果
   */
  executeSwap(amountIn, zeroForOne) {
    console.log(`\n==== 执行交换: ${amountIn} ${zeroForOne ? 'Token0 -> Token1' : 'Token1 -> Token0'} ====`);
    console.log(`初始价格: ${this.currentPrice.toFixed(6)}`);
    console.log(`初始刻度: ${this.currentTick}`);
    console.log(`费率层级: ${this.feeTier * 100}%\n`);
    
    // 存储初始价格以计算价格影响
    const initialPrice = this.currentPrice;
    
    let remainingAmount = amountIn;
    let totalAmountOut = 0;
    let feeAmount = 0;
    
    // 重置交换步骤
    this.swapSteps = [];
    
    // 缩放因子以避免精度问题
    const SCALE_FACTOR = 1e18;
    
    while (remainingAmount > 0) {
      // 获取当前活跃流动性
      const activeLiquidity = this.getActiveLiquidity();
      console.log(`活跃流动性: ${activeLiquidity}`);
      
      if (activeLiquidity <= 0) {
        console.log('没有可用的活跃流动性。交换失败。');
        
        // 返回部分结果，包含我们已经交换的部分
        return {
          amountIn: amountIn - remainingAmount,
          amountOut: totalAmountOut,
          feesCollected: feeAmount,
          finalPrice: this.currentPrice,
          priceImpact: (initialPrice - this.currentPrice) / initialPrice,
          steps: this.swapSteps
        };
      }
      
      // 在交换方向上查找下一个刻度
      const nextTick = this.findNextTick(zeroForOne);
      
      // 如果没有下一个刻度，我们可以使用所有剩余输入
      if (!nextTick) {
        console.log('未找到下一个刻度。使用所有剩余输入。');
        
        // 缩放输入数量以避免精度问题
        const scaledAmount = remainingAmount * SCALE_FACTOR;
        
        // 使用所有剩余输入计算步骤
        const step = uniswapV3.computeSwapStep(
          scaledAmount,
          this.currentSqrtPriceX96,
          activeLiquidity,
          this.feeTier,
          zeroForOne
        );
        
        // 取消输出数量的缩放
        const outputAmount = step.amountOut / SCALE_FACTOR;
        
        // 更新状态
        totalAmountOut += outputAmount;
        feeAmount += remainingAmount * this.feeTier;
        
        // 更新当前价格
        this.currentSqrtPriceX96 = step.newSqrtPriceX96;
        this.currentPrice = uniswapV3.sqrtPriceX96ToPrice(this.currentSqrtPriceX96);
        this.currentTick = uniswapV3.priceToTick(this.currentPrice);
        
        // 记录交换步骤
        this.swapSteps.push({
          amountIn: remainingAmount,
          amountOut: outputAmount,
          priceAfter: this.currentPrice,
          tickAfter: this.currentTick,
          liquidityUsed: activeLiquidity,
          crossedTick: false
        });
        
        // 记录步骤
        console.log(`\n交换步骤:`);
        console.log(`  输入: ${remainingAmount}`);
        console.log(`  输出: ${outputAmount}`);
        console.log(`  新价格: ${this.currentPrice.toFixed(6)}`);
        console.log(`  新刻度: ${this.currentTick}`);
        
        // 所有输入已用完
        remainingAmount = 0;
        break;
      }
      
      // 计算下一个刻度的价格
      const nextTickPrice = uniswapV3.tickToPrice(nextTick.index);
      const nextTickSqrtPriceX96 = uniswapV3.priceToSqrtPriceX96(nextTickPrice);
      
      // 计算到达下一个刻度所需的数量
      // 这是一个简化的近似值
      let amountToNextTick;
      if (zeroForOne) {
        // 价格下降，计算所需的 token0
        amountToNextTick = activeLiquidity * Math.abs(
          1/this.currentSqrtPriceX96 - 1/nextTickSqrtPriceX96
        );
      } else {
        // 价格上升，计算所需的 token1
        amountToNextTick = activeLiquidity * Math.abs(
          nextTickSqrtPriceX96 - this.currentSqrtPriceX96
        );
      }
      
      // 考虑费用
      amountToNextTick = amountToNextTick / (1 - this.feeTier);
      
      // 缩小数量以避免精度问题
      amountToNextTick = amountToNextTick / SCALE_FACTOR;
      
      console.log(`\n下一个刻度: ${nextTick.index} (价格: ${nextTickPrice.toFixed(6)})`);
      console.log(`到达下一个刻度所需的数量: ${amountToNextTick}`);
      
      if (amountToNextTick >= remainingAmount) {
        // 没有足够的输入到达下一个刻度
        console.log('没有足够的输入到达下一个刻度。');
        
        // 缩放输入数量以避免精度问题
        const scaledAmount = remainingAmount * SCALE_FACTOR;
        
        // 使用所有剩余输入
        const step = uniswapV3.computeSwapStep(
          scaledAmount,
          this.currentSqrtPriceX96,
          activeLiquidity,
          this.feeTier,
          zeroForOne
        );
        
        // 取消输出数量的缩放
        const outputAmount = step.amountOut / SCALE_FACTOR;
        
        // 更新状态
        totalAmountOut += outputAmount;
        feeAmount += remainingAmount * this.feeTier;
        
        // 更新当前价格
        this.currentSqrtPriceX96 = step.newSqrtPriceX96;
        this.currentPrice = uniswapV3.sqrtPriceX96ToPrice(this.currentSqrtPriceX96);
        this.currentTick = uniswapV3.priceToTick(this.currentPrice);
        
        // 记录交换步骤
        this.swapSteps.push({
          amountIn: remainingAmount,
          amountOut: outputAmount,
          priceAfter: this.currentPrice,
          tickAfter: this.currentTick,
          liquidityUsed: activeLiquidity,
          crossedTick: false
        });
        
        // 记录步骤
        console.log(`\n交换步骤:`);
        console.log(`  输入: ${remainingAmount}`);
        console.log(`  输出: ${outputAmount}`);
        console.log(`  新价格: ${this.currentPrice.toFixed(6)}`);
        console.log(`  新刻度: ${this.currentTick}`);
        
        // 所有输入已用完
        remainingAmount = 0;
      } else {
        // 有足够的输入跨越刻度
        // 首先，计算直到刻度边界的输出
        
        // 缩放输入数量以避免精度问题
        const scaledAmount = amountToNextTick * SCALE_FACTOR;
        
        const step = uniswapV3.computeSwapStep(
          scaledAmount,
          this.currentSqrtPriceX96,
          activeLiquidity,
          this.feeTier,
          zeroForOne
        );
        
        // 取消输出数量的缩放
        const outputAmount = step.amountOut / SCALE_FACTOR;
        
        // 更新此步骤的状态
        totalAmountOut += outputAmount;
        feeAmount += amountToNextTick * this.feeTier;
        remainingAmount -= amountToNextTick;
        
        // 记录交换步骤
        this.swapSteps.push({
          amountIn: amountToNextTick,
          amountOut: outputAmount,
          priceAfter: nextTickPrice,
          tickAfter: nextTick.index,
          liquidityUsed: activeLiquidity,
          crossedTick: true,
          tickCrossed: nextTick.index
        });
        
        // 记录步骤
        console.log(`\n交换步骤 (跨越刻度):`);
        console.log(`  输入: ${amountToNextTick}`);
        console.log(`  输出: ${outputAmount}`);
        console.log(`  跨越刻度: ${nextTick.index}`);
        
        // 跨越刻度并更新流动性
        this.currentTick = nextTick.index;
        this.currentPrice = nextTickPrice;
        this.currentSqrtPriceX96 = nextTickSqrtPriceX96;
        
        // 跨越刻度时更新流动性
        const liquidityChange = nextTick.liquidityNet;
        console.log(`  流动性变化: ${liquidityChange}`);
        
        // 记录新状态
        console.log(`  新价格: ${this.currentPrice.toFixed(6)}`);
        console.log(`  新刻度: ${this.currentTick}`);
        console.log(`  剩余输入: ${remainingAmount}`);
      }
    }
    
    // 返回交换结果
    return {
      amountIn: amountIn,
      amountOut: totalAmountOut,
      feesCollected: feeAmount,
      finalPrice: this.currentPrice,
      priceImpact: (initialPrice - this.currentPrice) / initialPrice,
      steps: this.swapSteps
    };
  }

  /**
   * 在特定价格范围内添加带有流动性的仓位
   * @param {number} lowerPrice - 较低价格边界
   * @param {number} upperPrice - 较高价格边界
   * @param {number} liquidity - 流动性数量
   */
  addPosition(lowerPrice, upperPrice, liquidity) {
    const lowerTick = uniswapV3.priceToTick(lowerPrice);
    const upperTick = uniswapV3.priceToTick(upperPrice);
    
    // 在较低刻度添加流动性（进入仓位）
    this.addTick(lowerTick, liquidity, liquidity);
    
    // 在较高刻度移除流动性（退出仓位）
    this.addTick(upperTick, -liquidity, liquidity);
  }
}

// 取消注释以查看示例用法
/*
// 为 ETH/USDC 池创建一个模拟器
const simulator = new UniswapV3SwapSimulator(2000); // ETH 价格 $2000

// 添加来自不同 LP 的流动性仓位
simulator.initializePoolFromPositions([
  // 窄范围 LP 仓位 (1950-2050, ±2.5%)
  { lowerPrice: 1950, upperPrice: 2050, liquidity: 100000 },
  
  // 中等范围 LP 仓位 (1900-2100, ±5%)
  { lowerPrice: 1900, upperPrice: 2100, liquidity: 50000 },
  
  // 宽范围 LP 仓位 (1800-2200, ±10%)
  { lowerPrice: 1800, upperPrice: 2200, liquidity: 25000 }
]);

// 交换前可视化流动性
visualizeLiquidity(simulator, '交换前的流动性分布');

// 执行 10 ETH 换取 USDC 的交换
const swapResult = simulator.executeSwap(10, true); // true = Token0 (ETH) 到 Token1 (USDC)

// 交换后可视化流动性
visualizeLiquidity(simulator, '交换后的流动性分布');
*/

/**
 * 格式化数字的辅助函数
 * @param {number} num - 要格式化的数字
 * @param {number} decimals - 小数位数
 * @returns {string} - 格式化后的数字字符串
 */
function formatNumber(num, decimals = 2) {
  if (num === 0) return '0';
  if (Math.abs(num) < 0.001) return num.toExponential(decimals);
  return num.toFixed(decimals);
}

/**
 * 可视化模拟器中的流动性分布
 * @param {UniswapV3SwapSimulator} simulator - 模拟器实例
 * @param {string} title - 可选的标题
 */
function visualizeLiquidity(simulator, title = '流动性分布') {
  // 从模拟器中提取仓位信息
  const positions = [];
  
  // 创建一个映射来跟踪每个刻度的流动性变化
  const tickLiquidityMap = new Map();
  
  // 首先，收集所有刻度的流动性变化
  simulator.liquidityTicks.forEach(tick => {
    tickLiquidityMap.set(tick.index, tick.liquidityNet);
  });
  
  // 然后，将刻度转换为仓位
  // 我们需要成对处理刻度，每对代表一个仓位
  const sortedTicks = Array.from(tickLiquidityMap.entries())
    .sort((a, b) => a[0] - b[0]);
  
  for (let i = 0; i < sortedTicks.length - 1; i++) {
    const [lowerTick, liquidityNet] = sortedTicks[i];
    
    // 只处理添加流动性的刻度（正的 liquidityNet）
    if (liquidityNet > 0) {
      // 查找对应的上边界刻度（负的 liquidityNet，数值相同）
      for (let j = i + 1; j < sortedTicks.length; j++) {
        const [upperTick, upperLiquidityNet] = sortedTicks[j];
        
        if (upperLiquidityNet === -liquidityNet) {
          // 找到了匹配的一对，创建一个仓位
          positions.push({
            lowerPrice: uniswapV3.tickToPrice(lowerTick),
            upperPrice: uniswapV3.tickToPrice(upperTick),
            liquidity: liquidityNet
          });
          break;
        }
      }
    }
  }
  
  // 如果没有找到任何仓位，添加一些默认仓位以便可视化
  if (positions.length === 0) {
    const currentPrice = simulator.currentPrice;
    positions.push({
      lowerPrice: currentPrice * 0.9,
      upperPrice: currentPrice * 1.1,
      liquidity: 10000
    });
  }
  
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
  
  // 检查当前价格是否在合理范围内
  let currentPrice = simulator.currentPrice;
  // 如果价格异常大或小，使用初始价格
  if (currentPrice > maxPrice * 10 || currentPrice < minPrice / 10 || !isFinite(currentPrice)) {
    console.log(`警告: 当前价格 (${currentPrice}) 超出了合理范围，使用初始价格 (${simulator.initialPrice}) 进行可视化。`);
    currentPrice = simulator.initialPrice;
  }
  
  // 找到最接近当前价格的价格点
  let closestPriceIndex = 0;
  let minDiff = Number.MAX_VALUE;
  liquidityAtPrice.forEach((point, index) => {
    const diff = Math.abs(point.price - currentPrice);
    if (diff < minDiff) {
      minDiff = diff;
      closestPriceIndex = index;
    }
  });
  
  // 生成 ASCII 图表
  console.log(`\n${title}:`);
  console.log('价格 (USDC/ETH) | 流动性');
  console.log('-'.repeat(50));
  
  liquidityAtPrice.forEach((point, index) => {
    const barLength = Math.round((point.liquidity / maxLiquidity) * 30);
    const bar = '█'.repeat(barLength);
    const priceStr = `$${formatNumber(point.price, 0).padStart(4)}`;
    
    // 如果这是最接近当前价格的点，添加标记
    if (index === closestPriceIndex) {
      console.log(`${priceStr} | ${bar} ${formatNumber(point.liquidity)} ← 当前价格 ($${formatNumber(currentPrice)})`);
    } else {
      console.log(`${priceStr} | ${bar} ${formatNumber(point.liquidity)}`);
    }
  });
  
  // 显示当前刻度信息
  console.log(`\n当前刻度: ${simulator.currentTick} (价格: ${formatNumber(simulator.currentPrice)} USDC per ETH)`);
  if (simulator.currentPrice !== currentPrice) {
    console.log(`注意: 显示的是调整后的价格，实际价格为: ${formatNumber(simulator.currentPrice)} USDC per ETH`);
  }
}

// 导出模拟器类和可视化函数
module.exports = { UniswapV3SwapSimulator, visualizeLiquidity }; 