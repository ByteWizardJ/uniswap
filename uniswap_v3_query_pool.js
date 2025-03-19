/**
 * Uniswap V3 Pool 查询工具
 * 
 * 本文件用于查询 Base Sepolia 测试网上指定代币与 WETH 之间的流动池信息，
 * 计算使用 0.001 ETH 兑换代币的数量，以及交换后的价格影响。
 * 
 * 需要安装以下依赖:
 * npm install @uniswap/v3-sdk @uniswap/sdk-core ethers@6.9.0 jsbi
 */

// 导入必要的依赖
const { ethers } = require('ethers');
const { 
  Pool, 
  FeeAmount, 
  computePoolAddress,
  SwapQuoter,
  tickToPrice
} = require('@uniswap/v3-sdk');
const { 
  Token, 
  CurrencyAmount,
  Percent
} = require('@uniswap/sdk-core');
const JSBI = require('jsbi');

// 格式化数字的辅助函数
function formatNumber(num, decimals = 6) {
  if (num === 0) return '0';
  if (Math.abs(num) < 0.000001) return num.toExponential(decimals);
  return num.toFixed(decimals);
}

// 计算价格影响的辅助函数
function calculatePriceImpact(initialPrice, finalPrice) {
  const priceChange = Math.abs(finalPrice - initialPrice);
  const impact = (priceChange / initialPrice) * 100;
  return impact;
}

// 从sqrtPriceX96直接计算价格的函数 - 适用于ethers v6
function calculatePriceFromSqrtX96(sqrtPriceX96, isWethToken0, wethDecimals, tokenDecimals) {
  try {
    // 确保输入是BigInt
    const sqrtPriceX96BigInt = BigInt(sqrtPriceX96.toString());
    
    // 计算价格 = (sqrtPriceX96 ^ 2) / (2 ^ 192)
    const priceQ192 = sqrtPriceX96BigInt * sqrtPriceX96BigInt;
    const Q96 = BigInt(2) ** BigInt(96);
    const price = priceQ192 / (Q96 * Q96);
    
    // 根据代币顺序确定价格方向
    // 如果WETH是token0，价格表示token1/token0，即每单位WETH值多少代币
    // 如果WETH不是token0，价格表示token0/token1，即每单位代币值多少WETH，需要取倒数
    let basePrice;
    if (isWethToken0) {
      // WETH是token0，价格是每单位WETH值多少代币
      // sqrtPrice默认给出的是token1/token0的价格
      basePrice = Number(price);
    } else {
      // WETH是token1，价格是每单位代币值多少WETH，需要取倒数
      // 使用BigInt(10) ** BigInt(36)作为分子进行除法，保留更多精度
      // 36 = 18 (ETH精度) * 2，使用更大数值以保持精度
      const numerator = BigInt(10) ** BigInt(36);
      basePrice = Number(numerator / price) / 10 ** 36;
    }
    
    // 调整小数位数差异
    const decimalAdjustment = 10 ** (tokenDecimals - wethDecimals);
    return basePrice * decimalAdjustment;
  } catch (error) {
    console.error('从sqrtPriceX96计算价格出错:', error);
    return null;
  }
}

// ===== 配置 =====
const CONFIG = {
  // API 密钥 (可以替换为您自己的)
  ALCHEMY_KEY: "AGvs5TB7q3TvbxDOehXCcYP4QUgm_jZ5",
  INFURA_KEY: "YOUR_INFURA_KEY_HERE", // 可选：添加您的Infura API密钥
  
  // 要查询的代币地址
  TOKEN_ADDRESS: "0xb88A0501E70828b5eA58bFCc27FEf4778bd72f15",
  
  // 交换金额
  ETH_SWAP_AMOUNT: 0.001,
  
  // 费率层级 - 只保留1%费率(10000)
  FEE_TIER: FeeAmount.HIGH, // 1%
  
  // 连接选项
  CONNECTION_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
};

// Base Sepolia 网络配置 - 提供多个RPC选项，增加连接成功率
const NETWORK = {
  name: "base-sepolia",
  chainId: 84532,
  rpcUrls: [
    "https://sepolia.base.org",  // 首先尝试Base提供的公共RPC节点
    `https://base-sepolia.g.alchemy.com/v2/${CONFIG.ALCHEMY_KEY}`,
    "https://base-sepolia-rpc.publicnode.com",  // 公共节点
    "https://sepolia.base.org", // 再次尝试官方RPC
    CONFIG.INFURA_KEY !== "YOUR_INFURA_KEY_HERE" ? 
      `https://base-sepolia.infura.io/v3/${CONFIG.INFURA_KEY}` : undefined
  ].filter(Boolean), // 过滤掉未定义的URL
};

// 合约地址
const ADDRESSES = {
  FACTORY: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
  QUOTER: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27',  // QuoterV2 地址
  WETH: '0x4200000000000000000000000000000000000006',    // Base Sepolia 上的 WETH
};

// 创建一个可靠的提供者，带有重试功能
async function createReliableProvider() {
  console.log("尝试连接到以下RPC节点:");
  NETWORK.rpcUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
  
  let lastError;
  
  // 尝试每个RPC URL，直到有一个成功
  for (const rpcUrl of NETWORK.rpcUrls) {
    console.log(`尝试连接到: ${rpcUrl}`);
    
    try {
      // 增加超时设置
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        timeout: 30000, // 30秒超时
        staticNetwork: true // 避免自动网络检测
      });
      
      // 设置网络明确指定
      const network = ethers.Network.from(NETWORK.chainId);
      
      // 测试连接 - 使用简单的调用
      console.log(`测试连接...`);
      const blockNumber = await provider.getBlockNumber();
      console.log(`成功连接到节点: ${rpcUrl}, 当前区块: ${blockNumber}`);
      return provider;
    } catch (error) {
      lastError = error;
      console.log(`连接到 ${rpcUrl} 失败: ${error.message}`);
    }
  }
  
  throw new Error(`无法连接到任何RPC节点: ${lastError?.message || "未知错误"}`);
}

// 带有重试功能的函数调用
async function withRetry(fn, maxRetries = CONFIG.CONNECTION_RETRIES, delay = CONFIG.RETRY_DELAY_MS) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.log(`尝试 ${attempt}/${maxRetries} 失败: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// ===== 主函数 =====
async function main() {
  console.log('===== Uniswap V3 流动池查询 - Base Sepolia =====');
  
  try {
    // ===== 连接到区块链网络 =====
    console.log(`\n连接到 ${NETWORK.name} 网络...`);
    const provider = await createReliableProvider();
    
    // ===== 创建代币实例 =====
    console.log('\n创建代币实例...');
    
    // 创建 WETH 代币实例
    const WETH = new Token(
      NETWORK.chainId,
      ADDRESSES.WETH,
      18,
      'WETH',
      'Wrapped Ether'
    );
    
    // 尝试获取目标代币的信息
    console.log(`查询代币 ${CONFIG.TOKEN_ADDRESS} 的信息...`);
    
    const tokenContract = new ethers.Contract(
      CONFIG.TOKEN_ADDRESS,
      [
        'function name() external view returns (string)',
        'function symbol() external view returns (string)',
        'function decimals() external view returns (uint8)'
      ],
      provider
    );
    
    let tokenName = 'Unknown Token';
    let tokenSymbol = 'UNKNOWN';
    let tokenDecimals = 18; // 默认为18，大多数ERC20代币使用18位小数
    
    try {
      // 分别尝试获取每个属性，以防一些代币未实现某些方法
      try {
        tokenName = await withRetry(() => tokenContract.name());
        console.log(`代币名称: ${tokenName}`);
      } catch (error) {
        console.log('无法获取代币名称，使用默认值');
      }
      
      try {
        tokenSymbol = await withRetry(() => tokenContract.symbol());
        console.log(`代币符号: ${tokenSymbol}`);
      } catch (error) {
        console.log('无法获取代币符号，使用默认值');
      }
      
      try {
        tokenDecimals = await withRetry(() => tokenContract.decimals());
        // 确保是有效的小数位数
        if (isNaN(Number(tokenDecimals)) || Number(tokenDecimals) < 0 || Number(tokenDecimals) > 18) {
          console.log(`获取到无效的小数位数: ${tokenDecimals}，使用默认值 18`);
          tokenDecimals = 18;
        } else {
          tokenDecimals = Number(tokenDecimals);
          console.log(`代币小数位: ${tokenDecimals}`);
        }
      } catch (error) {
        console.log('无法获取代币小数位，使用默认值 18');
      }
      
    } catch (error) {
      console.error('获取代币信息失败，使用默认值:', error.message);
    }
    
    // 创建目标代币实例
    console.log(`创建代币实例: ${tokenSymbol} (小数位: ${tokenDecimals})`);
    const TOKEN = new Token(
      NETWORK.chainId,
      CONFIG.TOKEN_ADDRESS,
      tokenDecimals,
      tokenSymbol,
      tokenName
    );
    
    // ===== 查询池数据 =====
    console.log('\n查询流动池数据...');

    // 定义 Uniswap V3 池 ABI
    const poolABI = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function liquidity() external view returns (uint128)'
    ];

    let pool = null;
    let currentPrice = null;

    try {
      // 计算池地址 - 直接使用1%费率
      const feeTier = CONFIG.FEE_TIER; // 1%
      const poolAddress = computePoolAddress({
        factoryAddress: ADDRESSES.FACTORY,
        tokenA: WETH,
        tokenB: TOKEN,
        fee: feeTier
      });
      
      console.log(`\n查询费率 ${feeTier / 10000}% (${feeTier}) 的池...`);
      console.log(`池地址: ${poolAddress}`);
      
      // 创建池合约实例
      const poolContract = new ethers.Contract(poolAddress, poolABI, provider);
      
      // 查询池数据
      try {
        // 使用重试机制获取池数据
        const [slot0, liquidity] = await Promise.all([
          withRetry(() => poolContract.slot0()),
          withRetry(() => poolContract.liquidity())
        ]);
        
        const sqrtPriceX96 = slot0.sqrtPriceX96;
        const tick = Number(slot0.tick);
        
        console.log(`获取到的原始数据:`);
        console.log(`- sqrtPriceX96: ${sqrtPriceX96.toString()}`);
        console.log(`- tick: ${tick}`);
        console.log(`- liquidity: ${liquidity.toString()}`);
        
        // 确定代币顺序 (Uniswap V3 会根据代币地址排序)
        const token0 = TOKEN.address.toLowerCase() < WETH.address.toLowerCase() ? TOKEN : WETH;
        const token1 = TOKEN.address.toLowerCase() < WETH.address.toLowerCase() ? WETH : TOKEN;
        
        console.log(`代币顺序: token0=${token0.symbol}, token1=${token1.symbol}`);
        
        // 创建池实例
        pool = new Pool(
          token0,
          token1,
          feeTier,
          sqrtPriceX96.toString(),
          liquidity.toString(),
          tick
        );
        
        // 获取当前价格
        try {
          console.log(`尝试计算价格...`);
          
          // 检查池中的sqrtPriceX96是否为0或极小值
          if (BigInt(sqrtPriceX96) === BigInt(0) || BigInt(sqrtPriceX96) < BigInt(1000)) {
            console.log(`警告: sqrtPriceX96值异常: ${sqrtPriceX96}`);
            throw new Error('sqrtPriceX96 值太小或为零');
          }
          
          // 检查tick值是否在合理范围内
          if (Math.abs(tick) > 887272) { // Uniswap V3的tick限制
            console.log(`警告: tick值超出有效范围: ${tick}`);
            throw new Error('tick值超出有效范围');
          }
          
          // 尝试获取价格
          console.log(`WETH是token0: ${pool.token0.equals(WETH)}`);
          
          // 手动计算价格，避免SDK的转换问题
          // 在Uniswap V3中，价格 = 1.0001^tick
          const rawPrice = Math.pow(1.0001, tick);
          console.log(`根据tick ${tick} 手动计算的原始价格: ${rawPrice}`);
          
          // 确定价格方向（取决于代币顺序）
          if (pool.token0.equals(WETH)) {
            // 如果WETH是token0，则价格表示每单位WETH的代币1数量
            currentPrice = rawPrice;
            console.log(`当前价格: ${formatNumber(currentPrice)} ${tokenSymbol} per WETH`);
          } else {
            // 如果WETH是token1，则价格表示每单位代币1的WETH数量，需要取倒数
            currentPrice = 1 / rawPrice;
            console.log(`当前价格: ${formatNumber(currentPrice)} WETH per ${tokenSymbol}`);
            console.log(`反转为: ${formatNumber(1 / currentPrice)} ${tokenSymbol} per WETH`);
          }
          
          // 使用sqrtPriceX96直接计算价格
          try {
            const sqrtPriceBasedPrice = calculatePriceFromSqrtX96(
              sqrtPriceX96,
              pool.token0.equals(WETH),
              WETH.decimals,
              TOKEN.decimals
            );
            
            if (sqrtPriceBasedPrice !== null) {
              console.log(`使用sqrtPriceX96直接计算的价格: ${formatNumber(sqrtPriceBasedPrice)} ${tokenSymbol} per WETH`);
              
              // 比较两种计算方式的差异
              const priceDiff = Math.abs((sqrtPriceBasedPrice - currentPrice) / currentPrice * 100);
              console.log(`两种计算方式的价格差异: ${formatNumber(priceDiff)}%`);
            }
          } catch (error) {
            console.log(`直接计算价格时出错: ${error.message}`);
          }
        } catch (error) {
          console.log(`无法计算价格，详细错误: ${error.message}`);
          console.log(`错误堆栈: ${error.stack ? error.stack.split('\n')[0] : '不可用'}`);
          console.log('这可能是由于流动性太低、价格极端或价格范围设置不当导致的');
        }
        
        console.log(`流动性: ${liquidity.toString()}`);
      } catch (error) {
        console.log(`池不存在或无法获取数据: ${error.message}`);
      }
    } catch (error) {
      console.error(`计算池地址时出错: ${error.message}`);
    }

    // 如果找到有效池，计算兑换数量和价格影响
    if (pool) {
      // ===== 获取交换报价 =====
      console.log('\n计算使用 0.001 ETH 兑换代币的数量...');
      
      // 定义 Quoter ABI (QuoterV2)
      const quoterABI = [
        'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
        'function quoteExactOutputSingle(tuple(address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
      ];
      
      // 创建 Quoter 合约实例
      const quoter = new ethers.Contract(ADDRESSES.QUOTER, quoterABI, provider);
      
      // 设置交换金额
      const swapAmount = CONFIG.ETH_SWAP_AMOUNT;
      console.log(`交换 ${swapAmount} ETH 为 ${tokenSymbol}`);
      
      try {
        // 确定输入和输出代币
        const isWethToken0 = pool.token0.equals(WETH);
        const tokenIn = WETH.address;
        const tokenOut = TOKEN.address;
        
        // 获取当前价格 - 优先使用之前手动计算的价格
        let initialPrice;
        
        // 尝试获取之前计算的价格
        if (typeof currentPrice === 'number' && !isNaN(currentPrice)) {
          initialPrice = currentPrice;
          console.log(`使用计算得到的价格: ${formatNumber(initialPrice)} ${tokenSymbol} per ETH`);
        } else {
          // 如果之前没有成功计算价格，尝试使用tick值计算
          try {
            // 在Uniswap V3中，价格 = 1.0001^tick
            const tick = pool.tickCurrent;
            const rawPrice = Math.pow(1.0001, tick);
            
            // 根据代币顺序确定价格方向
            initialPrice = isWethToken0 ? rawPrice : (1 / rawPrice);
            console.log(`使用tick ${tick} 计算的价格: ${formatNumber(initialPrice)} ${tokenSymbol} per ETH`);
          } catch (error) {
            console.log('无法基于tick计算价格:', error.message);
            initialPrice = 0; // 使用默认值
          }
        }
        
        // 计算输入金额
        const amountIn = ethers.parseUnits(
          swapAmount.toString(), 
          WETH.decimals
        ).toString();
        
        // 准备QuoterV2的参数
        const params = {
          tokenIn,
          tokenOut,
          amountIn,
          fee: CONFIG.FEE_TIER,
          sqrtPriceLimitX96: 0
        };
        
        console.log('调用QuoterV2获取交换报价...');
        
        try {
          // 获取报价 - 使用QuoterV2的新格式和重试机制
          const quoteResult = await withRetry(() => quoter.quoteExactInputSingle.staticCall(params));
          
          // QuoterV2返回的是一个包含多个值的结构体
          const amountOut = quoteResult[0]; // 第一个返回值是amountOut
          
          const formattedAmountOut = ethers.formatUnits(amountOut, tokenDecimals);
          console.log(`预计获得: ${formattedAmountOut} ${tokenSymbol}`);
          
          // 额外输出QuoterV2提供的详细信息
          if (quoteResult.length > 1) {
            const sqrtPriceX96After = quoteResult[1];
            const initializedTicksCrossed = quoteResult[2];
            const gasEstimate = quoteResult[3];
            
            console.log(`交叉的初始化刻度数: ${initializedTicksCrossed}`);
            console.log(`估计的gas消耗: ${gasEstimate}`);
            
            // 尝试从sqrtPriceX96After计算交换后的价格
            try {
              const priceX96 = sqrtPriceX96After;
              
              // 使用我们的专用函数计算价格
              const finalPrice = calculatePriceFromSqrtX96(
                sqrtPriceX96After,
                isWethToken0,
                WETH.decimals,
                TOKEN.decimals
              );
              
              if (finalPrice !== null) {
                console.log(`基于sqrtPriceX96After计算的交换后价格: ${formatNumber(finalPrice)} ${tokenSymbol} per WETH`);
                
                // 计算价格影响
                if (initialPrice > 0) {
                  const priceImpact = calculatePriceImpact(initialPrice, finalPrice);
                  console.log(`预估价格影响: ${formatNumber(priceImpact)}%`);
                }
              } else {
                throw new Error('价格计算结果为null');
              }
            } catch (error) {
              console.log(`无法从sqrtPriceX96After计算价格: ${error.message}`);
              
              // 尝试使用传统方法计算
              try {
                // 这个公式基于Uniswap V3的价格计算方式
                const numerator = BigInt(priceX96) * BigInt(priceX96);
                const denominator = BigInt(2) ** BigInt(192);
                // 这是一个粗略的计算方式
                const priceRatio = Number(numerator) / Number(denominator);
                
                const finalPrice = isWethToken0 ? priceRatio : (1 / priceRatio);
                console.log(`使用传统方法计算的交换后价格: ${formatNumber(finalPrice)} ${tokenSymbol} per ETH`);
                
                // 计算价格影响
                if (initialPrice > 0) {
                  const priceImpact = calculatePriceImpact(initialPrice, finalPrice);
                  console.log(`传统方法计算的价格影响: ${formatNumber(priceImpact)}%`);
                }
              } catch (innerError) {
                console.log(`传统方法计算价格也失败: ${innerError.message}`);
              }
            }
          }
          
          // 检查是否可以计算价格影响
          if (initialPrice > 0) {
            // 从交换结果直接计算有效价格
            const effectivePrice = parseFloat(formattedAmountOut) / swapAmount;
            console.log(`基于交换结果的有效价格: ${formatNumber(effectivePrice)} ${tokenSymbol} per ETH`);
            
            // 计算有效价格与当前价格的差异
            const priceDifference = Math.abs(effectivePrice - initialPrice) / initialPrice * 100;
            console.log(`价格差异: ${formatNumber(priceDifference)}%`);
          }
          
          // 计算每单位的价格
          const tokenPerEth = parseFloat(formattedAmountOut) / swapAmount;
          console.log(`每 ETH 可兑换: ${formatNumber(tokenPerEth)} ${tokenSymbol}`);
          
        } catch (error) {
          console.error('QuoterV2调用失败，尝试手动估算...');
          console.error(error);
          
          // 如果池存在但报价失败，尝试使用当前价格进行粗略估算
          if (initialPrice > 0) {
            const roughEstimate = swapAmount * initialPrice * 0.98; // 假设2%的滑点
            console.log(`基于当前价格的粗略估计: ${formatNumber(roughEstimate)} ${tokenSymbol} (考虑2%滑点)`);
            console.log(`每 ETH 粗略可兑换: ${formatNumber(roughEstimate / swapAmount)} ${tokenSymbol}`);
          } else {
            console.log('无法估算兑换量，无法获取可靠的价格数据');
          }
        }
        
      } catch (error) {
        console.error('获取交换报价时出错:', error);
        console.log('此池可能没有足够的流动性或不存在');
      }
    } else {
      console.log(`\n未找到 WETH/${tokenSymbol} 的有效流动池，可能尚未创建`);
    }
    
  } catch (error) {
    console.error('发生错误:', error);
    if (error.reason) {
      console.error('错误原因:', error.reason);
    }
  }
}

// 运行主函数
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  });
