#!/usr/bin/env node
/**
 * Test WebSocket console endpoint
 * 1. Login to get access token
 * 2. Get VM UUID
 * 3. Call /api/vms/{uuid}/console to get ws_url
 * 4. Test WebSocket connection
 */

const http = require('http');
const https = require('https');
const { WebSocket } = require('ws');

const BASE_URL = 'http://localhost:18443';
const PASSWORDS = ['0625', 'admin', 'password'];

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function login(username = 'admin', password = null) {
  const passwords = password ? [password] : PASSWORDS;
  
  for (const pwd of passwords) {
    try {
      const result = await httpRequest(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { username, password: pwd }
      });
      
      if (result.status === 200 && result.data.access_token) {
        return result.data.access_token;
      }
    } catch (e) {
      // Continue to next password
    }
  }
  
  return null;
}

async function getVmUuid(token) {
  try {
    const result = await httpRequest(`${BASE_URL}/api/vms`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (result.status === 200 && Array.isArray(result.data) && result.data.length > 0) {
      return result.data[0].uuid;
    }
  } catch (e) {
    console.error('Error getting VM list:', e.message);
  }
  
  return null;
}

async function getConsoleUrl(token, vmUuid) {
  try {
    const result = await httpRequest(`${BASE_URL}/api/vms/${vmUuid}/console`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (result.status === 200) {
      return {
        ws_url: result.data.ws_url,
        protocol: result.data.protocol,
        expires_at: result.data.expires_at
      };
    } else {
      console.error(`ERROR: Failed to get console URL: ${result.status}`);
      console.error(`Response: ${JSON.stringify(result.data)}`);
      return null;
    }
  } catch (e) {
    console.error('Error getting console URL:', e.message);
    return null;
  }
}

function testWebSocket(wsUrl) {
  return new Promise((resolve) => {
    console.log(`\n[WS TEST] Connecting to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl, {
      handshakeTimeout: 5000,
      perMessageDeflate: false
    });
    
    let opened = false;
    let receivedMessage = false;
    let closed = false;
    
    const timeout = setTimeout(() => {
      if (!closed) {
        console.log('[WS TEST] ✓ Connection timeout (5s) - connection is alive');
        ws.close();
      }
    }, 5000);
    
    ws.on('open', () => {
      opened = true;
      console.log('[WS TEST] ✓ Connection opened successfully');
    });
    
    ws.on('message', (data) => {
      receivedMessage = true;
      const preview = data.toString().slice(0, 80);
      const type = Buffer.isBuffer(data) ? 'Buffer' : typeof data;
      console.log(`[WS TEST] ✓ Received message (type: ${type}, len: ${data.length}): ${preview}`);
    });
    
    ws.on('error', (error) => {
      console.log(`[WS TEST] ✗ Error: ${error.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
    
    ws.on('close', (code, reason) => {
      closed = true;
      clearTimeout(timeout);
      
      if (opened) {
        if (receivedMessage) {
          console.log(`[WS TEST] ✓ Connection closed normally: code=${code}, reason=${reason || 'none'}`);
          resolve(true);
        } else {
          console.log(`[WS TEST] ⚠ Connection closed without receiving data: code=${code}, reason=${reason || 'none'}`);
          // Still consider it a success if connection was opened
          resolve(code === 1000 || code === 1001);
        }
      } else {
        console.log(`[WS TEST] ✗ Connection closed immediately: code=${code}, reason=${reason || 'none'}`);
        resolve(false);
      }
    });
  });
}

async function main() {
  console.log('=== Console WebSocket Test ===\n');
  
  // Step 1: Login
  console.log('[1] Logging in...');
  const token = await login();
  if (!token) {
    console.log('✗ Login failed');
    process.exit(1);
  }
  console.log(`✓ Login successful (token: ${token.substring(0, 20)}...)`);
  
  // Step 2: Get VM UUID
  console.log('\n[2] Getting VM list...');
  const vmUuid = await getVmUuid(token);
  if (!vmUuid) {
    console.log('✗ No VM found');
    process.exit(1);
  }
  console.log(`✓ Found VM: ${vmUuid}`);
  
  // Step 3: Get console URL
  console.log('\n[3] Getting console URL...');
  const consoleInfo = await getConsoleUrl(token, vmUuid);
  if (!consoleInfo || !consoleInfo.ws_url) {
    console.log('✗ Failed to get console URL');
    process.exit(1);
  }
  console.log(`✓ Console URL received:`);
  console.log(`  ws_url: ${consoleInfo.ws_url}`);
  console.log(`  protocol: ${consoleInfo.protocol}`);
  console.log(`  expires_at: ${consoleInfo.expires_at}`);
  
  // Step 4: Test WebSocket
  console.log('\n[4] Testing WebSocket connection...');
  const success = await testWebSocket(consoleInfo.ws_url);
  
  if (success) {
    console.log('\n✓✓✓ ALL TESTS PASSED ✓✓✓');
    process.exit(0);
  } else {
    console.log('\n✗✗✗ WEBSOCKET TEST FAILED ✗✗✗');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
