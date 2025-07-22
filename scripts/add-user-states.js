#!/usr/bin/env node

// Migration script to add user_states table for persistent state management
require('dotenv').config();
const db = require('../src/database/db');

async function migrate() {
  console.log('🔄 Starting user_states migration...');
  
  try {
    // 1. Create user_states table
    console.log('📊 Creating user_states table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_states (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        current_state VARCHAR(50) NOT NULL,
        previous_state VARCHAR(50),
        context JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 2. Create index for performance
    console.log('📈 Creating indexes...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_states_current 
      ON user_states(current_state)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_states_updated 
      ON user_states(updated_at)
    `);
    
    // 3. Migrate existing users to appropriate states
    console.log('👥 Migrating existing users...');
    const users = await db.query(`
      SELECT 
        u.id, 
        u.onboarding_completed, 
        u.created_at,
        u.monthly_income,
        COUNT(DISTINCT g.id) as goal_count,
        COUNT(DISTINCT m.id) as message_count
      FROM users u
      LEFT JOIN goals g ON u.id = g.user_id
      LEFT JOIN conversations c ON u.id = c.user_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      GROUP BY u.id, u.onboarding_completed, u.created_at, u.monthly_income
    `);
    
    let migrated = 0;
    for (const user of users.rows) {
      let state;
      let context = {};
      
      // Determine appropriate state based on user data
      if (!user.onboarding_completed) {
        if (parseInt(user.goal_count) === 0) {
          // No goals yet - start of onboarding
          state = 'onboarding_welcome';
          context.step = 'goal_discovery';
        } else if (!user.monthly_income) {
          // Has goals but no income
          state = 'onboarding_income';
          context.step = 'income_collection';
        } else {
          // Has goals and income but onboarding not marked complete
          state = 'onboarding_complete';
          context.step = 'plan_creation';
        }
      } else {
        // Onboarding completed - active user
        state = 'tracking_active';
        context.onboardedAt = user.created_at;
      }
      
      // Insert state record
      await db.query(`
        INSERT INTO user_states (user_id, current_state, context)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          current_state = EXCLUDED.current_state,
          context = EXCLUDED.context,
          updated_at = NOW()
      `, [user.id, state, JSON.stringify(context)]);
      
      migrated++;
    }
    
    console.log(`✅ Successfully migrated ${migrated} users to new state system`);
    
    // 4. Verify migration
    const stateCount = await db.query(`
      SELECT current_state, COUNT(*) as count
      FROM user_states
      GROUP BY current_state
      ORDER BY count DESC
    `);
    
    console.log('\n📊 State distribution:');
    stateCount.rows.forEach(row => {
      console.log(`   ${row.current_state}: ${row.count} users`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrate;