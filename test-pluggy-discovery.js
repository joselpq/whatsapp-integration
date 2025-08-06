#!/usr/bin/env node
/**
 * Local test script for Pluggy user discovery debugging
 * Tests the new methods directly without going through the API endpoints
 */

// Load environment variables
require('dotenv').config();

const PluggyV2 = require('./src/services/PluggyV2');

async function testPluggyDiscovery() {
  console.log('🔍 PLUGGY USER DISCOVERY TEST');
  console.log('=' .repeat(50));
  
  const pluggy = new PluggyV2();
  
  try {
    // Test 1: Try to get all consents (user discovery via consents)
    console.log('\n🧪 TEST 1: Consents API');
    console.log('-'.repeat(30));
    try {
      const consents = await pluggy.getConsents();
      console.log(`✅ Consents API works! Found ${consents.length} consents`);
      
      if (consents.length > 0) {
        // Extract unique item IDs from consents
        const itemIds = [...new Set(consents.map(c => c.itemId))].filter(Boolean);
        console.log(`🆔 Unique item IDs from consents: ${itemIds.length}`);
        console.log(`📋 Item IDs: ${itemIds.join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ Consents API failed: ${error.message}`);
    }

    // Test 2: Try to get all items (user discovery via items)
    console.log('\n🧪 TEST 2: All Items API');
    console.log('-'.repeat(30));
    try {
      const items = await pluggy.getAllItems();
      console.log(`✅ All Items API works! Found ${items.length} items`);
      
      if (items.length > 0) {
        // Extract unique clientUserIds
        const clientUserIds = [...new Set(items.map(i => i.clientUserId))].filter(Boolean);
        console.log(`🆔 Unique clientUserIds: ${clientUserIds.length}`);
        console.log(`📋 ClientUserIds: ${clientUserIds.join(', ')}`);
        
        // Check if our known test user is included
        const knownUser = '5511999999998';
        const hasKnownUser = clientUserIds.includes(knownUser);
        console.log(`🔍 Known test user (${knownUser}) found: ${hasKnownUser ? '✅' : '❌'}`);
      }
    } catch (error) {
      console.log(`❌ All Items API failed: ${error.message}`);
    }

    // Test 3: Test known item directly (known working case)
    console.log('\n🧪 TEST 3: Known Item Direct Access');
    console.log('-'.repeat(30));
    const knownItemId = '257adfd4-1fa7-497c-8231-5e6c31312cb1';
    
    try {
      const accounts = await pluggy.getAccounts(knownItemId);
      console.log(`✅ Known item access works! Found ${accounts.length} accounts`);
      
      if (accounts.length > 0) {
        const firstAccount = accounts[0];
        console.log(`💳 First account: ${firstAccount.name} (${firstAccount.type})`);
        console.log(`💰 Balance: ${firstAccount.currencyCode} ${firstAccount.balance}`);
        
        // Test 4: Debug transactions for the first account
        console.log('\n🧪 TEST 4: Transaction Debugging');
        console.log('-'.repeat(30));
        
        const transactionResults = await pluggy.debugTransactions(firstAccount.id);
        
        console.log('📊 Transaction test results:');
        transactionResults.forEach(result => {
          if (result.success) {
            console.log(`✅ ${result.testCase}: ${result.count} transactions (total: ${result.total})`);
          } else {
            console.log(`❌ ${result.testCase}: ${result.error.message || result.error}`);
          }
        });
      }
    } catch (error) {
      console.log(`❌ Known item access failed: ${error.message}`);
    }

    // Test 5: Test clientUserId filtering (the failing case)
    console.log('\n🧪 TEST 5: ClientUserId Filtering (Current Issue)');
    console.log('-'.repeat(30));
    const knownClientUserId = '5511999999998';
    
    try {
      const items = await pluggy.getItems(knownClientUserId);
      console.log(`${items.length > 0 ? '✅' : '❌'} ClientUserId filtering: Found ${items.length} items`);
      
      if (items.length === 0) {
        console.log('🔍 This confirms the clientUserId filtering issue!');
        console.log('💡 Solution: Use getAllItems() for user discovery instead');
      }
    } catch (error) {
      console.log(`❌ ClientUserId filtering failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎯 SUMMARY');
  console.log('=' .repeat(50));
  console.log('If Consents or All Items API work, we have user discovery!');
  console.log('If transactions are found, we solved the transaction issue!');
  console.log('If clientUserId filtering fails, we confirmed the bug!');
}

// Run the test
testPluggyDiscovery()
  .then(() => {
    console.log('\n✅ Discovery test completed!');
  })
  .catch(error => {
    console.error('❌ Discovery test failed:', error.message);
    process.exit(1);
  });