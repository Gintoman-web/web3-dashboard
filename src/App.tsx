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

  // --- SWAP HOOK ---
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

  // --- HELPERS ---
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

  const getSwapSellBalance = () => {
    if (isEthToUsdc) return balanceData ? parseFloat(formatUnits(balanceData.value, 18)).toFixed(4) : '0';
    return usdcData ? parseFloat(formatUnits(usdcData, 6)).toFixed(2) : '0';
  };

  const isSendPending = isEthPending || isUsdcPending;
  const isSendSuccess = isEthSuccess || isUsdcSuccess;
  const sendTxHash = ethHash || usdcHash;
  const sendError = ethError || usdcError;
  const stepAmount = sendTokenType === 'ETH' ? '0.000000000000000001' : '0.000001';

  const isApproveNeeded = !isEthToUsdc && amountInWei > 0n && allowance < amountInWei;
  const isSwapLoading = isApproving || isSwapping;

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

  return (<div className="app-container">

      <h1>My Web3 Wallet</h1>
      <ConnectButton />

      <div className="wallet-card">
        {isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="status-connected">✅ Connected</h3>
            
            <div className="info-row">
              <strong>Address:</strong>
              <div className="info-box address-text">{address}</div>
            </div>

            <div className="info-row">
               <strong>Balance:</strong>
               <div className="info-box">{renderEthBalance()}</div>
            </div>

            <div className="info-row">
               <strong>USDC Balance:</strong>
               <div className="info-box">{renderUsdcBalance()}</div>
            </div>

            {/* --- SEND SECTION --- */}
            <div className="action-section">
             <h2 className="section-title">💸 Send Assets</h2>
             
             <form onSubmit={handleSend}>
              <div className="form-group">
                <label className="input-label">Asset</label>
                <select 
                  className="styled-select"
                  value={sendTokenType}
                  onChange={(e) => setSendTokenType(e.target.value as 'ETH' | 'USDC')}
                  disabled={isSendPending}
                >
                  <option value="ETH">ETH</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
              <div className="form-group">
                <label className="input-label">Recipient</label>
                <input 
                  className="styled-input"
                  placeholder="0x..." value={sendTo} onChange={(e) => setSendTo(e.target.value)} disabled={isSendPending}
                />
              </div>
              <div className="form-group">
                <label className="input-label">Amount</label>
                <input 
                  className="styled-input"
                  type="number" min="0" step={stepAmount} placeholder="0.01" 
                  value={sendAmount} onChange={handleSendAmountChange} disabled={isSendPending}
                />
              </div>
              
              {inputUsdValue && sendTokenType === 'ETH' && (
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#555', marginTop: '4px', fontWeight: '500' }}>≈ {inputUsdValue}</div>
              )}

              <button 
                type="submit" 
                disabled={isSendPending || !sendTo || !sendAmount}
                className={`btn-primary btn-blue ${isSendPending ? 'btn-disabled' : ''}`}
              >
                {isSendPending ? 'Confirming...' : `Send ${sendTokenType}`}
              </button>
            </form>

             {isSendSuccess && (
              <div className="msg-box msg-success">
                ✅ <strong>Sent!</strong><br/><span style={{ fontSize: '12px', wordBreak: 'break-all' }}>Hash: {sendTxHash}</span>
              </div>
            )}
            {sendError && (
              <div className="msg-box msg-error">
                ❌ Error: {(sendError as BaseError).shortMessage || sendError.message}
              </div>
            )}
            </div>

            {/* --- SWAP SECTION --- */}
            <div className="action-section">
              <h2 className="section-title">🔄 Swap Assets</h2>
            
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Sell Input */}
                <div className="swap-input-card">
                  <div className="swap-header">
                    <label className="input-label">Sell {symbolIn}</label>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Bal: {getSwapSellBalance()}</span>
                  </div>
                  <div className="swap-row">
                    <input 
                      className="big-input"
                      type="number" placeholder="0.0" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)}
                    />
                    <div className="token-badge">{symbolIn}</div>
                  </div>
                </div>

                {/* Toggle Button */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '-5px 0' }}>
                  <button onClick={toggleDirection} className="btn-toggle">⇅</button>
                </div>

                {/* Buy Input */}
                <div className="swap-input-card">
                  <div className="swap-header">
                     <label className="input-label">Buy {symbolOut}</label>
                  </div>
                  <div className="swap-row">
                    <input 
                      className="big-input"
                      type="text" placeholder="Calculating..." value={buyAmount} disabled
                    />
                     <div className="token-badge">{symbolOut}</div>
                  </div>
                </div>

                {/* Main Action Button */}
                <button 
                  onClick={isApproveNeeded ? handleApprove : handleSwap}
                  disabled={!sellAmount || isSwapLoading}
                  className={`btn-primary btn-large ${
                    isSwapLoading ? 'btn-disabled' : (isApproveNeeded ? 'btn-yellow' : 'btn-pink')
                  }`}
                >
                  {isSwapLoading && <span className="animate-spin">⏳</span>} 
                  
                  {isSwapLoading 
                    ? (isApproving ? 'Approving...' : 'Swapping...') 
                    : (isApproveNeeded ? `Approve ${symbolIn}` : `Swap ${symbolIn} -> ${symbolOut}`)
                  }
                </button>

                {/* Success Link */}
                {isSwapSuccess && swapTxHash && (
                  <a 
                    href={`https://sepolia.etherscan.io/tx/${swapTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="etherscan-link"
                  >
                    <div>✅ <strong>Transaction Successful!</strong></div>
                    <div style={{ textDecoration: 'underline', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      View on Etherscan ↗
                    </div>
                  </a>
                )}

                {/* Error Msg */}
                {swapError && (
                  <div className="msg-box msg-error">
                    ❌ Error: {(swapError as BaseError).shortMessage || swapError.message}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ textAlign: 'left', marginTop: '10px' }}><strong>Chain ID:</strong> {chainId}</div>
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>
            <h3 className="status-disconnected">❌ Disconnected</h3>
            <p>Please connect wallet</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;