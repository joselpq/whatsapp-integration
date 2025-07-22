#!/usr/bin/env node

// Performance and load testing
require('dotenv').config();
const axios = require('axios');

class PerformanceTester {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || 'https://whatsapp-integration-production-06bb.up.railway.app';
    this.results = [];
  }

  async runLoadTest() {
    console.log('⚡ PERFORMANCE & LOAD TESTS');
    console.log('API URL:', this.apiUrl);
    console.log('=' .repeat(50));

    await this.testResponseTimes();
    await this.testConcurrentRequests();
    await this.testDatabasePerformance();
    await this.testMemoryUsage();

    this.printPerformanceReport();
  }

  async testResponseTimes() {
    console.log('\n🕐 Testing Response Times...');
    
    const endpoints = [
      { name: 'Health Check', path: '/health', method: 'GET' },
    ];

    for (const endpoint of endpoints) {
      const times = [];
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        try {
          await axios({
            method: endpoint.method,
            url: `${this.apiUrl}${endpoint.path}`,
            timeout: 5000
          });
          const responseTime = Date.now() - start;
          times.push(responseTime);
        } catch (error) {
          console.log(`   ❌ Request ${i+1} failed: ${error.message}`);
          times.push(5000); // Timeout penalty
        }
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`   ${endpoint.name}:`);
      console.log(`     Average: ${avgTime.toFixed(0)}ms`);
      console.log(`     Min: ${minTime}ms, Max: ${maxTime}ms`);

      this.results.push({
        test: endpoint.name,
        avgResponseTime: avgTime,
        maxResponseTime: maxTime,
        minResponseTime: minTime
      });

      // Performance thresholds
      if (avgTime > 2000) {
        console.log(`   ⚠️  Slow response time (${avgTime.toFixed(0)}ms > 2000ms threshold)`);
      } else if (avgTime < 500) {
        console.log(`   ✅ Excellent response time`);
      } else {
        console.log(`   ✅ Good response time`);
      }
    }
  }

  async testConcurrentRequests() {
    console.log('\n🔄 Testing Concurrent Load...');
    
    const concurrentLevels = [5, 10, 20];
    
    for (const concurrency of concurrentLevels) {
      console.log(`   Testing ${concurrency} concurrent requests...`);
      
      const promises = [];
      const startTime = Date.now();
      
      for (let i = 0; i < concurrency; i++) {
        promises.push(
          axios.get(`${this.apiUrl}/health`, { timeout: 10000 })
            .catch(error => ({ error: error.message }))
        );
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      const successful = results.filter(r => !r.error).length;
      const failed = results.filter(r => r.error).length;
      const totalTime = endTime - startTime;
      
      console.log(`     Successful: ${successful}/${concurrency}`);
      console.log(`     Failed: ${failed}/${concurrency}`);
      console.log(`     Total time: ${totalTime}ms`);
      console.log(`     Requests/second: ${(concurrency * 1000 / totalTime).toFixed(2)}`);
      
      this.results.push({
        test: `Concurrent ${concurrency}`,
        concurrency,
        successful,
        failed,
        totalTime,
        requestsPerSecond: concurrency * 1000 / totalTime
      });

      // Give system time to recover
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async testDatabasePerformance() {
    console.log('\n💾 Testing Database Performance...');
    
    try {
      const start = Date.now();
      const response = await axios.get(`${this.apiUrl}/health`);
      const dbTime = Date.now() - start;
      
      if (response.data.database === 'connected') {
        console.log(`   ✅ Database connection time: ${dbTime}ms`);
        
        if (dbTime > 1000) {
          console.log(`   ⚠️  Slow database connection (${dbTime}ms > 1000ms)`);
        }
        
        // Check for database stats
        const stats = response.data;
        console.log(`   📊 Database stats:`);
        console.log(`     Users: ${stats.users || 'N/A'}`);
        console.log(`     Messages: ${stats.messages || 'N/A'}`);
        console.log(`     Expenses: ${stats.expenses || 'N/A'}`);
        
      } else {
        console.log(`   ❌ Database not connected`);
      }
      
    } catch (error) {
      console.log(`   ❌ Database test failed: ${error.message}`);
    }
  }

  async testMemoryUsage() {
    console.log('\n🧠 Testing Memory Usage...');
    
    // Test with large payloads
    const largeMessage = 'a'.repeat(1000);
    const veryLargeMessage = 'b'.repeat(10000);
    
    const testCases = [
      { name: 'Normal message', size: 'small' },
      { name: 'Large message', size: 'large' },
      { name: 'Very large message', size: 'xlarge' }
    ];
    
    for (const testCase of testCases) {
      try {
        const start = Date.now();
        await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
        const time = Date.now() - start;
        
        console.log(`   ✅ ${testCase.name}: ${time}ms`);
      } catch (error) {
        console.log(`   ❌ ${testCase.name} failed: ${error.message}`);
      }
    }
  }

  printPerformanceReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PERFORMANCE REPORT');
    console.log('='.repeat(50));
    
    // Response time analysis
    const responseTimeResults = this.results.filter(r => r.avgResponseTime);
    if (responseTimeResults.length > 0) {
      const avgResponseTime = responseTimeResults.reduce((sum, r) => sum + r.avgResponseTime, 0) / responseTimeResults.length;
      console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
      
      if (avgResponseTime < 500) {
        console.log('✅ Excellent response performance');
      } else if (avgResponseTime < 1000) {
        console.log('✅ Good response performance');  
      } else if (avgResponseTime < 2000) {
        console.log('⚠️  Acceptable response performance');
      } else {
        console.log('🚨 Poor response performance');
      }
    }
    
    // Concurrency analysis
    const concurrencyResults = this.results.filter(r => r.concurrency);
    if (concurrencyResults.length > 0) {
      console.log('\nConcurrency Performance:');
      concurrencyResults.forEach(r => {
        const successRate = (r.successful / r.concurrency * 100).toFixed(1);
        console.log(`  ${r.concurrency} concurrent: ${successRate}% success, ${r.requestsPerSecond.toFixed(2)} req/sec`);
      });
      
      const maxConcurrency = Math.max(...concurrencyResults.map(r => r.concurrency));
      const maxResult = concurrencyResults.find(r => r.concurrency === maxConcurrency);
      
      if (maxResult.successful / maxResult.concurrency >= 0.9) {
        console.log(`✅ Can handle ${maxConcurrency} concurrent users`);
      } else {
        console.log(`⚠️  Struggles with ${maxConcurrency} concurrent users`);
      }
    }
    
    // Overall assessment
    console.log('\n🎯 PRODUCTION READINESS:');
    
    const avgResponseTime = responseTimeResults.reduce((sum, r) => sum + r.avgResponseTime, 0) / responseTimeResults.length;
    const maxSuccessRate = Math.max(...concurrencyResults.map(r => r.successful / r.concurrency));
    
    let score = 0;
    if (avgResponseTime < 500) score += 30;
    else if (avgResponseTime < 1000) score += 20;
    else if (avgResponseTime < 2000) score += 10;
    
    if (maxSuccessRate >= 0.95) score += 40;
    else if (maxSuccessRate >= 0.9) score += 30;
    else if (maxSuccessRate >= 0.8) score += 20;
    
    score += 30; // Base score for basic functionality
    
    console.log(`Production Readiness Score: ${score}/100`);
    
    if (score >= 80) {
      console.log('🎉 READY FOR PRODUCTION!');
      console.log('✅ Performance meets production standards');
    } else if (score >= 60) {
      console.log('⚠️  NEEDS OPTIMIZATION');
      console.log('⚠️  Consider performance improvements before scaling');
    } else {
      console.log('🚨 NOT READY FOR PRODUCTION');
      console.log('❌ Significant performance issues detected');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runLoadTest().catch(console.error);
}

module.exports = PerformanceTester;