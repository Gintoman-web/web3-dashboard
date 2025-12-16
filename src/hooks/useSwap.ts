import { useState, useMemo } from 'react';
import { useReadContract, useWriteContract, useChainId } from 'wagmi';
import { parseAbi, parseUnits, formatUnits, erc20Abi, type Address } from 'viem';

// --- CONSTANTS ---
const QUOTER_ADDRESS = '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3';
const SWAP_ROUTER_02_ADDRESS = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E';
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';

const USDC_ADDRESSES: Record<number, Address> = {
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
};

export function useSwap(address: Address | undefined) {
  const chainId = useChainId();
  const usdcAddress = USDC_ADDRESSES[chainId];

  // --- STATE ---
  const [sellAmount, setSellAmount] = useState('');
  const [isEthToUsdc, setIsEthToUsdc] = useState(true);
  const [txType, setTxType] = useState<'approve' | 'swap' | null>(null);

  // --- CONFIG ---
  const tokenConfig = useMemo(() => {
    return {
      tokenIn: (isEthToUsdc ? WETH_ADDRESS : usdcAddress) as Address,
      tokenOut: (isEthToUsdc ? usdcAddress : WETH_ADDRESS) as Address,
      symbolIn: isEthToUsdc ? 'ETH' : 'USDC',
      symbolOut: isEthToUsdc ? 'USDC' : 'ETH',
      decimalsIn: isEthToUsdc ? 18 : 6,
      decimalsOut: isEthToUsdc ? 6 : 18,
    };
  }, [isEthToUsdc, usdcAddress]);

  // --- READ: QUOTER ---
  const { data: quoteData, isLoading: isQuoteLoading } = useReadContract({
    address: QUOTER_ADDRESS,
    abi: parseAbi([
      'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
      'function quoteExactInputSingle(QuoteExactInputSingleParams params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
    ]),
    functionName: 'quoteExactInputSingle',
    args: (usdcAddress && sellAmount && parseFloat(sellAmount) > 0) ? [{
      tokenIn: tokenConfig.tokenIn,
      tokenOut: tokenConfig.tokenOut,
      amountIn: parseUnits(sellAmount, tokenConfig.decimalsIn),
      fee: 3000,
      sqrtPriceLimitX96: 0n,
    }] : undefined,
    query: { 
      enabled: !!usdcAddress && !!sellAmount && parseFloat(sellAmount) > 0,
      staleTime: 10000,
    }
  });

  const buyAmount = useMemo(() => {
    if (isQuoteLoading) return 'Calculating...';
    if (!quoteData) return '';
    const amountOut = Array.isArray(quoteData) ? quoteData[0] : quoteData;
    return typeof amountOut === 'bigint' ? formatUnits(amountOut, tokenConfig.decimalsOut) : '';
  }, [quoteData, isQuoteLoading, tokenConfig.decimalsOut]);

  // --- READ: ALLOWANCE ---
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, SWAP_ROUTER_02_ADDRESS] : undefined,
    query: { enabled: !!address && !!usdcAddress && !isEthToUsdc }
  });

  // --- WRITE: TRANSACTIONS ---
  const { writeContract, isPending, isSuccess, data: txHash, error: txError, reset } = useWriteContract({
    mutation: {
      onSuccess: () => {
        if (txType === 'approve') refetchAllowance();
        setTxType(null);
      },
      onError: () => setTxType(null)
    }
  });

  // --- ACTIONS ---
  const toggleDirection = () => {
    setIsEthToUsdc(prev => !prev);
    setSellAmount('');
    reset();
  };

  const handleApprove = () => {
    if (!usdcAddress) return;
    setTxType('approve');
    writeContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [SWAP_ROUTER_02_ADDRESS, parseUnits(sellAmount, tokenConfig.decimalsIn)],
    });
  };

  const handleSwap = () => {
    if (!usdcAddress || !address) return;
    setTxType('swap');
    const amountInWei = parseUnits(sellAmount, tokenConfig.decimalsIn);

    writeContract({
      address: SWAP_ROUTER_02_ADDRESS,
      abi: parseAbi([
        'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
        'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)'
      ]),
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: tokenConfig.tokenIn,
        tokenOut: tokenConfig.tokenOut,
        fee: 3000,
        recipient: address,
        amountIn: amountInWei,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      }],
      value: isEthToUsdc ? amountInWei : 0n, 
    });
  };

  return {
    sellAmount,
    setSellAmount,
    buyAmount,
    isEthToUsdc,
    symbolIn: tokenConfig.symbolIn,
    symbolOut: tokenConfig.symbolOut,
    allowance: allowance || 0n,
    amountInWei: sellAmount ? parseUnits(sellAmount, tokenConfig.decimalsIn) : 0n,
    isApproving: isPending && txType === 'approve',
    isSwapping: isPending && txType === 'swap',
    isSuccess,
    txHash,
    error: txError,
    toggleDirection,
    handleApprove,
    handleSwap,
  };
}