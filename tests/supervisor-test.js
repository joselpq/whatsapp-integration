#!/usr/bin/env node

// Test suite for the Conversation Supervisor
require('dotenv').config();

const ConversationSupervisor = require('../src/services/ConversationSupervisor');
const GoalIntelligence = require('../src/services/GoalIntelligence');

class SupervisorTester {
  constructor() {
    this.supervisor = new ConversationSupervisor();
    this.goalIntelligence = new GoalIntelligence();
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 Starting Supervisor Test Suite...\n');
    
    try {
      // Test 1: State Transition Checks
      await this.testStateTransitions();
      
      // Test 2: Convergence Checks
      await this.testConvergence();
      
      // Test 3: Context Preservation
      await this.testContextPreservation();
      
      // Test 4: Full Integration
      await this.testFullIntegration();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }

  async testStateTransitions() {
    console.log('1️⃣ Testing State Transition Supervision...');
    
    const testCases = [
      {
        name: 'Premature Income Question',
        state: 'GOAL_DISCOVERY',
        context: {},
        message: 'Qual sua renda mensal?',
        shouldIntervene: true
      },
      {
        name: 'Premature Expense Question',
        state: 'GOAL_CLARIFICATION',
        context: { partial_goal: { goal_type: 'savings' } },
        message: 'Quais são seus gastos fixos?',
        shouldIntervene: true
      },
      {
        name: 'Appropriate Goal Question',
        state: 'GOAL_DISCOVERY',
        context: {},
        message: 'Que tipo de carro você está pensando?',
        shouldIntervene: false
      },
      {
        name: 'Complete Goal Transition',
        state: 'GOAL_CLARIFICATION',
        context: { 
          partial_goal: { 
            goal_type: 'savings',
            amount: 1000,
            timeline: '1 ano'
          }
        },
        message: '🎯 OBJETIVO DEFINIDO!\n\nEconomizar R$1.000 por mês\n\nPara criar seu plano, me conta quanto você ganha por mês?',
        shouldIntervene: false
      }
    ];
    
    for (const testCase of testCases) {
      try {
        const result = await this.supervisor.checkStateTransition(
          testCase.state,
          [{ user: 'Quero economizar dinheiro' }],
          testCase.message,
          testCase.context
        );
        
        const passed = (result.approved === !testCase.shouldIntervene);
        
        this.testResults.push({
          category: 'State Transitions',
          name: testCase.name,
          passed,
          intervened: !result.approved,
          shouldIntervene: testCase.shouldIntervene
        });
        
        console.log(`   ${passed ? '✅' : '❌'} ${testCase.name}: ${!result.approved ? 'Intervened' : 'Approved'}`);
        
      } catch (error) {
        console.log(`   ❌ ${testCase.name}: Error - ${error.message}`);
      }
    }
  }

  async testConvergence() {
    console.log('\n2️⃣ Testing Convergence Supervision...');
    
    const testCases = [
      {
        name: 'Drifting to Expenses',
        state: 'GOAL_CLARIFICATION',
        context: { partial_goal: { goal_type: 'savings' } },
        message: 'Vamos ver quanto você gasta com alimentação e transporte',
        shouldIntervene: true
      },
      {
        name: 'Staying on Goal Topic',
        state: 'GOAL_CLARIFICATION',
        context: { partial_goal: { goal_type: 'savings' } },
        message: 'Quanto você quer economizar por mês? R$500, R$1000?',
        shouldIntervene: false
      },
      {
        name: 'Budget Analysis Too Early',
        state: 'GOAL_DISCOVERY',
        context: {},
        message: 'Vou criar um orçamento detalhado para você',
        shouldIntervene: true
      }
    ];
    
    for (const testCase of testCases) {
      try {
        const result = await this.supervisor.checkConvergence(
          testCase.state,
          [{ user: 'Quero economizar mais' }],
          testCase.message,
          testCase.context
        );
        
        const passed = (result.approved === !testCase.shouldIntervene);
        
        this.testResults.push({
          category: 'Convergence',
          name: testCase.name,
          passed,
          drifting: result.is_drifting
        });
        
        console.log(`   ${passed ? '✅' : '❌'} ${testCase.name}: ${result.is_drifting ? 'Drifting detected' : 'On track'}`);
        
      } catch (error) {
        console.log(`   ❌ ${testCase.name}: Error - ${error.message}`);
      }
    }
  }

  async testContextPreservation() {
    console.log('\n3️⃣ Testing Context Preservation...');
    
    const testCases = [
      {
        name: 'Forgetting Original Goal',
        state: 'GOAL_CLARIFICATION',
        context: { 
          partial_goal: { goal_type: 'savings', item: 'aposentadoria' },
          original_message: 'economizar para aposentadoria'
        },
        message: 'O que você quer fazer mesmo?',
        shouldIntervene: true
      },
      {
        name: 'Remembering Context',
        state: 'GOAL_CLARIFICATION',
        context: { 
          partial_goal: { goal_type: 'savings', item: 'aposentadoria' },
          original_message: 'economizar para aposentadoria'
        },
        message: 'Para sua aposentadoria, quanto você quer guardar por mês?',
        shouldIntervene: false
      },
      {
        name: 'Asking for Already Known Info',
        state: 'GOAL_CLARIFICATION',
        context: { 
          partial_goal: { goal_type: 'savings', amount: 1000 }
        },
        message: 'Quanto você quer economizar?',
        shouldIntervene: true
      }
    ];
    
    for (const testCase of testCases) {
      try {
        const result = await this.supervisor.checkContextPreservation(
          testCase.state,
          [{ user: 'R$1000 por mês' }],
          testCase.message,
          testCase.context
        );
        
        const passed = (result.approved === !testCase.shouldIntervene);
        
        this.testResults.push({
          category: 'Context Preservation',
          name: testCase.name,
          passed,
          contextLost: !result.context_preserved
        });
        
        console.log(`   ${passed ? '✅' : '❌'} ${testCase.name}: ${result.context_preserved ? 'Context preserved' : 'Context lost'}`);
        
      } catch (error) {
        console.log(`   ❌ ${testCase.name}: Error - ${error.message}`);
      }
    }
  }

  async testFullIntegration() {
    console.log('\n4️⃣ Testing Full Supervisor Integration...');
    
    // Only test if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('   ⚠️  OpenAI API key not found - skipping integration tests');
      return;
    }
    
    const scenarios = [
      {
        name: 'Goal Discovery with Drift Prevention',
        userMessage: 'Quero economizar mais dinheiro',
        expectedBehavior: 'Should ask about specifics, not expenses'
      },
      {
        name: 'Goal Clarification Focus',
        userMessage: 'R$1000 por mês para aposentadoria',
        context: { 
          partial_goal: { goal_type: 'savings' },
          last_question_focus: 'amount'
        },
        expectedBehavior: 'Should ask about timeline, not start budget'
      }
    ];
    
    for (const scenario of scenarios) {
      try {
        console.log(`   🎬 Testing: ${scenario.name}`);
        
        // Get AI response
        const aiResponse = await this.goalIntelligence.analyzeGoalMessage(
          scenario.userMessage,
          'test-user',
          scenario.context || {}
        );
        
        // Check if supervisor intervened
        const supervisorIntervened = aiResponse.message.includes('objetivo') || 
                                    aiResponse.message.includes('meta') ||
                                    !aiResponse.message.includes('gastos') &&
                                    !aiResponse.message.includes('renda');
        
        this.testResults.push({
          category: 'Full Integration',
          name: scenario.name,
          passed: supervisorIntervened,
          response: aiResponse.message.substring(0, 100) + '...'
        });
        
        console.log(`     ${supervisorIntervened ? '✅' : '❌'} ${scenario.expectedBehavior}`);
        console.log(`     Response: "${aiResponse.message.substring(0, 80)}..."`);
        
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
      }
    }
  }

  printResults() {
    console.log('\n📊 Supervisor Test Results Summary:\n');
    
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
      if (failed.length > 0) {
        failed.forEach(test => {
          console.log(`  ❌ ${test.name}`);
        });
      }
    }
    
    const overallPercentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    
    console.log(`\n🎯 Overall: ${totalPassed}/${totalTests} (${overallPercentage}%)`);
    
    if (overallPercentage >= 80) {
      console.log('🎉 Supervisor is working correctly!');
    } else {
      console.log('⚠️  Supervisor needs improvements.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new SupervisorTester();
  tester.runAllTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = SupervisorTester;