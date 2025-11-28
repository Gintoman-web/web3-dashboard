import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useReadContract, useSendTransaction } from 'wagmi';
import { formatEther, formatUnits, parseAbi, parseEther, type Address, type BaseError } from 'viem';
import { sepolia } from 'wagmi/chains';

const USDT_ADDRESS = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';

function App() {
  const { address, isConnected, chainId } = useAccount();

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');

  const { 
    data: balanceData, 
    isLoading: isBalanceLoading, 
    isError: isBalanceError 
  } = useBalance({
    address: address,
  });

   const { 
    data: usdtData, 
    isLoading: isUsdtLoading, 
    isError: isUsdtError 
  } = useReadContract({
    address: USDT_ADDRESS,
    abi: parseAbi([
      'function balanceOf(address account) view returns (uint256)'
    ]),
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && chainId === sepolia.id,
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
      const rawEther = formatEther(balanceData.value);
      const formattedEther = parseFloat(parseFloat(rawEther).toFixed(4));

       return (
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {formattedEther} {balanceData.symbol}
        </div>
      );
    }
    
    return null;
  };
  const renderUsdtBalance = () => {
    if (chainId !== sepolia.id) {
      return <div style={{fontSize: '12px', color: '#94a3b8'}}>Переключитесь на Sepolia для просмотра USDT</div>;
    }

    if (isUsdtLoading) return <div>Загрузка USDT...</div>;
    if (isUsdtError) return <div style={{ color: 'red' }}>Ошибка USDT</div>;

    if (usdtData !== undefined) {

      const formattedUsdt = formatUnits(usdtData, 6);

      return (
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {parseFloat(formattedUsdt).toFixed(2)} USDT
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
            
            <div style={{ textAlign: 'left' }}>
              <strong>Address:</strong>
              <div style={{ 
                background: '#3c3c3d', 
                padding: '8px', 
                borderRadius: '6px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '14px',
                marginTop: '4px'
              }}>
                {address}
              </div>
            </div>

            <div style={{ textAlign: 'left' }}>
               <strong>Balance:</strong>
               <div style={{
                 marginTop: '4px',
                 padding: '10px',
                 background: '#3c3c3d',
                 border: '1px solid #cbd5e1',
                 borderRadius: '6px'
               }}>
                 {renderEthBalance()}
               </div>

             <div style={{ textAlign: 'left' }}>
               <strong>Sepolia USDT Balance:</strong>
               <div style={{
                 marginTop: '4px',
                 padding: '10px',
                 marginBottom: '20px',
                 background: '#3c3c3d',
                 border: '1px solid #cbd5e1',
                 borderRadius: '6px'
               }}>
                 {renderUsdtBalance()}
               </div>

            </div>

            <div style={{
            background: '#3c3c3d', padding: '24px', borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
             <h2 style={{ marginTop: 0, fontSize: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              💸 Отправить ETH
            </h2>

            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Получатель</label>
                <input 
                  placeholder="0x..." 
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={isPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Сумма (ETH)</label>
                <input 
                  type="number" 
                  step="0.000000000000000001"
                  placeholder="0.01" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isPending}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

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