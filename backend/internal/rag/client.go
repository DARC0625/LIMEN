package rag

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// RAGClient RAG 클라이언트
type RAGClient struct {
	RAGPath     string
	DocsPath   string
	VectorsPath string
	IndexPath   string
}

// NewRAGClient RAG 클라이언트 생성
// RAG_PATH 환경 변수를 사용하거나 기본 경로를 사용합니다.
func NewRAGClient(ragPath string) *RAGClient {
	if ragPath == "" {
		ragPath = os.Getenv("RAG_PATH")
		if ragPath == "" {
			// 기본 경로: 프로젝트 루트의 RAG 폴더
			// 실행 파일 위치에서 상대 경로로 찾기
			ragPath = "../RAG"
			// 절대 경로로 변환 시도
			if absPath, err := filepath.Abs(ragPath); err == nil {
				ragPath = absPath
			}
		}
	}

	return &RAGClient{
		RAGPath:     ragPath,
		DocsPath:    ragPath, // RAG/ 자체가 문서 폴더 (docs 서브폴더 없음)
		VectorsPath: filepath.Join(ragPath, "vectors"),
		IndexPath:   filepath.Join(ragPath, "index"),
	}
}

// SearchDocuments 문서 검색
// query: 검색어
// limit: 최대 결과 수 (0이면 기본값 10)
func (c *RAGClient) SearchDocuments(ctx context.Context, query string, limit int) ([]Document, error) {
	if limit <= 0 {
		limit = 10
	}

	var results []Document
	queryLower := strings.ToLower(query)

	// 컨텍스트 취소 확인
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// 문서 디렉토리에서 검색
	err := filepath.Walk(c.DocsPath, func(path string, info os.FileInfo, err error) error {
		// 컨텍스트 취소 확인
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err != nil {
			return nil // 파일 접근 오류는 무시하고 계속 진행
		}

		// 마크다운 파일만 검색
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(path), ".md") {
			content, err := os.ReadFile(path)
			if err != nil {
				return nil // 파일 읽기 오류는 무시하고 계속 진행
			}

			contentStr := string(content)
			contentLower := strings.ToLower(contentStr)

			// 간단한 텍스트 검색 (향후 벡터 검색으로 업그레이드 가능)
			if strings.Contains(contentLower, queryLower) {
				relativePath, err := filepath.Rel(c.DocsPath, path)
				if err != nil {
					relativePath = path // 상대 경로 변환 실패 시 전체 경로 사용
				}

				// 제목과 일치하는 경우 우선순위 높임
				title := extractTitle(content)
				score := 1
				if strings.Contains(strings.ToLower(title), queryLower) {
					score = 2 // 제목에 포함되면 점수 높임
				}

				results = append(results, Document{
					Path:    relativePath,
					Title:   title,
					Content: contentStr,
					Score:   score,
				})

				if len(results) >= limit {
					return fmt.Errorf("limit reached")
				}
			}
		}

		return nil
	})

	if err != nil && err.Error() != "limit reached" {
		return nil, fmt.Errorf("failed to search documents: %w", err)
	}

	return results, nil
}

// GetDocument 문서 가져오기
// path: 문서의 상대 경로 (RAG 폴더 기준)
func (c *RAGClient) GetDocument(ctx context.Context, path string) (*Document, error) {
	// 컨텍스트 취소 확인
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// 경로 보안 검증 (상위 디렉토리 접근 방지)
	if strings.Contains(path, "..") {
		return nil, fmt.Errorf("invalid path: %s", path)
	}

	fullPath := filepath.Join(c.DocsPath, path)

	// 파일 존재 확인
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("document not found: %s", path)
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read document: %w", err)
	}

	return &Document{
		Path:    path,
		Title:   extractTitle(content),
		Content: string(content),
	}, nil
}

// ListDocuments 문서 목록 가져오기
// category: 카테고리 필터 (예: "01-architecture", "02-development")
// 빈 문자열이면 모든 문서 반환
func (c *RAGClient) ListDocuments(ctx context.Context, category string) ([]DocumentInfo, error) {
	var documents []DocumentInfo

	// 컨텍스트 취소 확인
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	err := filepath.Walk(c.DocsPath, func(path string, info os.FileInfo, err error) error {
		// 컨텍스트 취소 확인
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err != nil {
			return nil // 파일 접근 오류는 무시하고 계속 진행
		}

		// 마크다운 파일만 처리
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(path), ".md") {
			relativePath, err := filepath.Rel(c.DocsPath, path)
			if err != nil {
				relativePath = path // 상대 경로 변환 실패 시 전체 경로 사용
			}

			// 카테고리 필터링
			if category != "" && !strings.HasPrefix(relativePath, category) {
				return nil
			}

			documents = append(documents, DocumentInfo{
				Path:     relativePath,
				Category: extractCategory(relativePath),
				Size:     info.Size(),
				Modified: info.ModTime(),
			})
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}

	return documents, nil
}

// SearchDocumentsByCategory 카테고리별 문서 검색
// category: 카테고리 (예: "01-architecture")
// query: 검색어
// limit: 최대 결과 수
func (c *RAGClient) SearchDocumentsByCategory(ctx context.Context, category, query string, limit int) ([]Document, error) {
	// 먼저 카테고리 내 문서 목록 가져오기
	docInfos, err := c.ListDocuments(ctx, category)
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 10
	}

	var results []Document
	queryLower := strings.ToLower(query)

	for _, docInfo := range docInfos {
		// 컨텍스트 취소 확인
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		if len(results) >= limit {
			break
		}

		// 문서 읽기
		doc, err := c.GetDocument(ctx, docInfo.Path)
		if err != nil {
			continue // 읽기 실패한 문서는 건너뛰기
		}

		// 검색어 포함 여부 확인
		contentLower := strings.ToLower(doc.Content)
		if strings.Contains(contentLower, queryLower) {
			score := 1
			if strings.Contains(strings.ToLower(doc.Title), queryLower) {
				score = 2 // 제목에 포함되면 점수 높임
			}

			doc.Score = score
			results = append(results, *doc)
		}
	}

	return results, nil
}

// Document 문서 구조
type Document struct {
	Path    string // 문서의 상대 경로
	Title   string // 문서 제목
	Content string // 문서 내용
	Score   int    // 검색 점수 (높을수록 관련성 높음)
}

// DocumentInfo 문서 정보 (목록용)
type DocumentInfo struct {
	Path     string    // 문서의 상대 경로
	Category string    // 카테고리
	Size     int64     // 파일 크기 (바이트)
	Modified time.Time // 수정 시간
}

// extractTitle 제목 추출
// 마크다운 파일의 첫 번째 # 제목을 추출합니다.
func extractTitle(content []byte) string {
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# ") {
			return strings.TrimPrefix(line, "# ")
		}
	}
	return "Untitled"
}

// extractCategory 카테고리 추출
// 경로의 첫 번째 디렉토리를 카테고리로 사용합니다.
// 예: "01-architecture/api.md" -> "01-architecture"
func extractCategory(path string) string {
	parts := strings.Split(path, string(filepath.Separator))
	if len(parts) > 0 {
		return parts[0]
	}
	return "other"
}

