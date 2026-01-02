#!/usr/bin/env node

/**
 * noVNC 번들 파일 패치 스크립트
 * 빌드 후 번들 파일에서 c.isMac과 l.isWindows를 직접 수정
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 상대 경로 사용 (프로젝트 루트 기준)
const chunksDir = path.join('.next', 'static', 'chunks');

console.log('🔧 noVNC 번들 파일 패치 시작...');

// .next/static/chunks 디렉토리의 모든 .js 파일 찾기
// 상대 경로 사용
const jsFiles = glob.sync('**/*.js', {
  cwd: chunksDir,
  absolute: false,
}).map(file => path.join(chunksDir, file));

let patchedCount = 0;

jsFiles.forEach((filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // c.isMac 패치 - 모든 패턴 (함수 호출 및 속성 접근)
    // 더 강력한 패치: 모든 c.isMac 패턴을 안전한 함수로 교체
    const cIsMacSafeFn = '(typeof window!=="undefined"&&window.c&&typeof window.c.isMac==="function"?window.c.isMac:function(){return typeof navigator!=="undefined"&&/Mac/i.test(navigator.platform||navigator.userAgent||"")})';
    
    // 함수 호출 패턴: c.isMac(...)
    if (content.includes('c.isMac(') || content.includes('c["isMac"](') || content.includes("c['isMac'](")) {
      content = content.replace(/c\.isMac\(/g, cIsMacSafeFn + '(');
      content = content.replace(/c\["isMac"\]\(/g, cIsMacSafeFn + '(');
      content = content.replace(/c\['isMac'\]\(/g, cIsMacSafeFn + '(');
      modified = true;
    }
    
    // 속성 접근 패턴: c.isMac (함수 호출이 아닌 경우)
    // 이미 패치된 코드는 제외하기 위해 복잡한 패턴 사용
    const beforeC = content;
    content = content.replace(/(?<!typeof\s+window[!=]===)c\.isMac(?!\()/g, cIsMacSafeFn);
    content = content.replace(/(?<!typeof\s+window[!=]===)c\["isMac"\](?!\()/g, cIsMacSafeFn);
    content = content.replace(/(?<!typeof\s+window[!=]===)c\['isMac'\](?!\()/g, cIsMacSafeFn);
    if (content !== beforeC) modified = true;

    // l.isWindows 패치 - 모든 패턴 (함수 호출 및 속성 접근)
    // 더 강력한 패치: 모든 l.isWindows 패턴을 안전한 함수로 교체
    const lIsWindowsSafeFn = '(typeof window!=="undefined"&&window.l&&typeof window.l.isWindows==="function"?window.l.isWindows:function(){return typeof navigator!=="undefined"&&/Win/i.test(navigator.platform||navigator.userAgent||"")})';
    
    // 함수 호출 패턴: l.isWindows(...)
    if (content.includes('l.isWindows(') || content.includes('l["isWindows"](') || content.includes("l['isWindows'](") || /l\.iswindows\(/i.test(content)) {
      content = content.replace(/l\.isWindows\(/gi, lIsWindowsSafeFn + '(');
      content = content.replace(/l\["isWindows"\]\(/g, lIsWindowsSafeFn + '(');
      content = content.replace(/l\['isWindows'\]\(/g, lIsWindowsSafeFn + '(');
      content = content.replace(/l\.iswindows\(/gi, lIsWindowsSafeFn + '(');
      modified = true;
    }
    
    // 속성 접근 패턴: l.isWindows (함수 호출이 아닌 경우)
    const beforeL = content;
    content = content.replace(/(?<!typeof\s+window[!=]===)l\.isWindows(?!\()/gi, lIsWindowsSafeFn);
    content = content.replace(/(?<!typeof\s+window[!=]===)l\["isWindows"\](?!\()/gi, lIsWindowsSafeFn);
    content = content.replace(/(?<!typeof\s+window[!=]===)l\['isWindows'\](?!\()/gi, lIsWindowsSafeFn);
    content = content.replace(/(?<!typeof\s+window[!=]===)l\.iswindows(?!\()/gi, lIsWindowsSafeFn);
    if (content !== beforeL) modified = true;


    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      patchedCount++;
      console.log(`✅ 패치 완료: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.warn(`⚠️  파일 패치 실패: ${filePath}`, error.message);
  }
});

console.log(`\n✅ 완료! ${patchedCount}개 파일 패치됨`);
