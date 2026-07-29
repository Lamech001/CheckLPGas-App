import { db } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { SupplierData } from "./types/supplier";

export const getSupplierDataFresh = async (
  supplierId: string,
  retryCount = 0,
): Promise<{ success: boolean; data?: SupplierData; error?: string }> => {
  try {
    const supplierRef = doc(db, "suppliers", supplierId);
    const supplierSnap = await getDoc(supplierRef);

    if (supplierSnap.exists()) {
      return { success: true, data: supplierSnap.data() as SupplierData };
    }

    return {
      success: false,
      error: "Supplier not found. Please complete registration.",
    };
  } catch (error: any) {
    // Minimal retry for transient issues
    if (retryCount < 2) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return getSupplierDataFresh(supplierId, retryCount + 1);
    }

    return {
      success: false,
      error: error?.message || "Failed to fetch supplier data.",
    };
  }
};
