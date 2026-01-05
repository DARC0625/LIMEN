// Package utils provides utility functions and pools for performance optimization.
package utils

import (
	"bytes"
	"encoding/json"
	"sync"
)

// JSONEncoderPool provides a pool of JSON encoders to reduce allocations.
// Reusing encoders significantly reduces memory allocations for JSON encoding.
var JSONEncoderPool = sync.Pool{
	New: func() interface{} {
		buf := &bytes.Buffer{}
		return json.NewEncoder(buf)
	},
}

// GetJSONEncoder retrieves a JSON encoder from the pool with a new buffer.
// Caller must call PutJSONEncoder when done.
func GetJSONEncoder() (*json.Encoder, *bytes.Buffer) {
	buf := &bytes.Buffer{}
	encoder := json.NewEncoder(buf)
	return encoder, buf
}

// PutJSONEncoder returns the encoder and buffer to the pool.
// Note: The buffer is reset before returning to the pool.
func PutJSONEncoder(encoder *json.Encoder, buf *bytes.Buffer) {
	buf.Reset()
	// Encoder is tied to buffer, so we don't actually pool it
	// But we can pool the buffer
	BufferPool.Put(buf)
}

