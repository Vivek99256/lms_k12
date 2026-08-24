"use client";

/**
 * The Utility shell primitives are shared with the Admin services menus, so
 * they now live in `@/components/erp/erp-ui`. The original `Utility*` names are
 * re-exported here so no Utility page had to change.
 */
export {
  ErpAlert as UtilityAlert,
  ErpEmpty as UtilityEmpty,
  ErpLoading as UtilityLoading,
  ErpPageHeader as UtilityPageHeader,
  ErpSection as UtilitySection,
  erpCardClass as utilityCardClass,
  erpInputClass as utilityInputClass,
  erpSelectClass as utilitySelectClass,
} from "@/components/erp/erp-ui";
