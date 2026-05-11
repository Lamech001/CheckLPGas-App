/**
 * Hooks Index - Export all custom hooks
 */

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

