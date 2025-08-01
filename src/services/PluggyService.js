const axios = require('axios');
const db = require('../database/db');

class PluggyService {
  constructor() {
    this.baseUrl = 'https://api.pluggy.ai';
    this.clientId = process.env.PLUGGY_CLIENT_ID;
    this.clientSecret = process.env.PLUGGY_CLIENT_SECRET;
    this.apiKey = null;
    this.apiKeyExpiry = null;
    
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ Pluggy credentials not configured');
    }
  }

  /**
   * Authenticate with Pluggy API and get API key
   */
  async authenticate() {
    try {
      // Check if we have a valid API key
      if (this.apiKey && this.apiKeyExpiry && new Date() < this.apiKeyExpiry) {
        return this.apiKey;
      }

      console.log('🔑 Authenticating with Pluggy API...');
      
      const response = await axios.post(`${this.baseUrl}/auth`, {
        clientId: this.clientId,
        clientSecret: this.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.apiKey = response.data.accessToken;
      // API key expires in 2 hours
      this.apiKeyExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
      
      console.log('✅ Pluggy authentication successful');
      return this.apiKey;
      
    } catch (error) {
      console.error('❌ Pluggy authentication failed:');
      console.error('Status:', error.response?.status);
      console.error('Response:', error.response?.data);
      console.error('Message:', error.message);
      console.error('Base URL:', this.baseUrl);
      console.error('Client ID length:', this.clientId?.length);
      console.error('Client Secret length:', this.clientSecret?.length);
      throw new Error(`Failed to authenticate with Pluggy API: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create a connect token for frontend integration
   */
  async createConnectToken(userId, options = {}) {
    try {
      const apiKey = await this.authenticate();
      
      console.log(`🔗 Creating connect token for user ${userId}`);
      
      const requestData = {
        clientUserId: userId,
        webhookUrl: options.webhookUrl || `${process.env.BASE_URL}/api/pluggy/webhook`,
        ...options
      };

      const response = await axios.post(`${this.baseUrl}/connect_token`, requestData, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Connect token created successfully');
      return {
        accessToken: response.data.accessToken,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };
      
    } catch (error) {
      console.error('❌ Failed to create connect token:', error.response?.data || error.message);
      throw new Error('Failed to create connect token');
    }
  }

  /**
   * Get list of available connectors (banks/institutions)
   */
  async getConnectors() {
    try {
      const apiKey = await this.authenticate();
      
      const response = await axios.get(`${this.baseUrl}/connectors`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      return response.data.results.map(connector => ({
        id: connector.id,
        name: connector.name,
        institutionUrl: connector.institutionUrl,
        imageUrl: connector.imageUrl,
        primaryColor: connector.primaryColor,
        type: connector.type,
        country: connector.country,
        supportedProducts: connector.supportedProducts
      }));
      
    } catch (error) {
      console.error('❌ Failed to get connectors:', error.response?.data || error.message);
      throw new Error('Failed to get connectors');
    }
  }

  /**
   * Get user's connected items (bank accounts)
   */
  async getItems(userId) {
    try {
      const apiKey = await this.authenticate();
      
      const response = await axios.get(`${this.baseUrl}/items`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        params: {
          'clientUserId': userId
        }
      });

      return response.data.results.map(item => ({
        id: item.id,
        connector: item.connector,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        statusDetail: item.statusDetail,
        clientUserId: item.clientUserId
      }));
      
    } catch (error) {
      console.error('❌ Failed to get items:', error.response?.data || error.message);
      throw new Error('Failed to get user items');
    }
  }

  /**
   * Get accounts for a specific item
   */
  async getAccounts(itemId) {
    try {
      const apiKey = await this.authenticate();
      
      const response = await axios.get(`${this.baseUrl}/accounts`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        params: {
          itemId: itemId
        }
      });

      return response.data.results.map(account => ({
        id: account.id,
        itemId: account.itemId,
        type: account.type,
        subtype: account.subtype,
        name: account.name,
        marketingName: account.marketingName,
        balance: account.balance,
        owner: account.owner,
        number: account.number,
        taxNumber: account.taxNumber,
        currencyCode: account.currencyCode,
        creditData: account.creditData
      }));
      
    } catch (error) {
      console.error('❌ Failed to get accounts:', error.response?.data || error.message);
      throw new Error('Failed to get accounts');
    }
  }

  /**
   * Get transactions for a specific account
   */
  async getTransactions(accountId, options = {}) {
    try {
      const apiKey = await this.authenticate();
      
      const params = {
        accountId: accountId,
        pageSize: options.pageSize || 200,
        page: options.page || 0
      };

      if (options.from) params.from = options.from;
      if (options.to) params.to = options.to;

      const response = await axios.get(`${this.baseUrl}/transactions`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        params: params
      });

      return {
        results: response.data.results.map(transaction => ({
          id: transaction.id,
          accountId: transaction.accountId,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          balance: transaction.balance,
          currencyCode: transaction.currencyCode,
          category: transaction.category,
          categoryId: transaction.categoryId,
          paymentData: transaction.paymentData,
          creditCardMetadata: transaction.creditCardMetadata
        })),
        page: response.data.page,
        totalPages: response.data.totalPages,
        total: response.data.total
      };
      
    } catch (error) {
      console.error('❌ Failed to get transactions:', error.response?.data || error.message);
      throw new Error('Failed to get transactions');
    }
  }

  /**
   * Get all transactions for a user across all accounts
   */
  async getAllUserTransactions(userId, options = {}) {
    try {
      console.log(`📊 Fetching all transactions for user ${userId}`);
      
      // Get user's items
      const items = await this.getItems(userId);
      const allTransactions = [];
      
      for (const item of items) {
        if (item.status !== 'UPDATED') continue;
        
        // Get accounts for this item
        const accounts = await this.getAccounts(item.id);
        
        for (const account of accounts) {
          // Get transactions for this account
          let page = 0;
          let hasMore = true;
          
          while (hasMore) {
            const transactionData = await this.getTransactions(account.id, {
              ...options,
              page: page
            });
            
            // Add account info to each transaction
            const accountTransactions = transactionData.results.map(tx => ({
              ...tx,
              accountName: account.name,
              accountType: account.type,
              itemId: item.id,
              connectorName: item.connector?.name
            }));
            
            allTransactions.push(...accountTransactions);
            
            page++;
            hasMore = page < transactionData.totalPages;
          }
        }
      }
      
      console.log(`✅ Fetched ${allTransactions.length} transactions for user ${userId}`);
      return allTransactions;
      
    } catch (error) {
      console.error('❌ Failed to get all user transactions:', error);
      throw error;
    }
  }

  /**
   * Store user's financial data in database
   */
  async storeUserFinancialData(userId, data) {
    try {
      console.log(`💾 Storing financial data for user ${userId}`);
      
      const client = await db.getClient();
      await client.query('BEGIN');
      
      try {
        // Store items (bank connections)
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            await client.query(`
              INSERT INTO pluggy_items (
                user_id, pluggy_item_id, connector_name, status, 
                created_at, updated_at, status_detail
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (user_id, pluggy_item_id) DO UPDATE SET
                status = EXCLUDED.status,
                updated_at = EXCLUDED.updated_at,
                status_detail = EXCLUDED.status_detail
            `, [
              userId, item.id, item.connector?.name, item.status,
              item.createdAt, item.updatedAt, item.statusDetail
            ]);
          }
        }
        
        // Store accounts
        if (data.accounts && data.accounts.length > 0) {
          for (const account of data.accounts) {
            await client.query(`
              INSERT INTO pluggy_accounts (
                user_id, pluggy_account_id, pluggy_item_id, type, subtype,
                name, marketing_name, balance, owner, account_number,
                tax_number, currency_code, credit_data
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              ON CONFLICT (user_id, pluggy_account_id) DO UPDATE SET
                balance = EXCLUDED.balance,
                credit_data = EXCLUDED.credit_data,
                updated_at = NOW()
            `, [
              userId, account.id, account.itemId, account.type, account.subtype,
              account.name, account.marketingName, account.balance, account.owner,
              account.number, account.taxNumber, account.currencyCode,
              JSON.stringify(account.creditData)
            ]);
          }
        }
        
        // Store transactions
        if (data.transactions && data.transactions.length > 0) {
          for (const transaction of data.transactions) {
            await client.query(`
              INSERT INTO pluggy_transactions (
                user_id, pluggy_transaction_id, pluggy_account_id, transaction_date,
                description, amount, balance, currency_code, category,
                category_id, payment_data, credit_card_metadata
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (user_id, pluggy_transaction_id) DO NOTHING
            `, [
              userId, transaction.id, transaction.accountId, transaction.date,
              transaction.description, transaction.amount, transaction.balance,
              transaction.currencyCode, transaction.category, transaction.categoryId,
              JSON.stringify(transaction.paymentData),
              JSON.stringify(transaction.creditCardMetadata)
            ]);
          }
        }
        
        await client.query('COMMIT');
        console.log('✅ Financial data stored successfully');
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Failed to store financial data:', error);
      throw error;
    }
  }

  /**
   * Sync user's financial data from Pluggy
   */
  async syncUserData(userId) {
    try {
      console.log(`🔄 Syncing financial data for user ${userId}`);
      
      // Get all user data
      const items = await this.getItems(userId);
      const accounts = [];
      const transactions = await this.getAllUserTransactions(userId, {
        from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // Last 90 days
        pageSize: 500
      });
      
      // Get accounts for all items
      for (const item of items) {
        if (item.status === 'UPDATED') {
          const itemAccounts = await this.getAccounts(item.id);
          accounts.push(...itemAccounts);
        }
      }
      
      // Store everything in database
      await this.storeUserFinancialData(userId, {
        items,
        accounts,
        transactions
      });
      
      return {
        itemsCount: items.length,
        accountsCount: accounts.length,
        transactionsCount: transactions.length,
        syncedAt: new Date()
      };
      
    } catch (error) {
      console.error('❌ Failed to sync user data:', error);
      throw error;
    }
  }

  /**
   * Handle webhook from Pluggy
   */
  async handleWebhook(webhookData) {
    try {
      console.log('📥 Processing Pluggy webhook:', webhookData.event);
      
      const { event, itemId, clientUserId } = webhookData;
      
      switch (event) {
        case 'item/created':
        case 'item/updated':
          console.log(`🔄 Item ${event} for user ${clientUserId}`);
          // Sync data for this user
          if (clientUserId) {
            await this.syncUserData(clientUserId);
          }
          break;
          
        case 'item/error':
          console.log(`❌ Item error for user ${clientUserId}:`, webhookData.error);
          // Update item status in database
          await db.query(`
            UPDATE pluggy_items 
            SET status = 'ERROR', status_detail = $1, updated_at = NOW()
            WHERE pluggy_item_id = $2
          `, [JSON.stringify(webhookData.error), itemId]);
          break;
          
        default:
          console.log(`ℹ️ Unhandled webhook event: ${event}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to process webhook:', error);
      throw error;
    }
  }

  /**
   * Store user consent for Open Finance
   */
  async storeUserConsent(userId, status = 'pending') {
    try {
      await db.query(`
        INSERT INTO pluggy_user_consents (user_id, consent_status)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET
          consent_status = EXCLUDED.consent_status,
          updated_at = NOW()
      `, [userId, status]);
      
      console.log(`✅ User consent stored: ${userId} - ${status}`);
    } catch (error) {
      console.error('❌ Failed to store user consent:', error);
      throw error;
    }
  }

  /**
   * Get user's financial summary from stored data
   */
  async getUserFinancialSummary(userId) {
    try {
      const summaryQuery = `
        WITH account_balances AS (
          SELECT 
            type,
            SUM(balance) as total_balance,
            COUNT(*) as account_count
          FROM pluggy_accounts 
          WHERE user_id = $1
          GROUP BY type
        ),
        transaction_summary AS (
          SELECT 
            COUNT(*) as transaction_count,
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
            AVG(CASE WHEN amount < 0 THEN ABS(amount) ELSE NULL END) as avg_expense,
            MIN(transaction_date) as oldest_transaction,
            MAX(transaction_date) as newest_transaction
          FROM pluggy_transactions 
          WHERE user_id = $1 
            AND transaction_date >= NOW() - INTERVAL '90 days'
        )
        SELECT 
          COALESCE(json_agg(
            json_build_object(
              'type', ab.type,
              'total_balance', ab.total_balance,
              'account_count', ab.account_count
            )
          ), '[]'::json) as accounts,
          ts.*
        FROM account_balances ab
        FULL OUTER JOIN transaction_summary ts ON true
        GROUP BY ts.transaction_count, ts.total_income, ts.total_expenses, 
                 ts.avg_expense, ts.oldest_transaction, ts.newest_transaction
      `;
      
      const result = await db.query(summaryQuery, [userId]);
      return result.rows[0] || {};
      
    } catch (error) {
      console.error('❌ Failed to get financial summary:', error);
      throw error;
    }
  }
}

module.exports = PluggyService;