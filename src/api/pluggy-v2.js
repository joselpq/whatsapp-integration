const express = require('express');
const PluggyV2 = require('../services/PluggyV2');

const router = express.Router();
const pluggy = new PluggyV2();

/**
 * Clean Pluggy V2 API Routes
 * Based on official support team guidance and clean service architecture
 */

// Test connection endpoint
router.get('/test', async (req, res) => {
  try {
    const result = await pluggy.testConnection();
    res.json(result);
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get available connectors (banks/institutions)
router.get('/connectors', async (req, res) => {
  try {
    console.log('📋 API: Getting connectors...');
    
    const connectors = await pluggy.getConnectors();
    
    res.json({
      success: true,
      data: connectors,
      count: connectors.length
    });
    
  } catch (error) {
    console.error('❌ Connectors endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create connect token for frontend widget
router.post('/connect-token', async (req, res) => {
  try {
    const { phoneNumber, webhookUrl, includeSandbox } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber is required'
      });
    }
    
    console.log(`🔗 API: Creating connect token for ${phoneNumber}`);
    
    // Use phone number as clientUserId (clean digits only)
    const clientUserId = phoneNumber.replace(/\D/g, '');
    
    const tokenData = await pluggy.createConnectToken(clientUserId, {
      webhookUrl: webhookUrl || `${process.env.BASE_URL}/api/pluggy-v2/webhook`,
      includeSandbox: includeSandbox !== false // Default true for testing
    });
    
    res.json({
      success: true,
      data: tokenData
    });
    
  } catch (error) {
    console.error('❌ Connect token endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's connected items
router.get('/user/:clientUserId/items', async (req, res) => {
  try {
    const { clientUserId } = req.params;
    
    console.log(`📊 API: Getting items for user ${clientUserId}`);
    
    const items = await pluggy.getItems(clientUserId);
    
    res.json({
      success: true,
      data: items,
      count: items.length
    });
    
  } catch (error) {
    console.error('❌ Items endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get accounts for a specific item
router.get('/item/:itemId/accounts', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    console.log(`💳 API: Getting accounts for item ${itemId}`);
    
    const accounts = await pluggy.getAccounts(itemId);
    
    res.json({
      success: true,
      data: accounts,
      count: accounts.length
    });
    
  } catch (error) {
    console.error('❌ Accounts endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get transactions for an account
router.get('/account/:accountId/transactions', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { from, to, page, pageSize } = req.query;
    
    console.log(`💰 API: Getting transactions for account ${accountId}`);
    
    const options = {};
    if (from) options.from = from;
    if (to) options.to = to;
    if (page) options.page = parseInt(page);
    if (pageSize) options.pageSize = parseInt(pageSize);
    
    const result = await pluggy.getTransactions(accountId, options);
    
    res.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination,
      count: result.transactions.length
    });
    
  } catch (error) {
    console.error('❌ Transactions endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get complete financial data for a user
router.get('/user/:clientUserId/financial-data', async (req, res) => {
  try {
    const { clientUserId } = req.params;
    const { from, pageSize } = req.query;
    
    console.log(`📊 API: Getting complete financial data for user ${clientUserId}`);
    
    const options = {};
    if (from) options.from = from;
    if (pageSize) options.pageSize = parseInt(pageSize);
    
    const financialData = await pluggy.getUserFinancialData(clientUserId, options);
    
    res.json({
      success: true,
      data: financialData
    });
    
  } catch (error) {
    console.error('❌ Financial data endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get financial summary for a user
router.get('/user/:clientUserId/summary', async (req, res) => {
  try {
    const { clientUserId } = req.params;
    
    console.log(`📈 API: Getting financial summary for user ${clientUserId}`);
    
    // Get financial data first
    const financialData = await pluggy.getUserFinancialData(clientUserId);
    
    // Generate summary
    const summary = pluggy.generateFinancialSummary(financialData);
    
    res.json({
      success: true,
      data: {
        summary,
        rawData: {
          itemsCount: financialData.summary.totalItems,
          accountsCount: financialData.summary.totalAccounts,
          transactionsCount: financialData.summary.totalTransactions
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Summary endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync user data (trigger manual refresh)
router.post('/user/:clientUserId/sync', async (req, res) => {
  try {
    const { clientUserId } = req.params;
    
    console.log(`🔄 API: Manual sync requested for user ${clientUserId}`);
    
    // For now, just return fresh data
    const financialData = await pluggy.getUserFinancialData(clientUserId);
    
    res.json({
      success: true,
      message: 'Data sync completed',
      data: {
        syncedAt: new Date().toISOString(),
        summary: financialData.summary
      }
    });
    
  } catch (error) {
    console.error('❌ Sync endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Handle webhooks from Pluggy
router.post('/webhook', async (req, res) => {
  try {
    console.log('📥 API: Received Pluggy webhook');
    
    const result = await pluggy.handleWebhook(req.body);
    
    res.json({
      success: true,
      message: 'Webhook processed successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Webhook endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to check all items
router.get('/debug/all-items', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Fetching ALL items from Pluggy');
    
    const apiKey = await pluggy.authenticate();
    const axios = require('axios');
    
    // Fetch ALL items without filtering by clientUserId
    const response = await axios.get('https://api.pluggy.ai/items', {
      headers: {
        'X-API-KEY': apiKey
      }
      // No params - get ALL items
    });
    
    const items = response.data.results || response.data || [];
    
    res.json({
      success: true,
      totalItems: items.length,
      items: items.map(item => ({
        id: item.id,
        clientUserId: item.clientUserId,
        connectorName: item.connector?.name,
        status: item.status,
        createdAt: item.createdAt
      }))
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Health check for this API
router.get('/health', async (req, res) => {
  try {
    const testResult = await pluggy.testConnection();
    
    res.json({
      service: 'PluggyV2 API',
      status: testResult.success ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      pluggyConnection: testResult.success,
      details: testResult.data || testResult.error
    });
    
  } catch (error) {
    res.status(500).json({
      service: 'PluggyV2 API',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;