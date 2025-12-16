import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useReadContract, useSendTransaction, useWriteContract, useChainId } from 'wagmi';
import { formatUnits, parseAbi, parseEther, parseUnits, type Address, type BaseError } from 'viem';
import { useSwap } from './hooks/useSwap'; // Импорт нашего хука

// --- CONSTANTS ---
const USDC_ADDRESSES: Record<number, Address> = {
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
};

// --- HELPER HOOK: ETH Price ---
const useEthPrice = () => {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        setPrice(data.ethereum.usd);
      } catch (error) { console.error('Error fetching ETH price:', error); }
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
  const ethPrice = useEthPrice();

  // --- SEND STATE ---
  const [sendTokenType, setSendTokenType] = useState<'ETH' | 'USDC'>('ETH');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');

  // --- SWAP HOOK (Вся логика обмена тут) ---
  const {
    sellAmount, setSellAmount, buyAmount, isEthToUsdc, symbolIn, symbolOut,
    allowance, amountInWei, isApproving, isSwapping, isSuccess: isSwapSuccess,
    txHash: swapTxHash, error: swapError, toggleDirection, handleApprove, handleSwap
  } = useSwap(address);

  // --- HOOKS: Balance & Send ---
  const { data: balanceData, isLoading: isBalanceLoading, isError: isBalanceError } = useBalance({ address });
  
  const { data: usdcData, isLoading: isUsdcLoading, isError: isUsdcError } = useReadContract({
    address: usdcAddress,
    abi: parseAbi(['function balanceOf(address account) view returns (uint256)']),
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!usdcAddress }
  });

  const { 
    data: ethHash, isPending: isEthPending, isSuccess: isEthSuccess, 
    sendTransaction, error: ethError 
  } = useSendTransaction();

  const { 
    data: usdcHash, isPending: isUsdcPending, isSuccess: isUsdcSuccess, 
    writeContract: writeTransfer, error: usdcError 
  } = useWriteContract();

  // --- HELPERS: Display ---
  let usdValueDisplay = '';
  if (balanceData && ethPrice) {
    const ethAmount = parseFloat(formatUnits(balanceData.value, balanceData.decimals));
    usdValueDisplay = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ethAmount * ethPrice);
  }

  let inputUsdValue = '';
  if (sendAmount && ethPrice && sendTokenType === 'ETH') {
    const amountNum = parseFloat(sendAmount);
    if (!isNaN(amountNum)) {
      inputUsdValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountNum * ethPrice);
    }
  }

  // --- HANDLERS: Send ---
  const handleSendAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') { setSendAmount(''); return; }
    if (parseFloat(val) < 0) return;
    setSendAmount(val);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendTo || !sendAmount) return;

    if (sendTokenType === 'ETH') {
      sendTransaction({ to: sendTo as Address, value: parseEther(sendAmount) });
    } else {
      if (!usdcAddress) { alert('USDC not supported'); return; }
      writeTransfer({
        address: usdcAddress,
        abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
        functionName: 'transfer',
        args: [sendTo as Address, parseUnits(sendAmount, 6)], 
      });
    }
  };

  // --- RENDER HELPERS ---
  const renderEthBalance = () => {
    if (isBalanceLoading) return <div>Loading...</div>;
    if (isBalanceError) return <div style={{ color: 'red' }}>Error</div>;
    if (balanceData) {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            {parseFloat(formatUnits(balanceData.value, 18)).toFixed(4)} {balanceData.symbol}
          </div>
          {usdValueDisplay && <div style={{ fontSize: '14px', color: '#555' }}>≈ {usdValueDisplay}</div>}
        </div>
      );
    }
    return null;
  };

  const renderUsdcBalance = () => {
    if (!usdcAddress) return <div style={{fontSize: '12px', color: '#94a3b8'}}>USDC not supported</div>;
    if (isUsdcLoading) return <div>Loading...</div>;
    if (isUsdcError) return <div style={{ color: 'red' }}>Error</div>;
    if (usdcData !== undefined) {
      return <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{parseFloat(formatUnits(usdcData, 6)).toFixed(2)} USDC</div>;
    }
    return null;
  };

  // Для отображения баланса в поле Swap
  const getSwapSellBalance = () => {
    if (isEthToUsdc) return balanceData ? parseFloat(formatUnits(balanceData.value, 18)).toFixed(4) : '0';
    return usdcData ? parseFloat(formatUnits(usdcData, 6)).toFixed(2) : '0';
  };

  const isSendPending = isEthPending || isUsdcPending;
  const isSendSuccess = isEthSuccess || isUsdcSuccess;
  const sendTxHash = ethHash || usdcHash;
  const sendError = ethError || usdcError;
  const stepAmount = sendTokenType === 'ETH' ? '0.000000000000000001' : '0.000001';

  // Логика кнопки Swap
  const isApproveNeeded = !isEthToUsdc && amountInWei > 0n && allowance < amountInWei;
  const isSwapLoading = isApproving || isSwapping;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', gap: '24px', fontFamily: 'sans-serif', marginTop: '15px'
    }}>

      <h1>My Web3 Wallet</h1>
      <ConnectButton />

      <div style={{
        padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px',
        backgroundColor: '#f8fafc', width: '100%', maxWidth: '400px',
        textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '15px'
      }}>
        {isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, color: '#16a34a' }}>✅ Connected</h3>
            
            <div style={{ textAlign: 'left', color: '#3c3c3d' }}>
              <strong>Address:</strong>
              <div style={{ 
                background: '#bababeff', padding: '10px', border: '1px solid #3c3c3d',
                borderRadius: '6px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '14px', marginTop: '4px'
              }}>
                {address}
              </div>
            </div>

            <div style={{ textAlign: 'left', color: '#3c3c3d' }}>
               <strong>Balance:</strong>
               <div style={{ marginTop: '4px', marginBottom: '15px', padding: '10px', background: '#bababeff', border: '1px solid #3c3c3d', borderRadius: '6px' }}>
                 {renderEthBalance()}
               </div>
            </div>

            <div style={{ textAlign: 'left', color: '#3c3c3d' }}>
               <strong>USDC Balance:</strong>
               <div style={{ marginTop: '4px', padding: '10px', marginBottom: '20px', background: '#bababeff', border: '1px solid #3c3c3d', borderRadius: '6px' }}>
                 {renderUsdcBalance()}
               </div>
            </div>

            {/* --- SEND SECTION --- */}
            <div style={{
              background: '#bababeff', padding: '10px', borderRadius: '16px',
              border: '1px solid #3c3c3d', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
             <h2 style={{ marginTop: 0, fontSize: '20px', borderBottom: '1px solid #3c3c3d', paddingBottom: '10px', marginBottom: '10px', color: '#3c3c3d' }}>
              💸 Send Assets
            </h2>
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#3c3c3d' }}>Asset</label>
                <select 
                  value={sendTokenType}
                  onChange={(e) => setSendTokenType(e.target.value as 'ETH' | 'USDC')}
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
                  placeholder="0x..." value={sendTo} onChange={(e) => setSendTo(e.target.value)} disabled={isSendPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #3c3c3d', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#3c3c3d' }}>Amount</label>
                <input 
                  type="number" min="0" step={stepAmount} placeholder="0.01" 
                  value={sendAmount} onChange={handleSendAmountChange} disabled={isSendPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #3c3c3d', boxSizing: 'border-box' }}
                />
              </div>
              {inputUsdValue && sendTokenType === 'ETH' && (
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#555', marginTop: '4px', fontWeight: '500' }}>≈ {inputUsdValue}</div>
              )}
              <button 
                type="submit" disabled={isSendPending || !sendTo || !sendAmount}
                style={{
                  background: isSendPending ? '#94a3b8' : '#3b82f6', color: 'white', padding: '12px',
                  borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: isSendPending ? 'not-allowed' : 'pointer', marginTop: '10px'
                }}
              >
                {isSendPending ? 'Confirming...' : `Send ${sendTokenType}`}
              </button>
            </form>
             {isSendSuccess && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '14px' }}>
                ✅ <strong>Sent!</strong><br/><span style={{ fontSize: '12px', wordBreak: 'break-all' }}>Hash: {sendTxHash}</span>
              </div>
            )}
            {sendError && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
                ❌ Error: {(sendError as BaseError).shortMessage || sendError.message}
              </div>
            )}
            </div>

            {/* --- SWAP SECTION (USING HOOK) --- */}
            <div style={{
              background: '#bababeff', padding: '10px', borderRadius: '16px',
              border: '1px solid #3c3c3d', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginTop: '10px'
            }}>
              <h2 style={{ marginTop: 0, fontSize: '20px', borderBottom: '1px solid #3c3c3d', paddingBottom: '10px', marginBottom: '15px', color: '#3c3c3d' }}>
                🔄 Swap Assets
              </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '12px', border: '1px solid #3c3c3d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Sell {symbolIn}</label>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Bal: {getSwapSellBalance()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="number" placeholder="0.0" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '24px', outline: 'none', color: '#333', width: '100%' }}
                    />
                    <div style={{ background: '#fff', padding: '4px 8px', borderRadius: '16px', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '14px' }}>{symbolIn}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '-5px 0' }}>
                  <button 
                    onClick={toggleDirection}
                    style={{ background: '#f8fafc', borderRadius: '50%', padding: '8px', border: '1px solid #cbd5e1', zIndex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
                  >⇅</button>
                </div>

                <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '12px', border: '1px solid #3c3c3d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                     <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Buy {symbolOut}</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="text" placeholder="Calculating..." value={buyAmount} disabled
                      style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '24px', outline: 'none', color: '#333', width: '100%' }}
                    />
                     <div style={{ background: '#fff', padding: '4px 8px', borderRadius: '16px', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '14px' }}>{symbolOut}</div>
                  </div>
                </div>

                <button 
                  onClick={isApproveNeeded ? handleApprove : handleSwap}
                  disabled={!sellAmount || isSwapLoading}
                  style={{
                    width: '100%',
                    background: isSwapLoading ? '#94a3b8' : (isApproveNeeded ? '#f59e0b' : '#ec4899'), 
                    color: 'white', padding: '16px', borderRadius: '16px', border: 'none', 
                    fontWeight: 'bold', fontSize: '18px',
                    cursor: (!sellAmount || isSwapLoading) ? 'not-allowed' : 'pointer',
                    marginTop: '5px', opacity: (!sellAmount || isSwapLoading) ? 0.7 : 1
                  }}
                >
                  {isSwapLoading 
                    ? (isApproving ? 'Approving...' : 'Swapping...') 
                    : (isApproveNeeded ? `Approve ${symbolIn}` : `Swap ${symbolIn} -> ${symbolOut}`)
                  }
                </button>

                {isSwapSuccess && (
                  <div style={{ marginTop: '15px', padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '14px' }}>
                    ✅ <strong>Swapped!</strong><br/><span style={{ fontSize: '12px', wordBreak: 'break-all' }}>Hash: {swapTxHash}</span>
                  </div>
                )}
                {swapError && (
                  <div style={{ marginTop: '15px', padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
                    ❌ Error: {(swapError as BaseError).shortMessage || swapError.message}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ textAlign: 'left', marginTop: '10px' }}><strong>Chain ID:</strong> {chainId}</div>
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>❌ Disconnected</h3>
            <p>Please connect wallet</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;