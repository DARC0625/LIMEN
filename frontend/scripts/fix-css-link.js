const fs = require('fs');
const path = require('path');

const chunksDir = path.join('.next/static/chunks');
if (!fs.existsSync(chunksDir)) {
  process.exit(0);
}

const cssFiles = fs.readdirSync(chunksDir).filter(f => f.endsWith('.css'));
if (cssFiles.length === 0) {
  process.exit(0);
}

const actualCss = cssFiles[0];

// 여러 위치에서 HTML 파일 찾기
const htmlPaths = [
  path.join('.next/server/app/page.html'),
  path.join('.next/server/app/_not-found.html'),
  ...fs.readdirSync('.next/server/app').filter(f => f.endsWith('.html')).map(f => path.join('.next/server/app', f))
];

let foundCssName = null;

for (const htmlPath of htmlPaths) {
  if (!fs.existsSync(htmlPath)) continue;
  
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const match = html.match(/static\/chunks\/([^"]+\.css)/);
    
    if (match && match[1] !== actualCss) {
      foundCssName = match[1];
      break;
    }
  } catch (e) {
    // 무시
  }
}

// 매니페스트 파일에서도 찾기
if (!foundCssName) {
  try {
    const manifestFiles = [
      path.join('.next/server/app/_buildManifest.js'),
      path.join('.next/BUILD_ID'),
    ];
    
    for (const manifestPath of manifestFiles) {
      if (fs.existsSync(manifestPath)) {
        const content = fs.readFileSync(manifestPath, 'utf8');
        const match = content.match(/static\/chunks\/([^"'\s]+\.css)/);
        if (match && match[1] !== actualCss) {
          foundCssName = match[1];
          break;
        }
      }
    }
  } catch (e) {
    // 무시
  }
}

// 알려진 CSS 파일명 패턴 시도 (이전 빌드에서 사용된 파일명)
// 실제 서버에서 사용하는 파일명을 확인
if (!foundCssName) {
  const knownCssNames = ['c67ed24decc4485f.css'];
  for (const knownName of knownCssNames) {
    const testPath = path.join(chunksDir, knownName);
    if (!fs.existsSync(testPath) && knownName !== actualCss) {
      foundCssName = knownName;
      break;
    }
  }
}

// 모든 chunks 파일에서 CSS 참조 찾기
if (!foundCssName) {
  try {
    const chunkFiles = fs.readdirSync(chunksDir).filter(f => f.endsWith('.js'));
    for (const chunkFile of chunkFiles.slice(0, 10)) { // 처음 10개만 확인
      try {
        const content = fs.readFileSync(path.join(chunksDir, chunkFile), 'utf8');
        const match = content.match(/static\/chunks\/([^"'\s]+\.css)/);
        if (match && match[1] !== actualCss) {
          foundCssName = match[1];
          break;
        }
      } catch (e) {
        // 무시
      }
    }
  } catch (e) {
    // 무시
  }
}

// 알려진 CSS 파일명도 체크 (이전 빌드에서 사용된 파일명)
const knownCssNames = ['c67ed24decc4485f.css'];
for (const knownName of knownCssNames) {
  const testPath = path.join(chunksDir, knownName);
  if (!fs.existsSync(testPath) && knownName !== actualCss) {
    try {
      fs.symlinkSync(actualCss, testPath);
      console.log(`✅ CSS 심볼릭 링크 생성: ${knownName} -> ${actualCss}`);
    } catch (e) {
      // 이미 존재하면 무시
    }
  }
}

if (foundCssName && foundCssName !== actualCss) {
  const oldPath = path.join(chunksDir, foundCssName);
  const newPath = path.join(chunksDir, actualCss);
  
  if (!fs.existsSync(oldPath) && fs.existsSync(newPath)) {
    try {
      fs.symlinkSync(actualCss, oldPath);
      console.log(`✅ CSS 심볼릭 링크 생성: ${foundCssName} -> ${actualCss}`);
    } catch (e) {
      // 이미 존재하면 무시
    }
  }
}
