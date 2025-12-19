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
  "store:employee:view_deleted", // 👈 THÊM: xem nhân viên đã xóa

  // ========== CUSTOMERS ==========
  "customers:create",
  "customers:search",
  "customers:update",
  "customers:delete",
  "customers:top-customers",
  "customers:view", // 👈 THÊM: xem khách hàng

  // ========== LOYALTY ==========
  "loyalty:view",
  "loyalty:manage",

  // ========== ORDERS ==========
  "orders:create",
  "orders:pay",
  "orders:print",
  "orders:view",
  "orders:refund",

  // ========== REPORTS ==========
  "reports:top-products",
  "reports:revenue:view",
  "reports:revenue:employee",
  "reports:revenue:export",
  "reports:financial:view",
  "reports:financial:export",
  "reports:financial:list",

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

  // ========== SUPPLIERS ==========
  "supplier:create",
  "supplier:view",
  "supplier:update",
  "supplier:delete",
  "supplier:restore",
  "supplier:export",

  // ========== TAX ==========
  "tax:preview",
  "tax:create",
  "tax:update",
  "tax:clone",
  "tax:delete",
  "tax:list",
  "tax:export",
  "tax:view", // 👈 THÊM: xem thuế

  // ========== USER MANAGEMENT ==========
  "users:view",
  "users:manage",
  "users:role:update",
  "users:menu:update",
  "users:update",
  "users:create", // 👈 THÊM: tạo user
  "users:delete", // 👈 THÊM: xóa user

  // ========== REPORTS & EXPORTS ==========
  "reports:export",
  "reports:activity-log:view",
  "reports:endofday:view",
  "data:export",

  // ========== SETTINGS ==========
  "settings:activity-log",
  "settings:payment-method",
  "settings:view", // 👈 THÊM: xem settings
  "settings:update", // 👈 THÊM: cập nhật settings

  // ========== NOTIFICATIONS ==========
  "notifications:view",
  "notifications:manage", // 👈 THÊM: quản lý thông báo

  // ========== SUBSCRIPTION ==========
  "subscription:view",
  "subscription:manage",
  "subscription:activate",
  "subscription:cancel",
  "subscription:history",

  // ========== EMPLOYEES (GLOBAL) ==========
  "employees:view",
  "employees:assign",
  "employees:manage", // 👈 THÊM: quản lý nhân viên toàn hệ thống

  // ========== FILE MANAGEMENT ==========
  "file:view",
  "file:upload", // 👈 THÊM: upload file
  "file:delete", // 👈 THÊM: xóa file

  // ========== WILDCARDS ==========
  "*", // 👈 Toàn quyền
  "*:*", // 👈 Toàn quyền (alternate format)
  "all", // 👈 Toàn quyền (simple)
  "store:*", // 👈 Toàn quyền store
  "products:*", // 👈 Toàn quyền products
  "orders:*", // 👈 Toàn quyền orders
  "customers:*", // 👈 Toàn quyền customers
  "reports:*", // 👈 Toàn quyền reports
  "inventory:*", // 👈 Toàn quyền inventory
  "tax:*", // 👈 Toàn quyền tax
  "users:*", // 👈 Toàn quyền users

  // ========== SCOPE-SPECIFIC PATTERNS ==========
  // Các pattern này sẽ được generate động khi cần
  // Ví dụ: "store:68f8a0d08f156b744e9e4bb9:employee:view"
  // Pattern: "store:<storeId>:<resource>:<action>"
];

const STAFF_DEFAULT_MENU = [
  // Store
  "store:dashboard:view",
  "store:employee:view", // 👈 THÊM: staff có thể xem nhân viên cùng store

  // Orders
  "orders:create",
  "orders:pay",
  "orders:print",
  "orders:view",
  "orders:refund",

  // Customers
  "customers:create",
  "customers:search",
  "customers:update",
  "customers:view", // 👈 THÊM

  // Loyalty
  "loyalty:view",

  // Products
  "products:view",
  "products:search",

  // Inventory
  "inventory:stock-check:view",
  "inventory:stock-check:detail",
  "inventory:stock-check:update",

  // Suppliers
  "supplier:view",

  // Users (chỉ xem)
  "users:view",

  // Reports
  "reports:revenue:view",

  // Notifications
  "notifications:view",

  // File
  "file:view",

  // Product groups
  "product-groups:view",
];

module.exports = {
  ALL_PERMISSIONS,
  STAFF_DEFAULT_MENU,
};
