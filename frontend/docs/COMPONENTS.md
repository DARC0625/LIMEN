# Component Documentation

## Core Components

### VNCViewer
**Location**: `components/VNCViewer.tsx`

VNC console viewer component using noVNC library.

**Props**:
- `uuid: string` - VM UUID to connect to

**Features**:
- WebSocket connection to VNC server
- Fullscreen support
- Keyboard and mouse input
- Auto-reconnect on disconnect
- Media management (ISO mounting)

**Usage**:
```tsx
<VNCViewer uuid={vm.uuid} />
```

**Key Implementation Details**:
- Uses dynamic import for noVNC to reduce initial bundle size
- Handles VNC connection lifecycle (connect, disconnect, errors)
- Implements throttled resize handler for performance
- Supports fullscreen API with fallbacks for different browsers

---

### VMListSection
**Location**: `components/VMListSection.tsx`

3D carousel component for displaying VM cards.

**Props**:
- `vms: VM[]` - Array of VM objects
- `onAction?: (uuid: string, action: string) => void` - Action handler
- `onEdit?: (vm: VM) => void` - Edit handler
- `processingId?: string | null` - Currently processing VM UUID
- `editingVM?: VM | null` - Currently editing VM
- `selectedVMForSnapshot?: string | null` - Selected VM for snapshot
- `onSnapshotSelect?: (uuid: string | null) => void` - Snapshot selection handler

**Features**:
- 3D carousel with perspective effects
- Center card highlighting (scale, opacity, shadow)
- Click/drag navigation
- Keyboard navigation support
- Action buttons on center card only

**Usage**:
```tsx
<VMListSection
  vms={vms}
  onAction={handleAction}
  onEdit={setEditingVM}
  processingId={processingId}
  editingVM={editingVM}
/>
```

---

### QuotaDisplay
**Location**: `components/QuotaDisplay.tsx`

Displays resource quota usage (VMs, CPU, Memory).

**Features**:
- Real-time quota data from `useQuota` hook
- Progress bars with color coding (green/yellow/red)
- Loading and error states
- Optimized with React.memo

**Usage**:
```tsx
<QuotaDisplay />
```

---

### AgentMetricsCard
**Location**: `components/AgentMetricsCard.tsx`

Displays agent server metrics (CPU, Memory).

**Features**:
- Real-time metrics from `useAgentMetrics` hook
- CPU and Memory usage progress bars
- Total memory and CPU cores display
- Optimized with React.memo

**Usage**:
```tsx
<AgentMetricsCard />
```

---

### RevolverPicker
**Location**: `components/RevolverPicker.tsx`

iOS-style picker component for selecting values.

**Props**:
- `items: T[]` - Array of items to display
- `value: T` - Current selected value
- `onChange: (value: T) => void` - Change handler
- `formatLabel?: (value: T) => string` - Label formatter
- `itemHeight?: number` - Height of each item (default: 50)
- `visibleItems?: number` - Number of visible items (default: 5)
- `label?: string` - ARIA label

**Features**:
- Smooth scrolling animation
- Touch/drag support for mobile
- Keyboard navigation (Arrow keys, Home, End, PageUp/Down)
- Accessibility support (ARIA labels, keyboard navigation)

**Usage**:
```tsx
<RevolverPicker
  items={[1, 2, 3, 4, 5]}
  value={selectedValue}
  onChange={setSelectedValue}
  formatLabel={(v) => `${v} GB`}
/>
```

---

### StatusCard
**Location**: `components/StatusCard.tsx`

Reusable status card component.

**Components**:
- `StatusCard` - Main card container
- `StatusRow` - Status row with label and value
- `ProgressBar` - Progress bar with label and percentage

**Usage**:
```tsx
<StatusCard title="System Status" status="ok">
  <StatusRow label="Backend" value="connected" />
  <ProgressBar label="CPU" value={75} color="bg-blue-500" />
</StatusCard>
```

---

## Hooks

### useVMs
**Location**: `hooks/useVMs.ts`

Manages VM data fetching and mutations.

**Exports**:
- `useVMs()` - Query hook for VM list
- `useVMsSuspense()` - Suspense-compatible query hook
- `useCreateVM()` - Mutation hook for creating VMs
- `useVMAction()` - Mutation hook for VM actions (start, stop, delete, update)

**Usage**:
```tsx
const { data: vms, isLoading } = useVMs();
const createVM = useCreateVM();

createVM.mutate({ name: 'test', cpu: 2, memory: 2048, os_type: 'ubuntu-server' });
```

---

### useQuota
**Location**: `hooks/useQuota.ts`

Manages quota data fetching.

**Exports**:
- `useQuota()` - Query hook for quota data
- `useQuotaSuspense()` - Suspense-compatible query hook

**Usage**:
```tsx
const { data: quota } = useQuota();
```

---

### useAgentMetrics
**Location**: `hooks/useAgentMetrics.ts`

Manages agent metrics data fetching.

**Exports**:
- `useAgentMetrics()` - Query hook for agent metrics

**Usage**:
```tsx
const { data: metrics } = useAgentMetrics();
```

---

## API Client

### API Structure
**Location**: `lib/api/`

All API calls are centralized in the `lib/api/` directory:

- `client.ts` - Base API client with authentication
- `auth.ts` - Authentication API
- `vm.ts` - VM management API
- `quota.ts` - Quota API
- `admin.ts` - Admin API

**Usage**:
```tsx
import { vmAPI } from '../lib/api';

const vms = await vmAPI.list();
const vm = await vmAPI.create({ name: 'test', cpu: 2, memory: 2048, os_type: 'ubuntu-server' });
```

---

## Utilities

### Token Management
**Location**: `lib/tokenManager.ts`

Manages authentication tokens (access token, refresh token, CSRF token).

**Key Methods**:
- `getAccessToken()` - Get current access token (auto-refresh if needed)
- `hasValidToken()` - Check if valid token exists
- `setTokens()` - Set new tokens
- `clearTokens()` - Clear all tokens

**Usage**:
```tsx
import { tokenManager } from '../lib/tokenManager';

const token = await tokenManager.getAccessToken();
```

---

### Error Handling
**Location**: `lib/utils/errorHelpers.ts`

Centralized error handling utilities.

**Exports**:
- `isAuthError(error: unknown)` - Check if error is authentication-related
- `handleAuthError(error: unknown)` - Handle authentication errors (remove tokens)

**Usage**:
```tsx
import { handleAuthError } from '../lib/utils/errorHelpers';

try {
  await apiCall();
} catch (error) {
  handleAuthError(error);
}
```

---

## Best Practices

### Component Optimization
- Use `React.memo` for components that receive stable props
- Use `useCallback` for event handlers passed to child components
- Use `useMemo` for expensive calculations

### Data Fetching
- Use TanStack Query for all data fetching
- Implement proper loading and error states
- Use Suspense where appropriate

### Type Safety
- Avoid `any` types
- Define proper interfaces for all data structures
- Use type guards for runtime type checking

### Accessibility
- Add ARIA labels to interactive elements
- Support keyboard navigation
- Ensure proper focus management

---

**Last Updated**: 2025-01-14

