// Package utils provides utility functions for the application.
package utils

import (
	"sync"
)

// BufferPool provides a pool of byte buffers to reduce memory allocations.
var BufferPool = sync.Pool{
	New: func() interface{} {
		// Pre-allocate buffer with initial capacity
		return make([]byte, 0, 1024)
	},
}

// GetBuffer retrieves a buffer from the pool.
func GetBuffer() []byte {
	return BufferPool.Get().([]byte)
}

// PutBuffer returns a buffer to the pool.
// The buffer is reset to length 0 before being returned.
func PutBuffer(buf []byte) {
	// Reset buffer length to 0 but keep capacity
	buf = buf[:0]
	BufferPool.Put(buf)
}



