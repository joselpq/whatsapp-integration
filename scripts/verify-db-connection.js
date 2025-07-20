// Database connection verification script
// This script will verify that PostgreSQL is properly connected to Railway

const { Pool } = require('pg');
require('dotenv').config();

async function verifyDatabaseConnection() {
  console.log('🔍 Verifying database connection...\n');
  
  // Check if DATABASE_URL exists
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('   Make sure PostgreSQL is added to Railway and deployed');
    return false;
  }
  
  console.log('✅ DATABASE_URL found');
  console.log('   URL:', process.env.DATABASE_URL.replace(/:[^:]+@/, ':****@')); // Hide password
  
  // Test database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test basic connection
    console.log('\n🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL');
    
    // Test query execution
    console.log('\n📊 Testing query execution...');
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Query executed successfully');
    console.log('   Current time:', result.rows[0].current_time);
    console.log('   PostgreSQL version:', result.rows[0].postgres_version.split(' ')[0]);
    
    // Check if our tables exist
    console.log('\n🏗️  Checking table structure...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'conversations', 'messages')
      ORDER BY table_name;
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️  No application tables found - database needs setup');
      console.log('   Run: npm run db:setup-prod');
    } else {
      console.log('✅ Found application tables:');
      tableCheck.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      
      // Check table row counts
      console.log('\n📈 Table statistics:');
      for (const table of tableCheck.rows) {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        console.log(`   ${table.table_name}: ${countResult.rows[0].count} records`);
      }
    }
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Database verification completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Database verification failed:');
    console.error('   Error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('   This usually means the database host is not reachable');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   This usually means the database is not running or not accepting connections');
    } else if (error.code === '28P01') {
      console.log('   This usually means authentication failed - check credentials');
    }
    
    await pool.end();
    return false;
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyDatabaseConnection().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = verifyDatabaseConnection;