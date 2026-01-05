/**
 * WebVitalsClient 컴포넌트 테스트
 */

import { render } from '@testing-library/react'
import WebVitalsClient from '../WebVitalsClient'
import { initWebVitals } from '../../lib/webVitals'

// initWebVitals 모킹
jest.mock('../../lib/webVitals', () => ({
  initWebVitals: jest.fn(),
}))

describe('WebVitalsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing', () => {
    const { container } = render(<WebVitalsClient />)
    
    // 컴포넌트는 아무것도 렌더링하지 않음
    expect(container.firstChild).toBeNull()
  })

  it('calls initWebVitals on mount', () => {
    render(<WebVitalsClient />)
    
    expect(initWebVitals).toHaveBeenCalledTimes(1)
  })
})




