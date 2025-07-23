#!/usr/bin/env node

// Comprehensive test suite for the AI-first Goal Wizard
require('dotenv').config();

const GoalIntelligence = require('../src/services/GoalIntelligence');
const OnboardingFlow = require('../src/flows/OnboardingFlow');
const ConversationState = require('../src/services/ConversationState');
const db = require('../src/database/db');

class GoalWizardTester {
  constructor() {
    this.goalIntelligence = new GoalIntelligence();
    this.testResults = [];
    this.testUserId = 'test-goal-' + Date.now();
  }

  async runAllTests() {
    console.log('🧪 Starting Goal Wizard Test Suite...\n');
    
    try {
      // Test 1: AI Goal Analysis
      await this.testGoalAnalysis();
      
      // Test 2: Goal Clarification Flow
      await this.testGoalClarification();
      
      // Test 3: Complete Goal Scenarios
      await this.testCompleteGoalScenarios();
      
      // Test 4: Edge Cases
      await this.testEdgeCases();
      
      // Test 5: Fallback Mechanisms
      await this.testFallbacks();
      
      // Test 6: Integration Flow
      await this.testIntegrationFlow();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async testGoalAnalysis() {
    console.log('1️⃣ Testing AI Goal Analysis...');
    
    const testCases = [
      {
        name: 'Complete Car Purchase',
        input: 'Quero comprar um carro usado de 30 mil em 1 ano',
        expected: {
          goal_type: 'purchase',
          item: 'carro',
          amount: 30000,
          needs_clarification: false
        }
      },
      {
        name: 'Incomplete Purchase',
        input: 'Quero comprar um carro',
        expected: {
          goal_type: 'purchase',
          item: 'carro',
          needs_clarification: true
        }
      },
      {
        name: 'Emergency Fund',
        input: 'Preciso criar uma reserva de emergência',
        expected: {
          goal_type: 'emergency',
          needs_clarification: true
        }
      },
      {
        name: 'Debt Payment',
        input: 'Quero quitar minhas dívidas do cartão',
        expected: {
          goal_type: 'debt',
          needs_clarification: true
        }
      },
      {
        name: 'Savings Goal',
        input: 'Quero economizar mais dinheiro',
        expected: {
          goal_type: 'savings',
          needs_clarification: true
        }
      }
    ];
    
    for (const testCase of testCases) {
      try {
        const result = await this.goalIntelligence.analyzeGoalMessage(
          testCase.input, 
          this.testUserId
        );
        
        const passed = this.validateGoalAnalysis(result, testCase.expected);
        
        this.testResults.push({
          category: 'Goal Analysis',
          name: testCase.name,
          passed,
          input: testCase.input,
          result: result.extracted_data,
          message: result.message
        });
        
        console.log(`   ${passed ? '✅' : '❌'} ${testCase.name}: ${testCase.input}`);
        
      } catch (error) {
        console.log(`   ❌ ${testCase.name}: Error - ${error.message}`);
        this.testResults.push({
          category: 'Goal Analysis',
          name: testCase.name,
          passed: false,
          error: error.message
        });
      }
    }
  }

  async testGoalClarification() {
    console.log('\n2️⃣ Testing Goal Clarification Flow...');
    
    const scenarios = [
      {
        name: 'Car Type Clarification',
        context: {
          partial_goal: { goal_type: 'purchase', item: 'carro' },
          last_question_focus: 'specifics'
        },
        input: 'Um usado mesmo, algo simples',
        expected: {
          should_progress: true,
          next_focus: 'budget'
        }
      },
      {
        name: 'Emergency Fund Amount',
        context: {
          partial_goal: { goal_type: 'emergency' },
          last_question_focus: 'amount'
        },
        input: '6 meses de gastos',
        expected: {
          should_progress: true,
          next_focus: 'timeline'
        }
      }
    ];
    
    for (const scenario of scenarios) {
      try {
        const result = await this.goalIntelligence.handleGoalClarification(
          scenario.input,
          this.testUserId,
          scenario.context
        );
        
        const passed = result.message && result.message.length > 0;
        
        this.testResults.push({
          category: 'Goal Clarification',
          name: scenario.name,
          passed,
          input: scenario.input,
          response: result.message
        });
        
        console.log(`   ${passed ? '✅' : '❌'} ${scenario.name}`);
        
      } catch (error) {
        console.log(`   ❌ ${scenario.name}: Error - ${error.message}`);
        this.testResults.push({
          category: 'Goal Clarification',
          name: scenario.name,
          passed: false,
          error: error.message
        });
      }
    }
  }

  async testCompleteGoalScenarios() {
    console.log('\n3️⃣ Testing Complete Goal Scenarios...');
    
    const scenarios = [
      {
        name: 'Car Purchase Journey',
        messages: [
          'Quero comprar um carro',
          'Um usado mesmo',
          'Uns 30 mil',
          '1 ano'
        ]
      },
      {
        name: 'Emergency Fund Journey',
        messages: [
          'Preciso de uma reserva',
          '6 meses',
          'Até o final do ano'
        ]
      }
    ];
    
    for (const scenario of scenarios) {
      try {
        console.log(`   🎬 Testing: ${scenario.name}`);
        
        // Reset state for this scenario
        const scenarioUserId = this.testUserId + '-' + scenario.name.replace(/\s/g, '');
        await this.resetUserState(scenarioUserId);
        
        let currentState = ConversationState.STATES.GOAL_DISCOVERY;
        let conversationLog = [];
        
        for (let i = 0; i < scenario.messages.length; i++) {
          const message = scenario.messages[i];
          
          let response;
          if (currentState === ConversationState.STATES.GOAL_DISCOVERY) {
            response = await OnboardingFlow.handleGoalDiscovery(scenarioUserId, message);
          } else if (currentState === ConversationState.STATES.GOAL_CLARIFICATION) {
            response = await OnboardingFlow.handleGoalClarification(scenarioUserId, message);
          }
          
          conversationLog.push({
            user: message,
            arnaldo: response?.message || 'No response'
          });
          
          // Check if we've moved to income collection (success)
          const newState = await ConversationState.getUserState(scenarioUserId);
          currentState = newState;
          
          if (currentState === ConversationState.STATES.INCOME_COLLECTION) {
            console.log(`     ✅ Reached income collection after ${i + 1} messages`);
            break;
          }
        }
        
        const passed = currentState === ConversationState.STATES.INCOME_COLLECTION;
        
        this.testResults.push({
          category: 'Complete Scenarios',
          name: scenario.name,
          passed,
          finalState: currentState,
          conversationLog
        });
        
        console.log(`   ${passed ? '✅' : '❌'} ${scenario.name} - Final state: ${currentState}`);
        
      } catch (error) {
        console.log(`   ❌ ${scenario.name}: Error - ${error.message}`);
        this.testResults.push({
          category: 'Complete Scenarios',
          name: scenario.name,
          passed: false,
          error: error.message
        });
      }
    }
  }

  async testEdgeCases() {
    console.log('\n4️⃣ Testing Edge Cases...');
    
    const edgeCases = [
      {
        name: 'Empty Message',
        input: '',
        shouldHandle: true
      },
      {
        name: 'Very Long Message',
        input: 'Eu quero comprar um carro mas não sei bem qual tipo de carro porque tem muitas opções e eu não entendo muito de carros mas preciso de um para trabalhar e não tenho muito dinheiro então precisa ser algo barato mas que seja confiável',
        shouldHandle: true
      },
      {
        name: 'Nonsense Input',
        input: 'asdkjhasdkjh',
        shouldHandle: true
      },
      {
        name: 'Mixed Language',
        input: 'I want to buy uma casa',
        shouldHandle: true
      },
      {
        name: 'Numbers Only',
        input: '12345',
        shouldHandle: true
      }
    ];
    
    for (const edgeCase of edgeCases) {
      try {
        const result = await this.goalIntelligence.analyzeGoalMessage(
          edgeCase.input,
          this.testUserId
        );
        
        const passed = result && result.message && result.message.length > 0;
        
        this.testResults.push({
          category: 'Edge Cases',
          name: edgeCase.name,
          passed,
          input: edgeCase.input,
          response: result?.message
        });
        
        console.log(`   ${passed ? '✅' : '❌'} ${edgeCase.name}`);
        
      } catch (error) {
        console.log(`   ❌ ${edgeCase.name}: Error - ${error.message}`);
        this.testResults.push({
          category: 'Edge Cases',
          name: edgeCase.name,
          passed: false,
          error: error.message
        });
      }
    }
  }

  async testFallbacks() {
    console.log('\n5️⃣ Testing Fallback Mechanisms...');
    
    // Test fallback when AI is disabled
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'invalid-key';
    
    try {
      const result = await OnboardingFlow.fallbackGoalDiscovery(this.testUserId, 'Quero comprar um carro');
      
      const passed = result && result.message && result.message.length > 0;
      
      this.testResults.push({
        category: 'Fallbacks',
        name: 'AI Failure Fallback',
        passed,
        response: result?.message
      });
      
      console.log(`   ${passed ? '✅' : '❌'} AI Failure Fallback`);
      
    } catch (error) {
      console.log(`   ❌ AI Failure Fallback: Error - ${error.message}`);
    } finally {
      // Restore API key
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }

  async testIntegrationFlow() {
    console.log('\n6️⃣ Testing Integration Flow...');
    
    try {
      // Test complete flow from welcome to income collection
      const integrationUserId = this.testUserId + '-integration';
      await this.resetUserState(integrationUserId);
      
      // Step 1: Welcome
      const welcome = await OnboardingFlow.sendWelcome(integrationUserId);
      console.log('   📝 Welcome sent');
      
      // Step 2: Goal discovery
      const goalResponse = await OnboardingFlow.handleGoalDiscovery(
        integrationUserId, 
        'Quero comprar um carro usado de 30 mil'
      );
      console.log('   🎯 Goal processed');
      
      // Step 3: Check state transition
      const finalState = await ConversationState.getUserState(integrationUserId);
      const passed = finalState === ConversationState.STATES.INCOME_COLLECTION;
      
      this.testResults.push({
        category: 'Integration',
        name: 'Complete Flow',
        passed,
        finalState
      });
      
      console.log(`   ${passed ? '✅' : '❌'} Complete Flow - Final state: ${finalState}`);
      
    } catch (error) {
      console.log(`   ❌ Integration Flow: Error - ${error.message}`);
      this.testResults.push({
        category: 'Integration',
        name: 'Complete Flow',
        passed: false,
        error: error.message
      });
    }
  }

  validateGoalAnalysis(result, expected) {
    if (!result.extracted_data && expected.needs_clarification) {
      return true; // Expected to need clarification
    }
    
    if (!result.extracted_data) return false;
    
    const data = result.extracted_data;
    
    if (expected.goal_type && data.goal_type !== expected.goal_type) {
      return false;
    }
    
    if (expected.item && !data.item?.includes(expected.item)) {
      return false;
    }
    
    if (expected.amount && Math.abs(data.amount - expected.amount) > 5000) {
      return false;
    }
    
    return true;
  }

  async resetUserState(userId) {
    try {
      await db.query('DELETE FROM user_states WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM goals WHERE user_id = $1', [userId]);
    } catch (error) {
      console.log('State reset error (ignored):', error.message);
    }
  }

  printResults() {
    console.log('\n📊 Test Results Summary:\n');
    
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
          console.log(`  ❌ ${test.name}: ${test.error || 'Failed validation'}`);
        });
      }
    }
    
    const overallPercentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    
    console.log(`\n🎯 Overall: ${totalPassed}/${totalTests} (${overallPercentage}%)`);
    
    if (overallPercentage >= 80) {
      console.log('🎉 Goal Wizard tests PASSED! Ready for deployment.');
    } else {
      console.log('⚠️  Goal Wizard needs improvements before deployment.');
    }
  }

  async cleanup() {
    try {
      // Clean up test data
      await db.query('DELETE FROM user_states WHERE user_id LIKE $1', [this.testUserId + '%']);
      await db.query('DELETE FROM goals WHERE user_id LIKE $1', [this.testUserId + '%']);
      await db.close();
    } catch (error) {
      console.log('Cleanup error (ignored):', error.message);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new GoalWizardTester();
  tester.runAllTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = GoalWizardTester;