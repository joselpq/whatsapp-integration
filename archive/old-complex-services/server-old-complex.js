require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const validateConfig = require('./src/config/validate');
const WhatsAppService = require('./src/services/WhatsAppService');
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

// Initialize WhatsApp service
const whatsappService = new WhatsAppService();

// Import API routes
const pluggyRoutes = require('./src/api/pluggy');

// DEVELOPMENT ENDPOINTS (REMOVE IN PRODUCTION)
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
  
  // Debug user state flow
  app.get('/dev/debug-state/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const ConversationState = require('./src/services/ConversationState');
    const User = require('./src/models/User');
    
    try {
      const user = await User.findByPhoneNumber(phoneNumber);
      if (!user) {
        return res.json({ error: 'User not found' });
      }
      
      const userState = await ConversationState.getUserState(user.id);
      const needsGuidance = await ConversationState.needsGuidance(user.id);
      
      const now = Date.now();
      const createdAt = new Date(user.created_at).getTime();
      const diffMinutes = (now - createdAt) / (1000 * 60);
      const isNewUser = !user.onboarding_completed && diffMinutes < 5;
      
      res.json({
        userId: user.id,
        phoneNumber: user.phone_number,
        onboardingCompleted: user.onboarding_completed,
        createdAt: user.created_at,
        timeDiffMinutes: diffMinutes,
        isNewUser,
        userState,
        needsGuidance
      });
    } catch (error) {
      res.json({ error: error.message });
    }
  });
  
  // Run database migration
  app.post('/dev/migrate-states', async (req, res) => {
    const migrate = require('./scripts/add-user-states');
    
    try {
      console.log('🔄 Starting migration from API endpoint...');
      await migrate();
      res.json({ 
        success: true, 
        message: 'User states migration completed successfully',
        warning: 'REMOVE THIS ENDPOINT BEFORE PRODUCTION'
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Run Pluggy tables migration
  app.post('/dev/migrate-pluggy', async (req, res) => {
    const migrate = require('./scripts/add-pluggy-tables');
    
    try {
      console.log('🔄 Starting Pluggy migration from API endpoint...');
      await migrate();
      res.json({ 
        success: true, 
        message: 'Pluggy tables migration completed successfully',
        warning: 'REMOVE THIS ENDPOINT BEFORE PRODUCTION'
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Check Pluggy configuration
  app.get('/dev/pluggy-config', (req, res) => {
    res.json({
      clientIdConfigured: !!process.env.PLUGGY_CLIENT_ID,
      clientSecretConfigured: !!process.env.PLUGGY_CLIENT_SECRET,
      baseUrlConfigured: !!process.env.BASE_URL,
      baseUrl: process.env.BASE_URL,
      clientIdPreview: process.env.PLUGGY_CLIENT_ID ? `${process.env.PLUGGY_CLIENT_ID.slice(0, 8)}...` : 'not set'
    });
  });
}

// API Routes
app.use('/api/pluggy', pluggyRoutes);

// Webhook verification endpoint (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification request:', { mode, token: token ? 'provided' : 'missing' });

  if (mode === 'subscribe' && token === config.webhookVerifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
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
            await whatsappService.processIncomingMessage(change.value);
          }
        }
      }
    }

    // Always respond with 200 OK
    res.status(200).send('EVENT_RECEIVED');

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// API endpoint to send messages
app.post('/api/v1/messages/send', async (req, res) => {
  try {
    const { to, content, options = {} } = req.body;
    
    if (!to || !content) {
      return res.status(400).json({
        error: 'Missing required fields: to, content'
      });
    }

    const result = await whatsappService.sendMessage(to, content, options);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// API endpoint to send template messages
app.post('/api/v1/messages/template', async (req, res) => {
  try {
    const { to, templateName, templateLanguage = 'pt_BR', templateComponents = [] } = req.body;
    
    if (!to || !templateName) {
      return res.status(400).json({
        error: 'Missing required fields: to, templateName'
      });
    }

    const result = await whatsappService.sendMessage(to, '', {
      forceTemplate: true,
      templateName,
      templateLanguage,
      templateComponents
    });
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error sending template:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// API endpoint to get user messages
app.get('/api/v1/messages', async (req, res) => {
  try {
    const { phoneNumber, conversationId, limit = 50, offset = 0 } = req.query;
    
    let messages = [];
    
    if (conversationId) {
      messages = await Message.findByConversation(conversationId, parseInt(limit), parseInt(offset));
    } else if (phoneNumber) {
      const user = await User.findByPhoneNumber(phoneNumber);
      if (user) {
        messages = await Message.findByUser(user.id, parseInt(limit), parseInt(offset));
      }
    } else {
      return res.status(400).json({
        error: 'Either phoneNumber or conversationId is required'
      });
    }
    
    res.json({
      messages,
      total: messages.length,
      hasMore: messages.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// API endpoint to get conversation status
app.get('/api/v1/conversations/status', async (req, res) => {
  try {
    const { phoneNumber } = req.query;
    
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'phoneNumber is required'
      });
    }

    const user = await User.findByPhoneNumber(phoneNumber);
    if (!user) {
      return res.json({
        phoneNumber,
        hasConversation: false,
        isWindowOpen: false,
        canSendFreeMessage: false
      });
    }

    const status = await Conversation.getStatus(user.id);
    
    res.json({
      phoneNumber,
      userId: user.id,
      ...status
    });

  } catch (error) {
    console.error('Error getting conversation status:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Health check endpoint with database stats
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

// Helper function to verify webhook signature
function verifySignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', config.appSecret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// Graceful shutdown
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

// Start server
app.listen(config.port, () => {
  console.log(`🚀 WhatsApp API service running on port ${config.port}`);
  console.log(`📡 Webhook URL: http://localhost:${config.port}/webhook`);
  console.log(`🔑 Verify Token: ${config.webhookVerifyToken}`);
  console.log(`🔐 App Secret: ${config.appSecret ? 'Configured' : 'Not configured'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
});