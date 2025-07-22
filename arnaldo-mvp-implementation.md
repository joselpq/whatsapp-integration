# Arnaldo MVP - Quick Implementation Plan

## 🎯 MVP Scope: Emergency Financial Helper

**Core Feature:** Help users when they run out of money before payday

## 📦 Implementation Steps

### Step 1: Add AI Service (30 min)
```javascript
// src/services/ArnaldoAI.js
class ArnaldoAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async getResponse(userMessage, context) {
    // Build prompt with context
    // Call OpenAI
    // Return formatted response
  }
}
```

### Step 2: Enhance Message Processing (1 hour)
```javascript
// Update WhatsAppService.js
async processAndRespond(user, conversation, message) {
  // Get last 5 messages for context
  const context = await Message.getConversationContext(conversation.id, 5);
  
  // Get AI response
  const aiResponse = await arnaldoAI.getResponse(
    message.text.body,
    context
  );
  
  // Send response
  await this.sendMessage(user.phone_number, aiResponse);
}
```

### Step 3: Create Expense Tracking (1 hour)
```javascript
// Simple expense extraction
function extractExpense(message) {
  // Pattern: "gastei 50" or "50 no mercado"
  const patterns = [
    /gastei?\s+(?:r\$)?\s*(\d+)/i,
    /(?:r\$)?\s*(\d+)\s+(?:no|na|em)/i
  ];
  
  // Extract amount and category
  return { amount, category };
}
```

### Step 4: Add User Context (30 min)
```sql
-- Quick profile addition
ALTER TABLE users ADD COLUMN 
  monthly_income DECIMAL(10,2),
  last_payday DATE,
  daily_budget DECIMAL(10,2);
```

## 🚀 Day 1 Deliverable

A working Arnaldo that can:
1. ✅ Understand "I'm out of money" messages
2. ✅ Ask clarifying questions
3. ✅ Calculate daily budget until payday
4. ✅ Track expenses via WhatsApp
5. ✅ Give emergency saving tips

## 🧪 Test Messages

```
"Arnaldo, acabou meu dinheiro"
"Gastei 50 reais hoje"
"Quanto posso gastar por dia?"
"Me ajuda a economizar"
```

## 🔑 Required Environment Variables

```env
# Add to existing .env
OPENAI_API_KEY=sk-...
```

Ready to build? Start with Step 1! 🚀