// Package utils provides utility functions for the application.
package utils

import (
	"bytes"
	"sync"
)

// BufferPool provides a pool of byte buffers to reduce memory allocations.
var BufferPool = sync.Pool{
	New: func() interface{} {
		// Pre-allocate buffer with initial capacity for JSON encoding
		return bytes.NewBuffer(make([]byte, 0, 2048))
	},
}





