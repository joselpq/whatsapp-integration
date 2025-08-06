#!/usr/bin/env node

/**
 * Comprehensive Pluggy Integration Test Script - PRODUCTION
 * Tests the complete end-to-end flow against Railway deployment
 * 
 * This script tests:
 * 1. API Health and connectivity
 * 2. Connect token generation
 * 3. Database-driven user discovery
 * 4. Financial data retrieval
 * 5. Webhook processing verification
 */

const axios = require('axios');
const readline = require('readline');

// Production configuration
const BASE_URL = 'https://whatsapp-integration-production-06bb.up.railway.app';
const TEST_PHONE = '+5511976196165'; // Your test phone number

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Helper functions
const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.magenta}▶ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  data: (label, data) => {
    console.log(`${colors.bright}${label}:${colors.reset}`);
    console.log(JSON.stringify(data, null, 2));
  }
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question}${colors.reset}`, (answer) => {
      resolve(answer);
    });
  });
};

// Test functions
async function testAPIHealth() {
  log.section('Testing API Health');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/pluggy-v2/health`);
    const { data } = response;
    
    if (data.status === 'healthy' && data.pluggyConnection) {
      log.success('API is healthy and Pluggy connection is active');
      log.data('Health Check Details', data.details);
      return true;
    } else {
      log.error('API health check failed');
      log.data('Response', data);
      return false;
    }
  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testConnectors() {
  log.section('Testing Bank Connectors');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/pluggy-v2/connectors`);
    const { data } = response;
    
    if (data.success && data.count > 0) {
      log.success(`Found ${data.count} available bank connectors`);
      
      // Show some popular banks
      const popularBanks = data.data.filter(bank => 
        ['Nubank', 'Bradesco', 'Itaú', 'Santander', 'Banco do Brasil'].some(name => 
          bank.name.includes(name)
        )
      ).slice(0, 5);
      
      console.log('\nPopular Banks Available:');
      popularBanks.forEach(bank => {
        console.log(`  • ${bank.name} (${bank.type})`);
      });
      
      return true;
    } else {
      log.error('No connectors found');
      return false;
    }
  } catch (error) {
    log.error(`Connectors test failed: ${error.message}`);
    return false;
  }
}

async function testConnectToken(phoneNumber) {
  log.section('Testing Connect Token Generation');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/pluggy-v2/connect-token`, {
      phoneNumber: phoneNumber,
      includeSandbox: true
    });
    
    const { data } = response;
    
    if (data.success && data.data.connectToken) {
      log.success('Connect token generated successfully');
      log.info(`Token expires at: ${new Date(data.data.expiresAt).toLocaleString()}`);
      log.info(`Webhook URL: ${data.data.webhookUrl}`);
      
      // Save token for later use
      return data.data.connectToken;
    } else {
      log.error('Token generation failed');
      log.data('Response', data);
      return null;
    }
  } catch (error) {
    log.error(`Token generation failed: ${error.message}`);
    if (error.response) {
      log.data('Error Response', error.response.data);
    }
    return null;
  }
}

async function testUserItems(phoneNumber) {
  log.section('Testing Database User Discovery');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/pluggy-v2/users/${encodeURIComponent(phoneNumber)}/items`);
    const { data } = response;
    
    if (data.success) {
      if (data.data.totalItems > 0) {
        log.success(`Found ${data.data.totalItems} connected bank(s) for ${phoneNumber}`);
        
        data.data.items.forEach((item, index) => {
          console.log(`\n  Bank ${index + 1}:`);
          console.log(`    • Item ID: ${item.itemId}`);
          console.log(`    • Bank: ${item.connectorName}`);
          console.log(`    • Status: ${item.status}`);
          console.log(`    • Connected: ${new Date(item.createdAt).toLocaleString()}`);
        });
        
        return data.data.items;
      } else {
        log.warning(`No connected banks found for ${phoneNumber}`);
        log.info('You need to connect a bank account first using the widget');
        return [];
      }
    } else {
      log.error('User items lookup failed');
      log.data('Response', data);
      return [];
    }
  } catch (error) {
    if (error.response?.status === 404) {
      log.warning(`User ${phoneNumber} not found in database`);
      log.info('This user needs to connect a bank account first');
    } else {
      log.error(`User items lookup failed: ${error.message}`);
      if (error.response) {
        log.data('Error Response', error.response.data);
      }
    }
    return [];
  }
}

async function testFinancialData(phoneNumber, live = false) {
  log.section(`Testing Financial Data Retrieval (${live ? 'LIVE' : 'DATABASE'})`);
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/pluggy-v2/users/${encodeURIComponent(phoneNumber)}/financial-data?live=${live}`
    );
    const { data } = response;
    
    if (data.success) {
      const summary = data.data.summary || {};
      
      if (summary.totalAccounts > 0 || data.data.accounts?.length > 0) {
        log.success('Financial data retrieved successfully');
        console.log(`\n  Summary:`);
        console.log(`    • Source: ${data.data.source}`);
        console.log(`    • Total Items: ${summary.totalItems || data.data.items?.length || 0}`);
        console.log(`    • Total Accounts: ${summary.totalAccounts || data.data.accounts?.length || 0}`);
        console.log(`    • Total Transactions: ${summary.totalTransactions || data.data.transactions?.length || 0}`);
        
        if (data.data.accounts && data.data.accounts.length > 0) {
          console.log(`\n  Accounts:`);
          data.data.accounts.forEach(account => {
            console.log(`    • ${account.name}: ${account.currencyCode || 'BRL'} ${account.balance?.toFixed(2) || '0.00'}`);
          });
        }
        
        if (data.data.transactions && data.data.transactions.length > 0) {
          console.log(`\n  Recent Transactions (last 5):`);
          data.data.transactions.slice(0, 5).forEach(tx => {
            console.log(`    • ${tx.date}: ${tx.description} - ${tx.currencyCode || 'BRL'} ${tx.amount}`);
          });
        }
        
        return data.data;
      } else {
        log.warning('No financial data found');
        log.info('User needs to connect a bank account and wait for data sync');
        return null;
      }
    } else {
      log.error('Financial data retrieval failed');
      log.data('Response', data);
      return null;
    }
  } catch (error) {
    log.error(`Financial data retrieval failed: ${error.message}`);
    if (error.response) {
      log.data('Error Response', error.response.data);
    }
    return null;
  }
}

async function testSpecificItem(itemId) {
  log.section(`Testing Specific Item: ${itemId}`);
  
  try {
    // Get accounts for the item
    const accountsResponse = await axios.get(`${BASE_URL}/api/pluggy-v2/item/${itemId}/accounts`);
    
    if (accountsResponse.data.success) {
      log.success(`Found ${accountsResponse.data.count} account(s)`);
      
      const accounts = accountsResponse.data.data;
      for (const account of accounts) {
        console.log(`\n  Account: ${account.name}`);
        console.log(`    • Type: ${account.type}`);
        console.log(`    • Balance: ${account.currencyCode} ${account.balance}`);
        console.log(`    • Account ID: ${account.id}`);
        
        // Get transactions for this account
        try {
          const txResponse = await axios.get(
            `${BASE_URL}/api/pluggy-v2/account/${account.id}/transactions?pageSize=10`
          );
          
          if (txResponse.data.success) {
            console.log(`    • Transactions: ${txResponse.data.count} retrieved (${txResponse.data.pagination.total} total)`);
            
            if (txResponse.data.data.length > 0) {
              console.log(`\n    Recent transactions:`);
              txResponse.data.data.slice(0, 3).forEach(tx => {
                console.log(`      - ${tx.date}: ${tx.description} | ${tx.currencyCode} ${tx.amount}`);
              });
            }
          }
        } catch (txError) {
          log.warning(`    Could not fetch transactions: ${txError.message}`);
        }
      }
      
      return accounts;
    } else {
      log.error('Failed to get accounts for item');
      return [];
    }
  } catch (error) {
    log.error(`Item test failed: ${error.message}`);
    return [];
  }
}

// Main test flow
async function runTests() {
  log.title('');
  console.log(`${colors.bright}${colors.cyan}🏦 PLUGGY INTEGRATION TEST SUITE - PRODUCTION${colors.reset}`);
  console.log(`${colors.cyan}Testing against: ${BASE_URL}${colors.reset}`);
  log.title('');
  
  let testResults = {
    health: false,
    connectors: false,
    token: false,
    userDiscovery: false,
    financialData: false
  };
  
  try {
    // 1. Test API Health
    testResults.health = await testAPIHealth();
    if (!testResults.health) {
      log.error('API health check failed. Stopping tests.');
      return;
    }
    
    // 2. Test Connectors
    testResults.connectors = await testConnectors();
    
    // 3. Ask for phone number
    console.log('');
    const useTestPhone = await askQuestion(`Use test phone ${TEST_PHONE}? (y/n): `);
    const phoneNumber = useTestPhone.toLowerCase() === 'y' 
      ? TEST_PHONE 
      : await askQuestion('Enter phone number (format: +5511999999999): ');
    
    // 4. Test Connect Token
    const token = await testConnectToken(phoneNumber);
    testResults.token = !!token;
    
    if (token) {
      console.log('');
      log.info('To connect a bank account, visit:');
      log.info(`${BASE_URL}/widget/`);
      log.info(`Or use the token in your own widget implementation`);
      console.log('');
      
      const openWidget = await askQuestion('Do you want to open the widget now? (y/n): ');
      if (openWidget.toLowerCase() === 'y') {
        console.log(`\n${colors.bright}Widget URL: ${BASE_URL}/widget/${colors.reset}`);
        console.log('Please complete the bank connection in your browser.');
        await askQuestion('Press Enter when done...');
      }
    }
    
    // 5. Test User Discovery
    const items = await testUserItems(phoneNumber);
    testResults.userDiscovery = items.length > 0;
    
    // 6. Test Financial Data
    if (items.length > 0) {
      // Test database data
      const dbData = await testFinancialData(phoneNumber, false);
      
      // Ask if user wants to fetch live data
      console.log('');
      const fetchLive = await askQuestion('Fetch fresh data from Pluggy? (y/n): ');
      if (fetchLive.toLowerCase() === 'y') {
        const liveData = await testFinancialData(phoneNumber, true);
        testResults.financialData = !!liveData;
      } else {
        testResults.financialData = !!dbData;
      }
      
      // Test specific item if available
      if (items[0]) {
        console.log('');
        const testItem = await askQuestion(`Test specific item ${items[0].itemId}? (y/n): `);
        if (testItem.toLowerCase() === 'y') {
          await testSpecificItem(items[0].itemId);
        }
      }
    }
    
    // 7. Summary
    log.title('');
    log.section('TEST SUMMARY');
    console.log('');
    Object.entries(testResults).forEach(([test, passed]) => {
      const testName = test.charAt(0).toUpperCase() + test.slice(1).replace(/([A-Z])/g, ' $1');
      if (passed) {
        log.success(`${testName}: PASSED`);
      } else {
        log.error(`${testName}: FAILED`);
      }
    });
    
    const passedTests = Object.values(testResults).filter(r => r).length;
    const totalTests = Object.values(testResults).length;
    
    console.log('');
    if (passedTests === totalTests) {
      log.success(`🎉 All tests passed! (${passedTests}/${totalTests})`);
    } else if (passedTests > totalTests / 2) {
      log.warning(`⚠️  Partial success: ${passedTests}/${totalTests} tests passed`);
    } else {
      log.error(`❌ Tests failed: Only ${passedTests}/${totalTests} passed`);
    }
    
  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
    console.error(error);
  } finally {
    rl.close();
  }
}

// Run the tests
console.log(`${colors.cyan}Starting Pluggy Integration Tests...${colors.reset}`);
runTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});