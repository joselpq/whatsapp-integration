// Test script for WhatsApp API with Meta's test phone number
require('dotenv').config();
const https = require('https');

// Configuration from environment
const config = {
  phoneNumberId: process.env.TEST_PHONE_NUMBER_ID,
  accessToken: process.env.TEST_ACCESS_TOKEN,
  recipientNumber: process.env.YOUR_WHATSAPP_NUMBER,
  apiVersion: 'v18.0'
};

// Function to send a test message
function sendTestMessage(message) {
  const data = JSON.stringify({
    messaging_product: 'whatsapp',
    to: config.recipientNumber,
    type: 'text',
    text: {
      body: message
    }
  });

  const options = {
    hostname: 'graph.facebook.com',
    port: 443,
    path: `/${config.apiVersion}/${config.phoneNumberId}/messages`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Length': data.length
    }
  };

  console.log('Sending message to:', config.recipientNumber);
  console.log('Using phone number ID:', config.phoneNumberId);

  const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response:', JSON.parse(responseData));
      
      if (res.statusCode === 200) {
        console.log('✅ Message sent successfully!');
      } else {
        console.log('❌ Failed to send message');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error);
  });

  req.write(data);
  req.end();
}

// Function to get test phone number details
function getPhoneNumberDetails() {
  const options = {
    hostname: 'graph.facebook.com',
    port: 443,
    path: `/${config.apiVersion}/${config.phoneNumberId}?access_token=${config.accessToken}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  console.log('Getting phone number details...');

  const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Phone Number Details:', JSON.parse(responseData));
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error);
  });

  req.end();
}

// Main execution
console.log('WhatsApp API Test Script');
console.log('========================\n');

// Check if all required environment variables are set
const requiredEnvVars = ['TEST_PHONE_NUMBER_ID', 'TEST_ACCESS_TOKEN', 'YOUR_WHATSAPP_NUMBER'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('\nPlease create a .env file with the following variables:');
  console.error('- TEST_PHONE_NUMBER_ID: The test phone number ID from Meta');
  console.error('- TEST_ACCESS_TOKEN: The temporary access token from Meta');
  console.error('- YOUR_WHATSAPP_NUMBER: Your WhatsApp number to receive messages (with country code)');
  process.exit(1);
}

// Command line argument handling
const command = process.argv[2];

switch (command) {
  case 'send':
    const message = process.argv[3] || 'Hello from WhatsApp API test!';
    sendTestMessage(message);
    break;
  
  case 'info':
    getPhoneNumberDetails();
    break;
  
  default:
    console.log('Usage:');
    console.log('  node test-whatsapp-api.js send [message]  - Send a test message');
    console.log('  node test-whatsapp-api.js info            - Get phone number details');
    console.log('\nExample:');
    console.log('  node test-whatsapp-api.js send "Hello World!"');
}