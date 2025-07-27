// Debug user state and message history
require('dotenv').config();
const axios = require('axios');

async function debugUserState() {
  const phoneNumber = "+5511976196165";
  const apiUrl = "https://whatsapp-integration-production.up.railway.app";
  
  console.log("🔍 Debugging user state...\n");
  
  // Try to get user status
  try {
    console.log("1. Checking user status:");
    const response = await axios.get(`${apiUrl}/dev/user-status/${encodeURIComponent(phoneNumber)}`);
    console.log("✅ User status:", response.data);
  } catch (error) {
    if (error.response) {
      console.log("❌ User status error:", error.response.status, error.response.data);
    } else {
      console.log("❌ User status error:", error.message);
    }
  }
  
  // Try to list users
  try {
    console.log("\n2. Checking all users:");
    const response = await axios.get(`${apiUrl}/dev/users`);
    console.log("✅ Users:", response.data);
  } catch (error) {
    if (error.response) {
      console.log("❌ Users error:", error.response.status, error.response.data);
    } else {
      console.log("❌ Users error:", error.message);
    }
  }
  
  // Try reset again
  try {
    console.log("\n3. Attempting reset:");
    const response = await axios.post(`${apiUrl}/dev/reset-user`, {
      phoneNumber: phoneNumber
    });
    console.log("✅ Reset response:", response.data);
  } catch (error) {
    if (error.response) {
      console.log("❌ Reset error:", error.response.status, error.response.data);
    } else {
      console.log("❌ Reset error:", error.message);
    }
  }
}

debugUserState().catch(console.error);