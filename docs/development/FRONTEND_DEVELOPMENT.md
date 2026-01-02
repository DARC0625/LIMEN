# LIMEN Frontend Development Guide

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
The application will start on `http://localhost:9444`

### Building
```bash
npm run build
npm start
```

## 🛠️ Development Tools

### ESLint
Linting is configured with Next.js recommended rules and TypeScript support.

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

### Prettier
Code formatting is handled by Prettier.

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

### Pre-commit Hooks
Husky is configured to run lint-staged on every commit. This ensures:
- ESLint checks pass
- Code is formatted with Prettier
- Only staged files are checked

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── (protected)/       # Protected routes (require auth)
│   └── login/             # Login page
├── components/            # React components
│   ├── VNCViewer.tsx     # VNC console viewer
│   ├── VMListSection.tsx  # VM carousel component
│   └── ...
├── hooks/                 # Custom React hooks
│   ├── useVMs.ts         # VM data fetching
│   ├── useQuota.ts       # Quota data fetching
│   └── ...
├── lib/                   # Utility libraries
│   ├── api/              # API client
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript type definitions
├── middleware.ts          # Next.js middleware (API proxy)
└── public/                # Static assets
```

## 🔧 Key Technologies

- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type safety
- **TanStack Query**: Data fetching and caching
- **noVNC**: VNC client library
- **Tailwind CSS**: Utility-first CSS framework

## 📝 Code Style

### TypeScript
- Use strict mode
- Avoid `any` types (use `unknown` instead)
- Define proper interfaces for all data structures

### React
- Use functional components with hooks
- Apply `React.memo` for expensive components
- Use `useCallback` and `useMemo` appropriately
- Follow React best practices for hooks

### File Naming
- Components: PascalCase (e.g., `VMCard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useVMs.ts`)
- Utilities: camelCase (e.g., `formatBytes.ts`)
- Types: camelCase (e.g., `types.ts`)

## 🔐 Authentication

The application uses a token-based authentication system:
- Access tokens (15 minutes expiry)
- Refresh tokens (7 days expiry)
- CSRF protection
- Token storage via `TokenManager`

## 🌐 API Integration

All API calls go through the middleware proxy:
- `/api/*` → Backend API
- `/ws/*` → WebSocket connections
- `/agent/*` → Agent service
- `/vnc/*` → VNC WebSocket (handled by Envoy)

## 🧪 Testing

Currently, testing is optional. To add tests:
1. Install testing framework (Jest, Vitest, etc.)
2. Set up test configuration
3. Write unit tests for utilities
4. Add integration tests for critical flows

## 📦 Build & Deployment

### Build Process
1. Clean previous builds
2. Run Next.js build
3. Patch noVNC bundle (if needed)
4. Fix CSS links (if needed)

### PM2 Management
```bash
npm run pm2:setup    # Setup PM2
npm run restart      # Restart frontend
npm run pm2:logs     # View logs
```

## 🐛 Debugging

### Development Mode
- React Query DevTools available
- Hot reload enabled
- Source maps included

### Production Debugging
- Check browser console for errors
- Review PM2 logs: `npm run pm2:logs`
- Check network tab for API errors

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run lint` and `npm run format`
4. Commit (pre-commit hooks will run automatically)
5. Push and create a pull request

---

**Last Updated**: 2025-01-14

