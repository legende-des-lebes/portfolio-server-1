const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { google } = require('googleapis');
const credentials = require('./credentials.json');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Index')));

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEET_ID = '1oQDqY2ZTatcQQjjSMz59Ez_FeRpwAl4wORVm2_BXk_U'; // ✅ Use your actual ID

async function appendToSheet({ name, email, ip, location }) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const timestamp = new Date().toISOString();
  const row = [timestamp, name, email, ip, location];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'portfolio-server-log!A1:E1', // ✅ Sheet name should exist
    valueInputOption: 'RAW',
    requestBody: {
      values: [row],
    },
  });
}

// POST route to log user data
app.post('/log', async (req, res) => {
  const { name, email } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  console.log('🧪 Received POST to /log');
  console.log('🧪 Name:', name);
  console.log('🧪 Email:', email);
  console.log('🧪 IP:', ip);

  if (!name || !email) {
    console.log('❌ Missing name or email');
    return res.status(400).send('Missing name or email');
  }

  let locationInfo = '';
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    const data = response.data;
    if (data.status === 'success') {
      locationInfo = `${data.city}, ${data.regionName}, ${data.country} | ISP: ${data.isp}`;
    } else {
      locationInfo = 'Unknown';
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch geo info:', error.message);
    locationInfo = '[Geo lookup failed]';
  }

  try {
    await appendToSheet({ name, email, ip, location: locationInfo });
    res.send('Logged successfully to Google Sheets');
  } catch (err) {
    console.error('❌ Failed to log to Google Sheets:', err.message);
    res.status(500).send('Logging failed');
  }
});

// Serve main index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Index', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
