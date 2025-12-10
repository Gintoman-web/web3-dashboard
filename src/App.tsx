
import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useReadContract, useSendTransaction, useWriteContract, useChainId } from 'wagmi';
import { formatUnits, parseAbi, parseEther, parseUnits, type Address, type BaseError } from 'viem';


// --- CONSTANTS ---
const QUOTER_ADDRESS = '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3';
const SWAP_ROUTER_02_ADDRESS = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E'
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';

const USDC_ADDRESSES: Record<number, Address> = {
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
};


const useEthPrice = () => {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
        );
        const data = await response.json();
        setPrice(data.ethereum.usd);
      } catch (error) {
        console.error('Error fetching ETH price:', error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  return price;
};

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const usdcAddress = USDC_ADDRESSES[chainId];

  const [tokenType, setTokenType] = useState<'ETH' | 'USDC'>('ETH');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');

  // Swap State
  const [swapSellAmount, setSwapSellAmount] = useState('');

  // --- HOOKS: Balance ---
  const { 
    data: balanceData, 
    isLoading: isBalanceLoading, 
    isError: isBalanceError 
  } = useBalance({
    address: address,
  });

  const ethPrice = useEthPrice();

  let usdValueDisplay = '';
  if (balanceData && ethPrice) {
    const ethAmount = parseFloat(formatUnits(balanceData.value, balanceData.decimals));
    const totalUsd = ethAmount * ethPrice;

    usdValueDisplay = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(totalUsd);
  }

  let inputUsdValue = '';
  if (amount && ethPrice && tokenType === 'ETH') {
    const amountNum = parseFloat(amount);
    if (!isNaN(amountNum)) {
      inputUsdValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amountNum * ethPrice);
    }
  }

  const { 
    data: usdcData, 
    isLoading: isUsdcLoading, 
    isError: isUsdcError 
  } = useReadContract({
    address: usdcAddress,
    abi: parseAbi([
      'function balanceOf(address account) view returns (uint256)'
    ]),
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!usdcAddress,
    }
  });

  // --- HOOK: Uniswap V3 Quoter ---
  const { data: quoteData, isLoading: isQuoteLoading } = useReadContract({
    address: QUOTER_ADDRESS,
    abi: parseAbi([
      'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
      'function quoteExactInputSingle(QuoteExactInputSingleParams params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
    ]),
    functionName: 'quoteExactInputSingle',
    args: usdcAddress ? [{
      tokenIn: WETH_ADDRESS,
      tokenOut: usdcAddress,
      amountIn: parseEther(swapSellAmount || '0'),
      fee: 3000,
      sqrtPriceLimitX96: 0n,
    }] : undefined,
    query: { enabled: !!usdcAddress && !!swapSellAmount && parseFloat(swapSellAmount) > 0 }
  });

  let buyAmountDisplay = '';
  if (isQuoteLoading) {
    buyAmountDisplay = 'Calculating...';
  } else if (quoteData) {
    const amountOut = Array.isArray(quoteData) ? quoteData[0] : quoteData;
    if (typeof amountOut === 'bigint') {
       buyAmountDisplay = formatUnits(amountOut, 6);
    }
  }

  // --- HOOKS: Send Transactions ---
  const { 
    data: ethHash, 
    isPending: isEthPending, 
    isSuccess: isEthSuccess, 
    sendTransaction, 
    error: ethError 
  } = useSendTransaction();

  const { 
    data: usdcHash, 
    isPending: isUsdcPending, 
    isSuccess: isUsdcSuccess, 
    writeContract: writeTransfer, 
    error: usdcError 
  } = useWriteContract();

  // --- HOOKS: Swap Transaction ---
  const {
    data: swapHash,
    isPending: isSwapPending,
    isSuccess: isSwapSuccess,
    writeContract: writeSwap,
    error: swapError
  } = useWriteContract({
    mutation: {
      onError: (error) => {
        console.error("Swap Error Details:", error); 
      }
    }
  });

  // --- HANDLERS ---
  const renderEthBalance = () => {
    if (isBalanceLoading) return <div>Loading balance...</div>;
    if (isBalanceError) return <div style={{ color: 'red' }}>Error fetching balance</div>;

    if (balanceData) {
      const rawValue = formatUnits(balanceData.value, balanceData.decimals);
      const formattedEther = parseFloat(parseFloat(rawValue).toFixed(4));

      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            {formattedEther} {balanceData.symbol}
          </div>
          
          {usdValueDisplay && (
            <div style={{ fontSize: '14px', color: '#555', fontWeight: 'normal' }}>
              ≈ {usdValueDisplay}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  const renderUsdcBalance = () => {
    if (!usdcAddress) {
      return <div style={{fontSize: '12px', color: '#94a3b8'}}>USDC not supported on this network</div>;
    }

    if (isUsdcLoading) return <div>Loading USDC...</div>;
    if (isUsdcError) return <div style={{ color: 'red' }}>Error loading USDC</div>;

    if (usdcData !== undefined) {
      const rawUsdc = formatUnits(usdcData, 6);
      const formattedUsdc = parseFloat(parseFloat(rawUsdc).toFixed(2));

      return (
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {(formattedUsdc)} USDC
        </div>
      );
    }
    return null;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setAmount('');
      return;
    }
    if (parseFloat(val) < 0) return;
    setAmount(val);
  };

  // SWAP
  const handleSwapSellChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setSwapSellAmount('');
      return;
    }
    if (parseFloat(val) < 0) return;
    setSwapSellAmount(val);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!to || !amount) return;

    if (tokenType === 'ETH') {
      sendTransaction({
        to: to as Address, 
        value: parseEther(amount), 
      });
    } else {
      if (!usdcAddress) {
        alert('USDC is not supported on this network');
        return;
      }
      writeTransfer({
        address: usdcAddress,
        abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
        functionName: 'transfer',
        args: [to as Address, parseUnits(amount, 6)], 
      });
    }
  };

  // --- НОВОЕ: Функция Обмена ETH -> USDC ---
  const handleSwap = () => {
    if (!usdcAddress || !address || !swapSellAmount) return;
    
    const amountInWei = parseEther(swapSellAmount);

    console.log("Swapping on Router:", SWAP_ROUTER_02_ADDRESS);

    writeSwap({
      address: SWAP_ROUTER_02_ADDRESS,
      abi: parseAbi([
        'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
        'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)'
      ]),
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: WETH_ADDRESS,
        tokenOut: usdcAddress,
        fee: 3000,
        recipient: address,
        amountIn: amountInWei,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      }],
      value: amountInWei, 
    });
  };

  const isSendPending = isEthPending || isUsdcPending;
  const isSendSuccess = isEthSuccess || isUsdcSuccess;
  const txHash = ethHash || usdcHash;
  const txError = ethError || usdcError;
  const stepAmount = tokenType === 'ETH' ? '0.000000000000000001' : '0.000001';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '24px',
      fontFamily: 'sans-serif',
      marginTop: '15px'
    }}>

      <h1>My Web3 Wallet</h1>

      <ConnectButton />

      <div style={{
        padding: '20px',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        backgroundColor: '#f8fafc',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        marginBottom: '15px'
      }}>
        {isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, color: '#16a34a' }}>✅ Connected</h3>
            
            <div style={{ textAlign: 'left', color: '#3c3c3d' }}>
              <strong>Address:</strong>
              <div style={{ 
                background: '#bababeff', 
                padding: '10px', 
                border: '1px solid #3c3c3d',
                borderRadius: '6px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '14px',
                marginTop: '4px'
              }}>
                {address}
              </div>
            </div>

            <div style={{ textAlign: 'left', color: '#3c3c3d' }}>
               <strong>Balance:</strong>
               <div style={{
                 marginTop: '4px',
                 marginBottom: '15px',
                 padding: '10px',
                 background: '#bababeff',
                 border: '1px solid #3c3c3d',
                 borderRadius: '6px'
               }}>
                 {renderEthBalance()}
               </div>
            </div>

              <div style={{ textAlign: 'left', color: '#3c3c3d' }}>
               <strong>USDC Balance:</strong>
               <div style={{
                 marginTop: '4px',
                 padding: '10px',
                 marginBottom: '20px',
                 background: '#bababeff',
                 border: '1px solid #3c3c3d',
                 borderRadius: '6px'
               }}>
                 {renderUsdcBalance()}
               </div>
            </div>

            {/* SEND SECTION */}
            <div style={{
              background: '#bababeff', padding: '10px', borderRadius: '16px',
              border: '1px solid #3c3c3d',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
             <h2 style={{ marginTop: 0, fontSize: '20px', borderBottom: '1px solid #3c3c3d', paddingBottom: '10px', marginBottom: '10px', color: '#3c3c3d' }}>
              💸 Send Assets
            </h2>

            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#3c3c3d' }}>Asset</label>
                <select 
                  value={tokenType}
                  onChange={(e) => setTokenType(e.target.value as 'ETH' | 'USDC')}
                  disabled={isSendPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #3c3c3d', boxSizing: 'border-box' }}
                >
                  <option value="ETH">ETH</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#3c3c3d' }}>Recipient</label>
                <input 
                  placeholder="0x..." 
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={isSendPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #3c3c3d', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#3c3c3d' }}>Amount ({tokenType})</label>
                <input 
                  type="number" 
                  min="0"
                  step={stepAmount}
                  placeholder="0.01" 
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={isSendPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #3c3c3d', boxSizing: 'border-box' }}
                />
              </div>

              {inputUsdValue && tokenType === 'ETH' && (
                      <div style={{ textAlign: 'right', fontSize: '12px', color: '#555', marginTop: '4px', fontWeight: '500' }}>
                        ≈ {inputUsdValue}
                      </div>
                    )}

              <button 
                type="submit" 
                disabled={isSendPending || !to || !amount}
                style={{
                  background: isSendPending ? '#94a3b8' : '#3b82f6', color: 'white', padding: '12px',
                  borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: isSendPending ? 'not-allowed' : 'pointer',
                  marginTop: '10px'
                }}
              >
                {isSendPending ? 'Confirming...' : `Send ${tokenType}`}
              </button>
            </form>

             {isSendSuccess && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '14px' }}>
                ✅ <strong>Sent!</strong><br/>
                <span style={{ fontSize: '12px', wordBreak: 'break-all' }}>Hash: {txHash}</span>
              </div>
            )}

            {txError && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
                ❌ Error: {(txError as BaseError).shortMessage || txError.message}
              </div>
            )}
            </div>

            {/* SWAP SECTION */}
            <div style={{
              background: '#bababeff', padding: '10px', borderRadius: '16px',
              border: '1px solid #3c3c3d',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              marginTop: '10px'
            }}>
              <h2 style={{ marginTop: 0, fontSize: '20px', borderBottom: '1px solid #3c3c3d', paddingBottom: '10px', marginBottom: '15px', color: '#3c3c3d' }}>
                🔄 Swap Assets
              </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

               {/* Sell Input Card */}
              <div style={{
                  background: '#f1f5f9',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #3c3c3d'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Sell Amount</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="number"
                      placeholder="0.0"
                      value={swapSellAmount}
                      onChange={handleSwapSellChange}
                      style={{ 
                        flex: 1, 
                        background: 'transparent', 
                        border: 'none', 
                        fontSize: '24px', 
                        outline: 'none',
                        color: '#333',
                        width: '100%'
                      }}
                    />
                    <div style={{ 
                      background: '#fff', 
                      padding: '4px 8px', 
                      borderRadius: '16px', 
                      border: '1px solid #cbd5e1', 
                      fontWeight: 'bold', 
                      fontSize: '14px' 
                    }}>
                      ETH
                    </div>
                  </div>
                </div>

                {/* Arrow Separator */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '-5px 0' }}>
                  <div style={{ 
                    background: '#f8fafc', 
                    borderRadius: '50%', 
                    padding: '4px', 
                    border: '1px solid #cbd5e1',
                    zIndex: 1
                  }}>
                    ⬇️
                  </div>
                </div>

                {/* Buy Input Card (Auto-filled) */}
                <div style={{
                  background: '#f1f5f9',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #3c3c3d'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                     <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Buy Amount</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="text"
                      placeholder="Calculating..."
                      value={buyAmountDisplay} 
                      disabled
                      style={{ 
                        flex: 1, 
                        background: 'transparent', 
                        border: 'none', 
                        fontSize: '24px', 
                        outline: 'none',
                        color: isQuoteLoading ? '#94a3b8' : '#333',
                        width: '100%'
                      }}
                    />
                     <div style={{ 
                      background: '#fff', 
                      padding: '4px 8px', 
                      borderRadius: '16px', 
                      border: '1px solid #cbd5e1', 
                      fontWeight: 'bold', 
                      fontSize: '14px' 
                    }}>
                      USDC
                    </div>
                  </div>
                </div>

                <button 
                onClick={handleSwap}
                  disabled={!swapSellAmount || isSwapPending || isQuoteLoading}
                  style={{
                    width: '100%',
                    background: isSwapPending ? '#94a3b8' : '#ec4899', 
                    color: 'white', 
                    padding: '16px',
                    borderRadius: '16px', 
                    border: 'none', 
                    fontWeight: 'bold', 
                    fontSize: '18px',
                    cursor: (!swapSellAmount || isSwapPending || isQuoteLoading) ? 'not-allowed' : 'pointer',
                    marginTop: '5px',
                    opacity: (!swapSellAmount || isSwapPending || isQuoteLoading) ? 0.7 : 1
                  }}
                >
                  {isSwapPending ? 'Swapping...' : 'Swap'}
                </button>

                {isSwapSuccess && (
                  <div style={{ marginTop: '15px', padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '14px' }}>
                    ✅ <strong>Swapped!</strong><br/>
                    <span style={{ fontSize: '12px', wordBreak: 'break-all' }}>Hash: {swapHash}</span>
                  </div>
                )}

                {swapError && (
                  <div style={{ marginTop: '15px', padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
                    ❌ Error: {(swapError as BaseError).shortMessage || swapError.message}
                  </div>
                )}

              </div>
            </div>

            <div style={{ textAlign: 'left', marginTop: '10px' }}>
              <strong>Chain ID:</strong> {chainId}
            </div>
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>❌ Disconnected</h3>
            <p style={{ margin: 0 }}>
              Address and Chain ID are unavailable. <br />
              Please click the Connect Wallet button.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;