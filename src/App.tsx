import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useReadContract, useSendTransaction, useChainId } from 'wagmi';
import { formatUnits, parseAbi, parseEther, type Address, type BaseError } from 'viem';

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
        console.error('Ошибка получения цены ETH:', error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  return price;
};

const USDC_ADDRESSES: Record<number, Address> = {
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', 
};

function App() {
  const { address, isConnected } = useAccount();

   const chainId = useChainId();

  const usdcAddress = USDC_ADDRESSES[chainId];

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');

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
  if (amount && ethPrice) {
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

  const { 
    data: txHash, 
    isPending, 
    isSuccess, 
    sendTransaction, 
    error: txError 
  } = useSendTransaction();

  const renderEthBalance = () => {
    if (isBalanceLoading) return <div>Загрузка баланса...</div>;
    if (isBalanceError) return <div style={{ color: 'red' }}>Ошибка получения баланса</div>;

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
      return <div style={{fontSize: '12px', color: '#94a3b8'}}>USDC не поддерживается в этой сети</div>;
    }

    if (isUsdcLoading) return <div>Загрузка USDC...</div>;
    if (isUsdcError) return <div style={{ color: 'red' }}>Ошибка USDC</div>;

    if (usdcData !== undefined) {
      const rawUsdc = formatUnits(usdcData, 6);
      const formattedUsdc= parseFloat(parseFloat(rawUsdc).toFixed(2));

      return (
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {(formattedUsdc)} USDC
        </div>
      );
    }
    return null;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!to || !amount) return;

    sendTransaction({
      to: to as Address, 
      value: parseEther(amount), 
    });
  };

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
      <h1>Мой Web3-кошелек</h1>

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

            <div style={{
              background: '#bababeff', padding: '10px', borderRadius: '16px',
              border: '1px solid #3c3c3d',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
             <h2 style={{ marginTop: 0, fontSize: '20px', borderBottom: '1px solid #3c3c3d', paddingBottom: '10px', marginBottom: '10px', color: '#3c3c3d' }}>
              💸 Отправить ETH
            </h2>

            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#3c3c3d' }}>Получатель</label>
                <input 
                  placeholder="0x..." 
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={isPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #3c3c3d', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#3c3c3d' }}>Сумма (ETH)</label>
                <input 
                  type="number" 
                  step="0.0001"
                  placeholder="0.01" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #3c3c3d', boxSizing: 'border-box' }}
                />
              </div>

              {inputUsdValue && (
                      <div style={{ textAlign: 'right', fontSize: '12px', color: '#555', marginTop: '4px', fontWeight: '500' }}>
                        ≈ {inputUsdValue}
                      </div>
                    )}

              <button 
                type="submit" 
                disabled={isPending || !to || !amount}
                style={{
                  background: isPending ? '#94a3b8' : '#3b82f6', color: 'white', padding: '12px',
                  borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: isPending ? 'not-allowed' : 'pointer',
                  marginTop: '10px'
                }}
              >
                {isPending ? 'Подтверждение в кошельке...' : 'Отправить'}
              </button>
            </form>

             {isSuccess && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '14px' }}>
                ✅ <strong>Отправлено!</strong><br/>
                <span style={{ fontSize: '12px', wordBreak: 'break-all' }}>Hash: {txHash}</span>
              </div>
            )}

            {txError && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
                ❌ Ошибка: {(txError as BaseError).shortMessage || txError.message}
              </div>
            )}

            </div>
            
            <div style={{ textAlign: 'left' }}>
              <strong>Chain ID:</strong> {chainId}
            </div>
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>❌ Disconnected</h3>
            <p style={{ margin: 0 }}>
              Адрес и Chain ID недоступны. <br />
              Пожалуйста, нажмите кнопку Connect Wallet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;