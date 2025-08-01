#!/usr/bin/env node

/**
 * Database migration for Pluggy V2 Open Finance tables
 * Creates clean schema optimized for V2 integration
 */

require('dotenv').config();
const db = require('../src/database/db');

async function addPluggyV2Tables() {
  try {
    console.log('🏗️ Creating Pluggy V2 Open Finance tables...');
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Pluggy V2 User Consents - Track user permissions and connection status
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_v2_user_consents (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          client_user_id VARCHAR(255) NOT NULL, -- Pluggy's clientUserId 
          consent_status VARCHAR(50) DEFAULT 'active',
          consent_given_at TIMESTAMP DEFAULT NOW(),
          last_sync_at TIMESTAMP,
          webhook_url VARCHAR(500),
          total_items INTEGER DEFAULT 0,
          total_accounts INTEGER DEFAULT 0,
          total_transactions INTEGER DEFAULT 0,
          sync_status VARCHAR(50) DEFAULT 'pending',
          error_details JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(user_id),
          UNIQUE(client_user_id)
        )
      `);
      console.log('✅ Created pluggy_v2_user_consents table');
      
      // Pluggy V2 Items - Bank connections/integrations
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_v2_items (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          pluggy_item_id VARCHAR(255) NOT NULL,
          client_user_id VARCHAR(255) NOT NULL,
          connector_id INTEGER,
          connector_name VARCHAR(255),
          connector_image_url VARCHAR(500),
          status VARCHAR(50) NOT NULL,
          status_detail JSONB,
          last_updated_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(user_id, pluggy_item_id),
          INDEX(client_user_id),
          INDEX(status)
        )
      `);
      console.log('✅ Created pluggy_v2_items table');
      
      // Pluggy V2 Accounts - Bank accounts from connected items
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_v2_accounts (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          pluggy_account_id VARCHAR(255) NOT NULL,
          pluggy_item_id VARCHAR(255) NOT NULL,
          client_user_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          subtype VARCHAR(50),
          name VARCHAR(255) NOT NULL,
          marketing_name VARCHAR(255),
          balance DECIMAL(15,2),
          currency_code VARCHAR(3) DEFAULT 'BRL',
          owner VARCHAR(255),
          account_number VARCHAR(100),
          tax_number VARCHAR(50),
          credit_data JSONB,
          connector_name VARCHAR(255),
          connector_image_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(user_id, pluggy_account_id),
          INDEX(client_user_id),
          INDEX(type),
          INDEX(pluggy_item_id)
        )
      `);
      console.log('✅ Created pluggy_v2_accounts table');
      
      // Pluggy V2 Transactions - Financial transactions
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_v2_transactions (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          pluggy_transaction_id VARCHAR(255) NOT NULL,
          pluggy_account_id VARCHAR(255) NOT NULL,
          client_user_id VARCHAR(255) NOT NULL,
          transaction_date DATE NOT NULL,
          description VARCHAR(500) NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          balance DECIMAL(15,2),
          currency_code VARCHAR(3) DEFAULT 'BRL',
          category VARCHAR(255),
          category_id VARCHAR(100),
          transaction_type VARCHAR(50),
          payment_data JSONB,
          credit_card_metadata JSONB,
          account_name VARCHAR(255),
          account_type VARCHAR(50),
          connector_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(user_id, pluggy_transaction_id),
          INDEX(client_user_id),
          INDEX(transaction_date DESC),
          INDEX(category),
          INDEX(amount),
          INDEX(pluggy_account_id)
        )
      `);
      console.log('✅ Created pluggy_v2_transactions table');
      
      // Pluggy V2 Sync Log - Track synchronization activities
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_v2_sync_log (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          client_user_id VARCHAR(255) NOT NULL,
          sync_type VARCHAR(50) NOT NULL, -- 'manual', 'webhook', 'scheduled'
          sync_status VARCHAR(50) NOT NULL, -- 'success', 'error', 'partial'
          items_synced INTEGER DEFAULT 0,
          accounts_synced INTEGER DEFAULT 0,
          transactions_synced INTEGER DEFAULT 0,
          error_message TEXT,
          sync_duration_ms INTEGER,
          started_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP,
          
          INDEX(client_user_id),
          INDEX(sync_status),
          INDEX(started_at DESC)
        )
      `);
      console.log('✅ Created pluggy_v2_sync_log table');
      
      // Pluggy V2 Webhooks - Log webhook events
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_v2_webhooks (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(100) NOT NULL,
          pluggy_item_id VARCHAR(255),
          client_user_id VARCHAR(255),
          event_data JSONB NOT NULL,
          processed BOOLEAN DEFAULT FALSE,
          processed_at TIMESTAMP,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          
          INDEX(event_type),
          INDEX(client_user_id),
          INDEX(processed),
          INDEX(created_at DESC)
        )
      `);
      console.log('✅ Created pluggy_v2_webhooks table');
      
      // Update existing users table to ensure UUID support
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS pluggy_v2_client_user_id VARCHAR(255) UNIQUE
      `);
      console.log('✅ Added pluggy_v2_client_user_id to users table');
      
      await client.query('COMMIT');
      console.log('🎉 All Pluggy V2 tables created successfully!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error creating Pluggy V2 tables:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addPluggyV2Tables()
    .then(() => {
      console.log('✅ Pluggy V2 migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Pluggy V2 migration failed:', error);
      process.exit(1);
    });
}

module.exports = addPluggyV2Tables;