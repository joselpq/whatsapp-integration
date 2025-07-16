# Direct WhatsApp Business API Integration Plan

## Overview
This document outlines a step-by-step plan to create a direct integration with Meta's WhatsApp Business API, from account creation to building a reusable service that can send messages through multiple phone numbers.

## Prerequisites
- Business verification documents
- Facebook Business Manager account
- Valid business website with privacy policy
- SSL certificate for webhook URL
- Phone numbers not previously registered with WhatsApp

## Phase 1: Meta Business Setup

### Step 1: Create Meta Business Account
1. Go to [business.facebook.com](https://business.facebook.com)
2. Create new Business Manager account
3. Complete business verification:
   - Business registration documents
   - Utility bill or bank statement
   - Business address verification
   - Tax ID number

### Step 2: WhatsApp Business Platform Setup
1. Navigate to Meta Business Suite
2. Go to "WhatsApp" section
3. Select "Get Started with WhatsApp Business Platform"
4. Choose "Build your own solution" (not using a BSP)

### Step 3: Create WhatsApp Business App
1. In Meta for Developers ([developers.facebook.com](https://developers.facebook.com)):
   - Create new app
   - Select "Business" as app type
   - Choose "WhatsApp" as product
2. Note down:
   - App ID
   - App Secret
   - WhatsApp Business Account ID

## Phase 2: Phone Number Configuration

### Step 4: Add Phone Numbers
1. In WhatsApp Business Platform:
   - Click "Add phone number"
   - Enter phone number (must not be registered with WhatsApp)
   - Verify via SMS/Voice call
2. For each phone number, obtain:
   - Phone Number ID
   - Display Name
   - Quality Rating

### Step 5: Configure Phone Number Settings
1. Set display name for each number
2. Upload profile picture
3. Configure business description
4. Set business category
5. Add business address

## Phase 3: API Access Setup

### Step 6: Generate Access Tokens
1. System User Creation:
   ```
   Business Settings → Users → System Users → Add
   - Name: WhatsApp API User
   - Role: Admin
   ```
2. Generate System User Access Token:
   - Add Assets → WhatsApp Accounts → Select your account
   - Generate Token with permissions:
     - whatsapp_business_messaging
     - whatsapp_business_management
   - **IMPORTANT**: This creates a permanent access token (no expiration)
   - Save this token securely - you cannot view it again

3. Note the credentials you'll need:
   - **Access Token**: The permanent token from step 2 (used for all API calls)
   - **Phone Number ID**: Found in WhatsApp Manager for each phone number
   - **WhatsApp Business Account ID**: Found in Business Manager
   - **App Secret**: Only needed for webhook signature verification

### Step 7: Webhook Configuration
1. Set up webhook endpoint in your application
2. In Meta App Dashboard:
   - WhatsApp → Configuration → Webhook
   - Callback URL: `https://yourdomain.com/webhook/whatsapp`
   - Verify Token: Generate secure random string
3. Subscribe to webhook fields:
   - messages
   - message_status
   - message_template_status_update

## Phase 4: Build the Integration Service

### Step 8: Project Structure
```
whatsapp-api-service/
├── src/
│   ├── config/
│   │   └── whatsapp.config.ts
│   ├── services/
│   │   ├── whatsapp.service.ts
│   │   ├── webhook.service.ts
│   │   └── message.queue.ts
│   ├── controllers/
│   │   ├── webhook.controller.ts
│   │   └── message.controller.ts
│   ├── models/
│   │   ├── message.model.ts
│   │   └── phone-number.model.ts
│   ├── utils/
│   │   ├── crypto.ts
│   │   └── validators.ts
│   └── index.ts
├── .env.example
├── package.json
└── README.md
```

### Step 9: Core Implementation

#### Environment Configuration (.env)
```env
# WhatsApp API Credentials
WHATSAPP_ACCESS_TOKEN=your_permanent_system_user_token
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# Webhook Configuration (App Secret is only for webhook signature verification)
META_APP_SECRET=your_app_secret_for_webhook_verification
WEBHOOK_VERIFY_TOKEN=your_verify_token
WEBHOOK_URL=https://yourdomain.com/webhook/whatsapp

# Phone Numbers (format: phoneNumberId:displayNumber)
# Phone Number IDs are obtained from Meta Business Manager
PHONE_NUMBERS=10293847561234:+1234567890,98765432101234:+0987654321

# Server Configuration
PORT=3000
NODE_ENV=production
```

#### WhatsApp Service (whatsapp.service.ts)
```typescript
import axios from 'axios';

interface PhoneNumber {
  id: string;
  number: string;
  displayName: string;
}

export class WhatsAppService {
  private baseUrl = 'https://graph.facebook.com/v18.0';
  private phoneNumbers: Map<string, PhoneNumber> = new Map();

  constructor(
    private accessToken: string,
    phoneNumbers: string
  ) {
    this.initializePhoneNumbers(phoneNumbers);
  }

  private initializePhoneNumbers(phoneNumbersConfig: string) {
    const numbers = phoneNumbersConfig.split(',');
    numbers.forEach(num => {
      const [id, number] = num.split(':');
      this.phoneNumbers.set(number, { id, number, displayName: '' });
    });
  }

  async sendMessage(
    from: string,
    to: string,
    message: string
  ): Promise<any> {
    const phoneNumber = this.phoneNumbers.get(from);
    if (!phoneNumber) {
      throw new Error(`Phone number ${from} not configured`);
    }

    const url = `${this.baseUrl}/${phoneNumber.id}/messages`;
    
    try {
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async sendTemplate(
    from: string,
    to: string,
    templateName: string,
    languageCode: string,
    components?: any[]
  ): Promise<any> {
    const phoneNumber = this.phoneNumbers.get(from);
    if (!phoneNumber) {
      throw new Error(`Phone number ${from} not configured`);
    }

    const url = `${this.baseUrl}/${phoneNumber.id}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components
      }
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to send template:', error);
      throw error;
    }
  }

  async sendMedia(
    from: string,
    to: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    mediaUrl: string,
    caption?: string
  ): Promise<any> {
    const phoneNumber = this.phoneNumbers.get(from);
    if (!phoneNumber) {
      throw new Error(`Phone number ${from} not configured`);
    }

    const url = `${this.baseUrl}/${phoneNumber.id}/messages`;
    
    const payload: any = {
      messaging_product: 'whatsapp',
      to: to,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl
      }
    };

    if (caption && (mediaType === 'image' || mediaType === 'video')) {
      payload[mediaType].caption = caption;
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to send media:', error);
      throw error;
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    // Implementation for marking messages as read
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    // Implementation for retrieving media URLs
  }
}
```

#### Webhook Controller (webhook.controller.ts)
```typescript
import crypto from 'crypto';
import { Request, Response } from 'express';

export class WebhookController {
  constructor(
    private verifyToken: string,
    private appSecret: string
  ) {}

  // Webhook verification endpoint
  verify(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('Webhook verified');
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  // Webhook event handler
  async handleEvent(req: Request, res: Response) {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!this.verifySignature(req.body, signature)) {
      return res.status(401).send('Unauthorized');
    }

    const { entry } = req.body;

    // Process each entry
    for (const item of entry) {
      const { changes } = item;
      
      for (const change of changes) {
        if (change.field === 'messages') {
          await this.processMessage(change.value);
        }
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  }

  private verifySignature(payload: any, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.appSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return `sha256=${expectedSignature}` === signature;
  }

  private async processMessage(value: any) {
    const { messages, statuses } = value;

    if (messages) {
      for (const message of messages) {
        console.log('Received message:', message);
        // Handle incoming message
        // Emit event or call message handler
      }
    }

    if (statuses) {
      for (const status of statuses) {
        console.log('Status update:', status);
        // Handle status update
      }
    }
  }
}
```

#### API Endpoints (index.ts)
```typescript
import express from 'express';
import dotenv from 'dotenv';
import { WhatsAppService } from './services/whatsapp.service';
import { WebhookController } from './controllers/webhook.controller';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize services
const whatsappService = new WhatsAppService(
  process.env.WHATSAPP_ACCESS_TOKEN!,
  process.env.PHONE_NUMBERS!
);

const webhookController = new WebhookController(
  process.env.WEBHOOK_VERIFY_TOKEN!,
  process.env.META_APP_SECRET!
);

// Webhook endpoints
app.get('/webhook/whatsapp', (req, res) => webhookController.verify(req, res));
app.post('/webhook/whatsapp', (req, res) => webhookController.handleEvent(req, res));

// Message sending endpoint
app.post('/api/messages/send', async (req, res) => {
  try {
    const { from, to, message } = req.body;
    const result = await whatsappService.sendMessage(from, to, message);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Template sending endpoint
app.post('/api/messages/template', async (req, res) => {
  try {
    const { from, to, templateName, languageCode, components } = req.body;
    const result = await whatsappService.sendTemplate(
      from, to, templateName, languageCode, components
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Media sending endpoint
app.post('/api/messages/media', async (req, res) => {
  try {
    const { from, to, mediaType, mediaUrl, caption } = req.body;
    const result = await whatsappService.sendMedia(
      from, to, mediaType, mediaUrl, caption
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WhatsApp API service running on port ${PORT}`);
});
```

## Phase 5: Message Templates

### Step 10: Create Message Templates
1. In WhatsApp Manager → Message Templates
2. Create templates for common use cases:
   - Order confirmation
   - Appointment reminder
   - Account verification
   - Shipping notification
3. Template structure:
   ```
   Header: [Optional - Text/Image/Document]
   Body: Your order {{1}} has been confirmed
   Footer: [Optional]
   Buttons: [Optional - Quick Reply/Call/URL]
   ```

### Step 11: Template Approval Process
1. Submit template for review
2. Wait for approval (24-48 hours)
3. Monitor template quality score
4. Maintain template health

## Phase 6: Production Deployment

### Step 12: Security Implementation
1. **API Key Management**:
   - Use environment variables
   - Rotate access tokens regularly
   - Implement key vault integration

2. **Rate Limiting**:
   ```typescript
   // Add rate limiting per phone number
   const rateLimits = new Map<string, number>();
   const RATE_LIMIT = 80; // messages per second
   ```

3. **Webhook Security**:
   - Verify all webhook signatures
   - Implement request replay protection
   - Add IP whitelisting if needed

### Step 13: Monitoring and Logging
1. **Message Tracking**:
   - Log all sent messages
   - Track delivery status
   - Monitor failed messages

2. **Health Monitoring**:
   - API endpoint health checks
   - Phone number status monitoring
   - Rate limit tracking

3. **Alerting**:
   - Set up alerts for API errors
   - Monitor quality rating drops
   - Track template rejections

## Phase 7: Scaling Considerations

### Step 14: Multi-Number Management
```typescript
class PhoneNumberManager {
  private numbers: Map<string, PhoneNumberConfig> = new Map();
  
  selectNumber(criteria: SelectionCriteria): string {
    // Implement load balancing logic
    // Consider: rate limits, quality score, availability
  }
  
  async checkHealth(): Promise<HealthStatus[]> {
    // Check each number's status and quality rating
  }
}
```

### Step 15: Queue Implementation
For high-volume messaging:
1. Implement message queue (Redis/RabbitMQ)
2. Add retry logic with exponential backoff
3. Handle rate limiting gracefully
4. Implement priority queues

## Usage in Other Applications

### Simple Integration Example
```typescript
// In any application
import axios from 'axios';

class WhatsAppClient {
  constructor(private apiUrl: string, private apiKey: string) {}

  async sendMessage(from: string, to: string, message: string) {
    return axios.post(
      `${this.apiUrl}/api/messages/send`,
      { from, to, message },
      { headers: { 'X-API-Key': this.apiKey } }
    );
  }
}

// Usage
const whatsapp = new WhatsAppClient('https://api.yourdomain.com', 'your-api-key');
await whatsapp.sendMessage('+1234567890', '+0987654321', 'Hello from my app!');
```

## Maintenance Checklist

### Daily
- Monitor message delivery rates
- Check error logs
- Verify webhook functionality

### Weekly
- Review phone number quality ratings
- Check template performance
- Analyze usage patterns

### Monthly
- Rotate access tokens
- Review and optimize templates
- Update documentation
- Performance analysis

## Common Issues and Solutions

### Issue 1: Template Rejected
- Review Meta's template guidelines
- Avoid promotional content in utility templates
- Ensure proper variable formatting

### Issue 2: Quality Rating Drop
- Monitor customer opt-outs
- Improve message relevance
- Respect messaging windows

### Issue 3: Rate Limiting
- Implement proper queue management
- Distribute load across phone numbers
- Request limit increase if needed

## Cost Considerations

### Pricing Structure
1. **Conversation-based pricing**:
   - User-initiated: 24-hour window
   - Business-initiated: 24-hour window
   - Template messages outside window

2. **Cost Optimization**:
   - Batch messages within conversation windows
   - Use templates efficiently
   - Monitor conversation analytics

## Next Steps

1. Complete Meta Business verification
2. Set up development environment
3. Implement core service
4. Test with sandbox numbers
5. Submit production access request
6. Deploy to production
7. Monitor and optimize

This direct integration provides full control over WhatsApp messaging without third-party dependencies, suitable for scaling across multiple applications and phone numbers.