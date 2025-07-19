// Script to send WhatsApp template messages
require('dotenv').config();
const https = require('https');

// Configuration from environment
const config = {
  phoneNumberId: process.env.TEST_PHONE_NUMBER_ID,
  accessToken: process.env.TEST_ACCESS_TOKEN,
  recipientNumber: process.env.YOUR_WHATSAPP_NUMBER,
  apiVersion: 'v18.0'
};

// Function to send a template message
function sendTemplateMessage(templateName, languageCode = 'pt_BR', components = []) {
  const data = JSON.stringify({
    messaging_product: 'whatsapp',
    to: config.recipientNumber,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: components
    }
  });

  const options = {
    hostname: 'graph.facebook.com',
    port: 443,
    path: `/${config.apiVersion}/${config.phoneNumberId}/messages`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Length': data.length
    }
  };

  console.log('Sending template to:', config.recipientNumber);
  console.log('Template name:', templateName);
  console.log('Language:', languageCode);

  const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response:', JSON.parse(responseData));
      
      if (res.statusCode === 200) {
        console.log('✅ Template message sent successfully!');
      } else {
        console.log('❌ Failed to send template message');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error);
  });

  req.write(data);
  req.end();
}

// Main execution
console.log('WhatsApp Template Message Test');
console.log('==============================\n');

// Get template name from command line or use default
const templateName = process.argv[2] || 'hello_world';
const languageCode = process.argv[3] || 'pt_BR';

// For hello_world template, no components needed
// For other templates, you might need to add components with parameters
sendTemplateMessage(templateName, languageCode);