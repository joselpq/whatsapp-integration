const express = require('express');
const PluggyService = require('../services/PluggyService');
const User = require('../models/User');

const router = express.Router();
const pluggyService = new PluggyService();

/**
 * GET /api/pluggy/connect-token
 * Create a connect token for frontend integration
 */
router.post('/connect-token', async (req, res) => {
  try {
    const { phoneNumber, webhookUrl } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }
    
    // Get or create user
    const user = await User.findOrCreateByPhone(phoneNumber);
    
    // Create connect token
    const tokenData = await pluggyService.createConnectToken(user.id, {
      webhookUrl
    });
    
    // Update user consent status
    await pluggyService.storeUserConsent(user.id, 'pending');
    
    res.json({
      success: true,
      data: {
        connectToken: tokenData.accessToken,
        expiresAt: tokenData.expiresAt,
        userId: user.id
      }
    });
    
  } catch (error) {
    console.error('Connect token error:', error);
    res.status(500).json({ 
      error: 'Failed to create connect token',
      message: error.message 
    });
  }
});

/**
 * GET /api/pluggy/connectors
 * Get list of available banks/institutions
 */
router.get('/connectors', async (req, res) => {
  try {
    const connectors = await pluggyService.getConnectors();
    
    res.json({
      success: true,
      data: connectors
    });
    
  } catch (error) {
    console.error('Connectors error:', error);
    res.status(500).json({ 
      error: 'Failed to get connectors',
      message: error.message 
    });
  }
});

/**
 * GET /api/pluggy/user/:userId/items
 * Get user's connected bank accounts
 */
router.get('/user/:userId/items', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const items = await pluggyService.getItems(userId);
    
    res.json({
      success: true,
      data: items
    });
    
  } catch (error) {
    console.error('Items error:', error);
    res.status(500).json({ 
      error: 'Failed to get user items',
      message: error.message 
    });
  }
});

/**
 * GET /api/pluggy/user/:userId/accounts
 * Get user's bank accounts across all connections
 */
router.get('/user/:userId/accounts', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const items = await pluggyService.getItems(userId);
    const allAccounts = [];
    
    for (const item of items) {
      if (item.status === 'UPDATED') {
        const accounts = await pluggyService.getAccounts(item.id);
        allAccounts.push(...accounts.map(account => ({
          ...account,
          itemId: item.id,
          connectorName: item.connector?.name
        })));
      }
    }
    
    res.json({
      success: true,
      data: allAccounts
    });
    
  } catch (error) {
    console.error('Accounts error:', error);
    res.status(500).json({ 
      error: 'Failed to get user accounts',
      message: error.message 
    });
  }
});

/**
 * GET /api/pluggy/user/:userId/transactions
 * Get user's transactions with optional filtering
 */
router.get('/user/:userId/transactions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { from, to, category, limit = 100 } = req.query;
    
    const options = {};
    if (from) options.from = from;
    if (to) options.to = to;
    if (limit) options.pageSize = Math.min(parseInt(limit), 500);
    
    const transactions = await pluggyService.getAllUserTransactions(userId, options);
    
    // Filter by category if specified
    let filteredTransactions = transactions;
    if (category) {
      filteredTransactions = transactions.filter(tx => 
        tx.category && tx.category.toLowerCase().includes(category.toLowerCase())
      );
    }
    
    res.json({
      success: true,
      data: filteredTransactions.slice(0, parseInt(limit))
    });
    
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ 
      error: 'Failed to get user transactions',
      message: error.message 
    });
  }
});

/**
 * POST /api/pluggy/user/:userId/sync
 * Manually sync user's financial data
 */
router.post('/user/:userId/sync', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`🔄 Manual sync requested for user ${userId}`);
    
    const syncResult = await pluggyService.syncUserData(userId);
    
    res.json({
      success: true,
      message: 'Data sync completed',
      data: syncResult
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync user data',
      message: error.message 
    });
  }
});

/**
 * GET /api/pluggy/user/:userId/summary
 * Get user's financial summary
 */
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const summary = await pluggyService.getUserFinancialSummary(userId);
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ 
      error: 'Failed to get financial summary',
      message: error.message 
    });
  }
});

/**
 * POST /api/pluggy/webhook
 * Handle webhooks from Pluggy
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Received Pluggy webhook');
    
    await pluggyService.handleWebhook(req.body);
    
    res.json({ 
      success: true,
      message: 'Webhook processed successfully' 
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Failed to process webhook',
      message: error.message 
    });
  }
});

/**
 * GET /api/pluggy/user/:userId/consent
 * Get user's consent status for Open Finance
 */
router.get('/user/:userId/consent', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const consentQuery = `
      SELECT 
        consent_status,
        consent_given_at,
        last_sync_at,
        total_accounts,
        total_transactions,
        sync_status
      FROM pluggy_user_consents 
      WHERE user_id = $1
    `;
    
    const db = require('../database/db');
    const result = await db.query(consentQuery, [userId]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          hasConsent: false,
          status: 'not_connected'
        }
      });
    }
    
    const consent = result.rows[0];
    
    res.json({
      success: true,
      data: {
        hasConsent: true,
        status: consent.consent_status,
        consentGivenAt: consent.consent_given_at,
        lastSyncAt: consent.last_sync_at,
        totalAccounts: consent.total_accounts,
        totalTransactions: consent.total_transactions,
        syncStatus: consent.sync_status
      }
    });
    
  } catch (error) {
    console.error('Consent status error:', error);
    res.status(500).json({ 
      error: 'Failed to get consent status',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/pluggy/user/:userId/consent
 * Revoke user's Open Finance consent
 */
router.delete('/user/:userId/consent', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const db = require('../database/db');
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Update consent status
      await client.query(`
        UPDATE pluggy_user_consents 
        SET consent_status = 'revoked', updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);
      
      // Optionally delete user's financial data
      if (req.query.deleteData === 'true') {
        await client.query('DELETE FROM pluggy_transactions WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM pluggy_accounts WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM pluggy_items WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM pluggy_user_consents WHERE user_id = $1', [userId]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Consent revoked successfully'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Revoke consent error:', error);
    res.status(500).json({ 
      error: 'Failed to revoke consent',
      message: error.message 
    });
  }
});

module.exports = router;