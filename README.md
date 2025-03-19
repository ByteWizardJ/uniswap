# Uniswap V3 模拟器

本项目提供了 Uniswap V3 核心机制的模拟实现，重点关注集中流动性、基于价格区间的刻度系统以及交换执行过程。它旨在作为教育目的，帮助理解 Uniswap V3 的内部工作原理。

## 文件说明

- **uniswap_v3_calculations.js**：Uniswap V3 计算的核心数学函数
- **uniswap_v3_swap_simulation.js**：详细的交换模拟，包含逐刻度追踪
- **uniswap_v3_swap_test.js**：使用模拟器执行交换的测试文件
- **uniswap_v3_simple_test.js**：Uniswap V3 计算的简单示例
- **uniswap_v3_educational.js**：带有可视化的综合教育示例

## 涵盖的核心概念

### 1. 集中流动性

Uniswap V3 引入了集中流动性，允许流动性提供者将资金集中在特定价格区间内。与 Uniswap V2 的全范围流动性提供相比，这大大提高了资金效率。

### 2. 刻度和价格区间

Uniswap V3 中的价格表示为对数刻度上的离散"刻度"。每个刻度代表 0.01% 的价格变化。流动性提供者以刻度区间的形式指定其仓位，这些刻度区间对应于价格区间。

### 3. 费率层级

Uniswap V3 提供多种费率层级（0.01%、0.05%、0.3%、1%）以适应不同的资产波动性。每个费率层级都有自己的刻度间距，决定了可以创建的价格区间的粒度。

### 4. 交换执行

Uniswap V3 中的交换是通过沿着集中流动性曲线移动来执行的，可能会跨越多个刻度边界。模拟跟踪：
- 每一步的输入量和输出量
- 价格影响
- 收取的费用
- 每个价格水平上使用的流动性

### 5. 资金效率

该项目展示了 Uniswap V3 的集中流动性设计如何比 Uniswap V2 提供更高的资金效率，只需要一小部分资金就能提供相同的交易深度。

## 运行示例

### 基本交换测试

```bash
node uniswap_v3_swap_test.js
```

这将执行 0.1 ETH 兑换为 USDC 的交换，显示详细的交换结果和流动性分布。

### 简单计算

```bash
node uniswap_v3_simple_test.js
```

这展示了 Uniswap V3 计算的基础知识，包括价格/刻度转换、流动性计算和简单交换示例。

### 教育示例

```bash
node uniswap_v3_educational.js
```

这提供了 Uniswap V3 概念的全面介绍，包含详细解释和流动性分布的 ASCII 可视化。

## 实现细节

模拟实现了 Uniswap V3 中使用的核心数学公式，包括：

- 价格 <-> 刻度转换
- SqrtPriceX96 计算
- 仓位的流动性计算
- 跨刻度的交换步骤执行
- 费用计算
- 价格影响计算

## 局限性

这是一个用于教育目的的简化模拟，有一些局限性：

- 它没有实现完整的 Uniswap V3 协议
- 它使用 JavaScript 数字而不是定点算术，这可能导致非常大或非常小的值出现精度问题
- 它不包括预言机功能或闪电贷保护

## 资源

有关 Uniswap V3 的更多信息，请参考：

- [Uniswap V3 白皮书](https://uniswap.org/whitepaper-v3.pdf)
- [Uniswap V3 核心文档](https://docs.uniswap.org/protocol/concepts/V3-overview/concentrated-liquidity)
- [Uniswap V3 技术指南](https://docs.uniswap.org/protocol/reference/core/libraries/SqrtPriceMath)






