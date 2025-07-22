#!/usr/bin/env node

// CLI tool to reset user data for testing
require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://whatsapp-integration-production-06bb.up.railway.app'
  : 'http://localhost:3000';

async function resetUser(phoneNumber) {
  try {
    console.log(`🔄 Resetting user ${phoneNumber}...`);
    console.log(`Using API: ${API_URL}`);
    
    // First check user status
    console.log('\n📊 Current user status:');
    try {
      const statusResponse = await axios.get(`${API_URL}/dev/user-status/${encodeURIComponent(phoneNumber)}`);
      const status = statusResponse.data;
      
      if (status.exists) {
        console.log(`✅ User found: ${status.phoneNumber}`);
        console.log(`   Onboarded: ${status.onboardingCompleted ? '✅' : '❌'}`);
        console.log(`   Income: R$${status.monthlyIncome || 'Not set'}`);
        console.log(`   Stats: ${status.stats.messages} messages, ${status.stats.expenses} expenses, ${status.stats.goals} goals`);
      } else {
        console.log('❌ User not found in database');
        return;
      }
    } catch (error) {
      console.log('⚠️  Could not get user status');
    }
    
    // Reset the user
    console.log('\n🗑️  Resetting user data...');
    const resetResponse = await axios.post(`${API_URL}/dev/reset-user`, {
      phoneNumber
    });
    
    const result = resetResponse.data;
    
    if (result.success) {
      console.log('✅ User reset successfully!');
      console.log('💬 Send "Oi" to your WhatsApp to start fresh onboarding');
    } else {
      console.log('❌ Reset failed:', result.message);
    }
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('❌ Development endpoints not available (production mode?)');
    } else {
      console.log('❌ Error:', error.response?.data?.error || error.message);
    }
  }
}

// Command line usage
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.log('Usage: node reset-user.js <phone-number>');
  console.log('Example: node reset-user.js +5511976196165');
  process.exit(1);
}

resetUser(phoneNumber);