require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const listEndpoints = require("express-list-endpoints");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const errorHandler = require("./middlewares/errorHandler");
const notFoundHandler = require("./middlewares/notFoundHandler");

// Swagger (đang tắt)
// const swaggerUi = require("swagger-ui-express");
// const YAML = require("yamljs");
// const swaggerDocument = YAML.load(path.join(__dirname, "swagger.json"));

// --- LOAD MODELS ---
[
  "Product",
  "ProductGroup",
  "Supplier",
  "Employee",
  "StockDisposal",
  "StockCheck",
  "PurchaseOrder",
  "PurchaseReturn",
].forEach((model) => require(`./models/${model}`));

const app = express();

/* =====================================================
   🌍 CORS – WHITELIST + HỖ TRỢ CREDENTIALS
   ✅ Cho phép domain trong whitelist dùng cookies/credentials
   ✅ Domain ngoài whitelist vẫn gọi được API (không có credentials)
   ✅ Hỗ trợ Swagger Editor test API
===================================================== */
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://skinanalysis.life",
  "https://skinanalysis.life",
  "http://smallbizsales.site",
  "https://smallbizsales.site",
  "https://editor.swagger.io", // ✅ Swagger Editor
  "https://petstore.swagger.io", // ✅ Swagger Petstore
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // ✅ NẾU ORIGIN TRONG WHITELIST → CHO PHÉP + CREDENTIALS
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  } else {
    // ✅ ORIGIN KHÁC → CHO PHÉP NHƯNG KHÔNG CREDENTIALS
    res.header("Access-Control-Allow-Origin", "*");
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-store-id"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  // ✅ XỬ LÝ PREFLIGHT REQUEST
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* =====================================================
   🚀 WEBHOOK (PHẢI ĐẶT TRƯỚC JSON)
===================================================== */
const orderWebhookHandler = require("./routers/orderWebhookHandler");
const subscriptionWebhookHandler = require("./routers/subscriptionWebhookHandler");

app.post(
  "/api/orders/vietqr-webhook",
  express.raw({ type: "*/*" }),
  orderWebhookHandler
);

app.post(
  "/api/subscriptions/webhook",
  express.raw({ type: "*/*" }),
  subscriptionWebhookHandler
);

/* =====================================================
   📂 MULTER UPLOAD
===================================================== */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

/* =====================================================
   🌐 HTTP SERVER + SOCKET.IO
===================================================== */
const server = http.createServer(app);

/* =====================================================
   🔌 SOCKET.IO – WHITELIST + CREDENTIALS
===================================================== */
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // ✅ Dùng whitelist
    methods: ["GET", "POST"],
    credentials: true, // ✅ Cho phép credentials với whitelist
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`🟢 Socket connected: ${socket.id}`);
  socket.on("disconnect", () =>
    console.log(`🔴 Socket disconnected: ${socket.id}`)
  );
});

/* =====================================================
   ⏰ CRON JOB
===================================================== */
require("./services/cronJobs");

/* =====================================================
   🧱 COMMON MIDDLEWARES
===================================================== */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

/* =====================================================
   🚏 ROUTERS
===================================================== */
const storeRouters = require("./routers/storeRouters");
const storePaymentRouters = require("./routers/storePaymentRouters");
const userRouters = require("./routers/userRouters");
const productRouters = require("./routers/productRouters");
const productGroupRouters = require("./routers/productGroupRouters");
const stockDisposalRouters = require("./routers/stockDisposalRouters");
const stockCheckRouters = require("./routers/stockCheckRouters");
const supplierRouters = require("./routers/supplierRouters");
const purchaseOrderRouters = require("./routers/purchaseOrderRouters");
const purchaseReturnRouters = require("./routers/purchaseReturnRouters");
const orderRouters = require("./routers/orderRouters");
const taxRouters = require("./routers/taxRouters");
const revenueRouters = require("./routers/revenueRouters");
const customerRouters = require("./routers/customerRouters");
const loyaltyRouters = require("./routers/loyaltyRouters");
const financialRouters = require("./routers/financialRouters");
const activityLogRouters = require("./routers/activityLogRouters");
const fileRouters = require("./routers/fileRouters");
const subscriptionRouters = require("./routers/subscriptionRouters");
const notificationRouters = require("./routers/notificationRouters");
const inventoryReportRouters = require("./routers/inventoryReportRouters");
const exportRouters = require("./routers/exportRouters");
const warehouseRouters = require("./routers/warehouseRouters");
const inventoryVoucherRouters = require("./routers/inventoryVoucherRouters");
const operatingExpenseRouters = require("./routers/operatingExpenseRouters");

/* =====================================================
   🔗 MOUNT ROUTERS
===================================================== */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/stores", storeRouters);
app.use("/api/stores-config-payment", storePaymentRouters);
app.use("/api/users", userRouters);
app.use("/api/products", productRouters);
app.use("/api/product-groups", productGroupRouters);
app.use("/api/stock-disposals", stockDisposalRouters);
app.use("/api/stock-checks", stockCheckRouters);
app.use("/api/suppliers", supplierRouters);
app.use("/api/purchase-orders", purchaseOrderRouters);
app.use("/api/purchase-returns", purchaseReturnRouters);
app.use("/api/orders", orderRouters);
app.use("/api/taxs", taxRouters);
app.use("/api/revenues", revenueRouters);
app.use("/api/customers", customerRouters);
app.use("/api/loyaltys", loyaltyRouters);
app.use("/api/financials", financialRouters);
app.use("/api/activity-logs", activityLogRouters);
app.use("/api/files", fileRouters);
app.use("/api/subscriptions", subscriptionRouters);
app.use("/api/notifications", notificationRouters);
app.use("/api/inventory-reports", inventoryReportRouters);
app.use("/api/export", exportRouters);
app.use("/api/stores", inventoryVoucherRouters);
app.use("/api/stores", warehouseRouters);
app.use("/api/operating-expenses", operatingExpenseRouters);

/* =====================================================
   🏠 ROOT
===================================================== */
app.get("/", (req, res) => {
  res.send("👀 Ai vừa ping tui đó? Tui thấy rồi nha! From SmartRetail team with Love 🫶");
});

/* =====================================================
   📋 API OVERVIEW
===================================================== */
app.get("/api", (req, res) => {
  const endpoints = listEndpoints(app);
  const grouped = {};

  endpoints.forEach((ep) => {
    const prefix = ep.path.split("/")[2] || "root";
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push({
      methods: ep.methods,
      path: ep.path,
    });
  });

  res.json({
    status: "ok",
    totalEndpoints: endpoints.length,
    totalModules: Object.keys(grouped).length,
    endpoints: grouped,
  });
});

/* =====================================================
   ❌ ERROR HANDLERS
===================================================== */
app.use(notFoundHandler);
app.use(errorHandler);

/* =====================================================
   🚀 START SERVER
===================================================== */
const PORT = process.env.PORT || 9999;

async function bootstrap() {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`🔥 Server running: http://localhost:${PORT}`);
    console.log("🔔 Socket.io đang hoạt động...");
    console.log(`📋 API Overview: http://localhost:${PORT}/api`);
  });
}

bootstrap().catch((error) => {
  console.error("❌ Không thể khởi động server:", error);
  process.exit(1);
});
