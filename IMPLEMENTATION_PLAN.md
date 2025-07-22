# Implementation Plan: State Management Fix

## Immediate Fix (Phase 1) - Fix State Persistence Bug

### 1. Create user_states table
```sql
CREATE TABLE user_states (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_state VARCHAR(50) NOT NULL,
  previous_state VARCHAR(50),
  context JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_user_states_current ON user_states(current_state);
```

### 2. Update ConversationState.js
```javascript
// Add actual state persistence
static async updateUserState(userId, newState, context = {}) {
  const query = `
    INSERT INTO user_states (user_id, current_state, context)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET
      previous_state = user_states.current_state,
      current_state = EXCLUDED.current_state,
      context = EXCLUDED.context,
      updated_at = NOW()
    RETURNING *
  `;
  
  const result = await db.query(query, [userId, newState, context]);
  
  // Emit event for analytics
  await this.trackStateTransition(userId, result.rows[0].previous_state, newState);
  
  return result.rows[0];
}

// Update getUserState to check persisted state first
static async getUserState(userId) {
  // First check persisted state
  const stateQuery = `
    SELECT current_state, context 
    FROM user_states 
    WHERE user_id = $1
  `;
  const stateResult = await db.query(stateQuery, [userId]);
  
  if (stateResult.rows.length > 0) {
    return stateResult.rows[0].current_state;
  }
  
  // Fall back to existing logic for new users
  // ... (existing code)
}
```

### 3. Fix OnboardingFlow state transitions
```javascript
// Ensure state is persisted after each step
static async handleGoalDiscovery(userId, messageText) {
  // ... existing goal parsing logic ...
  
  // After creating goal, update state
  await ConversationState.updateUserState(
    userId, 
    ConversationState.STATES.INCOME_COLLECTION,
    { goalType, goalId: goal.id }
  );
  
  return {
    message: incomePrompt,
    // Remove nextState - state is already updated
  };
}
```

### 4. Update WhatsAppService.js
```javascript
// Remove redundant state update logic
if (onboardingResponse.nextState) {
  // State already updated by OnboardingFlow
  // Just track analytics here
}
```

## Migration Script
```javascript
// scripts/add-user-states.js
const db = require('../src/database/db');

async function migrate() {
  // Create table
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
  
  // Migrate existing users
  const users = await db.query(`
    SELECT u.id, u.onboarding_completed, u.created_at,
           COUNT(g.id) as goal_count,
           u.monthly_income
    FROM users u
    LEFT JOIN goals g ON u.id = g.user_id
    GROUP BY u.id
  `);
  
  for (const user of users.rows) {
    let state;
    if (!user.onboarding_completed) {
      if (user.goal_count === 0) {
        state = 'onboarding_goal';
      } else if (!user.monthly_income) {
        state = 'onboarding_income';
      } else {
        state = 'onboarding_complete';
      }
    } else {
      state = 'tracking_active';
    }
    
    await db.query(`
      INSERT INTO user_states (user_id, current_state)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [user.id, state]);
  }
  
  console.log('Migration complete!');
}

migrate().catch(console.error);
```

## Testing Plan

### 1. Unit Tests
```javascript
// Test state persistence
it('should persist state transitions', async () => {
  const userId = 'test-user';
  await ConversationState.updateUserState(userId, 'onboarding_goal');
  const state = await ConversationState.getUserState(userId);
  expect(state).toBe('onboarding_goal');
});

// Test onboarding flow
it('should progress through onboarding states', async () => {
  // Test each transition
});
```

### 2. Integration Test Script
```javascript
// Test full onboarding flow
async function testOnboarding(phoneNumber) {
  console.log('1. Reset user...');
  await resetUser(phoneNumber);
  
  console.log('2. Send "Oi"...');
  // Should see welcome message
  
  console.log('3. Send "1" for emergency fund...');
  // Should ask for income
  
  console.log('4. Send "ganho 3000"...');
  // Should complete onboarding
  
  console.log('5. Send "gastei 50"...');
  // Should track expense
}
```

## Rollout Strategy

### Day 1: Deploy State Fix
1. Add user_states table
2. Deploy updated ConversationState
3. Run migration script
4. Monitor for 24 hours

### Day 2-3: Test with Beta Users
1. Reset 5 beta users
2. Have them go through onboarding
3. Monitor state transitions
4. Fix any edge cases

### Day 4-5: Full Rollout
1. Enable for all users
2. Remove old state logic
3. Clean up code

## Success Metrics
- ✅ Users complete onboarding without loops
- ✅ State transitions are logged correctly
- ✅ No "welcome message" repeats
- ✅ 80%+ onboarding completion rate

## Next Phases (After State Fix Works)

### Phase 2: Team Boundaries (Week 2)
- Create platform/, financial/, analytics/ folders
- Move files to appropriate teams
- Define interfaces

### Phase 3: Event Bus (Week 3)
- Implement event system
- Replace direct calls with events
- Add event logging

### Phase 4: Enhanced Features (Week 4)
- Daily check-ins
- Emergency detection
- Insights generation