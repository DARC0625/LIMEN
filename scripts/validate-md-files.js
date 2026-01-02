#!/usr/bin/env node

/**
 * MD 파일 검증 스크립트
 * - MD 파일이 올바른 위치에 있는지 확인
 * - MD 파일 내용이 한글로 작성되었는지 확인
 */

const fs = require('fs');
const path = require('path');

// 허용된 MD 파일 위치
const ALLOWED_LOCATIONS = [
  'docs/',
  '.github/',
];

// 허용된 README 파일 위치
const ALLOWED_README_LOCATIONS = [
  'README.md', // 루트 README만 허용
  'frontend/README.md',
  'backend/README.md',
  'scripts/README.md',
  'infra/README.md',
];

// 제외할 경로
const EXCLUDED_PATHS = [
  'node_modules/',
  '.next/',
  'vendor/',
  'target/',
  '.git/',
  'dist/',
  'build/',
];

// 허용된 영어 파일 (예외)
const ALLOWED_ENGLISH_FILES = [
  'README.md',
  'CHANGELOG.md',
  'LICENSE.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
];

let hasErrors = false;
const errors = [];

/**
 * 한글 포함 여부 확인
 */
function containsKorean(text) {
  // 한글 유니코드 범위: \uAC00-\uD7A3
  return /[\uAC00-\uD7A3]/.test(text);
}

/**
 * 파일이 허용된 위치에 있는지 확인
 */
function isAllowedLocation(filePath) {
  // 루트 기준 경로로 변환
  const relativePath = path.relative(process.cwd(), filePath);
  
  // 제외 경로 확인
  if (EXCLUDED_PATHS.some(excluded => relativePath.includes(excluded))) {
    return { allowed: true, reason: 'excluded' };
  }
  
  // 허용된 위치 확인
  for (const allowed of ALLOWED_LOCATIONS) {
    if (relativePath.startsWith(allowed) || relativePath === allowed.replace('/', '')) {
      return { allowed: true, reason: 'allowed' };
    }
  }
  
  // README 파일은 특정 위치에서만 허용
  const fileName = path.basename(filePath);
  if (fileName === 'README.md') {
    // 허용된 README 위치 확인
    for (const allowedReadme of ALLOWED_README_LOCATIONS) {
      if (relativePath === allowedReadme || relativePath.endsWith('/' + allowedReadme)) {
        return { allowed: true, reason: 'readme' };
      }
    }
  }
  
  return { allowed: false, reason: 'not_allowed' };
}

/**
 * 파일이 영어로 작성되어도 되는 파일인지 확인
 */
function isAllowedEnglishFile(filePath) {
  const fileName = path.basename(filePath);
  return ALLOWED_ENGLISH_FILES.includes(fileName);
}

/**
 * MD 파일 검증
 */
function validateMdFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const fileName = path.basename(filePath);
  
  // 위치 검증
  const locationCheck = isAllowedLocation(filePath);
  if (!locationCheck.allowed && locationCheck.reason !== 'excluded') {
    errors.push({
      file: relativePath,
      type: 'location',
      message: `MD 파일이 허용되지 않은 위치에 있습니다: ${relativePath}\n  → docs/ 디렉토리로 이동하세요.`,
    });
    hasErrors = true;
    return;
  }
  
  // 내용 검증 (제외 경로는 스킵)
  if (locationCheck.reason === 'excluded') {
    return;
  }
  
  // 영어 허용 파일은 스킵
  if (isAllowedEnglishFile(filePath)) {
    return;
  }
  
  // 파일 내용 읽기
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 한글 포함 여부 확인
    if (!containsKorean(content)) {
      errors.push({
        file: relativePath,
        type: 'language',
        message: `MD 파일이 한글로 작성되지 않았습니다: ${relativePath}\n  → 모든 MD 파일은 한글로 작성되어야 합니다.`,
      });
      hasErrors = true;
    }
  } catch (err) {
    errors.push({
      file: relativePath,
      type: 'read_error',
      message: `파일을 읽을 수 없습니다: ${relativePath}\n  → ${err.message}`,
    });
    hasErrors = true;
  }
}

/**
 * 모든 MD 파일 찾기 및 검증
 */
function findAndValidateMdFiles(dir = process.cwd()) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    
    // 제외 경로 스킵
    if (EXCLUDED_PATHS.some(excluded => filePath.includes(excluded))) {
      continue;
    }
    
    if (file.isDirectory()) {
      findAndValidateMdFiles(filePath);
    } else if (file.isFile() && file.name.endsWith('.md')) {
      validateMdFile(filePath);
    }
  }
}

// 메인 실행
console.log('🔍 MD 파일 검증 시작...\n');

findAndValidateMdFiles();

if (hasErrors) {
  console.error('❌ 검증 실패:\n');
  errors.forEach((error, index) => {
    console.error(`${index + 1}. [${error.type}] ${error.message}\n`);
  });
  console.error(`\n총 ${errors.length}개의 오류가 발견되었습니다.`);
  process.exit(1);
} else {
  console.log('✅ 모든 MD 파일이 올바르게 정리되어 있습니다!');
  process.exit(0);
}

