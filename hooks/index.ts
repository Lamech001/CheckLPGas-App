/**
 * Hooks Index - Export all custom hooks
 */

// Data fetching with caching
export { useInfiniteQuery, useMutation, useQueries, useQuery } from './useQuery';

// Authentication
export { useAuth, useCachedUserRole } from './useAuth';

// Suppliers
export { useFilteredSuppliers, usePrefetchSuppliers, useSupplier, useSuppliers } from './useSuppliers';

// User Profile
export { useUpdateUserProfile, useUserProfile } from './useUserProfile';

// Supplier Dashboard
export {
    useSupplierDashboard, useSupplierStats, useUpdateSupplier
} from './useSupplierDashboard';

// Legacy cached data hook
export { useCachedData, useCachedSuppliers } from './useCachedData';

