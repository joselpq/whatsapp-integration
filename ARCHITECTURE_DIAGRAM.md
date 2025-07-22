# Architecture Diagrams

## System Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                          WhatsApp User                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CONVERSATION PLATFORM                         │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐      │
│  │  WhatsApp   │───▶│ Conversation │───▶│   State     │      │
│  │  Connector  │    │   Manager    │    │  Manager    │      │
│  └─────────────┘    └──────────────┘    └─────────────┘      │
│         ▲                    │                   │              │
│         │                    ▼                   ▼              │
│         │            ┌──────────────┐    ┌─────────────┐      │
│         │            │   Handler    │    │   Session   │      │
│         └────────────│   Registry   │    │  Context    │      │
│                      └──────────────┘    └─────────────┘      │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Event Bus
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  FINANCIAL   │    │   GROWTH &   │    │   EXTERNAL   │
│ INTELLIGENCE │    │  ANALYTICS   │    │  SERVICES    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ • Onboarding │    │ • Insights   │    │ • OpenAI API │
│ • Tracking   │    │ • Analytics  │    │ • PostgreSQL │
│ • AI Advice  │    │ • Emergency  │    │ • Redis      │
└──────────────┘    └──────────────┘    └──────────────┘
```

## State Flow Diagram
```
                    NEW_USER
                       │
                       ▼
              ┌─────────────────┐
              │ ONBOARDING_GOAL │ ◀── Team: Financial
              └────────┬────────┘
                       │ Goal selected
                       ▼
            ┌───────────────────┐
            │ ONBOARDING_INCOME │ ◀── Team: Financial
            └─────────┬─────────┘
                      │ Income provided
                      ▼
           ┌──────────────────────┐
           │ ONBOARDING_COMPLETE  │ ◀── Team: Financial
           └──────────┬───────────┘
                      │
                      ▼
              ┌───────────────┐
              │ TRACKING_ACTIVE│ ◀── Team: Financial
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌─────────────┐ ┌──────────┐ ┌──────────────┐
│ EMERGENCY   │ │ CHECK_IN │ │ GOAL_REVIEW  │
│    MODE     │ │          │ │              │
└─────────────┘ └──────────┘ └──────────────┘
Team: Analytics  Team: Analytics  Team: Financial
```

## Message Processing Pipeline
```
Incoming: "gastei 50 no mercado"
         │
         ▼
┌─────────────────────┐
│ 1. WhatsApp Gateway │ Validate, extract message
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 2. State Manager    │ Get user state: TRACKING_ACTIVE
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 3. Handler Registry │ Route to ExpenseTracker
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 4. Expense Parser   │ Extract: R$50, category: groceries
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 5. Expense Tracker  │ Save to database
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 6. Arnaldo AI       │ Generate response
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 7. Response Builder │ Format for WhatsApp
└──────────┬──────────┘
           ▼
"Anotei! R$50 no mercado. 
Você já gastou R$320 esta semana."
```

## Database Ownership
```
┌─────────────────────────────────────────────┐
│           CONVERSATION PLATFORM              │
├─────────────────────────────────────────────┤
│ • users (id, phone, created_at)             │
│ • conversations (id, user_id, window)       │
│ • messages (id, content, timestamp)         │
│ • user_states (user_id, state, context)     │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────┼────────────────────────┐
│                     │                         │
▼                     ▼                         ▼
┌───────────────┐ ┌────────────────┐ ┌────────────────┐
│   FINANCIAL   │ │    GROWTH &    │ │   EXTERNAL     │
│ INTELLIGENCE  │ │   ANALYTICS    │ │   CACHES       │
├───────────────┤ ├────────────────┤ ├────────────────┤
│ • goals       │ │ • events       │ │ • Redis        │
│ • expenses    │ │ • insights     │ │ • Session      │
│ • profiles    │ │ • campaigns    │ │ • AI Context   │
└───────────────┘ └────────────────┘ └────────────────┘
```

## Error Handling Flow
```
                Error Occurs
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Team Error   External Error  State Error
        │            │            │
        ▼            ▼            ▼
   Log + Retry   Fallback Msg  Safe State
        │            │            │
        └────────────┼────────────┘
                     ▼
              User Sees Generic
              "Tive um probleminha"
                     │
                     ▼
              Alert On-Call Team
```

## Debugging Tools
```
/debug/user/{userId}/journey
├── States visited: [new_user → onboarding_goal → ...]
├── Messages sent: 15
├── Errors encountered: 0
└── Current context: { state: tracking_active, ... }

/debug/user/{userId}/trace/{messageId}
├── 1. Received at: 2025-01-22 10:30:00
├── 2. Routed to: ExpenseTracker
├── 3. Parsed as: { amount: 50, category: groceries }
├── 4. AI Context: { recentExpenses: [...], goals: [...] }
├── 5. Response generated: "Anotei! R$50..."
└── 6. Sent at: 2025-01-22 10:30:02 (2s total)
```