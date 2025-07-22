#!/usr/bin/env node

// Test Arnaldo AI locally
require('dotenv').config();
const ArnaldoAI = require('../src/services/ArnaldoAI');
const ExpenseParser = require('../src/services/ExpenseParser');
const IncomeParser = require('../src/services/IncomeParser');

async function testArnaldo() {
  console.log('🧪 Testing Arnaldo AI\n');
  
  // Test 1: Income vs Expense Detection
  console.log('1️⃣ Testing income vs expense detection...');
  const testMessages = [
    'gastei 50 no mercado',    // Should be expense
    'ganho 4000 por mês',      // Should be income, NOT expense
    'uber 15',                 // Should be expense
    'meu salário é 3000',      // Should be income, NOT expense
    '30 reais de gasolina',    // Should be expense
    'recebo 2500'              // Should be income, NOT expense
  ];
  
  testMessages.forEach(msg => {
    const isExpense = ExpenseParser.isExpenseMessage(msg);
    const isIncome = IncomeParser.isIncomeMessage(msg);
    
    console.log(`"${msg}"`);
    console.log(`  Expense: ${isExpense ? '✅' : '❌'}`);
    console.log(`  Income: ${isIncome ? '✅' : '❌'}`);
    
    if (isExpense) {
      const expense = ExpenseParser.parse(msg);
      console.log(`  → R$${expense?.amount} (${expense?.category})`);
    }
    if (isIncome) {
      const income = IncomeParser.parse(msg);
      console.log(`  → R$${income?.amount} monthly income`);
    }
    console.log('');
  });
  
  // Test 2: Concise AI responses
  console.log('\n2️⃣ Testing concise responses...');
  try {
    const arnaldo = new ArnaldoAI();
    const response = await arnaldo.processMessage('Oi Arnaldo', { messages: [], profile: null });
    console.log('Response length:', response.length, 'characters');
    console.log('Response:', response);
    
    if (response.length < 150) {
      console.log('✅ Response is concise');
    } else {
      console.log('❌ Response too long, should be shorter');
    }
  } catch (error) {
    console.error('❌ AI error:', error.message);
  }
}

testArnaldo();