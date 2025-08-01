// Simple, working Pluggy API routes
const express = require('express');
const axios = require('axios');

const router = express.Router();

// Debug middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`🔍 Pluggy-simple route accessed: ${req.method} ${req.path}`);
  next();
});

const PLUGGY_BASE_URL = 'https://api.pluggy.ai';
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;

// Authenticate with Pluggy and get API key
async function getPluggyApiKey() {
  const response = await axios.post(`${PLUGGY_BASE_URL}/auth`, {
    clientId: PLUGGY_CLIENT_ID,
    clientSecret: PLUGGY_CLIENT_SECRET
  });
  return response.data.accessToken;
}

/**
 * GET /connectors - Get list of available banks
 */
router.get('/connectors', async (req, res) => {
  try {
    console.log('📋 Getting Pluggy connectors...');
    
    const apiKey = await getPluggyApiKey();
    
    const response = await axios.get(`${PLUGGY_BASE_URL}/connectors`, {
      headers: {
        'X-API-KEY': apiKey
      }
    });
    
    console.log(`✅ Retrieved ${response.data.total} connectors`);
    
    res.json({
      success: true,
      data: response.data.results.map(connector => ({
        id: connector.id,
        name: connector.name,
        type: connector.type,
        country: connector.country,
        imageUrl: connector.imageUrl,
        primaryColor: connector.primaryColor,
        health: connector.health,
        isOpenFinance: connector.isOpenFinance
      }))
    });
    
  } catch (error) {
    console.error('❌ Connectors error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get connectors',
      message: error.message
    });
  }
});

/**
 * POST /connect-token - Create connect token for frontend
 */
router.post('/connect-token', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    console.log(`🔗 Creating connect token for ${phoneNumber}...`);
    
    const apiKey = await getPluggyApiKey();
    
    // Create a simple user ID from phone number (remove non-digits)
    const userId = phoneNumber.replace(/\D/g, '');
    
    const response = await axios.post(`${PLUGGY_BASE_URL}/connect_token`, {
      clientUserId: userId,
      webhookUrl: `${process.env.BASE_URL}/api/pluggy-simple/webhook`
    }, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Connect token created successfully');
    
    res.json({
      success: true,
      data: {
        connectToken: response.data.accessToken,
        userId: userId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }
    });
    
  } catch (error) {
    console.error('❌ Connect token error:', error.message);
    console.error('Error details:', error.response?.data);
    res.status(500).json({
      success: false,
      error: 'Failed to create connect token',
      message: error.message,
      details: error.response?.data
    });
  }
});

/**
 * POST /webhook - Handle Pluggy webhooks
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Received Pluggy webhook:', req.body);
    
    // For now, just log and acknowledge
    res.json({
      success: true,
      message: 'Webhook received'
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
});

/**
 * GET /test - Simple test endpoint
 */
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing Pluggy connection...');
    
    const apiKey = await getPluggyApiKey();
    
    const response = await axios.get(`${PLUGGY_BASE_URL}/connectors?page=1&pageSize=5`, {
      headers: {
        'X-API-KEY': apiKey
      }
    });
    
    res.json({
      success: true,
      message: 'Pluggy connection working!',
      data: {
        totalConnectors: response.data.total,
        sampleBanks: response.data.results.slice(0, 3).map(c => c.name)
      }
    });
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

module.exports = router;