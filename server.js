require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const validateConfig = require('./src/config/validate');
const WhatsAppMessagingService = require('./src/services/WhatsAppMessagingService');
const ArnaldoAgent = require('./src/services/ArnaldoAgent');
const User = require('./src/models/User');
const Conversation = require('./src/models/Conversation');
const Message = require('./src/models/Message');
const db = require('./src/database/db');

// Validate configuration on startup
validateConfig();

const app = express();

// Middleware to capture raw body for signature verification
app.use(express.json({ 
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Serve static files for testing
app.use(express.static('public'));

// Configuration
const config = {
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'zenmind-webhook-2025',
  appSecret: process.env.META_APP_SECRET,
  port: process.env.PORT || 3000
};

// Initialize services
const messagingService = new WhatsAppMessagingService();
const arnaldoAgent = new ArnaldoAgent();

// Import API routes
const pluggyRoutes = require('./src/api/pluggy');

// ============================================
// WEBHOOK ENDPOINTS
// ============================================

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === config.webhookVerifyToken) {
      console.log('✅ Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.error('❌ Webhook verification failed');
      res.status(403).send('Forbidden');
    }
  } else {
    res.status(403).send('Forbidden');
  }
});

// Webhook event handler (POST)
app.post('/webhook', async (req, res) => {
  try {
    // Verify signature if app secret is configured
    if (config.appSecret) {
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(req.rawBody, signature)) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).send('Unauthorized');
      }
    }

    const body = req.body;
    console.log('📨 Webhook event received:', JSON.stringify(body, null, 2));

    // Process the webhook event
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            await processWhatsAppMessages(change.value);
          }
        }
      }
    }

    // Always respond with 200 OK immediately
    res.status(200).send('EVENT_RECEIVED');

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ============================================
// API ENDPOINTS
// ============================================

// Send message endpoint
app.post('/api/v1/messages/send', async (req, res) => {
  try {
    const { to, content, options } = req.body;
    
    if (!to || !content) {
      return res.status(400).json({
        error: 'Missing required fields: to, content'
      });
    }

    const result = await messagingService.sendMessage(to, content, options);
    res.json(result);

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get conversation status
app.get('/api/v1/conversations/status/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const status = await messagingService.getConversationStatus(phoneNumber);
    res.json(status);

  } catch (error) {
    console.error('Error getting conversation status:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const messageStats = await Message.getStats();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      stats: messageStats
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Pluggy API routes
app.use('/api/v1/pluggy', pluggyRoutes);

// ============================================
// DEVELOPMENT ENDPOINTS (REMOVE IN PRODUCTION)
// ============================================
if (process.env.NODE_ENV !== 'production' || process.env.DEV_TOOLS_ENABLED === 'true') {
  const DevTools = require('./src/utils/dev-tools');
  
  // Reset user for testing
  app.post('/dev/reset-user', async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }
    
    const result = await DevTools.resetUser(phoneNumber);
    res.json(result);
  });
  
  // Get user status
  app.get('/dev/user-status/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const result = await DevTools.getUserStatus(phoneNumber);
    res.json(result);
  });
  
  // List recent users
  app.get('/dev/users', async (req, res) => {
    const users = await DevTools.listRecentUsers();
    res.json(users);
  });
  
  // Emergency reset by user ID
  app.post('/dev/emergency-reset', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const result = await DevTools.resetUserById(userId);
    res.json(result);
  });
  
  // Debug message counts for user
  app.get('/dev/debug-messages/:userId', async (req, res) => {
    const { userId } = req.params;
    const result = await DevTools.debugMessages(userId);
    res.json(result);
  });
  
  // Store last error for debugging
  let lastError = null;
  
  // Override console.error to capture errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    if (args[0] && args[0].includes('❌ Error processing message')) {
      lastError = {
        timestamp: new Date().toISOString(),
        error: args[1]
      };
    }
    originalConsoleError.apply(console, args);
  };
  
  // Get last error
  app.get('/dev/last-error', (req, res) => {
    res.json(lastError || { message: 'No recent errors captured' });
  });
  
  // Test the exact flow that's failing
  app.get('/dev/test-message-flow/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const message = req.query.message || 'Testando';
      
      // Simulate the exact messageInfo structure
      const messageInfo = {
        messageId: 'test-id',
        userId: userId,
        conversationId: 'test-conv-id',
        phoneNumber: '+5511976196165',
        content: message,
        messageType: 'text'
      };
      
      // Call ArnaldoAgent directly
      const result = await arnaldoAgent.processIncomingMessage(messageInfo);
      
      res.json({
        success: true,
        result: result
      });
      
    } catch (error) {
      res.json({
        success: false,
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  });
  
  // Test OpenAI connection
  app.get('/dev/test-openai', async (req, res) => {
    try {
      const ArnaldoGoalDiscovery = require('./src/services/ArnaldoGoalDiscovery');
      const goalDiscovery = new ArnaldoGoalDiscovery();
      
      // Test with real user ID to check conversation history
      const userId = req.query.userId || 'test-user-id';
      const message = req.query.message || 'test message';
      const result = await goalDiscovery.chat(message, userId);
      
      res.json({
        success: true,
        openaiKeyConfigured: !!process.env.OPENAI_API_KEY,
        openaiKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
        result: result
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        openaiKeyConfigured: !!process.env.OPENAI_API_KEY,
        openaiKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
      });
    }
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Process WhatsApp messages from webhook
async function processWhatsAppMessages(webhookData) {
  try {
    const { messages, statuses } = webhookData;
    
    // Process incoming messages
    if (messages) {
      for (const message of messages) {
        // Store the message first
        const messageInfo = await messagingService.storeIncomingMessage(message, webhookData.metadata);
        
        // Then send to Arnaldo Agent for processing
        // This is async but we don't await - webhook responds immediately
        arnaldoAgent.processIncomingMessage(messageInfo).catch(error => {
          console.error('Error in Arnaldo processing:', error);
        });
      }
    }
    
    // Process status updates
    if (statuses) {
      for (const status of statuses) {
        await messagingService.updateMessageStatus(status);
      }
    }
    
  } catch (error) {
    console.error('Error processing WhatsApp messages:', error);
    throw error;
  }
}

// Verify webhook signature
function verifySignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', config.appSecret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  await db.close();
  process.exit(0);
});

// ============================================
// START SERVER
// ============================================

app.listen(config.port, () => {
  console.log(`🚀 WhatsApp API service (simplified) running on port ${config.port}`);
  console.log(`📡 Webhook URL: http://localhost:${config.port}/webhook`);
  console.log(`🔑 Verify Token: ${config.webhookVerifyToken}`);
  console.log(`🔐 App Secret: ${config.appSecret ? 'Configured' : 'Not configured'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`🤖 Arnaldo Agent: Active`);
});