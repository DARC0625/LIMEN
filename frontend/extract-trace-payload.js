const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function extractPayload(tracePath) {
  const traceDir = path.dirname(tracePath);
  const traceFile = path.basename(tracePath);
  
  console.log(`Extracting payload from: ${tracePath}`);
  
  // Playwright trace를 읽기 위해 브라우저 컨텍스트 생성
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // Trace 파일에서 네트워크 요청 추출
  // Note: Playwright의 trace API는 직접 네트워크 요청을 추출하는 기능이 제한적이므로
  // 대신 trace 파일의 압축을 풀어서 확인하거나, 다음 테스트 실행 시 캡처하는 것이 더 확실합니다.
  
  await browser.close();
  
  // 대안: trace 파일을 압축 해제하여 확인
  const { execSync } = require('child_process');
  const extractDir = `/tmp/trace-extract-${Date.now()}`;
  
  try {
    execSync(`mkdir -p ${extractDir}`, { stdio: 'inherit' });
    execSync(`cd ${extractDir} && unzip -q ${tracePath}`, { stdio: 'inherit' });
    
    // network.json 파일 찾기
    const networkFiles = execSync(`find ${extractDir} -name "*network*" -o -name "*request*"`, { encoding: 'utf-8' }).trim().split('\n').filter(f => f);
    
    console.log('Found network files:', networkFiles);
    
    for (const file of networkFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('vm') || content.includes('instance') || content.includes('vcpu') || content.includes('memory')) {
          console.log(`\n=== Potential VM request in ${file} ===`);
          console.log(content.substring(0, 2000));
        }
      }
    }
    
    execSync(`rm -rf ${extractDir}`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Error extracting trace:', e.message);
  }
}

const tracePath = process.argv[2] || '/home/darc/LIMEN/frontend/test-results/vm-console-e2e-VM-create---1979e-s-basic-input-no-fake-PASS--chromium/trace.zip';

extractPayload(tracePath).catch(console.error);
