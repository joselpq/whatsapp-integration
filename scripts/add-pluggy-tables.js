#!/usr/bin/env node

// Database migration to add Pluggy Open Finance tables
require('dotenv').config();
const db = require('../src/database/db');

async function addPluggyTables() {
  try {
    console.log('🏗️ Creating Pluggy Open Finance tables...');
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Table for storing Pluggy items (bank connections)
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_items (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          pluggy_item_id VARCHAR(255) NOT NULL,
          connector_name VARCHAR(255),
          status VARCHAR(50) NOT NULL,
          status_detail JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(user_id, pluggy_item_id)
        )
      `);
      console.log('✅ Created pluggy_items table');
      
      // Table for storing Pluggy accounts
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_accounts (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          pluggy_account_id VARCHAR(255) NOT NULL,
          pluggy_item_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          subtype VARCHAR(50),
          name VARCHAR(255) NOT NULL,
          marketing_name VARCHAR(255),
          balance DECIMAL(15,2),
          owner VARCHAR(255),
          account_number VARCHAR(100),
          tax_number VARCHAR(50),
          currency_code VARCHAR(3) DEFAULT 'BRL',
          credit_data JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(user_id, pluggy_account_id)
        )
      `);
      console.log('✅ Created pluggy_accounts table');
      
      // Table for storing Pluggy transactions
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_transactions (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          pluggy_transaction_id VARCHAR(255) NOT NULL,
          pluggy_account_id VARCHAR(255) NOT NULL,
          transaction_date DATE NOT NULL,
          description VARCHAR(500) NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          balance DECIMAL(15,2),
          currency_code VARCHAR(3) DEFAULT 'BRL',
          category VARCHAR(255),
          category_id VARCHAR(100),
          payment_data JSONB,
          credit_card_metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(user_id, pluggy_transaction_id)
        )
      `);
      console.log('✅ Created pluggy_transactions table');
      
      // Table for storing user consent and connection status
      await client.query(`
        CREATE TABLE IF NOT EXISTS pluggy_user_consents (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          consent_given_at TIMESTAMP DEFAULT NOW(),
          consent_status VARCHAR(50) DEFAULT 'active',
          last_sync_at TIMESTAMP,
          total_accounts INTEGER DEFAULT 0,
          total_transactions INTEGER DEFAULT 0,
          sync_status VARCHAR(50) DEFAULT 'pending',
          error_details JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(user_id)
        )
      `);
      console.log('✅ Created pluggy_user_consents table');
      
      // Indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pluggy_transactions_user_date 
        ON pluggy_transactions(user_id, transaction_date DESC)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pluggy_transactions_category 
        ON pluggy_transactions(user_id, category)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pluggy_accounts_user_type 
        ON pluggy_accounts(user_id, type)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pluggy_items_user_status 
        ON pluggy_items(user_id, status)
      `);
      
      console.log('✅ Created indexes');
      
      await client.query('COMMIT');
      console.log('🎉 All Pluggy tables created successfully!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error creating Pluggy tables:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addPluggyTables()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addPluggyTables;