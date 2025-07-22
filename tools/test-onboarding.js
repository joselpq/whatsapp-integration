#!/usr/bin/env node

// Test onboarding flow locally
require('dotenv').config();
const ConversationState = require('../src/services/ConversationState');
const OnboardingFlow = require('../src/flows/OnboardingFlow');

async function testOnboarding() {
  console.log('🧪 Testing Onboarding Flow\n');
  
  const testUserId = 'test-user-123';
  
  try {
    // Test 1: Welcome message for new user
    console.log('1️⃣ Testing welcome message...');
    const welcomeResponse = await OnboardingFlow.handleOnboarding(
      testUserId,
      ConversationState.STATES.NEW_USER,
      ''
    );
    console.log('✅ Welcome response:');
    console.log(welcomeResponse.message);
    console.log('Next state:', welcomeResponse.nextState);
    console.log();

    // Test 2: Goal selection responses
    console.log('2️⃣ Testing goal selection...');
    const testGoalInputs = ['1', '2', '3', '4', 'reserva', 'invalid input'];
    
    for (const input of testGoalInputs) {
      console.log(`Input: "${input}"`);
      const goalResponse = await OnboardingFlow.handleGoalDiscovery(testUserId, input);
      console.log('Response preview:', goalResponse.message.substring(0, 100) + '...');
      console.log('Next state:', goalResponse.nextState);
      console.log();
    }

    // Test 3: Income collection
    console.log('3️⃣ Testing income collection...');
    const incomeInputs = ['no number', 'ganho 3000 por mês'];
    
    for (const input of incomeInputs) {
      console.log(`Input: "${input}"`);
      const incomeResponse = OnboardingFlow.handleIncomeCollection(testUserId, input);
      console.log('Response preview:', incomeResponse.message.substring(0, 100) + '...');
      console.log('Next state:', incomeResponse.nextState);
      console.log('Complete onboarding:', incomeResponse.completeOnboarding || false);
      console.log();
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testOnboarding();