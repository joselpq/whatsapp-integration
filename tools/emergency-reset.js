#!/usr/bin/env node

// CLI tool for reliable user reset using emergency reset endpoint
require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://whatsapp-integration-production-06bb.up.railway.app'
  : 'http://localhost:3000';

async function emergencyReset(phoneNumber) {
  try {
    console.log(`🔄 Emergency Reset for ${phoneNumber}...`);
    console.log(`Using API: ${API_URL}`);
    
    // Step 1: Get user ID from phone number
    console.log('\n📊 Getting user information...');
    const statusResponse = await axios.get(`${API_URL}/dev/user-status/${encodeURIComponent(phoneNumber)}`);
    const status = statusResponse.data;
    
    if (!status.exists) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log(`✅ User found:`);
    console.log(`   ID: ${status.userId}`);
    console.log(`   Phone: ${status.phoneNumber}`);
    console.log(`   Messages: ${status.stats.messages}`);
    console.log(`   Expenses: ${status.stats.expenses}`);
    console.log(`   Goals: ${status.stats.goals}`);
    
    // Step 2: Emergency reset using user ID
    console.log('\n🚨 Performing emergency reset...');
    const resetResponse = await axios.post(`${API_URL}/dev/emergency-reset`, {
      userId: status.userId
    });
    
    const result = resetResponse.data;
    
    if (result.success) {
      console.log('✅ Emergency reset completed!');
      console.log(`   Deleted ${result.deletedRecords} records`);
      console.log(`   User ${result.phone} is now completely reset`);
      console.log('\n💬 Send "Oi" to WhatsApp to start fresh conversation');
    } else {
      console.log('❌ Reset failed:', result.message);
    }
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('❌ Development endpoints not available');
      console.log('   Make sure DEV_TOOLS_ENABLED=true in .env');
    } else {
      console.log('❌ Error:', error.response?.data?.error || error.message);
    }
  }
}

// Command line usage
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.log('🛠️  WhatsApp User Emergency Reset Tool');
  console.log('');
  console.log('Usage: node emergency-reset.js <phone-number>');
  console.log('');
  console.log('Examples:');
  console.log('  node emergency-reset.js +5511976196165');
  console.log('  node emergency-reset.js 5511976196165');
  console.log('');
  console.log('This tool uses the emergency reset endpoint which is the');
  console.log('ONLY reliable method for resetting users. It bypasses all');
  console.log('phone number format issues by using the user ID directly.');
  process.exit(1);
}

emergencyReset(phoneNumber);