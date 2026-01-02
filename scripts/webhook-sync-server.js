#!/usr/bin/env node
// GitHub webhook을 받아서 자동 동기화하는 서버
// push 이벤트가 발생하면 자동으로 git pull 실행

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');

const PORT = process.env.WEBHOOK_PORT || 3001;
const SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key-change-this';
const LIMEN_DIR = process.env.LIMEN_DIR || '/home/darc/LIMEN';
const SYNC_SCRIPT = `${LIMEN_DIR}/scripts/auto-sync-server.sh`;

// 로그 함수
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  // 로그 파일에도 기록
  fs.appendFileSync('/tmp/limen-webhook.log', `[${timestamp}] ${message}\n`);
}

// HMAC 서명 검증
function verifySignature(payload, signature) {
  if (!SECRET || SECRET === 'your-secret-key-change-this') {
    log('⚠️  WARNING: Webhook secret not set! Set WEBHOOK_SECRET environment variable.');
    return true; // 개발 환경에서는 검증 건너뛰기
  }
  
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Git 동기화 실행
function syncRepository() {
  return new Promise((resolve, reject) => {
    log('🔄 Git 동기화 시작...');
    
    exec(`cd ${LIMEN_DIR} && ${SYNC_SCRIPT}`, (error, stdout, stderr) => {
      if (error) {
        log(`❌ 동기화 실패: ${error.message}`);
        reject(error);
        return;
      }
      
      log('✅ 동기화 완료');
      if (stdout) log(`출력: ${stdout}`);
      if (stderr) log(`에러: ${stderr}`);
      resolve(stdout);
    });
  });
}

// HTTP 서버
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const signature = req.headers['x-hub-signature-256'] || req.headers['x-hub-signature'];
        
        // 서명 검증
        if (signature && !verifySignature(body, signature)) {
          log('❌ 서명 검증 실패');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }
        
        const payload = JSON.parse(body);
        const event = req.headers['x-github-event'];
        
        log(`📥 이벤트 수신: ${event}`);
        
        // push 이벤트만 처리
        if (event === 'push' && payload.ref === 'refs/heads/main') {
          log(`🔄 Push 이벤트 감지: ${payload.head_commit?.message || 'unknown'}`);
          
          // 비동기로 동기화 실행 (응답은 즉시 반환)
          syncRepository().catch(err => {
            log(`❌ 동기화 오류: ${err.message}`);
          });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            status: 'ok', 
            message: 'Sync triggered',
            commit: payload.head_commit?.id 
          }));
        } else if (event === 'ping') {
          // GitHub webhook 테스트
          log('🏓 Ping 이벤트 수신');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', message: 'pong' }));
        } else {
          log(`ℹ️  이벤트 무시: ${event} (ref: ${payload.ref})`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ignored', event }));
        }
      } catch (error) {
        log(`❌ 요청 처리 오류: ${error.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    // 헬스 체크
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'limen-webhook-sync' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  log(`🚀 Webhook 서버 시작: http://0.0.0.0:${PORT}`);
  log(`📋 LIMEN 디렉토리: ${LIMEN_DIR}`);
  log(`📋 동기화 스크립트: ${SYNC_SCRIPT}`);
  log(`🔐 Secret: ${SECRET === 'your-secret-key-change-this' ? '⚠️  NOT SET (using default)' : '✅ Set'}`);
  log('');
  log('GitHub Webhook 설정:');
  log(`  URL: http://your-server-ip:${PORT}/webhook`);
  log(`  Content type: application/json`);
  log(`  Secret: ${SECRET}`);
  log(`  Events: Just the push event`);
});

// 에러 처리
server.on('error', (error) => {
  log(`❌ 서버 오류: ${error.message}`);
  process.exit(1);
});

// 종료 처리
process.on('SIGTERM', () => {
  log('🛑 서버 종료 중...');
  server.close(() => {
    log('✅ 서버 종료 완료');
    process.exit(0);
  });
});

