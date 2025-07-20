// Script to list available WhatsApp message templates
require('dotenv').config();
const https = require('https');

// Configuration
const config = {
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  accessToken: process.env.TEST_ACCESS_TOKEN,
  apiVersion: 'v18.0'
};

// Function to list templates
function listTemplates() {
  const options = {
    hostname: 'graph.facebook.com',
    port: 443,
    path: `/${config.apiVersion}/${config.businessAccountId}/message_templates?access_token=${config.accessToken}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  console.log('Fetching message templates...\n');

  const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      const response = JSON.parse(responseData);
      
      if (res.statusCode === 200 && response.data) {
        console.log(`Found ${response.data.length} templates:\n`);
        
        response.data.forEach((template, index) => {
          console.log(`${index + 1}. Template: ${template.name}`);
          console.log(`   Status: ${template.status}`);
          console.log(`   Language: ${template.language}`);
          console.log(`   Category: ${template.category}`);
          if (template.components) {
            template.components.forEach(component => {
              if (component.type === 'BODY') {
                console.log(`   Body: ${component.text}`);
              }
            });
          }
          console.log('');
        });
      } else {
        console.log('Failed to fetch templates:', response);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error);
  });

  req.end();
}

// Main execution
console.log('WhatsApp Template List');
console.log('=====================\n');

listTemplates();