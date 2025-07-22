#!/usr/bin/env node

// Test Arnaldo AI locally
require('dotenv').config();
const ArnaldoAI = require('../src/services/ArnaldoAI');
const ExpenseParser = require('../src/services/ExpenseParser');

async function testArnaldo() {
  console.log('🧪 Testing Arnaldo AI\n');
  
  // Test 1: OpenAI Connection
  console.log('1️⃣ Testing OpenAI connection...');
  try {
    const arnaldo = new ArnaldoAI();
    const response = await arnaldo.processMessage('Oi', { messages: [], profile: null });
    console.log('✅ OpenAI connected successfully');
    console.log('Response:', response);
  } catch (error) {
    console.error('❌ OpenAI error:', error.message);
    console.log('\nMake sure OPENAI_API_KEY is set in .env');
    return;
  }
  
  // Test 2: Expense Parser
  console.log('\n2️⃣ Testing expense parser...');
  const testMessages = [
    'gastei 50 no mercado',
    'uber 15',
    '30 reais de gasolina',
    'comprei remédio por 45'
  ];
  
  testMessages.forEach(msg => {
    const expense = ExpenseParser.parse(msg);
    if (expense) {
      console.log(`✅ "${msg}" → R$${expense.amount} (${expense.category})`);
    } else {
      console.log(`❌ "${msg}" → Failed to parse`);
    }
  });
  
  // Test 3: Context with expenses
  console.log('\n3️⃣ Testing with context...');
  try {
    const arnaldo = new ArnaldoAI();
    const context = {
      messages: [
        { direction: 'inbound', content: { text: 'gastei 50 no mercado' } }
      ],
      profile: { monthly_income: 1500, payday: 5 },
      expenses: { 
        todayTotal: 50, 
        dailyBudget: 50, 
        remainingToday: 0 
      }
    };
    
    const response = await arnaldo.processMessage(
      'acabei de gastar todo meu limite do dia', 
      context
    );
    console.log('✅ Context response:', response);
  } catch (error) {
    console.error('❌ Context error:', error);
  }
}

testArnaldo();