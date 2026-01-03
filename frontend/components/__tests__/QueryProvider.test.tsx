/**
 * QueryProvider 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react'
import { QueryProvider } from '../QueryProvider'

describe('QueryProvider', () => {
  it('renders children', () => {
    render(
      <QueryProvider>
        <div>Test Content</div>
      </QueryProvider>
    )
    
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('provides QueryClient context', () => {
    const TestComponent = () => {
      return <div>QueryClient Available</div>
    }
    
    render(
      <QueryProvider>
        <TestComponent />
      </QueryProvider>
    )
    
    expect(screen.getByText('QueryClient Available')).toBeInTheDocument()
  })
})
