// Emergency reset using user ID from logs
require('dotenv').config();
const axios = require('axios');

async function emergencyReset() {
  const userId = "773f3dc0-e3e6-4d17-bde9-74c8666c9238";
  const apiUrl = "https://whatsapp-integration-production.up.railway.app";
  
  console.log(`🚨 Emergency reset for user ID: ${userId}`);
  
  try {
    // Create a custom reset endpoint call
    const response = await axios.post(`${apiUrl}/dev/emergency-reset`, {
      userId: userId
    });
    console.log("✅ Emergency reset response:", response.data);
  } catch (error) {
    if (error.response) {
      console.log("❌ Reset error:", error.response.status, error.response.data);
    } else {
      console.log("❌ Reset error:", error.message);
    }
  }
}

emergencyReset().catch(console.error);