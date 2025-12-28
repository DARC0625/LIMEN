# Git 보안 가이드

> [← 보안](../security/hardening.md) | [Git 보안](./git-security.md)

## 개요

Git 저장소에 민감한 데이터를 커밋하면 **모든 사용자가 볼 수 있게** 됩니다. 이는 심각한 보안 위험입니다.

> **절대 커밋하면 안 되는 것들**:
> - 개인정보 (이름, 이메일, 전화번호 등)
> - 비밀번호 및 인증 정보
> - API 키 및 토큰
> - VM 디스크 이미지
> - 로그 파일 (개인정보 포함 가능)
> - 데이터베이스 파일
> - 키 및 인증서 파일

---

## .gitignore 설정

### 필수 제외 항목

```gitignore
# VM 이미지 (민감 정보 포함 가능)
*.qcow2
*.qcow
*.img
*.raw
*.vdi
*.vmdk
*.vhd

# ISO 이미지 (대용량)
*.iso
*.ISO

# 로그 파일 (개인정보 포함 가능)
*.log
*.log.*
*.log.gz
/var/log/limen/

# 데이터베이스 파일
*.db
*.sqlite
*.sqlite3

# 키 및 인증서
*.pem
*.key
*.crt
*.cert
*.pfx
*.p12

# 환경 변수 파일
.env
.env.*
!.env.example

# 백업 파일
*.backup
*.dump
*.sql
```

---

## 이미 커밋된 민감한 데이터 제거

### 1. 현재 커밋에서 제거

```bash
# 파일을 Git에서 제거 (로컬 파일은 유지)
git rm --cached database/vms/*.qcow2
git rm --cached database/iso/*.iso
git rm --cached *.log

# .gitignore에 추가
echo "*.qcow2" >> .gitignore
echo "*.iso" >> .gitignore

# 커밋
git add .gitignore
git commit -m "security: 민감한 데이터 제거"
```

### 2. Git 히스토리에서 완전히 제거

**주의**: 이 작업은 Git 히스토리를 재작성합니다. 협업 중이라면 팀과 상의하세요.

```bash
# git-filter-repo 사용 (권장)
git filter-repo --path database/vms --invert-paths
git filter-repo --path database/iso --invert-paths

# 또는 git filter-branch 사용
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch database/vms/*.qcow2 database/iso/*.iso' \
  --prune-empty --tag-name-filter cat -- --all

# 히스토리 정리
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 3. 강제 푸시 (주의!)

```bash
# ⚠️ 주의: 이 작업은 원격 저장소 히스토리를 덮어씁니다
git push origin master --force
```

---

## 민감한 데이터 검사

### 커밋 전 검사

```bash
# 커밋할 파일 확인
git status

# 민감한 파일 패턴 검사
git diff --cached --name-only | grep -E "(\.log|\.qcow2|\.iso|\.db|\.key|\.pem|\.env$)"

# 파일 크기 확인 (대용량 파일 체크)
git ls-files | xargs -I {} du -h {} | sort -rh | head -20
```

### Git 히스토리 검사

```bash
# 히스토리에서 대용량 파일 찾기
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '/^blob/ {print substr($0,6)}' | \
  sort -k2 -n -r | \
  head -10

# 특정 파일이 히스토리에 있는지 확인
git log --all --full-history -- database/vms/*.qcow2
```

---

## 보안 체크리스트

### 커밋 전 확인사항

- [ ] `.env` 파일이 커밋되지 않았는가?
- [ ] 비밀번호나 API 키가 코드에 하드코딩되지 않았는가?
- [ ] VM 디스크 이미지가 포함되지 않았는가?
- [ ] 로그 파일이 포함되지 않았는가?
- [ ] 데이터베이스 파일이 포함되지 않았는가?
- [ ] 키 파일(.key, .pem)이 포함되지 않았는가?
- [ ] 개인정보가 포함된 파일이 없는가?

### 정기 점검

- [ ] 주기적으로 Git 히스토리 검사
- [ ] `.gitignore` 파일 업데이트 확인
- [ ] 팀원들과 보안 정책 공유

---

## 사고 발생 시 대응

### 1. 즉시 조치

```bash
# 민감한 데이터가 포함된 커밋 확인
git log --all --source --all -- database/vms/*.qcow2

# 해당 커밋에서 제거
git filter-repo --path database/vms --invert-paths

# 강제 푸시
git push origin master --force
```

### 2. 추가 조치

- **비밀번호 변경**: 커밋된 비밀번호가 있다면 즉시 변경
- **API 키 재발급**: 노출된 API 키는 즉시 재발급
- **알림**: 팀원들에게 알림 및 보안 정책 재교육

---

## 예방 방법

### 1. Pre-commit Hook 설정

`.git/hooks/pre-commit` 파일 생성:

```bash
#!/bin/bash
# 민감한 파일 패턴 검사
for file in $(git diff --cached --name-only); do
  if [[ $file =~ \.(log|qcow2|iso|db|sqlite|key|pem|env)$ ]]; then
    echo "❌ ERROR: 민감한 파일이 커밋에 포함되었습니다: $file"
    echo "이 파일은 .gitignore에 추가하세요."
    exit 1
  fi
done
```

### 2. Git Secrets 도구 사용

```bash
# git-secrets 설치
git secrets --install

# 패턴 추가
git secrets --add 'password\s*=\s*.+'
git secrets --add 'api[_-]?key\s*=\s*.+'
git secrets --add 'secret\s*=\s*.+'
```

---

## 관련 문서

- [보안 강화](../security/hardening.md)
- [Zero Trust 보안](../security/zero-trust.md)
- [암호화](../security/encryption.md)

---

**태그**: `#보안` `#Git` `#민감정보보호` `#데이터보호`

**마지막 업데이트**: 2024-12-23











