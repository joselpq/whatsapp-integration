#!/usr/bin/env node

// Mock test for Goal Wizard without database dependency
require('dotenv').config();

const GoalIntelligence = require('../src/services/GoalIntelligence');

class MockGoalWizardTester {
  constructor() {
    this.testResults = [];
  }

  async runMockTests() {
    console.log('🧪 Running Goal Wizard Mock Tests (No Database)...\n');
    
    try {
      // Test 1: Goal Intelligence Parsing
      await this.testGoalParsing();
      
      // Test 2: Fallback Mechanisms
      await this.testFallbackMethods();
      
      // Test 3: Helper Functions
      await this.testHelperFunctions();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Mock test suite failed:', error);
      throw error;
    }
  }

  async testGoalParsing() {
    console.log('1️⃣ Testing Goal Intelligence Parsing...');
    
    // Only test if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('   ⚠️  OpenAI API key not found - skipping AI tests');
      return;
    }

    const goalIntelligence = new GoalIntelligence();
    
    const testCases = [
      {
        name: 'Simple Car Purchase',
        input: 'Quero comprar um carro',
        expectsExtraction: true
      },
      {
        name: 'Complete Goal with Amount',
        input: 'Quero comprar um carro usado de 30 mil reais',
        expectsExtraction: true
      },
      {
        name: 'Emergency Fund',
        input: 'Preciso criar uma reserva de emergência',
        expectsExtraction: true
      }
    ];
    
    for (const testCase of testCases) {
      try {
        console.log(`   🔍 Testing: ${testCase.input}`);
        
        const result = await goalIntelligence.analyzeGoalMessage(
          testCase.input, 
          'test-user-123'
        );
        
        const passed = this.validateAIResponse(result);
        
        this.testResults.push({
          category: 'AI Parsing',
          name: testCase.name,
          passed,
          hasMessage: !!result.message,
          hasExtraction: !!result.extracted_data
        });
        
        console.log(`     ${passed ? '✅' : '❌'} ${testCase.name}`);
        console.log(`     Response: "${result.message?.substring(0, 50)}..."`);
        
      } catch (error) {
        console.log(`     ❌ ${testCase.name}: Error - ${error.message}`);
        this.testResults.push({
          category: 'AI Parsing',
          name: testCase.name,
          passed: false,
          error: error.message
        });
      }
    }
  }

  async testFallbackMethods() {
    console.log('\n2️⃣ Testing Fallback Methods...');
    
    const goalIntelligence = new GoalIntelligence();
    
    const testCases = [
      {
        name: 'Car Purchase Fallback',
        input: 'Quero comprar um carro',
        expectedType: 'purchase'
      },
      {
        name: 'Emergency Fund Fallback', 
        input: 'Preciso de uma reserva',
        expectedType: 'emergency'
      },
      {
        name: 'Debt Payment Fallback',
        input: 'Quero quitar dívidas',
        expectedType: 'debt'
      },
      {
        name: 'Unknown Goal Fallback',
        input: 'Não sei o que quero',
        expectedType: 'unknown'
      }
    ];
    
    for (const testCase of testCases) {
      try {
        const result = goalIntelligence.fallbackGoalAnalysis(testCase.input);
        
        const passed = result && result.message && result.message.length > 0;
        
        this.testResults.push({
          category: 'Fallbacks',
          name: testCase.name,
          passed,
          response: result.message
        });
        
        console.log(`   ${passed ? '✅' : '❌'} ${testCase.name}`);
        
      } catch (error) {
        console.log(`   ❌ ${testCase.name}: Error - ${error.message}`);
        this.testResults.push({
          category: 'Fallbacks',
          name: testCase.name,
          passed: false,
          error: error.message
        });
      }
    }
  }

  async testHelperFunctions() {
    console.log('\n3️⃣ Testing Helper Functions...');
    
    const goalIntelligence = new GoalIntelligence();
    
    const amountTests = [
      { input: '30 mil', expected: 30000 },
      { input: 'R$25000', expected: 25000 },
      { input: '15 reais', expected: 15 },
      { input: '50k', expected: 50000 },
      { input: 'sem valor', expected: null }
    ];
    
    console.log('   💰 Testing amount extraction:');
    for (const test of amountTests) {
      const result = goalIntelligence.extractAmount(test.input);
      const passed = result === test.expected;
      
      this.testResults.push({
        category: 'Helpers',
        name: `Amount: ${test.input}`,
        passed,
        expected: test.expected,
        result
      });
      
      console.log(`     ${passed ? '✅' : '❌'} "${test.input}" → ${result} (expected: ${test.expected})`);
    }
    
    const timelineTests = [
      { input: '1 ano', expected: '1 ano' },
      { input: '6 meses', expected: '6 meses' },
      { input: 'este ano', expected: 'este ano' },
      { input: 'até dezembro', expected: 'até dezembro' },
      { input: 'sem prazo', expected: null }
    ];
    
    console.log('\n   📅 Testing timeline extraction:');
    for (const test of timelineTests) {
      const result = goalIntelligence.extractTimeline(test.input);
      const passed = result === test.expected;
      
      this.testResults.push({
        category: 'Helpers',
        name: `Timeline: ${test.input}`,
        passed,
        expected: test.expected,
        result
      });
      
      console.log(`     ${passed ? '✅' : '❌'} "${test.input}" → ${result} (expected: ${test.expected})`);
    }
  }

  validateAIResponse(result) {
    // Basic validation of AI response structure
    if (!result) return false;
    if (!result.message || result.message.length === 0) return false;
    if (typeof result.needs_clarification !== 'boolean') return false;
    
    return true;
  }

  printResults() {
    console.log('\n📊 Mock Test Results Summary:\n');
    
    const categories = [...new Set(this.testResults.map(t => t.category))];
    let totalPassed = 0;
    let totalTests = 0;
    
    for (const category of categories) {
      const categoryTests = this.testResults.filter(t => t.category === category);
      const passed = categoryTests.filter(t => t.passed).length;
      const total = categoryTests.length;
      
      totalPassed += passed;
      totalTests += total;
      
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      console.log(`${category}: ${passed}/${total} (${percentage}%) ${percentage >= 80 ? '✅' : '❌'}`);
      
      // Show failed tests
      const failed = categoryTests.filter(t => !t.passed);
      if (failed.length > 0 && failed.length <= 3) {
        failed.forEach(test => {
          console.log(`  ❌ ${test.name}: ${test.error || 'Failed validation'}`);
        });
      }
    }
    
    const overallPercentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    
    console.log(`\n🎯 Overall: ${totalPassed}/${totalTests} (${overallPercentage}%)`);
    
    if (overallPercentage >= 80) {
      console.log('🎉 Goal Wizard components are working correctly!');
    } else {
      console.log('⚠️  Some Goal Wizard components need attention.');
    }
    
    // Show configuration status
    console.log('\n🔧 Configuration Status:');
    console.log(`   OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   Database URL: ${process.env.DATABASE_URL ? '✅ Configured' : '❌ Missing (expected for local)'}`);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new MockGoalWizardTester();
  tester.runMockTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = MockGoalWizardTester;