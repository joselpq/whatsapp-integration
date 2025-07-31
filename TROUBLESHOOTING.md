# Troubleshooting Guide

## Common Issues & Solutions

### 🚨 **CRITICAL FIX**: Conversation Flow Technical Error

**Problem**: After welcome message, second message shows technical error fallback
**Symptoms**: 
- First message works fine (welcome message sent)
- Second message triggers: "Ops! Tive um probleminha técnico. Pode repetir sua mensagem? 🤔"
- Error: `lastMessage.includes is not a function`

**Root Cause**: JSON parsing issue in `_getLastOutboundMessage()` method
- Message content stored as JSON string in database: `'{"text":"Welcome message..."}'`
- Code tries to call `.includes()` on JSON string instead of extracted text
- Results in TypeError when checking for goal confirmation

**Solution Applied**:
```javascript
// Fixed in ArnaldoAgent._getLastOutboundMessage()
async _getLastOutboundMessage(userId) {
  try {
    const db = require('../database/db');
    const query = `
      SELECT m.content 
      FROM messages m 
      JOIN conversations c ON m.conversation_id = c.id 
      WHERE c.user_id = $1 AND m.direction = 'outbound' 
      ORDER BY m.created_at DESC 
      LIMIT 1
    `;
    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    let content = result.rows[0].content;
    
    // Parse JSON content if needed (content is stored as JSON string)
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        content = parsed.text || parsed.body || content;
      } catch (e) {
        // If not JSON, use as-is
      }
    } else if (content?.text) {
      content = content.text;
    }
    
    return content;
  } catch (error) {
    console.error('Error getting last outbound message:', error);
    return null;
  }
}
```

**Status**: ✅ **FIXED** - Conversation transitions now work properly

---

### 1. User Reset - Use Emergency Reset Only

**Problem**: Regular reset endpoints often fail due to phone number format issues
**Symptoms**: 
- Reset returns success but user data remains
- AI remembers previous conversation context
- Phone format mismatches (+55 vs 55)

**✅ SOLUTION: Use Emergency Reset (The Only Reliable Method)**
```bash
# Step 1: Get user ID
curl "https://your-app.up.railway.app/dev/user-status/+5511999999999"
# Returns: {"userId": "xxx-xxx-xxx", ...}

# Step 2: Emergency reset with user ID
curl -X POST "https://your-app.up.railway.app/dev/emergency-reset" \
  -H "Content-Type: application/json" \
  -d '{"userId": "xxx-xxx-xxx"}'
```

**Why Emergency Reset Works:**
- Bypasses phone number format issues completely
- Uses user ID directly (no format ambiguity)
- Properly deletes ALL related records
- Resets created_at for fresh user experience

**⚠️ DO NOT USE THESE (Unreliable):**
- ~~POST /dev/reset/:phoneNumber~~ - Phone format issues
- ~~POST /dev/reset-user~~ with phoneNumber in body - Same issues
- ~~DevTools.resetUser(phoneNumber)~~ - Internally has format problems

### 2. Duplicate User Records

**Problem**: Multiple user records for the same person
**Detection**: Database query shows multiple users with similar phone numbers

```sql
-- Check for duplicates
SELECT id, phone_number, created_at 
FROM users 
WHERE phone_number LIKE '%5511976196165%' 
ORDER BY created_at DESC;
```

**Solution**:
```javascript
// Manual cleanup via direct database access
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:GpNpXGDyGbmhjHfMkwvBlgMYIyyuZShq@shortline.proxy.rlwy.net:40462/railway'
});

// Delete duplicate user (keep the one without +)
await client.query('DELETE FROM users WHERE id = $1', [duplicateUserId]);
```

### 3. Welcome Message Not Sent

**Problem**: New users don't receive the welcome message
**Debugging Steps**:

1. **Check Outbound Message Count**:
```javascript
GET /dev/messages/debug/:userId
// Should return outboundMessages: 0 for new users
```

2. **Verify User Detection Logic**:
```javascript
// In ArnaldoAgent.js
const outboundCount = await this._getOutboundMessageCount(phoneNumber);
if (outboundCount === 0) {
  // This should trigger for new users
}
```

3. **Check Phone Number Format**:
```javascript
// Ensure consistent format in database
SELECT phone_number FROM users WHERE phone_number LIKE '%976196165%';
```

**Solution**: Use emergency reset to clear message count to 0

### 4. Date Calculation Errors

**Problem**: AI calculates incorrect future dates
**Example**: User wants to travel in 2 years, AI says "novembro de 2024" instead of 2026

**Root Cause**: AI lacks current date context

**Solution**: Verify temporal context in system prompt:
```javascript
// In ArnaldoGoalDiscovery.js
content: `CONTEXTO TEMPORAL: Estamos em julho de 2025. Use isso para calcular datas futuras corretamente.`
```

### 5. AI Sending Follow-up Messages

**Problem**: AI sends additional messages after goal completion
**Example**: After saying "Então podemos considerar que seu objetivo é: [goal]", AI sends another message

**Solution**: Enforce rule #9 in system prompt:
```javascript
`9. **CRUCIAL**: Após dizer "Então podemos considerar que seu objetivo é:" você deve PARAR de enviar mensagens. Não envie mensagens de acompanhamento.`
```

### 6. Database Connection Issues

**Problem**: Cannot connect to Railway database locally

**Verification**:
```bash
# Test connection
psql "postgresql://postgres:GpNpXGDyGbmhjHfMkwvBlgMYIyyuZShq@shortline.proxy.rlwy.net:40462/railway"
```

**Common Issues**:
- Internal URL won't work locally (use external URL)
- Firewall blocking connection
- Railway database sleeping (wake up by visiting app)

## Development Tools

### Direct Database Access
```javascript
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:GpNpXGDyGbmhjHfMkwvBlgMYIyyuZShq@shortline.proxy.rlwy.net:40462/railway'
});

await client.connect();

// Check user exists
const userQuery = await client.query(
  'SELECT id, phone_number, created_at FROM users WHERE phone_number LIKE $1',
  ['%976196165%']
);

// Count messages  
const messageQuery = await client.query(
  'SELECT COUNT(*) FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)',
  [userId]
);

await client.end();
```

### Development Endpoints

```bash
# 🟢 RECOMMENDED: Emergency Reset
POST /dev/emergency-reset
Body: {"userId": "xxx-xxx-xxx"}
# The ONLY reliable reset method - use this!

# Get User Information
GET /dev/user-status/:phoneNumber
# Returns userId needed for emergency reset

# Debug Messages
GET /dev/debug-messages/:userId
# Check message counts and history

# List Recent Users
GET /dev/users
# See recent activity
```

### Using DevTools Class

```javascript
const DevTools = require('./src/utils/dev-tools');

// ✅ CORRECT: Get user status (to find userId)
const status = await DevTools.getUserStatus('+5511976196165');
console.log('User ID:', status.userId); // Use this for reset!

// ✅ CORRECT: Emergency reset by ID
const reset = await DevTools.resetUserById(status.userId);
console.log('Reset result:', reset);

// ❌ AVOID: Phone-based reset (unreliable)
// const reset = await DevTools.resetUser(phoneNumber); // DON'T USE

// Other useful methods:
const debug = await DevTools.debugMessages(userId);
const users = await DevTools.listRecentUsers(10);
```

## Production Debugging

### Railway Logs
1. Go to Railway dashboard
2. Select your service
3. Click "Logs" tab
4. Look for webhook activity and errors

### Health Endpoint
```bash
# Check service health
curl https://your-app.up.railway.app/health
```

### Manual Database Queries

```sql
-- Find user by phone (any format)
SELECT * FROM users WHERE phone_number LIKE '%976196165%';

-- Count messages for user
SELECT 
  COUNT(*) as total_messages,
  COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_messages
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE c.user_id = :userId;

-- Check recent conversations
SELECT 
  u.phone_number,
  c.updated_at,
  COUNT(m.id) as message_count
FROM conversations c
JOIN users u ON c.user_id = u.id
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY u.phone_number, c.updated_at
ORDER BY c.updated_at DESC
LIMIT 10;
```

## Emergency Procedures

### Complete User Reset (Nuclear Option)
```javascript
// When all else fails - complete database cleanup
const userId = 'user-id-here';

const deletions = [
  'DELETE FROM analytics_events WHERE user_id = $1',
  'DELETE FROM expenses WHERE user_id = $1',
  'DELETE FROM goals WHERE user_id = $1',
  'DELETE FROM daily_summaries WHERE user_id = $1',
  'DELETE FROM insights WHERE user_id = $1',
  'DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)',
  'DELETE FROM conversations WHERE user_id = $1',
  'DELETE FROM user_states WHERE user_id = $1'
];

for (const query of deletions) {
  await client.query(query, [userId]);
}

// Reset user profile
await client.query(`
  UPDATE users 
  SET created_at = NOW(), updated_at = NOW()
  WHERE id = $1
`, [userId]);
```

### Database Recovery
If database becomes corrupted or inconsistent:

1. **Backup current state**:
```bash
pg_dump "postgresql://..." > backup.sql
```

2. **Reset specific tables**:
```sql
TRUNCATE messages, conversations, user_states RESTART IDENTITY CASCADE;
```

3. **Recreate test user**:
```sql
INSERT INTO users (phone_number, created_at, updated_at) 
VALUES ('+5511976196165', NOW(), NOW());
```

## Prevention Best Practices

1. **Phone Number Standardization**: Always normalize phone numbers before database operations
2. **Consistent Format**: Use either `+55...` or `55...` format consistently throughout system
3. **User ID Usage**: Prefer user ID over phone number for internal operations
4. **Reset Testing**: Test reset functionality regularly during development
5. **Database Monitoring**: Monitor for duplicate users and format inconsistencies
6. **Temporal Context**: Always include current date in AI system prompts
7. **Message Counting**: Verify outbound message counts before sending welcome messages

## Contact Information

- **Test Phone**: +5511976196165
- **Database URL**: postgresql://postgres:GpNpXGDyGbmhjHfMkwvBlgMYIyyuZShq@shortline.proxy.rlwy.net:40462/railway
- **Railway App**: [Your Railway app URL]
- **Development Tools**: Located in `src/utils/dev-tools.js`