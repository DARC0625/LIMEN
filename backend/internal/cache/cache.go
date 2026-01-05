package cache

import (
	"sync"
	"time"
)

// CacheItem represents a cached item with expiration time
type CacheItem struct {
	Value      interface{}
	ExpiresAt  time.Time
}

// IsExpired checks if the cache item has expired
func (item *CacheItem) IsExpired() bool {
	return time.Now().After(item.ExpiresAt)
}

// InMemoryCache is a thread-safe in-memory cache with TTL support
type InMemoryCache struct {
	items map[string]*CacheItem
	mu    sync.RWMutex
	ttl   time.Duration
}

// NewInMemoryCache creates a new in-memory cache with the specified TTL
func NewInMemoryCache(ttl time.Duration) *InMemoryCache {
	cache := &InMemoryCache{
		items: make(map[string]*CacheItem),
		ttl:   ttl,
	}
	
	// Start background cleanup goroutine
	go cache.cleanup()
	
	return cache
}

// Get retrieves a value from the cache
func (c *InMemoryCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	item, exists := c.items[key]
	if !exists || item.IsExpired() {
		return nil, false
	}
	
	return item.Value, true
}

// Set stores a value in the cache with TTL
func (c *InMemoryCache) Set(key string, value interface{}) {
	c.SetWithTTL(key, value, c.ttl)
}

// SetWithTTL stores a value in the cache with custom TTL
func (c *InMemoryCache) SetWithTTL(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.items[key] = &CacheItem{
		Value:     value,
		ExpiresAt: time.Now().Add(ttl),
	}
}

// Delete removes a key from the cache
func (c *InMemoryCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	delete(c.items, key)
}

// Clear removes all items from the cache
func (c *InMemoryCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.items = make(map[string]*CacheItem)
}

// cleanup periodically removes expired items from the cache
func (c *InMemoryCache) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		c.mu.Lock()
		for key, item := range c.items {
			if item.IsExpired() {
				delete(c.items, key)
			}
		}
		c.mu.Unlock()
	}
}

// Size returns the number of items in the cache
func (c *InMemoryCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	return len(c.items)
}

// Stats returns cache statistics
func (c *InMemoryCache) Stats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	expired := 0
	for _, item := range c.items {
		if item.IsExpired() {
			expired++
		}
	}
	
	return map[string]interface{}{
		"total_items": len(c.items),
		"expired_items": expired,
		"active_items": len(c.items) - expired,
		"ttl_seconds": c.ttl.Seconds(),
	}
}






