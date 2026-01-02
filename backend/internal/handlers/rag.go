package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/DARC0625/LIMEN/backend/internal/errors"
	"github.com/DARC0625/LIMEN/backend/internal/logger"
	"github.com/DARC0625/LIMEN/backend/internal/rag"
	"go.uber.org/zap"
)

// HandleRAGSearch 문서 검색 엔드포인트
// @Summary Search RAG documents
// @Description Search documents in the RAG system
// @Tags rag
// @Accept json
// @Produce json
// @Param query query string true "Search query"
// @Param limit query int false "Maximum number of results (default: 10)"
// @Param category query string false "Category filter (e.g., 01-architecture, 02-development)"
// @Success 200 {object} map[string]interface{} "Search results"
// @Failure 400 {object} errors.APIError "Bad request"
// @Failure 500 {object} errors.APIError "Internal server error"
// @Router /api/rag/search [get]
func (h *Handler) HandleRAGSearch(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	query := r.URL.Query().Get("query")
	if query == "" {
		errors.WriteBadRequest(w, "query parameter is required", nil)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 10
	if limitStr != "" {
		var err error
		limit, err = strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			errors.WriteBadRequest(w, "invalid limit parameter", err)
			return
		}
		if limit > 100 {
			limit = 100 // 최대 100개로 제한
		}
	}

	category := r.URL.Query().Get("category")

	var results []rag.Document
	var err error

	ragClient := rag.NewRAGClient(h.Config.RAGPath)

	if category != "" {
		// 카테고리별 검색
		results, err = ragClient.SearchDocumentsByCategory(ctx, category, query, limit)
	} else {
		// 전체 검색
		results, err = ragClient.SearchDocuments(ctx, query, limit)
	}

	if err != nil {
		logger.Log.Error("RAG search failed", zap.Error(err), zap.String("query", query))
		errors.WriteErrorWithCode(w, http.StatusInternalServerError, "Failed to search documents", errors.ErrCodeSearchFailed, err, h.Config.IsDevelopment())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"query":    query,
		"category": category,
		"limit":    limit,
		"count":    len(results),
		"results":  results,
	})
}

// HandleRAGGetDocument 문서 조회 엔드포인트
// @Summary Get RAG document
// @Description Get a specific document from the RAG system
// @Tags rag
// @Accept json
// @Produce json
// @Param path query string true "Document path (relative to RAG folder)"
// @Success 200 {object} rag.Document "Document content"
// @Failure 400 {object} errors.APIError "Bad request"
// @Failure 404 {object} errors.APIError "Document not found"
// @Failure 500 {object} errors.APIError "Internal server error"
// @Router /api/rag/document [get]
func (h *Handler) HandleRAGGetDocument(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// 경로는 쿼리 파라미터에서 가져옴
	path := r.URL.Query().Get("path")
	if path == "" {
		errors.WriteBadRequest(w, "path query parameter is required", nil)
		return
	}

	ragClient := rag.NewRAGClient(h.Config.RAGPath)
	doc, err := ragClient.GetDocument(ctx, path)

	if err != nil {
		logger.Log.Error("Failed to get document", zap.Error(err), zap.String("path", path))
		errors.WriteErrorWithCode(w, http.StatusNotFound, "Document not found", errors.ErrCodeDocumentNotFound, err, h.Config.IsDevelopment())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

// HandleRAGListDocuments 문서 목록 조회 엔드포인트
// @Summary List RAG documents
// @Description List all documents in the RAG system, optionally filtered by category
// @Tags rag
// @Accept json
// @Produce json
// @Param category query string false "Category filter (e.g., 01-architecture, 02-development)"
// @Success 200 {object} map[string]interface{} "Document list"
// @Failure 500 {object} errors.APIError "Internal server error"
// @Router /api/rag/documents [get]
func (h *Handler) HandleRAGListDocuments(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	category := r.URL.Query().Get("category")

	ragClient := rag.NewRAGClient(h.Config.RAGPath)
	documents, err := ragClient.ListDocuments(ctx, category)

	if err != nil {
		logger.Log.Error("Failed to list documents", zap.Error(err))
		errors.WriteErrorWithCode(w, http.StatusInternalServerError, "Failed to list documents", errors.ErrCodeRAGError, err, h.Config.IsDevelopment())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"category":  category,
		"count":     len(documents),
		"documents": documents,
	})
}

// HandleRAGCategories 카테고리 목록 조회 엔드포인트
// @Summary List RAG categories
// @Description List all available categories in the RAG system
// @Tags rag
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Category list"
// @Failure 500 {object} errors.APIError "Internal server error"
// @Router /api/rag/categories [get]
func (h *Handler) HandleRAGCategories(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	ragClient := rag.NewRAGClient(h.Config.RAGPath)
	documents, err := ragClient.ListDocuments(ctx, "")

	if err != nil {
		logger.Log.Error("Failed to list categories", zap.Error(err))
		errors.WriteErrorWithCode(w, http.StatusInternalServerError, "Failed to list categories", errors.ErrCodeRAGError, err, h.Config.IsDevelopment())
		return
	}

	// 카테고리 추출 및 중복 제거
	categoryMap := make(map[string]bool)
	for _, doc := range documents {
		if doc.Category != "" {
			categoryMap[doc.Category] = true
		}
	}

	categories := make([]string, 0, len(categoryMap))
	for cat := range categoryMap {
		categories = append(categories, cat)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":      len(categories),
		"categories": categories,
	})
}

