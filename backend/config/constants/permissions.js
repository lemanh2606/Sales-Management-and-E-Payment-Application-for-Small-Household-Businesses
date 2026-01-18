// Centralized permission definitions for menu assignment.
const ALL_PERMISSIONS = [
  // ========== STORE MANAGEMENT ==========
  "store:create",
  "store:view",
  "store:update",
  "store:delete",
  "store:dashboard:view",
  "store:staff:assign",
  "store:employee:create",
  "store:employee:view",
  "store:employee:update",
  "store:employee:delete",
  "store:employee:softDelete",
  "store:employee:restore",
  "store:employee:view_deleted",

  // ========== CUSTOMERS ==========
  "customers:create",
  "customers:view",
  "customers:search",
  "customers:update",
  "customers:delete",
  "customers:top-customers",
  "customers:export",

  // ========== LOYALTY ==========
  "loyalty:view",
  "loyalty:manage",

  // ========== ORDERS ==========
  "orders:create",
  "orders:pay",
  "orders:print",
  "orders:view",
  "orders:refund",
  "orders:delete",

  // ========== REPORTS ==========
  "reports:top-products",
  "reports:revenue:view",
  "reports:revenue:employee",
  "reports:revenue:export",
  "reports:financial:view",
  "reports:financial:export",
  "reports:financial:list",
  "reports:activity-log:view",
  "reports:endofday:view",

  // ========== PRODUCTS ==========
  "products:create",
  "products:view",
  "products:update",
  "products:price",
  "products:delete",
  "products:image:delete",
  "products:search",
  "products:low-stock",
  "products:export",

  // ========== PRODUCT GROUPS ==========
  "product-groups:create",
  "product-groups:view",
  "product-groups:update",
  "product-groups:delete",

  // ========== PURCHASE ORDERS ==========
  "purchase-orders:create",
  "purchase-orders:view",
  "purchase-orders:update",
  "purchase-orders:delete",

  // ========== PURCHASE RETURNS ==========
  "purchase-returns:create",
  "purchase-returns:view",
  "purchase-returns:update",
  "purchase-returns:delete",

  // ========== INVENTORY / STOCK ==========
  "inventory:stock-check:create",
  "inventory:stock-check:view",
  "inventory:stock-check:detail",
  "inventory:stock-check:update",
  "inventory:stock-check:delete",
  "inventory:disposal:create",
  "inventory:disposal:view",
  "inventory:disposal:update",
  "inventory:disposal:delete",

  "inventory:voucher:create",
  "inventory:voucher:view",
  "inventory:voucher:update",
  "inventory:voucher:delete",
  "inventory:voucher:approve",
  "inventory:voucher:post",
  "inventory:voucher:cancel",
  "inventory:voucher:reverse",

  "warehouses:view",
  "warehouses:create",
  "warehouses:update",
  "warehouses:delete",
  "warehouses:restore",
  "warehouses:set-default",

  // ========== SUPPLIERS ==========
  "suppliers:create",
  "suppliers:view",
  "suppliers:update",
  "suppliers:delete",
  "suppliers:restore",
  "suppliers:export",

  // ========== TAXES ==========
  "taxes:view",
  "taxes:preview",
  "taxes:create",
  "taxes:update",
  "taxes:clone",
  "taxes:delete",
  "taxes:list",
  "taxes:export",

  // ========== USER MANAGEMENT ==========
  "users:view",
  "users:create",
  "users:update",
  "users:delete",
  "users:manage",
  "users:role:update",
  "users:menu:update",

  // ========== SETTINGS ==========
  "settings:view",
  "settings:update",
  "settings:activity-log",
  "settings:payment-method",

  // ========== NOTIFICATIONS ==========
  "notifications:view",
  "notifications:manage",

  // ========== SUBSCRIPTION ==========
  "subscription:view",
  "subscription:manage",
  "subscription:activate",
  "subscription:cancel",
  "subscription:history",

  // ========== EMPLOYEES (GLOBAL) ==========
  "employees:view",
  "employees:manage",
  "employees:assign",

  // ========== FILES ==========
  "files:view",
  "files:upload",
  "files:delete",

  // ========== WILDCARDS ==========
  "*",
  "*:*",
  "all",
  "store:*",
  "products:*",
  "orders:*",
  "customers:*",
  "reports:*",
  "inventory:*",
  "taxes:*",
  "users:*",
];

const STAFF_DEFAULT_MENU = [
  "orders:create",
  "orders:pay",
  "orders:print",
  "orders:view",
  "orders:refund",
  "orders:delete",
  "customers:create",
  "customers:search",
  "customers:view",
  "customers:update",
  "customers:delete",
  "customers:top-customers",
  "loyalty:view",
  "loyalty:manage",
  "notifications:view",
  "notifications:manage",
  "files:view",
  "files:upload",
  "files:delete",
  "store:dashboard:view",
  "store:view",
  "store:employee:view",
  "purchase-returns:create",
  "purchase-returns:view",
  "purchase-returns:update",
  "purchase-returns:delete",
  "users:view",
  "users:create",
  "users:update",
  "users:delete",
  "users:manage",
  "users:role:update",
  "users:menu:update",
  "inventory:stock-check:view",
  "reports:top-products",
  "reports:revenue:view",
  "reports:revenue:employee",
  "reports:revenue:export",
  "reports:financial:view",
  "reports:financial:export",
  "reports:financial:list",
  "reports:activity-log:view",
  "reports:endofday:view",
  "reports:export",
  "reports:*",
  "products:search",
  "products:view",
  "settings:view",
  "settings:update",
  "employees:view",
];

module.exports = {
  ALL_PERMISSIONS,
  STAFF_DEFAULT_MENU,
};
