# LIMEN Frontend Upgrade Plan

## 📊 Current Status
- **Total Source Files**: ~70 files (TS/TSX)
- **Build Size**: ~9.7MB (.next directory)
- **Dependencies**: Minimal (React, Next.js, TanStack Query, noVNC)
- **Documentation**: Archived to `docs/archive/` (128KB saved)

---

## 🎯 Upgrade Priorities

### **Phase 1: Performance & Bundle Optimization** (High Priority)
**Goal**: Reduce bundle size by 30-40%, improve initial load time

#### 1.1 Bundle Size Analysis & Optimization
- [ ] Run bundle analyzer: `npm run build:analyze`
- [ ] Identify largest dependencies
- [ ] Implement tree-shaking for unused exports
- [ ] Remove duplicate dependencies
- [ ] Optimize noVNC import (currently largest bundle)
  - [ ] Consider lazy loading VNCViewer only when needed
  - [ ] Split noVNC into separate chunk
  - [ ] Investigate lighter VNC alternatives (if applicable)

#### 1.2 Code Splitting Enhancement
- [ ] Audit all dynamic imports
- [ ] Convert heavy components to dynamic imports:
  - [ ] `VNCViewer.tsx` - Already dynamic, verify optimization
  - [ ] `SnapshotManager.tsx` - Already dynamic, verify
  - [ ] `AgentMetricsCard.tsx` - Already dynamic, verify
  - [ ] `HealthStatus.tsx` - Already dynamic, verify
- [ ] Implement route-based code splitting
- [ ] Add loading states for all dynamic imports

#### 1.3 Image & Asset Optimization
- [ ] Audit `public/` directory
- [ ] Compress SVG icons (icon-192.svg, icon-512.svg)
- [ ] Convert to WebP format where applicable
- [ ] Implement Next.js Image component for all images
- [ ] Add proper image lazy loading

#### 1.4 CSS Optimization
- [ ] Run Tailwind CSS purge analysis
- [ ] Remove unused CSS classes
- [ ] Optimize global CSS (globals.css)
- [ ] Consider CSS-in-JS migration for better tree-shaking (optional)

---

### **Phase 2: Code Quality & Maintainability** (High Priority)
**Goal**: Improve code consistency, reduce technical debt

#### 2.1 Type Safety Enhancement
- [ ] Replace remaining `any` types with proper types
- [ ] Add strict TypeScript checks
- [ ] Create comprehensive type definitions for API responses
- [ ] Add runtime type validation (Zod or similar)
- [ ] Type all event handlers properly

#### 2.2 Code Duplication Removal
- [ ] Identify duplicate utility functions
- [ ] Consolidate similar components
- [ ] Create shared hooks for common patterns
- [ ] Extract common UI patterns into reusable components

#### 2.3 Error Handling Standardization
- [ ] Audit all error handling patterns
- [ ] Standardize error messages
- [ ] Improve error boundaries
- [ ] Add error recovery mechanisms
- [ ] Implement retry logic consistently

#### 2.4 Code Organization
- [ ] Review folder structure
- [ ] Group related components
- [ ] Create feature-based folders (optional)
- [ ] Improve import paths (use aliases if needed)

---

### **Phase 3: User Experience & Accessibility** (Medium Priority)
**Goal**: Improve accessibility, user feedback, and overall UX

#### 3.1 Accessibility (a11y) Improvements
- [ ] Audit all components with accessibility tools
- [ ] Add proper ARIA labels where missing
- [ ] Improve keyboard navigation
- [ ] Add focus management
- [ ] Ensure color contrast compliance (WCAG AA)
- [ ] Add screen reader support

#### 3.2 Loading States & Feedback
- [ ] Standardize loading states across all components
- [ ] Add skeleton loaders where appropriate
- [ ] Improve error message clarity
- [ ] Add success feedback for actions
- [ ] Implement optimistic updates consistently

#### 3.3 Performance Monitoring
- [ ] Enhance Web Vitals tracking
- [ ] Add performance metrics dashboard (optional)
- [ ] Monitor Core Web Vitals in production
- [ ] Set up alerts for performance degradation

---

### **Phase 4: Security & Best Practices** (Medium Priority)
**Goal**: Enhance security, follow React/Next.js best practices

#### 4.1 Security Hardening
- [ ] Audit all user inputs for XSS vulnerabilities
- [ ] Review authentication flow security
- [ ] Implement Content Security Policy (CSP) properly
- [ ] Add rate limiting on client side (if needed)
- [ ] Review token storage security

#### 4.2 React Best Practices
- [ ] Audit all useEffect dependencies
- [ ] Remove unnecessary re-renders
- [ ] Implement React.memo where beneficial
- [ ] Use useMemo/useCallback appropriately
- [ ] Review component composition patterns

#### 4.3 Next.js Optimization
- [ ] Optimize middleware.ts (currently 433 lines)
- [ ] Review API route handling
- [ ] Optimize server-side rendering
- [ ] Implement proper caching strategies
- [ ] Review ISR/SSG opportunities

---

### **Phase 5: Developer Experience** (Low Priority)
**Goal**: Improve development workflow and code quality

#### 5.1 Development Tools
- [ ] Set up ESLint rules for consistency
- [ ] Add Prettier configuration
- [ ] Implement pre-commit hooks (Husky)
- [ ] Add commit message linting
- [ ] Set up automated code formatting

#### 5.2 Documentation
- [ ] Create component documentation
- [ ] Document API integration patterns
- [ ] Add JSDoc comments to complex functions
- [ ] Create development setup guide
- [ ] Document deployment process

#### 5.3 Testing (Optional)
- [ ] Add unit tests for utilities
- [ ] Add integration tests for critical flows
- [ ] Set up E2E testing (Playwright/Cypress)
- [ ] Add visual regression testing

---

## 📈 Success Metrics

### Performance Targets
- **Initial Bundle Size**: < 500KB (gzipped)
- **Time to Interactive (TTI)**: < 3 seconds
- **First Contentful Paint (FCP)**: < 1.5 seconds
- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1

### Code Quality Targets
- **TypeScript Coverage**: 100% (no `any` types)
- **Code Duplication**: < 5%
- **Test Coverage**: > 80% (if testing added)
- **ESLint Errors**: 0

### User Experience Targets
- **Accessibility Score**: 100 (Lighthouse)
- **Performance Score**: > 90 (Lighthouse)
- **Error Rate**: < 0.1%

---

## 🚀 Implementation Order

### Week 1: Performance Foundation
1. Bundle analysis and optimization
2. Code splitting audit
3. Image optimization

### Week 2: Code Quality
1. Type safety improvements
2. Code duplication removal
3. Error handling standardization

### Week 3: UX & Accessibility
1. Accessibility audit and fixes
2. Loading states improvement
3. Performance monitoring setup

### Week 4: Security & Polish
1. Security audit
2. React/Next.js best practices
3. Documentation

---

## 🔍 Detailed Analysis Needed

### Immediate Actions
1. **Bundle Analysis**: Run `npm run build:analyze` to identify largest chunks
2. **Middleware Review**: 433 lines in middleware.ts - needs optimization
3. **Component Audit**: Review all 22 components for optimization opportunities
4. **Dependency Audit**: Check for unused or duplicate dependencies

### Key Files to Review
- `middleware.ts` (433 lines) - Potential optimization target
- `components/VNCViewer.tsx` - Largest component, needs review
- `components/VMListSection.tsx` - Complex carousel logic
- `lib/api/` - API client structure
- `hooks/useVMs.ts` - Main data fetching hook

---

## 📝 Notes

- All optimizations must maintain existing functionality
- Focus on incremental improvements
- Test thoroughly after each phase
- Monitor production metrics after deployment
- Document breaking changes (if any)

---

**Last Updated**: 2025-01-14
**Status**: Planning Phase
**Next Review**: After Phase 1 completion

