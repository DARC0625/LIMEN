# 빠른 개선 가이드

> [← 홈](../../00-home.md) | [아카이브](../) | [Phase 기록](./) | [빠른 개선](./QUICK_FIXES.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 개선 작업 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 1. 환경 변수 사용 (최우선)

### database/db.go 수정

```go
// Before
dsn := "host=localhost user=postgres password=password dbname=project_alpha..."

// After
import "github.com/darc0/limen/backend/internal/config"

cfg := config.Load()
dsn := cfg.DatabaseURL
```

### vm/service.go 수정

```go
// Before
const (
    isoDir = "/home/darc0/projects/LIMEN/database/iso"
    vmDir  = "/home/darc0/projects/LIMEN/database/vms"
)

// After
// config에서 주입받음
```

---

## 관련 문서

- [개선 사항](./IMPROVEMENTS.md)
- [요약](./SUMMARY.md)

---

**태그**: `#아카이브` `#Phase` `#빠른-개선` `#과거-기록`

**카테고리**: 아카이브 > Phase 기록 > 빠른 개선

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
