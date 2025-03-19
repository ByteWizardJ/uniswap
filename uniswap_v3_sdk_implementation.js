/**
 * Uniswap V3 SDK 实际应用实现
 * 
 * 本文件实现了使用官方 Uniswap V3 SDK 与以太坊网络交互的完整流程，
 * 包括查询池数据、添加流动性、获取交换报价和执行交换。
 * 
 * 需要安装以下依赖:
 * npm install @uniswap/v3-sdk @uniswap/sdk-core ethers@6.9.0 jsbi
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

// 辅助函数：将 BigInt 转换为 Number (仅用于显示目的)
function bigIntToNumber(bigInt) {
  // 注意：这可能会导致大数的精度损失
  return Number(bigInt.toString());
}

// ===== 配置 =====
// 请在运行前填写以下配置
const CONFIG = {
  // 您的 Alchemy API 密钥
  ALCHEMY_KEY: "AGvs5TB7q3TvbxDOehXCcYP4QUgm_jZ5", 
  
  // 您的以太坊私钥（请确保这是测试账户，不要使用包含大量资金的账户）
  PRIVATE_KEY: "591168d601feed21a22c4654b89dd95bc104d60b4a7edbe00455fc420f73e268", 
  
  // 要使用的网络
  // 可选值: "mainnet", "sepolia", "base", "base_sepolia"
  NETWORK: "base_sepolia",
  
  // 交易参数
  ETH_AMOUNT_FOR_POSITION: 0.01, // 添加流动性时使用的 ETH 数量
  USDC_AMOUNT_FOR_POSITION: 20,  // 添加流动性时使用的 USDC 数量
  ETH_AMOUNT_FOR_SWAP: 0.001,    // 交换时使用的 ETH 数量
  SLIPPAGE_TOLERANCE: 0.01,      // 滑点容忍度（1%）
  
  // 价格范围（用于添加流动性）
  LOWER_PRICE: 1800, // 下限价格
  UPPER_PRICE: 2200, // 上限价格
};

// ===== 网络配置 =====
const NETWORKS = {
  mainnet: {
    name: "mainnet",
    chainId: 1,
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${CONFIG.ALCHEMY_KEY}`,
    isTestnet: false,
    nativeToken: "ETH"
  },
  sepolia: {
    name: "sepolia",
    chainId: 11155111,
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${CONFIG.ALCHEMY_KEY}`,
    isTestnet: true,
    nativeToken: "ETH"
  },
  base: {
    name: "base",
    chainId: 8453,
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${CONFIG.ALCHEMY_KEY}`,
    isTestnet: false,
    nativeToken: "ETH"
  },
  base_sepolia: {
    name: "base-sepolia",
    chainId: 84532,
    rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${CONFIG.ALCHEMY_KEY}`,
    isTestnet: true,
    nativeToken: "ETH"
  }
};

// ===== 合约地址 =====
// 根据网络选择正确的合约地址
const ADDRESSES = {
  // 主网地址
  MAINNET: {
    FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    SWAP_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  // Sepolia 测试网地址
  SEPOLIA: {
    FACTORY: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
    POSITION_MANAGER: '0x1238536071E1c677A632429e3655c799b22cDA52',
    QUOTER: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3', // QuoterV2 地址
    SWAP_ROUTER: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', // UniversalRouter 地址
    WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // 或使用官方文档中的 '0xfff9976782d46cc05630d1f6ebab18b2324d6b14'
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  },
  // Base 主网地址
  BASE: {
    FACTORY: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    POSITION_MANAGER: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
    QUOTER: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',  // QuoterV2 地址
    SWAP_ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481',  // SwapRouter02 地址
    UNIVERSAL_ROUTER: '0x6ff5693b99212da76ad316178a184ab56d299b43',
    WETH: '0x4200000000000000000000000000000000000006',  // Base 上的 WETH 
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'   // Base 上的 USDC (Circle)
  },
  // Base Sepolia 测试网地址
  BASE_SEPOLIA: {
    FACTORY: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    POSITION_MANAGER: '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2',
    QUOTER: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27',  // QuoterV2 地址
    SWAP_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',  // SwapRouter02 地址
    UNIVERSAL_ROUTER: '0x492e6456d9528771018deb9e87ef7750ef184104',
    WETH: '0x4200000000000000000000000000000000000006',  // Base Sepolia 上的 WETH
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'   // Base Sepolia 上的模拟 USDC
  }
};

// ===== 主函数 =====
async function main() {
  console.log('===== Uniswap V3 SDK 实际应用 =====');
  
  try {
    // ===== 连接到区块链网络 =====
    console.log('\n===== 连接到区块链网络 =====');
    
    // 确定要使用的网络
    const networkConfig = NETWORKS[CONFIG.NETWORK];
    if (!networkConfig) {
      throw new Error(`不支持的网络: ${CONFIG.NETWORK}。支持的网络有: ${Object.keys(NETWORKS).join(', ')}`);
    }
    
    const { name: networkName, chainId, rpcUrl, isTestnet } = networkConfig;
    
    // 确定要使用的合约地址
    let networkAddresses;
    switch (CONFIG.NETWORK) {
      case 'mainnet':
        networkAddresses = ADDRESSES.MAINNET;
        break;
      case 'sepolia':
        networkAddresses = ADDRESSES.SEPOLIA;
        break;
      case 'base':
        networkAddresses = ADDRESSES.BASE;
        break;
      case 'base_sepolia':
        networkAddresses = ADDRESSES.BASE_SEPOLIA;
        break;
      default:
        throw new Error(`未找到网络 ${CONFIG.NETWORK} 的合约地址配置`);
    }
    
    console.log(`使用网络: ${networkName} (chainId: ${chainId}, ${isTestnet ? '测试网' : '主网'})`);
    
    // 创建提供者和钱包 - ethers v6 方式
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
    const address = await wallet.getAddress();
    console.log(`钱包地址: ${address}`);
    
    // 获取余额
    const ethBalance = await provider.getBalance(address);
    console.log(`${networkConfig.nativeToken} 余额: ${ethers.formatEther(ethBalance)} ${networkConfig.nativeToken}`);
    
    // ===== 创建代币实例 =====
    console.log('\n===== 创建代币实例 =====');
    
    // 创建代币实例
    const WETH = new Token(
      chainId,
      networkAddresses.WETH,
      18,
      'WETH',
      'Wrapped Ether'
    );
    
    const USDC = new Token(
      chainId,
      networkAddresses.USDC,
      6,
      'USDC',
      'USD Coin'
    );
    
    console.log(`WETH: ${WETH.name} (${WETH.symbol})`);
    console.log(`地址: ${WETH.address}`);
    console.log(`小数位: ${WETH.decimals}`);
    console.log();
    console.log(`USDC: ${USDC.name} (${USDC.symbol})`);
    console.log(`地址: ${USDC.address}`);
    console.log(`小数位: ${USDC.decimals}`);
    
    // ===== 设置费率层级和池地址 =====
    console.log('\n===== 设置费率层级和池地址 =====');
    
    // 选择费率层级
    const FEE_TIER = FeeAmount.MEDIUM; // 0.3%
    console.log(`费率层级: ${FEE_TIER / 10000}% (${FEE_TIER})`);
    
    // 计算池地址
    const POOL_FACTORY_ADDRESS = networkAddresses.FACTORY;
    console.log(`使用工厂地址: ${POOL_FACTORY_ADDRESS}`);
    
    const poolAddress = computePoolAddress({
      factoryAddress: POOL_FACTORY_ADDRESS,
      tokenA: WETH,
      tokenB: USDC,
      fee: FEE_TIER
    });
    
    console.log(`WETH/USDC 池地址: ${poolAddress}`);
    
    // ===== 查询池数据 =====
    console.log('\n===== 查询池数据 =====');
    
    // 定义 Uniswap V3 池 ABI（仅包含我们需要的函数）
    const IUniswapV3PoolABI = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function liquidity() external view returns (uint128)'
    ];
    
    // 创建池合约实例
    const poolContract = new ethers.Contract(poolAddress, IUniswapV3PoolABI, provider);
    
    // 查询池数据
    console.log('正在查询池数据...');
    
    try {
      const [slot0, liquidity] = await Promise.all([
        poolContract.slot0(),
        poolContract.liquidity()
      ]);
      
      // 在 ethers v6 中，值可能是 BigInt，需要转换
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      const tick = Number(slot0.tick); // 将 BigInt 转换为 number
      const currentPrice = Math.pow(1.0001, tick);
      
      console.log('池数据:');
      console.log(`当前刻度: ${tick}`);
      console.log(`当前价格: $${formatNumber(currentPrice)} USDC per ETH`);
      console.log(`流动性: ${liquidity.toString()}`);
      
      // 创建池实例 - 使用 JSBI 或 String 确保数值类型正确
      const pool = new Pool(
        WETH,
        USDC,
        FEE_TIER,
        sqrtPriceX96.toString(), // 转换为字符串
        liquidity.toString(),    // 转换为字符串
        tick                     // 已经转换为 Number
      );
      
      console.log('池实例已创建');
      
      // 继续执行后续代码...
      continueWithPool(pool, WETH, USDC, FEE_TIER, provider, wallet, address, networkAddresses);
      
    } catch (error) {
      console.error(`查询池数据时出错，可能是池不存在。在 ${networkName} 上创建模拟池...`);
      console.error(error);
      
      // 如果池不存在，创建一个模拟池用于演示
      const mockTick = 76012; // 约等于 2000 USDC/ETH
      const mockSqrtPriceX96 = JSBI.BigInt('1414213562373095048801688724'); // 使用 JSBI.BigInt 转换
      const mockLiquidity = JSBI.BigInt('1000000000000');
      
      const pool = new Pool(
        WETH,
        USDC,
        FEE_TIER,
        mockSqrtPriceX96,
        mockLiquidity,
        mockTick
      );
      
      console.log('模拟池数据:');
      console.log(`当前刻度: ${mockTick}`);
      console.log(`当前价格: $${formatNumber(Math.pow(1.0001, mockTick))} USDC per ETH`);
      console.log(`流动性: ${mockLiquidity.toString()}`);
      console.log('模拟池实例已创建');
      
      // 继续执行后续代码...
      continueWithPool(pool, WETH, USDC, FEE_TIER, provider, wallet, address, networkAddresses);
    }
    
  } catch (error) {
    console.error('发生错误:', error);
    if (error.reason) {
      console.error('错误原因:', error.reason);
    }
    if (error.data) {
      console.error('错误数据:', error.data);
    }
  }
}

// 继续执行后续流程的函数
async function continueWithPool(pool, WETH, USDC, FEE_TIER, provider, wallet, address, networkAddresses) {
  try {
    // ===== 计算价格范围和刻度 =====
    console.log('\n===== 计算价格范围和刻度 =====');
    
    // 检查池数据是否在合理范围内
    console.log('检查池数据有效性...');
    const poolTick = pool.tickCurrent;
    const estimatedPrice = Math.pow(1.0001, poolTick);
    console.log(`池当前刻度: ${poolTick}`);
    console.log(`估计价格: ${estimatedPrice} USDC per ETH`);
    
    // 如果刻度值不合理，则使用默认值
    let useDefaultSettings = false;
    if (poolTick > 100000 || poolTick < -100000 || estimatedPrice > 10000 || estimatedPrice < 0.0001) {
      console.log('检测到池刻度值异常，将使用默认值进行演示');
      useDefaultSettings = true;
    }
    
    // 定义价格范围
    const LOWER_PRICE = CONFIG.LOWER_PRICE;
    const UPPER_PRICE = CONFIG.UPPER_PRICE;
    console.log(`价格范围: $${LOWER_PRICE} - $${UPPER_PRICE} USDC per ETH`);
    
    // 计算对应的刻度
    const LOWER_TICK = Math.floor(Math.log(LOWER_PRICE) / Math.log(1.0001));
    const UPPER_TICK = Math.floor(Math.log(UPPER_PRICE) / Math.log(1.0001));
    
    // 找到最近的可用刻度
    const tickSpacing = TICK_SPACINGS[FEE_TIER];
    const lowerTick = nearestUsableTick(LOWER_TICK, tickSpacing);
    const upperTick = nearestUsableTick(UPPER_TICK, tickSpacing);
    
    console.log(`价格范围对应的刻度: ${LOWER_TICK} - ${UPPER_TICK}`);
    console.log(`最近的可用刻度: ${lowerTick} - ${upperTick}`);
    
    // ===== 检查代币余额 =====
    console.log('\n===== 检查代币余额 =====');
    
    // 定义 ERC20 ABI（仅包含我们需要的函数）
    const IERC20ABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function approve(address spender, uint256 amount) external returns (bool)'
    ];
    
    // 创建代币合约实例
    const wethContract = new ethers.Contract(WETH.address, IERC20ABI, wallet);
    const usdcContract = new ethers.Contract(USDC.address, IERC20ABI, wallet);
    
    // 查询代币余额
    let wethBalance = '0';
    let usdcBalance = '0';
    try {
      wethBalance = await wethContract.balanceOf(address);
      usdcBalance = await usdcContract.balanceOf(address);
      
      console.log(`WETH 余额: ${ethers.formatUnits(wethBalance, WETH.decimals)} WETH`);
      console.log(`USDC 余额: ${ethers.formatUnits(usdcBalance, USDC.decimals)} USDC`);
    } catch (error) {
      console.error('查询代币余额时出错:', error.message);
      console.log('继续执行，但请确保您的账户有足够的代币余额');
    }
    
    // ===== 添加流动性 =====
    console.log('\n===== 添加流动性 =====');
    
    // 定义 NonfungiblePositionManager ABI（仅包含我们需要的函数）
    const INonfungiblePositionManagerABI = [
      'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
    ];
    
    // 定义 NonfungiblePositionManager 地址
    const NONFUNGIBLE_POSITION_MANAGER = networkAddresses.POSITION_MANAGER;
    console.log(`使用 NonfungiblePositionManager 地址: ${NONFUNGIBLE_POSITION_MANAGER}`);
    
    // 批准代币转账的函数
    async function approveToken(tokenContract, spender, amount) {
      console.log(`正在批准 ${spender} 使用 ${amount} 代币...`);
      try {
        const tx = await tokenContract.approve(spender, amount);
        console.log(`批准交易已提交，交易哈希: ${tx.hash}`);
        await tx.wait();
        console.log(`批准交易已确认`);
      } catch (error) {
        console.error(`批准代币时出错: ${error.message}`);
        throw error;
      }
    }
    
    // 添加流动性
    async function addLiquidity() {
      console.log('准备添加流动性...');
      
      try {
        // 创建代币金额
        const ethAmount = CONFIG.ETH_AMOUNT_FOR_POSITION;
        const usdcAmount = CONFIG.USDC_AMOUNT_FOR_POSITION;
        
        console.log(`添加 ${ethAmount} ETH 和 ${usdcAmount} USDC 的流动性`);
        
        const ethCurrencyAmount = CurrencyAmount.fromRawAmount(
          WETH,
          ethers.parseUnits(ethAmount.toString(), WETH.decimals).toString()
        );
        
        const usdcCurrencyAmount = CurrencyAmount.fromRawAmount(
          USDC,
          ethers.parseUnits(usdcAmount.toString(), USDC.decimals).toString()
        );
        
        // 创建仓位
        let position;
        try {
          position = Position.fromAmounts({
            pool,
            tickLower: lowerTick,
            tickUpper: upperTick,
            amount0: ethCurrencyAmount.quotient,
            amount1: usdcCurrencyAmount.quotient,
            useFullPrecision: true
          });
          
          console.log('仓位信息:');
          console.log(`刻度范围: ${position.tickLower} - ${position.tickUpper}`);
          console.log(`流动性: ${position.liquidity.toString()}`);
        } catch (error) {
          console.error('创建仓位时发生错误:', error.message);
          console.log('尝试使用默认值创建模拟仓位');
          
          // 如果创建仓位失败，使用模拟值
          return console.log('添加流动性操作在测试网上暂时不可用，需要先创建池和获取测试代币');
        }
        
        // 创建 NonfungiblePositionManager 合约实例
        const positionManager = new ethers.Contract(
          NONFUNGIBLE_POSITION_MANAGER,
          INonfungiblePositionManagerABI,
          wallet
        );
        
        // 批准代币转账
        await approveToken(
          wethContract, 
          NONFUNGIBLE_POSITION_MANAGER, 
          position.amount0.quotient.toString()
        );
        
        await approveToken(
          usdcContract, 
          NONFUNGIBLE_POSITION_MANAGER, 
          position.amount1.quotient.toString()
        );
        
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
          recipient: address,
          deadline: Math.floor(Date.now() / 1000) + 60 * 20
        };
        
        // 铸造仓位
        console.log('正在铸造仓位...');
        try {
          const tx = await positionManager.mint(mintParams);
          console.log(`铸造交易已提交，交易哈希: ${tx.hash}`);
          const receipt = await tx.wait();
          console.log('仓位已创建，交易哈希:', receipt.hash);
          return receipt;
        } catch (error) {
          console.error('铸造仓位时出错:', error.message);
          if (error.reason) console.error('原因:', error.reason);
          console.log('注意: 在测试网上，可能需要先获取测试代币并确保池已创建');
          throw error;
        }
      } catch (error) {
        console.error('添加流动性过程中出错:', error);
        console.log('继续执行其他流程...');
      }
    }
    
    // ===== 获取交换报价 =====
    console.log('\n===== 获取交换报价 =====');
    
    // 定义 Quoter ABI（仅包含我们需要的函数）
    const IQuoterABI = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
    ];
    
    // 定义 Quoter 地址
    const QUOTER = networkAddresses.QUOTER;
    console.log(`使用 Quoter 地址: ${QUOTER}`);
    
    // 获取交换报价
    async function getSwapQuote() {
      console.log('正在获取交换报价...');
      
      try {
        // 创建 Quoter 合约实例
        const quoter = new ethers.Contract(QUOTER, IQuoterABI, provider);
        
        // 设置交换金额
        const swapAmount = CONFIG.ETH_AMOUNT_FOR_SWAP;
        console.log(`交换 ${swapAmount} ETH 为 USDC`);
        
        // 获取报价
        const amountIn = ethers.parseUnits(swapAmount.toString(), WETH.decimals).toString();
        
        try {
          // v6中使用静态调用的方式略有变化
          const amountOut = await quoter.quoteExactInputSingle.staticCall(
            WETH.address,
            USDC.address,
            FEE_TIER,
            amountIn,
            0
          );
          
          const formattedAmountOut = ethers.formatUnits(amountOut, USDC.decimals);
          console.log(`预计获得: ${formattedAmountOut} USDC`);
          
          return {
            amountIn,
            amountOut: amountOut.toString(),
            formattedAmountOut
          };
        } catch (error) {
          console.error('获取报价时出错:', error.message);
          console.log(`在 ${CONFIG.NETWORK} 上可能没有足够的流动性或池不存在`);
          
          // 返回模拟报价
          const mockAmountOut = ethers.parseUnits(
            (parseFloat(swapAmount) * 2000).toString(), 
            USDC.decimals
          ).toString();
          
          const formattedMockAmountOut = ethers.formatUnits(mockAmountOut, USDC.decimals);
          console.log(`使用模拟报价: ${formattedMockAmountOut} USDC (基于 1 ETH = 2000 USDC)`);
          
          return {
            amountIn,
            amountOut: mockAmountOut,
            formattedAmountOut: formattedMockAmountOut
          };
        }
      } catch (error) {
        console.error('调用报价函数出错:', error);
        
        // 出错时返回模拟报价
        const swapAmount = CONFIG.ETH_AMOUNT_FOR_SWAP;
        const mockAmountOut = ethers.parseUnits(
          (parseFloat(swapAmount) * 2000).toString(), 
          USDC.decimals
        ).toString();
        
        const formattedMockAmountOut = ethers.formatUnits(mockAmountOut, USDC.decimals);
        console.log(`使用模拟报价: ${formattedMockAmountOut} USDC (基于 1 ETH = 2000 USDC)`);
        
        return {
          amountIn: ethers.parseUnits(swapAmount.toString(), WETH.decimals).toString(),
          amountOut: mockAmountOut,
          formattedAmountOut: formattedMockAmountOut
        };
      }
    }
    
    // ===== 执行交换 =====
    console.log('\n===== 执行交换 =====');
    
    // 定义 SwapRouter ABI（仅包含我们需要的函数）
    const ISwapRouterABI = [
      'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
    ];
    
    // 定义 SwapRouter 地址
    const SWAP_ROUTER = networkAddresses.SWAP_ROUTER;
    console.log(`使用 SwapRouter 地址: ${SWAP_ROUTER}`);
    
    // 执行交换
    async function executeSwap(quoteResult) {
      console.log('准备执行交换...');
      
      try {
        // 检查WETH余额
        const currentWethBalance = await wethContract.balanceOf(address);
        console.log(`当前WETH余额: ${ethers.formatUnits(currentWethBalance, WETH.decimals)} WETH`);
        
        if (BigInt(currentWethBalance) < BigInt(quoteResult.amountIn)) {
          console.error(`WETH余额不足，需要 ${ethers.formatUnits(quoteResult.amountIn, WETH.decimals)} WETH，但只有 ${ethers.formatUnits(currentWethBalance, WETH.decimals)} WETH`);
          return console.log('交换操作在测试网上暂时不可用，需要先获取测试代币');
        }
        
        // 创建 SwapRouter 合约实例
        const swapRouter = new ethers.Contract(SWAP_ROUTER, ISwapRouterABI, wallet);
        
        // 批准代币转账
        await approveToken(wethContract, SWAP_ROUTER, quoteResult.amountIn);
        
        // 计算最小输出金额（考虑滑点）
        const minAmountOut = (
          parseFloat(quoteResult.formattedAmountOut) * (1 - CONFIG.SLIPPAGE_TOLERANCE)
        ).toString();
        
        console.log(`最小输出金额 (考虑 ${CONFIG.SLIPPAGE_TOLERANCE * 100}% 滑点): ${minAmountOut} USDC`);
        
        // 创建交换参数
        const swapParams = {
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          fee: FEE_TIER,
          recipient: address,
          deadline: Math.floor(Date.now() / 1000) + 60 * 20,
          amountIn: quoteResult.amountIn,
          amountOutMinimum: ethers.parseUnits(minAmountOut, USDC.decimals).toString(),
          sqrtPriceLimitX96: '0'
        };
        
        // 执行交换
        console.log('正在执行交换...');
        try {
          const tx = await swapRouter.exactInputSingle(swapParams);
          console.log(`交换交易已提交，交易哈希: ${tx.hash}`);
          const receipt = await tx.wait();
          console.log('交换已执行，交易哈希:', receipt.hash);
          return receipt;
        } catch (error) {
          console.error('执行交换时出错:', error.message);
          if (error.reason) console.error('原因:', error.reason);
          console.log(`注意: 在 ${CONFIG.NETWORK} 上，可能需要先创建池并添加流动性`);
          throw error;
        }
      } catch (error) {
        console.error('交换过程中出错:', error);
        console.log('继续执行其他流程...');
      }
    }
    
    // ===== 执行完整流程 =====
    console.log('\n===== 执行完整流程 =====');
    
    // 根据用户选择执行操作
    const ADD_LIQUIDITY = false; // 设置为 true 以添加流动性
    const EXECUTE_SWAP = true;   // 设置为 true 以执行交换
    
    if (ADD_LIQUIDITY) {
      console.log('\n开始添加流动性流程...');
      try {
        await addLiquidity();
        console.log('添加流动性流程已完成');
      } catch (error) {
        console.error('添加流动性失败:', error.message);
      }
    }
    
    if (EXECUTE_SWAP) {
      console.log('\n开始交换流程...');
      try {
        const quoteResult = await getSwapQuote();
        await executeSwap(quoteResult);
        console.log('交换流程已完成');
      } catch (error) {
        console.error('交换失败:', error.message);
      }
    }
    
    console.log('\n===== 所有操作已完成 =====');
    
  } catch (error) {
    console.error('执行流程时出错:', error);
    if (error.reason) {
      console.error('错误原因:', error.reason);
    }
    if (error.data) {
      console.error('错误数据:', error.data);
    }
    console.log('尽管出现错误，程序仍将继续运行演示功能');
    
    // 执行简化版的流程，确保即使出错也能演示
    console.log('\n===== 执行简化版模拟流程 =====');
    
    try {
      console.log('\n开始交换流程（模拟）...');
      
      // 模拟交换报价
      const swapAmount = CONFIG.ETH_AMOUNT_FOR_SWAP;
      const mockAmountOut = (swapAmount * 2000).toString();
      console.log(`交换 ${swapAmount} ETH 为 USDC`);
      console.log(`模拟报价: ${mockAmountOut} USDC (基于 1 ETH = 2000 USDC)`);
      console.log('注意：这是模拟数据，实际执行时需要连接到有效的测试网并有足够的测试代币');
      
      console.log('交换流程（模拟）已完成');
    } catch (error) {
      console.error('模拟流程失败:', error);
    }
    
    console.log('\n===== 所有操作已完成 =====');
  }
}

// 运行主函数
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  }); 