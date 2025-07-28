# Troubleshooting Guide

## Common Issues & Solutions

### 1. User Reset Not Working

**Problem**: AI remembers previous conversation context even after reset
**Symptoms**: 
- User expects fresh start but AI references old conversation
- Welcome message not sent to "new" user
- Reset endpoints return success but behavior unchanged

**Root Cause**: Phone number format mismatch between stored and lookup formats
- Database may have `+5511976196165` 
- Lookup may use `5511976196165`
- Results in new user creation instead of reset

**Solution**:
```javascript
// Use emergency reset by user ID (bypasses phone number issues)
const DevTools = require('./src/utils/dev-tools');

// 1. Find user ID directly
const userStatus = await DevTools.getUserStatus(phoneNumber);
console.log('User ID:', userStatus.userId);

// 2. Reset using user ID
const result = await DevTools.resetUserById(userStatus.userId);
console.log('Reset result:', result);
```

**Prevention**: Standardize phone number format in all API calls

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
# Debug user messages and counts
GET /dev/messages/debug/:userId

# Reset user by phone number
POST /dev/reset/:phoneNumber

# Emergency reset by user ID (most reliable)
POST /dev/reset-user/:userId
```

### Using DevTools Class

```javascript
const DevTools = require('./src/utils/dev-tools');

// Get user overview
const status = await DevTools.getUserStatus('+5511976196165');
console.log('User status:', status);

// Debug message counts
const debug = await DevTools.debugMessages(userId);
console.log('Debug info:', debug);

// Emergency reset
const reset = await DevTools.resetUserById(userId);
console.log('Reset result:', reset);

// List recent users
const users = await DevTools.listRecentUsers(10);
console.log('Recent users:', users);
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