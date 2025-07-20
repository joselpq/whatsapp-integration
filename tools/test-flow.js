#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://whatsapp-integration-production-06bb.up.railway.app';
const TEST_PHONE = process.env.TEST_PHONE || '+5511976196165';

async function testFlow() {
  console.log('🧪 Testing WhatsApp Integration Flow\n');

  try {
    // 1. Test Health
    console.log('1️⃣  Testing health endpoint...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('   Status:', health.data.status);
    console.log('   Database:', health.data.database);
    
    // 2. Test Send Message
    console.log('\n2️⃣  Testing send message...');
    const sendResult = await axios.post(`${API_URL}/api/v1/messages/send`, {
      to: TEST_PHONE,
      content: 'Teste do Arnaldo: Oi! Como posso ajudar com suas finanças hoje?'
    });
    console.log('   Result:', sendResult.data.success ? '✅ Success' : '❌ Failed');
    console.log('   Message ID:', sendResult.data.messageId);
    console.log('   Type:', sendResult.data.messageType);
    
    // 3. Check conversation status
    console.log('\n3️⃣  Checking conversation status...');
    const status = await axios.get(`${API_URL}/api/v1/conversations/status/${TEST_PHONE}`);
    console.log('   Can send free message:', status.data.canSendFreeMessage);
    console.log('   Window expires:', status.data.windowExpiresAt || 'No active window');
    
    console.log('\n✅ All tests completed!');
    console.log('\n📱 Next steps:');
    console.log('   1. Send a WhatsApp message to +5511939041011');
    console.log('   2. Check Railway logs for webhook activity');
    console.log('   3. You should receive an auto-response from Arnaldo');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.log('   Make sure the service is deployed and running on Railway');
    }
  }
}

testFlow();