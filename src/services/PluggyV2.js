const axios = require('axios');

/**
 * Clean Pluggy Open Finance Integration - V2
 * Based on official support team guidance and working patterns
 * 
 * Authentication Flow:
 * 1. POST /auth with {clientId, clientSecret} → returns {apiKey}
 * 2. All other requests use X-API-KEY header with apiKey
 * 3. Connect token creation: POST /connect_token → returns {accessToken}
 */
class PluggyV2 {
  constructor() {
    this.baseUrl = 'https://api.pluggy.ai';
    this.clientId = process.env.PLUGGY_CLIENT_ID;
    this.clientSecret = process.env.PLUGGY_CLIENT_SECRET;
    this.apiKey = null;
    this.apiKeyExpiry = null;
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET environment variables required');
    }
    
    console.log('🏦 PluggyV2 initialized with credentials');
  }

  /**
   * Authenticate with Pluggy API
   * POST https://api.pluggy.ai/auth - confirmed by support team
   * Returns apiKey valid for 2 hours
   */
  async authenticate() {
    try {
      // Return cached API key if still valid (refresh 10min early)
      if (this.apiKey && this.apiKeyExpiry && new Date() < this.apiKeyExpiry) {
        return this.apiKey;
      }

      console.log('🔑 Authenticating with Pluggy API...');
      
      const response = await axios.post(`${this.baseUrl}/auth`, {
        clientId: this.clientId,
        clientSecret: this.clientSecret
      });

      // Confirmed by support: response contains apiKey
      this.apiKey = response.data.apiKey;
      this.apiKeyExpiry = new Date(Date.now() + (110 * 60 * 1000)); // 1h50m (refresh early)
      
      console.log('✅ Pluggy authentication successful');
      console.log(`📋 API Key length: ${this.apiKey.length}`);
      return this.apiKey;
      
    } catch (error) {
      console.error('❌ Pluggy authentication failed:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      
      if (error.response?.status === 401) {
        throw new Error('Invalid Pluggy credentials (CLIENT_ID or CLIENT_SECRET)');
      }
      
      throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get available connectors (banks/institutions)
   * Uses X-API-KEY header as confirmed by support
   */
  async getConnectors() {
    try {
      const apiKey = await this.authenticate();
      
      console.log('📋 Fetching available connectors...');
      
      const response = await axios.get(`${this.baseUrl}/connectors`, {
        headers: {
          'X-API-KEY': apiKey
        }
      });

      const connectors = response.data.results || response.data;
      console.log(`✅ Retrieved ${connectors.length} connectors`);
      
      return connectors.map(connector => ({
        id: connector.id,
        name: connector.name,
        type: connector.type,
        country: connector.country,
        imageUrl: connector.imageUrl,
        primaryColor: connector.primaryColor,
        health: connector.health?.status || 'unknown',
        isOpenFinance: connector.isOpenFinance || false
      }));
      
    } catch (error) {
      console.error('❌ Failed to get connectors:', error.response?.data || error.message);
      throw new Error('Failed to get connectors');
    }
  }

  /**
   * Create connect token for frontend widget
   * Returns accessToken (different from apiKey) - valid 30 minutes
   */
  async createConnectToken(clientUserId, options = {}) {
    try {
      const apiKey = await this.authenticate();
      
      console.log(`🔗 Creating connect token for user: ${clientUserId}`);
      
      const payload = {
        clientUserId: clientUserId,
        webhookUrl: options.webhookUrl || `${process.env.BASE_URL}/api/pluggy-v2/webhook`,
        includeSandbox: options.includeSandbox !== false, // Default true for testing
        ...options
      };

      const response = await axios.post(`${this.baseUrl}/connect_token`, payload, {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      });

      // Connect token endpoint returns accessToken (not apiKey)
      const connectToken = response.data.accessToken;
      
      console.log('✅ Connect token created successfully');
      return {
        connectToken,
        clientUserId,
        expiresAt: new Date(Date.now() + (30 * 60 * 1000)), // 30 minutes
        webhookUrl: payload.webhookUrl
      };
      
    } catch (error) {
      console.error('❌ Failed to create connect token:', error.response?.data || error.message);
      throw new Error(`Connect token creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get user's connected items (bank connections)
   */
  async getItems(clientUserId) {
    try {
      const apiKey = await this.authenticate();
      
      console.log(`📊 Fetching items for user: ${clientUserId}`);
      
      const response = await axios.get(`${this.baseUrl}/items`, {
        headers: {
          'X-API-KEY': apiKey
        },
        params: {
          clientUserId: clientUserId
        }
      });

      const items = response.data.results || response.data;
      console.log(`✅ Retrieved ${items.length} items`);
      
      return items.map(item => ({
        id: item.id,
        connectorId: item.connector?.id,
        connectorName: item.connector?.name,
        connectorImageUrl: item.connector?.imageUrl,
        status: item.status,
        statusDetail: item.statusDetail,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        clientUserId: item.clientUserId
      }));
      
    } catch (error) {
      console.error('❌ Failed to get items:', error.response?.data || error.message);
      throw new Error('Failed to get items');
    }
  }

  /**
   * Get accounts for a specific item
   */
  async getAccounts(itemId) {
    try {
      const apiKey = await this.authenticate();
      
      console.log(`💳 Fetching accounts for item: ${itemId}`);
      
      const response = await axios.get(`${this.baseUrl}/accounts`, {
        headers: {
          'X-API-KEY': apiKey
        },
        params: {
          itemId: itemId
        }
      });

      const accounts = response.data.results || response.data;
      console.log(`✅ Retrieved ${accounts.length} accounts`);
      
      return accounts.map(account => ({
        id: account.id,
        itemId: account.itemId,
        type: account.type,
        subtype: account.subtype,
        name: account.name,
        marketingName: account.marketingName,
        balance: account.balance,
        currencyCode: account.currencyCode || 'BRL',
        owner: account.owner,
        number: account.number,
        taxNumber: account.taxNumber,
        creditData: account.creditData
      }));
      
    } catch (error) {
      console.error('❌ Failed to get accounts:', error.response?.data || error.message);
      throw new Error('Failed to get accounts');
    }
  }

  /**
   * Get transactions for an account with pagination
   */
  async getTransactions(accountId, options = {}) {
    try {
      const apiKey = await this.authenticate();
      
      const params = {
        accountId: accountId,
        pageSize: options.pageSize || 100,
        page: options.page || 0
      };

      if (options.from) params.from = options.from;
      if (options.to) params.to = options.to;

      console.log(`💰 Fetching transactions for account: ${accountId} (page ${params.page})`);

      const response = await axios.get(`${this.baseUrl}/transactions`, {
        headers: {
          'X-API-KEY': apiKey
        },
        params: params
      });

      const transactions = response.data.results || response.data;
      const pagination = {
        page: response.data.page || 0,
        totalPages: response.data.totalPages || 1,
        total: response.data.total || transactions.length,
        hasMore: (response.data.page || 0) < (response.data.totalPages || 1) - 1
      };

      console.log(`✅ Retrieved ${transactions.length} transactions (page ${pagination.page + 1}/${pagination.totalPages})`);

      return {
        transactions: transactions.map(tx => ({
          id: tx.id,
          accountId: tx.accountId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          balance: tx.balance,
          currencyCode: tx.currencyCode || 'BRL',
          category: tx.category,
          categoryId: tx.categoryId,
          type: tx.type,
          paymentData: tx.paymentData,
          creditCardMetadata: tx.creditCardMetadata
        })),
        pagination
      };
      
    } catch (error) {
      console.error('❌ Failed to get transactions:', error.response?.data || error.message);
      throw new Error('Failed to get transactions');
    }
  }

  /**
   * Get complete financial data for a user
   */
  async getUserFinancialData(clientUserId, options = {}) {
    try {
      console.log(`📊 Fetching complete financial data for user: ${clientUserId}`);
      
      const items = await this.getItems(clientUserId);
      const allAccounts = [];
      const allTransactions = [];
      
      for (const item of items) {
        // Only process successfully connected items
        if (item.status !== 'UPDATED') {
          console.log(`⚠️ Skipping item ${item.id} - status: ${item.status}`);
          continue;
        }
        
        const accounts = await this.getAccounts(item.id);
        
        // Add connector info to accounts
        const accountsWithConnector = accounts.map(account => ({
          ...account,
          connectorName: item.connectorName,
          connectorImageUrl: item.connectorImageUrl
        }));
        
        allAccounts.push(...accountsWithConnector);
        
        // Get transactions for each account
        for (const account of accounts) {
          const { transactions } = await this.getTransactions(account.id, {
            from: options.from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            pageSize: options.pageSize || 200
          });
          
          // Add account info to transactions
          const transactionsWithAccount = transactions.map(tx => ({
            ...tx,
            accountName: account.name,
            accountType: account.type,
            connectorName: item.connectorName
          }));
          
          allTransactions.push(...transactionsWithAccount);
        }
      }
      
      console.log(`✅ Retrieved complete data: ${items.length} items, ${allAccounts.length} accounts, ${allTransactions.length} transactions`);
      
      return {
        items,
        accounts: allAccounts,
        transactions: allTransactions,
        summary: {
          totalItems: items.length,
          activeItems: items.filter(i => i.status === 'UPDATED').length,
          totalAccounts: allAccounts.length,
          totalTransactions: allTransactions.length,
          retrievedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to get user financial data:', error);
      throw error;
    }
  }

  /**
   * Handle webhook from Pluggy and sync data to database
   */
  async handleWebhook(payload, db = null) {
    try {
      console.log('📥 Processing Pluggy webhook:', payload.event);
      
      const { event, itemId, clientUserId, data } = payload;
      
      const result = {
        event,
        itemId,
        clientUserId,
        processedAt: new Date().toISOString()
      };
      
      switch (event) {
        case 'item/created':
          console.log(`✅ Item created: ${itemId} for user: ${clientUserId}`);
          result.message = 'Bank connection created successfully';
          
          // Store user-itemId mapping in database
          if (db) {
            await this.storeItemMapping(db, {
              userPhone: `+${clientUserId}`, // Assuming clientUserId is phone digits
              pluggyItemId: itemId,
              clientUserId,
              event: 'item/created',
              status: 'CREATED'
            });
          }
          
          // Fetch and store the financial data
          console.log(`🔄 Syncing financial data for itemId: ${itemId}`);
          try {
            const accounts = await this.getAccounts(itemId);
            console.log(`✅ Found ${accounts.length} accounts for item ${itemId}`);
            
            if (db && accounts.length > 0) {
              await this.storeFinancialData(db, itemId, accounts, clientUserId);
            }
            
            result.syncedData = {
              itemId,
              accountsFound: accounts.length,
              accountsStored: db ? accounts.length : 0
            };
          } catch (syncError) {
            console.error('⚠️ Failed to sync data after item creation:', syncError.message);
            result.syncError = syncError.message;
          }
          break;
          
        case 'item/updated':
          console.log(`🔄 Item updated: ${itemId} for user: ${clientUserId}`);
          result.message = 'Bank connection updated with new data';
          
          // Update status in database
          if (db) {
            await this.updateItemStatus(db, itemId, 'UPDATED');
          }
          
          // Re-sync financial data
          console.log(`🔄 Re-syncing financial data for itemId: ${itemId}`);
          try {
            const accounts = await this.getAccounts(itemId);
            console.log(`✅ Re-synced ${accounts.length} accounts for item ${itemId}`);
            
            if (db && accounts.length > 0) {
              await this.storeFinancialData(db, itemId, accounts, clientUserId);
            }
            
            result.syncedData = {
              itemId,
              accountsFound: accounts.length,
              accountsUpdated: db ? accounts.length : 0
            };
          } catch (syncError) {
            console.error('⚠️ Failed to sync data after item update:', syncError.message);
            result.syncError = syncError.message;
          }
          break;
          
        case 'item/error':
          console.log(`❌ Item error: ${itemId} for user: ${clientUserId}`, data?.error);
          result.message = 'Bank connection encountered an error';
          result.error = data?.error;
          
          if (db) {
            await this.updateItemStatus(db, itemId, 'ERROR', data?.error);
          }
          break;
          
        case 'item/waiting_user_input':
          console.log(`⏳ Item waiting for user input: ${itemId}`);
          result.message = 'Bank connection waiting for additional user input (MFA, etc.)';
          
          if (db) {
            await this.updateItemStatus(db, itemId, 'WAITING_USER_INPUT');
          }
          break;
          
        default:
          console.log(`ℹ️ Unhandled webhook event: ${event}`);
          result.message = `Unhandled event: ${event}`;
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to process webhook:', error);
      throw error;
    }
  }

  /**
   * Store user-itemId mapping in database
   */
  async storeItemMapping(db, { userPhone, pluggyItemId, clientUserId, event, status }) {
    try {
      console.log(`💾 Storing item mapping: ${userPhone} → ${pluggyItemId}`);
      
      const client = await db.getClient();
      
      try {
        // First, ensure user exists in users table
        const userResult = await client.query(`
          INSERT INTO users (phone_number, first_name, created_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (phone_number) DO UPDATE SET
          updated_at = NOW()
          RETURNING id
        `, [userPhone, 'Pluggy User']);
        
        const userId = userResult.rows[0].id;
        
        // Store item with proper user_id reference
        await client.query(`
          INSERT INTO pluggy_v2_items (
            user_id, pluggy_item_id, client_user_id, status, 
            connector_name, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (user_id, pluggy_item_id) DO UPDATE SET
          status = $4, updated_at = NOW()
        `, [
          userId,
          pluggyItemId,
          clientUserId,
          status,
          'Unknown' // Will be updated when we fetch account data
        ]);
        
        console.log(`✅ Stored item mapping: ${userPhone} → ${pluggyItemId}`);
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Failed to store item mapping:', error);
      throw error;
    }
  }

  /**
   * Store financial data (accounts and transactions) in database
   */
  async storeFinancialData(db, itemId, accounts, clientUserId) {
    try {
      console.log(`💾 Storing financial data for item: ${itemId}`);
      
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Get user and item info from our database
        const itemResult = await client.query(
          'SELECT user_id, connector_name FROM pluggy_v2_items WHERE pluggy_item_id = $1',
          [itemId]
        );
        
        if (itemResult.rows.length === 0) {
          throw new Error(`Item ${itemId} not found in database`);
        }
        
        const userId = itemResult.rows[0].user_id;
        let connectorName = itemResult.rows[0].connector_name;
        
        // Store accounts
        for (const account of accounts) {
          // Update connector name if we have it
          if (account.connectorName && connectorName === 'Unknown') {
            await client.query(
              'UPDATE pluggy_v2_items SET connector_name = $1 WHERE pluggy_item_id = $2',
              [account.connectorName, itemId]
            );
            connectorName = account.connectorName;
          }
          
          // Store account using the existing schema
          await client.query(`
            INSERT INTO pluggy_v2_accounts (
              user_id, pluggy_account_id, pluggy_item_id, client_user_id,
              type, subtype, name, marketing_name, balance, currency_code, 
              owner, account_number, tax_number, credit_data,
              connector_name, connector_image_url,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
            ON CONFLICT (user_id, pluggy_account_id) DO UPDATE SET
            balance = $9, updated_at = NOW()
          `, [
            userId,
            account.id,
            itemId,
            clientUserId,
            account.type,
            account.subtype,
            account.name,
            account.marketingName,
            account.balance || 0,
            account.currencyCode || 'BRL',
            account.owner,
            account.number,
            account.taxNumber,
            JSON.stringify(account.creditData),
            connectorName,
            account.connectorImageUrl
          ]);
          
          console.log(`✅ Stored account: ${account.name} (${account.currencyCode} ${account.balance})`);
          
          // Store recent transactions for this account
          try {
            const { transactions } = await this.getTransactions(account.id, {
              pageSize: 50, // Store recent 50 transactions
              from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Last 30 days
            });
            
            for (const transaction of transactions) {
              await client.query(`
                INSERT INTO pluggy_v2_transactions (
                  user_id, pluggy_transaction_id, pluggy_account_id, client_user_id,
                  transaction_date, description, amount, balance, currency_code, 
                  category, category_id, transaction_type, payment_data, 
                  credit_card_metadata, account_name, account_type, connector_name,
                  created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
                ON CONFLICT (user_id, pluggy_transaction_id) DO NOTHING
              `, [
                userId,
                transaction.id,
                account.id,
                clientUserId,
                transaction.date,
                transaction.description,
                transaction.amount,
                transaction.balance,
                transaction.currencyCode || 'BRL',
                transaction.category,
                transaction.categoryId,
                transaction.type,
                JSON.stringify(transaction.paymentData),
                JSON.stringify(transaction.creditCardMetadata),
                account.name,
                account.type,
                connectorName
              ]);
            }
            
            console.log(`✅ Stored ${transactions.length} transactions for account: ${account.name}`);
            
          } catch (txError) {
            console.error(`⚠️ Failed to store transactions for account ${account.id}:`, txError.message);
            // Don't fail the entire operation if transactions fail
          }
        }
        
        await client.query('COMMIT');
        console.log(`✅ Stored complete financial data for item: ${itemId}`);
        
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
   * Update item status in database
   */
  async updateItemStatus(db, itemId, status, errorDetails = null) {
    try {
      const client = await db.getClient();
      
      try {
        await client.query(`
          UPDATE pluggy_v2_items 
          SET status = $1, error_details = $2, updated_at = NOW()
          WHERE pluggy_item_id = $3
        `, [
          status,
          errorDetails ? JSON.stringify(errorDetails) : null,
          itemId
        ]);
        
        console.log(`✅ Updated item ${itemId} status to: ${status}`);
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Failed to update item status:', error);
      throw error;
    }
  }

  /**
   * Test the integration - verify credentials and connectivity
   */
  async testConnection() {
    try {
      console.log('🧪 Testing Pluggy V2 connection...');
      
      // Test authentication
      const apiKey = await this.authenticate();
      
      // Test getting connectors
      const connectors = await this.getConnectors();
      
      const result = {
        success: true,
        message: 'Pluggy V2 connection working perfectly!',
        data: {
          authenticated: true,
          apiKeyLength: apiKey.length,
          totalConnectors: connectors.length,
          sampleConnectors: connectors.slice(0, 3).map(c => ({
            name: c.name,
            type: c.type,
            country: c.country
          }))
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('🎉 Connection test passed!');
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      console.error('❌ Connection test failed:', error.message);
      return result;
    }
  }

  /**
   * Get all consents - potentially provides user discovery
   * Based on Pluggy docs: /reference/consents-list
   */
  async getConsents() {
    try {
      const apiKey = await this.authenticate();
      
      console.log('📋 Fetching all consents...');
      
      const response = await axios.get(`${this.baseUrl}/consents`, {
        headers: {
          'X-API-KEY': apiKey
        }
      });

      const consents = response.data.results || response.data || [];
      console.log(`✅ Retrieved ${consents.length} consents`);
      
      if (consents.length > 0) {
        console.log('📊 Sample consent structure:');
        console.log(JSON.stringify(consents[0], null, 2));
      }
      
      return consents;
      
    } catch (error) {
      console.error('❌ Failed to get consents:', error.response?.data || error.message);
      throw new Error('Failed to get consents');
    }
  }

  /**
   * Debug method: Get ALL items without clientUserId filtering
   * This tests if Pluggy allows bulk item discovery despite documentation
   */
  async getAllItems() {
    try {
      const apiKey = await this.authenticate();
      
      console.log('🔍 Fetching ALL items (no clientUserId filter)...');
      
      const response = await axios.get(`${this.baseUrl}/items`, {
        headers: {
          'X-API-KEY': apiKey
        }
        // Deliberately no params to test bulk discovery
      });

      const items = response.data.results || response.data || [];
      console.log(`✅ Retrieved ${items.length} total items`);
      
      if (items.length > 0) {
        // Analyze clientUserIds
        const uniqueClientUserIds = [...new Set(items.map(item => item.clientUserId))].filter(Boolean);
        console.log(`🆔 Unique clientUserIds found: ${uniqueClientUserIds.length}`);
        
        console.log('📊 Sample item structure:');
        console.log(JSON.stringify(items[0], null, 2));
      }
      
      return items;
      
    } catch (error) {
      console.error('❌ Failed to get all items:', error.response?.data || error.message);
      throw new Error('Failed to get all items');
    }
  }

  /**
   * Debug transactions with different parameters
   */
  async debugTransactions(accountId) {
    try {
      const apiKey = await this.authenticate();
      
      console.log(`🔍 Debug transactions for account: ${accountId}`);
      
      // Test different parameter combinations
      const testCases = [
        { description: 'No parameters', params: {} },
        { description: 'Large page size', params: { pageSize: 500 } },
        { description: 'Last 365 days', params: { 
          from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          pageSize: 200 
        }},
        { description: 'All pages', params: { pageSize: 100, page: 0 } }
      ];
      
      const results = [];
      
      for (const testCase of testCases) {
        console.log(`\n🧪 Testing: ${testCase.description}`);
        
        try {
          const response = await axios.get(`${this.baseUrl}/transactions`, {
            headers: {
              'X-API-KEY': apiKey
            },
            params: {
              accountId: accountId,
              ...testCase.params
            }
          });

          const transactions = response.data.results || response.data || [];
          const total = response.data.total || transactions.length;
          const totalPages = response.data.totalPages || 1;
          
          console.log(`✅ Found ${transactions.length} transactions (total: ${total}, pages: ${totalPages})`);
          
          if (transactions.length > 0) {
            console.log(`📊 Sample transaction: ${transactions[0].date}: ${transactions[0].description} - ${transactions[0].amount}`);
          }
          
          results.push({
            testCase: testCase.description,
            success: true,
            count: transactions.length,
            total,
            totalPages,
            sampleTransaction: transactions[0] || null
          });
          
        } catch (error) {
          console.log(`❌ ${testCase.description} failed: ${error.response?.data?.message || error.message}`);
          results.push({
            testCase: testCase.description,
            success: false,
            error: error.response?.data || error.message
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Debug transactions failed:', error);
      throw error;
    }
  }

  /**
   * Generate financial summary from raw data
   */
  generateFinancialSummary(financialData) {
    const { accounts, transactions } = financialData;
    
    // Account summary by type
    const accountSummary = accounts.reduce((acc, account) => {
      const type = account.type || 'UNKNOWN';
      if (!acc[type]) {
        acc[type] = { count: 0, totalBalance: 0, accounts: [] };
      }
      
      acc[type].count++;
      acc[type].totalBalance += account.balance || 0;
      acc[type].accounts.push({
        name: account.name,
        balance: account.balance,
        connector: account.connectorName
      });
      
      return acc;
    }, {});
    
    // Transaction analysis (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = transactions.filter(tx => new Date(tx.date) >= thirtyDaysAgo);
    
    const transactionSummary = recentTransactions.reduce((acc, tx) => {
      acc.totalCount++;
      
      if (tx.amount > 0) {
        acc.income.total += tx.amount;
        acc.income.count++;
      } else {
        acc.expenses.total += Math.abs(tx.amount);
        acc.expenses.count++;
      }
      
      // Category breakdown
      const category = tx.category || 'Uncategorized';
      if (!acc.categories[category]) {
        acc.categories[category] = { count: 0, amount: 0 };
      }
      acc.categories[category].count++;
      acc.categories[category].amount += Math.abs(tx.amount);
      
      return acc;
    }, {
      totalCount: 0,
      income: { total: 0, count: 0 },
      expenses: { total: 0, count: 0 },
      categories: {}
    });
    
    return {
      accounts: accountSummary,
      transactions: transactionSummary,
      netFlow: transactionSummary.income.total - transactionSummary.expenses.total,
      period: {
        from: thirtyDaysAgo.toISOString(),
        to: new Date().toISOString(),
        days: 30
      },
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = PluggyV2;