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

// Get complete financial data for a user (DEPRECATED - use database-driven version)
router.get('/user/:clientUserId/financial-data', async (req, res) => {
  try {
    const { clientUserId } = req.params;
    const { from, pageSize } = req.query;
    
    console.log(`📊 API: Getting complete financial data for user ${clientUserId} (DEPRECATED)`);
    
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

// NEW: Database-driven user discovery endpoints
// Get user's items via database lookup
router.get('/users/:phone/items', async (req, res) => {
  try {
    const { phone } = req.params;
    
    console.log(`🔍 API: Database lookup for user items: ${phone}`);
    
    // Import database connection
    const db = require('../database/db');
    const client = await db.getClient();
    
    try {
      // Query database for user's items via phone lookup
      const itemsResult = await client.query(`
        SELECT 
          i.pluggy_item_id,
          i.client_user_id,
          i.connector_name,
          i.status,
          i.created_at,
          i.updated_at
        FROM pluggy_v2_items i
        JOIN users u ON i.user_id = u.id
        WHERE u.phone_number = $1
        ORDER BY i.created_at DESC
      `, [phone]);
      
      const items = itemsResult.rows;
      console.log(`✅ Found ${items.length} items for user ${phone}`);
      
      res.json({
        success: true,
        data: {
          userPhone: phone,
          items: items.map(item => ({
            itemId: item.pluggy_item_id,
            clientUserId: item.client_user_id,
            connectorName: item.connector_name,
            status: item.status,
            createdAt: item.created_at,
            updatedAt: item.updated_at
          })),
          totalItems: items.length
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Database user items lookup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get complete financial data for a user via database + Pluggy APIs
router.get('/users/:phone/financial-data', async (req, res) => {
  try {
    const { phone } = req.params;
    const { live = false } = req.query; // live=true to fetch fresh data from Pluggy
    
    console.log(`📊 API: Getting financial data for user ${phone} (live: ${live})`);
    
    const db = require('../database/db');
    const client = await db.getClient();
    
    try {
      if (live === 'true') {
        // Live mode: Get itemIds from DB via phone lookup, fetch fresh data from Pluggy
        const itemsResult = await client.query(`
          SELECT i.pluggy_item_id 
          FROM pluggy_v2_items i
          JOIN users u ON i.user_id = u.id
          WHERE u.phone_number = $1 AND i.status IN ('CREATED', 'UPDATED')
        `, [phone]);
        
        if (itemsResult.rows.length === 0) {
          return res.json({
            success: true,
            data: {
              userPhone: phone,
              items: [],
              accounts: [],
              transactions: [],
              message: 'No connected bank accounts found'
            }
          });
        }
        
        // Fetch fresh data from Pluggy for each item
        const allAccounts = [];
        const allTransactions = [];
        
        for (const item of itemsResult.rows) {
          try {
            const accounts = await pluggy.getAccounts(item.pluggy_item_id);
            allAccounts.push(...accounts);
            
            // Get recent transactions for each account
            for (const account of accounts) {
              const { transactions } = await pluggy.getTransactions(account.id, {
                pageSize: 100,
                from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
              });
              allTransactions.push(...transactions);
            }
          } catch (itemError) {
            console.error(`⚠️ Failed to fetch data for item ${item.pluggy_item_id}:`, itemError.message);
          }
        }
        
        res.json({
          success: true,
          data: {
            userPhone: phone,
            source: 'live',
            items: itemsResult.rows.map(r => r.pluggy_item_id),
            accounts: allAccounts,
            transactions: allTransactions,
            summary: {
              totalItems: itemsResult.rows.length,
              totalAccounts: allAccounts.length,
              totalTransactions: allTransactions.length
            }
          }
        });
        
      } else {
        // Database mode: Return stored data via phone lookup
        const financialResult = await client.query(`
          SELECT 
            i.pluggy_item_id,
            i.connector_name,
            i.status,
            COUNT(DISTINCT a.pluggy_account_id) as account_count,
            COUNT(t.pluggy_transaction_id) as transaction_count,
            SUM(a.balance) as total_balance,
            json_agg(DISTINCT jsonb_build_object(
              'id', a.pluggy_account_id,
              'name', a.name,
              'type', a.type,
              'balance', a.balance,
              'currencyCode', a.currency_code
            )) FILTER (WHERE a.pluggy_account_id IS NOT NULL) as accounts,
            json_agg(DISTINCT jsonb_build_object(
              'id', t.pluggy_transaction_id,
              'date', t.transaction_date,
              'description', t.description,
              'amount', t.amount,
              'category', t.category
            )) FILTER (WHERE t.pluggy_transaction_id IS NOT NULL) as recent_transactions
          FROM pluggy_v2_items i
          JOIN users u ON i.user_id = u.id
          LEFT JOIN pluggy_v2_accounts a ON i.user_id = a.user_id AND i.pluggy_item_id = a.pluggy_item_id
          LEFT JOIN pluggy_v2_transactions t ON a.pluggy_account_id = t.pluggy_account_id
          WHERE u.phone_number = $1
          GROUP BY i.pluggy_item_id, i.connector_name, i.status, i.created_at
          ORDER BY i.created_at DESC
        `, [phone]);
        
        res.json({
          success: true,
          data: {
            userPhone: phone,
            source: 'database',
            financialData: financialResult.rows,
            summary: {
              totalItems: financialResult.rows.length,
              totalBalance: financialResult.rows.reduce((sum, row) => sum + (parseFloat(row.total_balance) || 0), 0),
              totalAccounts: financialResult.rows.reduce((sum, row) => sum + parseInt(row.account_count), 0),
              totalTransactions: financialResult.rows.reduce((sum, row) => sum + parseInt(row.transaction_count), 0)
            }
          }
        });
      }
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Database financial data lookup error:', error);
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

// Handle webhooks from Pluggy with database integration
router.post('/webhook', async (req, res) => {
  try {
    console.log('📥 API: Received Pluggy webhook with database integration');
    
    // Import database connection
    const db = require('../database/db');
    
    // Process webhook with database storage
    const result = await pluggy.handleWebhook(req.body, db);
    
    res.json({
      success: true,
      message: 'Webhook processed and data stored successfully',
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
    console.log('🔍 DEBUG: Using new getAllItems method');
    
    const items = await pluggy.getAllItems();
    
    res.json({
      success: true,
      totalItems: items.length,
      items: items.map(item => ({
        id: item.id,
        clientUserId: item.clientUserId,
        connectorName: item.connector?.name,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to check all consents
router.get('/debug/consents', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Fetching all consents');
    
    const consents = await pluggy.getConsents();
    
    res.json({
      success: true,
      totalConsents: consents.length,
      consents: consents.map(consent => ({
        id: consent.id,
        itemId: consent.itemId,
        products: consent.products,
        createdAt: consent.createdAt,
        expiresAt: consent.expiresAt,
        revokedAt: consent.revokedAt || null,
        status: consent.status || 'unknown'
      }))
    });
    
  } catch (error) {
    console.error('❌ Consents debug error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to test transactions with different parameters
router.get('/debug/transactions/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`🔍 DEBUG: Testing transactions for account ${accountId}`);
    
    const results = await pluggy.debugTransactions(accountId);
    
    res.json({
      success: true,
      accountId: accountId,
      testResults: results
    });
    
  } catch (error) {
    console.error('❌ Transactions debug error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
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