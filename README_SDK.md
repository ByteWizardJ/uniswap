# 使用 Uniswap V3 SDK 实现交易模拟

本项目展示了如何使用官方 Uniswap V3 SDK 实现与自定义模拟相同的功能，包括价格和刻度转换、流动性计算、交换计算等。

## 文件说明

- `uniswap_v3_sdk_example.js` - 使用 Uniswap V3 SDK 的概念示例，展示核心概念和用法
- `uniswap_v3_calculations.js` - 自定义实现的 Uniswap V3 计算函数
- `uniswap_v3_educational.js` - 教育性示例，展示 Uniswap V3 的关键概念
- `uniswap_v3_example.js` - 简单的示例代码
- `uniswap_v3_simple_test.js` - 简单的测试代码
- `uniswap_v3_swap_simulation.js` - 自定义实现的交换模拟
- `uniswap_v3_swap_test.js` - 交换模拟的测试代码

## 安装依赖

```bash
npm install @uniswap/v3-sdk @uniswap/sdk-core ethers jsbi
```

## 从自定义模拟到官方 SDK 的迁移

### 1. 代币创建

自定义模拟:
```javascript
const token0 = { symbol: 'ETH', decimals: 18 };
const token1 = { symbol: 'USDC', decimals: 6 };
```

官方 SDK:
```javascript
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
```

### 2. 价格和刻度转换

自定义模拟:
```javascript
function priceToTick(price) {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

function tickToPrice(tick) {
  return Math.pow(1.0001, tick);
}
```

官方 SDK:
```javascript
// 价格到刻度
const tick = Math.floor(Math.log(price) / Math.log(1.0001));
// 或使用 SDK 函数 (需要 Price 对象)
const tick = priceToClosestTick(price);

// 刻度到价格
const price = Math.pow(1.0001, tick);
// 或使用 SDK 函数
const price = tickToPrice(WETH, USDC, tick);
```

### 3. 创建池

自定义模拟:
```javascript
const pool = {
  token0,
  token1,
  fee: 3000, // 0.3%
  liquidity: 1000000,
  sqrtPrice: Math.sqrt(currentPrice),
  tick: priceToTick(currentPrice)
};
```

官方 SDK:
```javascript
// 从链上获取数据
const [slot0, liquidity] = await Promise.all([
  poolContract.slot0(),
  poolContract.liquidity()
]);

const { sqrtPriceX96, tick } = slot0;

// 创建池实例
const pool = new Pool(
  WETH,
  USDC,
  FEE_TIER,
  sqrtPriceX96.toString(),
  liquidity.toString(),
  tick
);
```

### 4. 创建仓位

自定义模拟:
```javascript
const position = {
  lowerTick: priceToTick(lowerPrice),
  upperTick: priceToTick(upperPrice),
  liquidity: calculateLiquidity(lowerPrice, upperPrice, ethAmount, usdcAmount)
};
```

官方 SDK:
```javascript
// 创建代币金额
const ethAmount = CurrencyAmount.fromRawAmount(
  WETH,
  ethers.utils.parseUnits(ethAmount.toString(), WETH.decimals).toString()
);

const usdcAmount = CurrencyAmount.fromRawAmount(
  USDC,
  ethers.utils.parseUnits(usdcAmount.toString(), USDC.decimals).toString()
);

// 创建仓位
const position = Position.fromAmounts({
  pool,
  tickLower: lowerTick,
  tickUpper: upperTick,
  amount0: ethAmount.quotient,
  amount1: usdcAmount.quotient,
  useFullPrecision: true
});
```

### 5. 执行交换

自定义模拟:
```javascript
const swapResult = simulateSwap(pool, amountIn, zeroForOne);
```

官方 SDK:
```javascript
// 获取报价
const amountOut = await quoter.callStatic.quoteExactInputSingle(
  tokenIn.address,
  tokenOut.address,
  fee,
  ethers.utils.parseUnits(amountIn.toString(), tokenIn.decimals).toString(),
  0
);

// 执行交换
const tx = await swapRouter.exactInputSingle(swapParams);
const receipt = await tx.wait();
```

## 官方 SDK 与自定义模拟的比较

### 官方 SDK 的优点

1. **准确性** - 使用与链上相同的计算逻辑，确保结果与实际交易一致
2. **维护** - 由 Uniswap 团队维护，随着协议更新而更新
3. **完整性** - 提供与协议交互所需的所有功能
4. **安全性** - 经过审计和广泛使用，减少错误风险

### 自定义模拟的优点

1. **简单性** - 可以简化复杂概念，更容易理解
2. **灵活性** - 可以根据特定需求进行定制
3. **教育价值** - 有助于理解底层机制
4. **无依赖** - 不需要安装多个依赖包

## 结论

- 对于教育和理解概念，自定义模拟很有价值
- 对于实际应用和生产环境，应该使用官方 SDK
- 理想的方法是先使用自定义模拟理解概念，然后过渡到官方 SDK 进行实际应用

## 资源

- [Uniswap V3 文档](https://docs.uniswap.org/)
- [Uniswap V3 SDK GitHub 仓库](https://github.com/Uniswap/v3-sdk)
- [Uniswap V3 SDK npm 包](https://www.npmjs.com/package/@uniswap/v3-sdk) 