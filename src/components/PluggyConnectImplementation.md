# Pluggy Connect Widget - Production Implementation Guide

## Overview
This guide shows how to implement the real Pluggy Connect widget in a React application.

## Installation

```bash
npm install react-pluggy-connect
```

## Basic Implementation

### 1. Create the Widget Component

```jsx
// PluggyConnectWidget.jsx
import React, { useState } from 'react';
import PluggyConnect from 'react-pluggy-connect';

function PluggyConnectWidget({ phoneNumber }) {
  const [connectToken, setConnectToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);

  // Get connect token from your backend
  const createConnectToken = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/pluggy-v2/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      
      const data = await response.json();
      if (data.success) {
        setConnectToken(data.data.connectToken);
      }
    } catch (error) {
      console.error('Failed to create token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful connection
  const handleSuccess = (itemData) => {
    console.log('Connection successful:', itemData);
    setConnectionResult({
      success: true,
      itemId: itemData.itemId,
      connector: itemData.connector
    });
    
    // Optionally sync data with your backend
    syncUserData(itemData.itemId);
  };

  // Handle connection errors
  const handleError = (error) => {
    console.error('Connection error:', error);
    setConnectionResult({
      success: false,
      error: error.message || 'Connection failed'
    });
  };

  // Handle widget events
  const handleEvent = (eventName, data) => {
    console.log('Widget event:', eventName, data);
    
    switch (eventName) {
      case 'OPEN':
        console.log('Widget opened');
        break;
      case 'CLOSE':
        console.log('Widget closed');
        break;
      case 'ERROR':
        console.log('Widget error:', data);
        break;
    }
  };

  return (
    <div>
      {!connectToken ? (
        <button onClick={createConnectToken} disabled={isLoading}>
          {isLoading ? 'Creating token...' : 'Start Connection'}
        </button>
      ) : (
        <PluggyConnect
          connectToken={connectToken}
          onSuccess={handleSuccess}
          onError={handleError}
          onEvent={handleEvent}
          includeSandbox={true}
          language="pt"
          theme="light"
        />
      )}
      
      {connectionResult && (
        <div className={connectionResult.success ? 'success' : 'error'}>
          {connectionResult.success 
            ? `✅ Connected to ${connectionResult.connector.name}`
            : `❌ Error: ${connectionResult.error}`
          }
        </div>
      )}
    </div>
  );
}

export default PluggyConnectWidget;
```

### 2. Using the Widget in Your App

```jsx
// App.jsx
import React from 'react';
import PluggyConnectWidget from './PluggyConnectWidget';

function App() {
  const userPhoneNumber = '+5511999999999';
  
  return (
    <div className="app">
      <h1>Connect Your Bank Account</h1>
      <PluggyConnectWidget phoneNumber={userPhoneNumber} />
    </div>
  );
}

export default App;
```

## Advanced Configuration

### Custom Styling

```jsx
<PluggyConnect
  connectToken={connectToken}
  onSuccess={handleSuccess}
  onError={handleError}
  // Customization options
  theme={{
    primaryColor: '#0066ff',
    borderRadius: '8px',
    fontSize: '16px'
  }}
  language="pt"
  includeSandbox={true}
  allowConnectInBackground={true}
  products={['ACCOUNTS', 'TRANSACTIONS', 'IDENTITY']}
  selectedConnectorId={123} // Pre-select a specific bank
/>
```

### Handling Specific Events

```jsx
const handleEvent = (eventName, data) => {
  switch (eventName) {
    case 'ITEM_UPDATING':
      // Show loading state
      setUpdating(true);
      break;
      
    case 'ITEM_UPDATED':
      // Item successfully updated
      setUpdating(false);
      fetchLatestData();
      break;
      
    case 'LOGIN_STEP':
      // User is entering credentials
      console.log('User at login step');
      break;
      
    case 'MFA_STEP':
      // Multi-factor authentication required
      console.log('MFA required');
      break;
      
    case 'CONNECTION_ERROR':
      // Handle specific connection errors
      handleConnectionError(data);
      break;
  }
};
```

## Integration with Backend

### 1. Store Connection Result

```javascript
// After successful connection
const syncUserData = async (itemId) => {
  try {
    await fetch(`/api/pluggy-v2/user/${userId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId })
    });
  } catch (error) {
    console.error('Sync failed:', error);
  }
};
```

### 2. Fetch User's Financial Data

```javascript
const fetchFinancialData = async () => {
  try {
    const response = await fetch(`/api/pluggy-v2/user/${userId}/financial-data`);
    const data = await response.json();
    
    if (data.success) {
      setAccounts(data.data.accounts);
      setTransactions(data.data.transactions);
    }
  } catch (error) {
    console.error('Failed to fetch data:', error);
  }
};
```

## Deployment Considerations

### Environment Variables
```env
REACT_APP_API_URL=https://your-api.com
REACT_APP_PLUGGY_ENV=production  # or sandbox
```

### Security Best Practices

1. **Never expose credentials in frontend**
   - Always generate connect tokens on backend
   - Keep CLIENT_ID and CLIENT_SECRET server-side only

2. **Validate webhook signatures**
   - Verify all webhook calls on your backend
   - Use Pluggy's webhook signature validation

3. **Handle token expiration**
   - Connect tokens expire after 30 minutes
   - Generate new tokens as needed

## Common Issues & Solutions

### Issue: Widget not appearing
**Solution**: Check that connectToken is valid and not expired

### Issue: CORS errors
**Solution**: Ensure your backend allows requests from your frontend domain

### Issue: Connection fails silently
**Solution**: Implement comprehensive error handling in onError callback

### Issue: Missing transactions
**Solution**: Check if correct products are requested in token creation

## Testing

### Sandbox Testing
```jsx
// Use sandbox institutions for testing
<PluggyConnect
  connectToken={connectToken}
  includeSandbox={true}  // Important for testing!
  onSuccess={handleSuccess}
/>
```

### Test Credentials (Sandbox)
- Bank: Pluggy Sandbox
- Username: user-test
- Password: 123456

## Support Resources

- [NPM Package](https://www.npmjs.com/package/react-pluggy-connect)
- [Pluggy Documentation](https://docs.pluggy.ai)
- [API Reference](https://docs.pluggy.ai/reference)

---

For vanilla JavaScript implementations, consider creating a small React app specifically for the Pluggy widget and embedding it as an iframe in your main application.