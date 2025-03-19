const simulator = require('./uniswap_v3_swap_simulation.js');
const uniswapV3 = require('./uniswap_v3_calculations.js');

// 为 ETH/USDC 池创建一个模拟器，费率为 0.3%
const sim = new simulator.UniswapV3SwapSimulator(2000, 0.003);

// 用仓位初始化池
sim.initializePoolFromPositions([
  // 当前价格附近的仓位
  { lowerPrice: 1950, upperPrice: 2050, liquidity: 100000 },
  
  // 当前价格以上的仓位
  { lowerPrice: 2000, upperPrice: 2100, liquidity: 75000 },
  
  // 当前价格更高处的仓位
  { lowerPrice: 2050, upperPrice: 2150, liquidity: 50000 },
  
  // 当前价格以下的仓位
  { lowerPrice: 1900, upperPrice: 2000, liquidity: 80000 }
]);

console.log('\n初始流动性分布:');
simulator.visualizeLiquidity(sim, '初始流动性分布');

// 执行一个较小的交换，不会耗尽所有流动性
// 使用非常小的数量以避免精度问题
const amountIn = 0.0001;
console.log(`\n执行 ${amountIn} ETH 的交换:`);
const result = sim.executeSwap(amountIn, true);

// 调试：打印原始结果对象
console.log('\n原始结果对象:');
console.log(result);

// 检查模拟器中是否有 swapSteps
console.log('\n模拟器中的交换步骤:');
console.log(sim.swapSteps);

console.log('\n======== 交换结果 ========');
if (result) {
  console.log(`输入数量: ${result.amountIn.toFixed(8)} ETH`);
  console.log(`输出数量: ${result.amountOut.toFixed(8)} USDC`);
  console.log(`收取的费用: ${result.feesCollected ? result.feesCollected.toFixed(8) : 'N/A'} ETH`);
  console.log(`最终价格: ${result.finalPrice.toFixed(4)} USDC per ETH`);
  console.log(`价格影响: ${(result.priceImpact * 100).toFixed(6)}%`);
  console.log(`跨越的刻度数: ${sim.swapSteps ? sim.swapSteps.length : 'N/A'}`);
  
  // 添加关于交换步骤的更详细信息
  if (sim.swapSteps && sim.swapSteps.length > 0) {
    console.log('\n模拟器中的交换步骤:');
    sim.swapSteps.forEach((step, index) => {
      console.log(`步骤 ${index + 1}:`);
      console.log(`  输入数量: ${step.amountIn.toFixed(8)} ETH`);
      console.log(`  输出数量: ${step.amountOut.toFixed(8)} USDC`);
      console.log(`  交换后价格: ${step.priceAfter.toFixed(4)} USDC per ETH`);
      console.log(`  交换后刻度: ${step.tickAfter}`);
      console.log(`  使用的流动性: ${step.liquidityUsed}`);
      console.log(`  是否跨越刻度: ${step.crossedTick ? '是' : '否'}`);
      if (step.crossedTick && step.tickCrossed) {
        console.log(`  跨越的刻度: ${step.tickCrossed}`);
      }
    });
  }
} else {
  console.log('交换失败 - 没有足够的流动性完成交换');
}
console.log('==============================\n');

console.log('\n交换后的流动性:');
simulator.visualizeLiquidity(sim, '交换后的流动性分布'); 