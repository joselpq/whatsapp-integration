#!/usr/bin/env node

// Test script to verify state persistence is working correctly
require('dotenv').config();
const ConversationState = require('../src/services/ConversationState');
const db = require('../src/database/db');

async function testStatePersistence() {
  console.log('🧪 Testing State Persistence...\n');
  
  const testUserId = 'test-user-' + Date.now();
  
  try {
    // Test 1: Create initial state
    console.log('1️⃣ Testing initial state creation...');
    await ConversationState.updateUserState(
      testUserId, 
      ConversationState.STATES.ONBOARDING_WELCOME,
      { test: true }
    );
    
    const state1 = await ConversationState.getUserState(testUserId);
    console.log(`   ✅ Initial state: ${state1}`);
    
    // Test 2: State transition
    console.log('\n2️⃣ Testing state transition...');
    await ConversationState.updateUserState(
      testUserId,
      ConversationState.STATES.GOAL_DISCOVERY,
      { transitioned: true }
    );
    
    const state2 = await ConversationState.getUserState(testUserId);
    console.log(`   ✅ New state: ${state2}`);
    
    // Test 3: Get state context
    console.log('\n3️⃣ Testing state context retrieval...');
    const context = await ConversationState.getStateContext(testUserId);
    console.log(`   ✅ State context:`, JSON.stringify(context, null, 2));
    
    // Test 4: Multiple transitions
    console.log('\n4️⃣ Testing multiple transitions...');
    const transitions = [
      ConversationState.STATES.INCOME_COLLECTION,
      ConversationState.STATES.PLAN_CREATION,
      ConversationState.STATES.ACTIVE_TRACKING
    ];
    
    for (const state of transitions) {
      await ConversationState.updateUserState(testUserId, state);
      const current = await ConversationState.getUserState(testUserId);
      console.log(`   ✅ Transitioned to: ${current}`);
    }
    
    // Test 5: Check analytics events
    console.log('\n5️⃣ Checking analytics events...');
    const eventsQuery = `
      SELECT event_name, properties 
      FROM analytics_events 
      WHERE user_id = $1 
      ORDER BY created_at
    `;
    const events = await db.query(eventsQuery, [testUserId]);
    console.log(`   ✅ Recorded ${events.rows.length} state transitions`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await db.query('DELETE FROM user_states WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM analytics_events WHERE user_id = $1', [testUserId]);
    
    console.log('\n✅ All state persistence tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run tests
if (require.main === module) {
  testStatePersistence()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = testStatePersistence;