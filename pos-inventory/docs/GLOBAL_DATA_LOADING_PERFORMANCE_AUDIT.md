# Global Data Loading Performance Audit

## Phase 1 Findings

This document outlines the architecture and performance bottlenecks across the Atls POS & Inventory application.

### Identified Bottlenecks

1. **Frontend Request Waterfalls (N+1)**
   Many pages use sequential `await` calls in React Query hooks instead of `Promise.all` or `useQueries`, blocking the initial UI rendering unnecessarily.
   
2. **Missing Component-Level Suspense/Skeletons**
   Several dashboard components wait for the entire page's data dependencies to resolve before displaying anything, rather than using localized `<Skeleton>` loaders per widget.

3. **SAP Service Layer Latency**
   The backend retrieves massive payloads (e.g. `Items?$select=*`) from SAP without strict `$select` or `$top` bounds. It needs to filter strictly at the OData query level.

4. **Inefficient React Query Key Management**
   Query keys are currently regenerating on component mounts causing unnecessary refetches. We need stable serialized filter keys.

5. **Search Debouncing**
   Search inputs are triggering API calls on every keystroke. We will implement a custom `useDebounce` hook set to 400ms.

## Next Steps
We will proceed to implement Phase 2 (Data Contract mapping) and Phase 4/5 (React Query and SAP Service Optimization).
