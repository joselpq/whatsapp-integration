import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

// Type definitions for Pluggy Connect
interface PluggyConnectProps {
  connectToken: string;
  onSuccess: (itemData: any) => void;
  onError: (error: any) => void;
  includeSandbox?: boolean;
}

// Mock PluggyConnect component since the real package might have issues
const PluggyConnect: React.FC<PluggyConnectProps> = ({ 
  connectToken, 
  onSuccess, 
  onError, 
  includeSandbox = true 
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnectBank = () => {
    setIsLoading(true);
    
    // Simulate bank connection process
    setTimeout(() => {
      setIsLoading(false);
      // Mock successful connection
      onSuccess({
        itemId: 'mock-item-id-12345',
        connectorId: 200,
        connectorName: 'MeuPluggy',
        status: 'UPDATED',
        message: 'Bank connection successful!'
      });
    }, 3000);
  };

  const handleError = () => {
    onError({
      message: 'Connection failed - simulated error',
      code: 'MOCK_ERROR'
    });
  };

  return (
    <div style={{ 
      border: '2px dashed #ccc', 
      padding: '40px', 
      textAlign: 'center',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h3>🏦 Mock Pluggy Connect Widget</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Connect Token: {connectToken.substring(0, 20)}...
      </p>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Sandbox Mode: {includeSandbox ? 'Enabled' : 'Disabled'}
      </p>
      
      {isLoading ? (
        <div>
          <p>🔄 Connecting to bank...</p>
          <div style={{ 
            width: '100%', 
            height: '4px', 
            backgroundColor: '#e0e0e0',
            borderRadius: '2px',
            marginTop: '10px'
          }}>
            <div style={{
              width: '30%',
              height: '100%',
              backgroundColor: '#4CAF50',
              borderRadius: '2px',
              animation: 'progress 2s infinite'
            }} />
          </div>
        </div>
      ) : (
        <div>
          <button 
            onClick={handleConnectBank}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              marginRight: '10px'
            }}
          >
            🎯 Connect Bank (Success)
          </button>
          
          <button 
            onClick={handleError}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ❌ Test Error
          </button>
        </div>
      )}
      
      <p style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>
        This is a mock widget for testing. Replace with real PluggyConnect component.
      </p>
    </div>
  );
};

interface ConnectTokenData {
  connectToken: string;
  clientUserId: string;
  expiresAt: string;
  webhookUrl: string;
}

function App() {
  const [phoneNumber, setPhoneNumber] = useState('+5511999999999');
  const [connectTokenData, setConnectTokenData] = useState<ConnectTokenData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const API_URL = process.env.REACT_APP_API_URL || 'https://whatsapp-integration-production-06bb.up.railway.app';

  const createToken = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('🔗 Creating connect token for:', phoneNumber);
      
      const response = await axios.post(`${API_URL}/api/pluggy-v2/connect-token`, {
        phoneNumber: phoneNumber.trim(),
        includeSandbox: true // Enable sandbox for testing
      });

      console.log('✅ Token created:', response.data);
      setConnectTokenData(response.data.data);
      
    } catch (error: any) {
      console.error('❌ Token creation failed:', error);
      setError(error.response?.data?.error || error.message || 'Failed to create connect token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = (itemData: any) => {
    console.log('🎉 Connection successful:', itemData);
    setConnectionResult({
      type: 'success',
      data: itemData,
      message: 'Bank connection successful! You can now access your financial data.'
    });
  };

  const handleError = (error: any) => {
    console.error('❌ Connection error:', error);
    setConnectionResult({
      type: 'error',
      data: error,
      message: 'Failed to connect to bank. Please try again.'
    });
  };

  const resetFlow = () => {
    setConnectTokenData(null);
    setConnectionResult(null);
    setError('');
  };

  const fetchUserData = async () => {
    if (!connectTokenData) return;
    
    try {
      console.log('📊 Fetching user financial data...');
      
      const response = await axios.get(
        `${API_URL}/api/pluggy-v2/user/${connectTokenData.clientUserId}/financial-data`
      );
      
      console.log('✅ User data:', response.data);
      alert(`Found ${response.data.data?.summary?.totalAccounts || 0} accounts and ${response.data.data?.summary?.totalTransactions || 0} transactions`);
      
    } catch (error: any) {
      console.error('❌ Failed to fetch user data:', error);
      alert('No financial data found yet. The connection might still be processing.');
    }
  };

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1>🏦 Pluggy Banking Connection Widget</h1>
        <p style={{ color: '#666' }}>
          Connect your bank account securely using Open Finance
        </p>
      </header>

      {/* Connection Status */}
      {connectionResult && (
        <div style={{
          padding: '20px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: connectionResult.type === 'success' ? '#e8f5e8' : '#ffebee',
          border: `2px solid ${connectionResult.type === 'success' ? '#4CAF50' : '#f44336'}`
        }}>
          <h3>{connectionResult.type === 'success' ? '🎉 Success!' : '❌ Error'}</h3>
          <p>{connectionResult.message}</p>
          <details style={{ marginTop: '10px' }}>
            <summary>Technical Details</summary>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {JSON.stringify(connectionResult.data, null, 2)}
            </pre>
          </details>
          
          <div style={{ marginTop: '15px' }}>
            <button 
              onClick={fetchUserData}
              style={{
                backgroundColor: '#2196F3',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              📊 Check Financial Data
            </button>
            
            <button 
              onClick={resetFlow}
              style={{
                backgroundColor: '#666',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              🔄 Start Over
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '6px',
          color: '#d32f2f'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step 1: Phone Number Input */}
      {!connectTokenData && (
        <div style={{ 
          backgroundColor: '#f9f9f9',
          padding: '30px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2>📱 Step 1: Enter Your Phone Number</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            This will be used to identify your account and receive updates.
          </p>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+5511999999999"
              style={{
                flex: 1,
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            />
            
            <button 
              onClick={createToken}
              disabled={isLoading || !phoneNumber.trim()}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                opacity: isLoading || !phoneNumber.trim() ? 0.6 : 1
              }}
            >
              {isLoading ? '🔄 Creating...' : '🚀 Create Connect Token'}
            </button>
          </div>
          
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
            Token valid for 30 minutes • Sandbox mode enabled for testing
          </p>
        </div>
      )}

      {/* Step 2: Pluggy Widget */}
      {connectTokenData && !connectionResult && (
        <div style={{ 
          backgroundColor: '#f9f9f9',
          padding: '30px',
          borderRadius: '8px'
        }}>
          <h2>🏦 Step 2: Connect Your Bank</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Choose your bank and provide your credentials securely.
          </p>
          
          <div style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>
            <p><strong>Client User ID:</strong> {connectTokenData.clientUserId}</p>
            <p><strong>Token Expires:</strong> {new Date(connectTokenData.expiresAt).toLocaleString()}</p>
            <p><strong>Webhook URL:</strong> {connectTokenData.webhookUrl}</p>
          </div>

          <PluggyConnect
            connectToken={connectTokenData.connectToken}
            onSuccess={handleSuccess}
            onError={handleError}
            includeSandbox={true}
          />
        </div>
      )}

      {/* Instructions */}
      <div style={{ 
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <h3>📋 Instructions</h3>
        <ol style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Enter your phone number and click "Create Connect Token"</li>
          <li>Use the mock widget to simulate bank connection (click "Connect Bank")</li>
          <li>After successful connection, click "Check Financial Data" to verify the integration</li>
        </ol>
        
        <p style={{ marginTop: '15px', color: '#666' }}>
          <strong>Note:</strong> This is using a mock widget for demonstration. 
          Replace the PluggyConnect component with the real react-pluggy-connect package for production use.
        </p>
      </div>
    </div>
  );
}

export default App;
