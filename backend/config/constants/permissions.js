// Centralized permission definitions for menu assignment.
const ALL_PERMISSIONS = [
  // store
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
  // customers
  "customers:create",
  "customers:search",
  "customers:update",
  "customers:delete",
  "customers:top-customers",
  // loyalty
  "loyalty:view",
  "loyalty:manage",
  // orders
  "orders:create",
  "orders:pay",
  "orders:print",
  "orders:view",
  "orders:refund",
  // reports
  "reports:top-products",
  "reports:revenue:view",
  "reports:revenue:employee",
  "reports:revenue:export",
  "reports:financial:view",
  "reports:financial:export",
  "reports:financial:list",
  // products
  "products:create",
  "products:view",
  "products:update",
  "products:price",
  "products:delete",
  "products:image:delete",
  "products:search",
  "products:low-stock",
  // product groups
  "product-groups:create",
  "product-groups:view",
  "product-groups:update",
  "product-groups:delete",
  // purchase orders
  "purchase-orders:create",
  "purchase-orders:view",
  "purchase-orders:update",
  "purchase-orders:delete",
  // purchase returns
  "purchase-returns:create",
  "purchase-returns:view",
  "purchase-returns:update",
  "purchase-returns:delete",
  // stock checks / inventory
  "inventory:stock-check:create",
  "inventory:stock-check:view",
  "inventory:stock-check:detail",
  "inventory:stock-check:update",
  "inventory:stock-check:delete",
  // stock disposal
  "inventory:disposal:create",
  "inventory:disposal:view",
  "inventory:disposal:update",
  "inventory:disposal:delete",
  // suppliers
  "supplier:create",
  "supplier:view",
  "supplier:update",
  "supplier:delete",
  // tax
  "tax:preview",
  "tax:create",
  "tax:update",
  "tax:clone",
  "tax:delete",
  "tax:list",
  "tax:export",
  // user management
  "users:manage",
  "users:role:update",
  "users:menu:update",
  "users:update",
  // purchase/supplier related reports/exports
  "reports:export",
  "reports:activity-log:view",
  "reports:endofday:view",
  // settings and notifications
  "settings:activity-log",
  "settings:payment-method",
  "notifications:view",
  // subscription
  "subscription:view",
  "subscription:manage",
  "subscription:activate",
  "subscription:cancel",
  "subscription:history",
  // file management
  "file:view",
];

const STAFF_DEFAULT_MENU = [
  "store:dashboard:view",
  "orders:create",
  "orders:pay",
  "orders:print",
  "orders:view",
  "orders:refund",
  "customers:create",
  "customers:search",
  "customers:update",
  "loyalty:view",
  "products:view",
  "products:search",
  "inventory:stock-check:view",
  "inventory:stock-check:detail",
  "inventory:stock-check:update",
  "supplier:view",
  "reports:revenue:view",
  "notifications:view",
  "file:view",
];

module.exports = {
  ALL_PERMISSIONS,
  STAFF_DEFAULT_MENU,
};
