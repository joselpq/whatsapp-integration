# WhatsApp Financial Assistant Architecture

## Overview
Our architecture follows a 3-team bounded context model, designed for clarity, debuggability, and scalability.

## Team Structure & Boundaries

### Team 1: Conversation Platform
**Mission**: Provide reliable, fast, and compliant messaging infrastructure

```
conversation-platform/
├── gateway/
│   ├── WhatsAppConnector      # WhatsApp API integration
│   └── MessageValidator        # Compliance & validation
├── engine/
│   ├── ConversationManager     # Message routing & flow control
│   ├── StateManager           # Persistent state machine
│   └── SessionContext         # User session management
└── interfaces/
    ├── IMessageHandler        # Contract for message processors
    └── IStateTransition       # Contract for state changes
```

**Responsibilities:**
- WhatsApp API communication
- Message delivery guarantees
- State persistence and consistency
- Handler registration and routing
- Session management
- Rate limiting and compliance

**Key APIs:**
```javascript
// Message handling
async handleIncomingMessage(userId, message) -> HandlerResponse

// State management  
async getUserState(userId) -> State
async transitionState(userId, newState, context) -> void

// Handler registration
registerHandler(state, handler) -> void
```

### Team 2: Financial Intelligence
**Mission**: Help users achieve their financial goals through intelligent guidance

```
financial-intelligence/
├── onboarding/
│   ├── GoalDiscoveryFlow      # Initial goal setting
│   ├── ProfileBuilder         # Income & family data
│   └── OnboardingOrchestrator # Coordinates onboarding
├── tracking/
│   ├── ExpenseParser          # Natural language → structured data
│   ├── ExpenseTracker         # Daily expense management
│   └── GoalProgressMonitor    # Track goal achievement
├── advice/
│   ├── ArnaldoAI             # OpenAI integration
│   ├── ContextBuilder        # Build rich context for AI
│   └── ResponseOptimizer     # Format for WhatsApp
└── models/
    ├── FinancialProfile      # User financial state
    ├── Goal                  # User goals
    └── Expense              # Tracked expenses
```

**Responsibilities:**
- Onboarding flow orchestration
- Expense parsing and categorization
- AI-powered financial advice
- Goal setting and tracking
- Financial calculations and projections
- Personalized recommendations

**Key APIs:**
```javascript
// Onboarding
async startOnboarding(userId) -> OnboardingState
async handleOnboardingStep(userId, message) -> StepResponse

// Tracking
async parseExpense(userId, message) -> Expense
async getFinancialSummary(userId) -> Summary

// AI Advice
async getAdvice(userId, context, query) -> Advice
```

### Team 3: Growth & Analytics
**Mission**: Drive user engagement and business growth through insights

```
growth-analytics/
├── insights/
│   ├── UserBehaviorAnalyzer   # Usage patterns
│   ├── FinancialInsights      # Spending insights
│   └── ProactiveMessenger     # Engagement campaigns
├── analytics/
│   ├── EventCollector         # User events
│   ├── MetricsAggregator     # Business metrics
│   └── ReportGenerator       # Analytics dashboards
└── emergency/
    ├── EmergencyDetector     # Crisis identification
    └── CrisisResponseFlow    # Emergency assistance
```

**Responsibilities:**
- User behavior analytics
- Financial insights generation
- Proactive engagement (daily check-ins)
- Emergency situation handling
- A/B testing infrastructure
- Business metrics and reporting

**Key APIs:**
```javascript
// Analytics
async trackEvent(userId, event, properties) -> void
async getUserInsights(userId) -> Insights[]

// Engagement
async shouldSendCheckIn(userId) -> boolean
async generateCheckInMessage(userId) -> Message

// Emergency
async detectEmergency(userId, context) -> EmergencyLevel
```

## Message Flow Architecture

```
                    Incoming WhatsApp Message
                              ↓
                    [Conversation Platform]
                         WhatsAppConnector
                              ↓
                        MessageValidator
                              ↓
                      ConversationManager
                              ↓
                         StateManager
                              ↓
                    Route based on state
                    /        |         \
                   /         |          \
    [Financial Intelligence] | [Growth & Analytics]
         /      \            |            |
   Onboarding  Tracking   Emergency   Insights
        ↓         ↓          ↓           ↓
    ArnaldoAI ←──────────────────────────┘
        ↓
    Response
        ↓
    [Conversation Platform]
    WhatsAppConnector.send()
```

## State Machine Design

```javascript
// States owned by Conversation Platform
const PLATFORM_STATES = {
  NEW_USER: 'new_user',
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  ERROR: 'error'
};

// States owned by Financial Intelligence
const FINANCIAL_STATES = {
  ONBOARDING_GOAL: 'onboarding_goal',
  ONBOARDING_INCOME: 'onboarding_income',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  TRACKING_ACTIVE: 'tracking_active',
  GOAL_REVIEW: 'goal_review'
};

// States owned by Growth & Analytics
const ENGAGEMENT_STATES = {
  EMERGENCY_MODE: 'emergency_mode',
  INSIGHT_DELIVERY: 'insight_delivery',
  CHECK_IN: 'check_in'
};
```

## Database Schema Per Team

### Conversation Platform Tables
```sql
-- Core user and conversation tracking
users, conversations, messages, user_states

-- Platform owns user creation and message history
```

### Financial Intelligence Tables
```sql
-- Financial data and tracking
financial_profiles, goals, expenses, expense_categories

-- Owns all financial user data
```

### Growth & Analytics Tables
```sql
-- Analytics and engagement
analytics_events, user_insights, emergency_flags, engagement_campaigns

-- Owns behavioral and analytical data
```

## Inter-Team Communication

### Event Bus Pattern
```javascript
// Teams communicate through events, not direct calls
EventBus.emit('user.onboarded', { userId, goals });
EventBus.emit('expense.tracked', { userId, amount, category });
EventBus.emit('emergency.detected', { userId, severity });
```

### Shared Context Object
```javascript
// Passed between teams for each message
{
  userId: string,
  state: State,
  message: Message,
  session: {
    conversationWindow: Date,
    lastActivity: Date
  },
  financial: {
    monthlyIncome: number,
    goals: Goal[],
    recentExpenses: Expense[]
  },
  flags: {
    isEmergency: boolean,
    needsCheckIn: boolean
  }
}
```

## Debugging Strategy

### 1. Centralized Logging
```javascript
// Every state transition logged
Logger.stateChange(userId, fromState, toState, trigger);

// Every handler invocation logged
Logger.handlerInvoked(handlerName, userId, state, message);

// Every API call logged
Logger.apiCall(team, method, params, duration, result);
```

### 2. Debug Endpoints per Team
```
GET /debug/platform/user/{userId}/state
GET /debug/financial/user/{userId}/profile
GET /debug/analytics/user/{userId}/events
```

### 3. State Visualization
```
GET /debug/user/{userId}/flow
Returns visual representation of user's journey through states
```

## Deployment Strategy

### Monorepo Structure (Current)
```
whatsapp-integration/
├── src/
│   ├── platform/       # Team 1
│   ├── financial/      # Team 2
│   └── analytics/      # Team 3
├── shared/
│   ├── contracts/      # Interfaces
│   └── events/         # Event definitions
└── tests/
    ├── integration/    # Cross-team tests
    └── unit/          # Per-team tests
```

### Future Microservices (When needed)
- Each team folder becomes separate service
- Event bus becomes message queue (RabbitMQ/Kafka)
- Shared contracts become OpenAPI specs

## Migration Path

### Phase 1: Fix Current State Bug (1 day)
```javascript
// Add user_states table
// Update StateManager to persist state
// Keep existing code structure
```

### Phase 2: Create Team Boundaries (3 days)
```javascript
// Move files into team folders
// Define interfaces
// Add event bus
```

### Phase 3: Refactor Core Platform (1 week)
```javascript
// Extract WhatsAppConnector
// Build proper ConversationManager
// Implement handler registry
```

### Phase 4: Enhance Financial Intelligence (1 week)
```javascript
// Modularize onboarding flows
// Improve AI context building
// Add goal tracking features
```

## Success Metrics

### Platform Team
- Message delivery: 99.9%
- Response time: <500ms
- State consistency: 100%

### Financial Team  
- Onboarding completion: 80%
- Daily active users: 60%
- Goal achievement: 40%

### Analytics Team
- Event capture rate: 100%
- Insight relevance: 4.5/5
- Emergency response: <2min

## Key Benefits

1. **Clear Ownership**: Each team owns specific user outcomes
2. **Debugging**: Clear logs show which team handled what
3. **Scalability**: Can split into microservices when needed
4. **Testing**: Each team can test independently
5. **Evolution**: New features have clear home teams