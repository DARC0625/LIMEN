#!/usr/bin/env python3
"""
Test WebSocket console endpoint
1. Login to get access token
2. Get VM UUID
3. Call /api/vms/{uuid}/console to get ws_url
4. Test WebSocket connection
"""
import sys
import json
import requests
import asyncio
import websockets
from urllib.parse import urlparse, parse_qs

BASE_URL = "http://localhost:18443"
# Try different passwords
PASSWORDS = ["0625", "admin", "password"]

def login(username="admin", password=None):
    """Login and get access token"""
    if password is None:
        for pwd in PASSWORDS:
            resp = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": username, "password": pwd},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("access_token")
        return None
    
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": password},
        timeout=5
    )
    if resp.status_code == 200:
        data = resp.json()
        return data.get("access_token")
    return None

def get_vm_uuid(token):
    """Get first VM UUID"""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/api/vms", headers=headers, timeout=5)
    if resp.status_code == 200:
        vms = resp.json()
        if vms and len(vms) > 0:
            return vms[0].get("uuid")
    return None

def get_console_url(token, vm_uuid):
    """Get console WebSocket URL"""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(
        f"{BASE_URL}/api/vms/{vm_uuid}/console",
        headers=headers,
        timeout=5
    )
    if resp.status_code == 200:
        data = resp.json()
        return data.get("ws_url"), data.get("protocol"), data.get("expires_at")
    else:
        print(f"ERROR: Failed to get console URL: {resp.status_code}")
        print(f"Response: {resp.text}")
        return None, None, None

async def test_websocket(ws_url):
    """Test WebSocket connection"""
    print(f"\n[WS TEST] Connecting to: {ws_url}")
    
    try:
        # Parse URL to extract origin if needed
        parsed = urlparse(ws_url)
        origin = f"{parsed.scheme.replace('ws', 'http')}://{parsed.netloc}"
        
        async with websockets.connect(
            ws_url,
            origin=origin if parsed.scheme == "wss" else None,
            ping_interval=None,
            ping_timeout=None,
            close_timeout=5
        ) as ws:
            print("[WS TEST] ✓ Connection opened successfully")
            
            # Wait for messages or close
            try:
                # Wait up to 3 seconds for any message
                message = await asyncio.wait_for(ws.recv(), timeout=3.0)
                msg_preview = str(message)[:80] if len(str(message)) > 80 else str(message)
                print(f"[WS TEST] ✓ Received message (type: {type(message).__name__}, len: {len(str(message))}): {msg_preview}")
            except asyncio.TimeoutError:
                print("[WS TEST] ✓ No message received (timeout after 3s) - connection is alive")
            except websockets.exceptions.ConnectionClosed as e:
                print(f"[WS TEST] ✗ Connection closed by server: code={e.code}, reason={e.reason}")
                return False
            
            # Send a test message (if VNC protocol supports it)
            # For VNC, we might not send anything, just keep connection alive
            await asyncio.sleep(1)
            
            print("[WS TEST] ✓ WebSocket test PASSED - connection is stable")
            return True
            
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"[WS TEST] ✗ Connection failed: HTTP {e.status_code}")
        if hasattr(e, 'headers'):
            print(f"  Headers: {e.headers}")
        return False
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"[WS TEST] ✗ Connection closed immediately: code={e.code}, reason={e.reason}")
        return False
    except Exception as e:
        print(f"[WS TEST] ✗ Error: {type(e).__name__}: {e}")
        return False

def main():
    print("=== Console WebSocket Test ===")
    
    # Step 1: Login
    print("\n[1] Logging in...")
    token = login()
    if not token:
        print("✗ Login failed")
        sys.exit(1)
    print(f"✓ Login successful (token: {token[:20]}...)")
    
    # Step 2: Get VM UUID
    print("\n[2] Getting VM list...")
    vm_uuid = get_vm_uuid(token)
    if not vm_uuid:
        print("✗ No VM found")
        sys.exit(1)
    print(f"✓ Found VM: {vm_uuid}")
    
    # Step 3: Get console URL
    print("\n[3] Getting console URL...")
    ws_url, protocol, expires_at = get_console_url(token, vm_uuid)
    if not ws_url:
        print("✗ Failed to get console URL")
        sys.exit(1)
    print(f"✓ Console URL received:")
    print(f"  ws_url: {ws_url}")
    print(f"  protocol: {protocol}")
    print(f"  expires_at: {expires_at}")
    
    # Step 4: Test WebSocket
    print("\n[4] Testing WebSocket connection...")
    success = asyncio.run(test_websocket(ws_url))
    
    if success:
        print("\n✓✓✓ ALL TESTS PASSED ✓✓✓")
        sys.exit(0)
    else:
        print("\n✗✗✗ WEBSOCKET TEST FAILED ✗✗✗")
        sys.exit(1)

if __name__ == "__main__":
    main()
