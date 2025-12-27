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
// Swagger
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
// const swaggerDocument = YAML.load(path.join(__dirname, "swagger.json")); // 👈 nhớ tạo file swagger.yaml
// --- LOAD MODELS ---
["Product", "ProductGroup", "Supplier", "Employee", "StockDisposal", "StockCheck", "PurchaseOrder", "PurchaseReturn"].forEach((model) =>
  require(`./models/${model}`)
);

const app = express();

//KHAI BÁO allowedOrigins ĐẦU TIÊN
const allowedOrigins = [
  "http://localhost:3000",
  "http://skinanalysis.life",
  "https://skinanalysis.life",
  "http://smallbizsales.site",
  "https://smallbizsales.site",
];

// --- ĐẶT WEBOOK trước các body parser ---
const orderWebhookHandler = require("./routers/orderWebhookHandler");
const subscriptionWebhookHandler = require("./routers/subscriptionWebhookHandler");
app.post("/api/orders/vietqr-webhook", express.raw({ type: "*/*" }), orderWebhookHandler);
app.post("/api/subscriptions/webhook", express.raw({ type: "*/*" }), subscriptionWebhookHandler);

// PHẦN CODE CỦA Multer
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ===== PHẦN CODE CỦA Socket.io =====
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "X-XSRF-TOKEN", "XSRF-TOKEN", "x-store-id"],
  },
});
app.set("io", io);
io.on("connection", (socket) => {
  console.log(`🟢 Client kết nối: ${socket.id}`);
  socket.on("disconnect", () => console.log(`🔴 Client ngắt kết nối: ${socket.id}`));
});

//PHẦN KHAI BÁO THÔNG BÁO BẰNG EMAIL CRONJOB
require("./services/cronJobs");

// --- CÁC MIDDLEWARE SẼ NẰM Ở DƯỚI NÀY ---
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "X-XSRF-TOKEN", "XSRF-TOKEN"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// --- FULL CÁC ROUTERS ---
const storeRouters = require("./routers/storeRouters"); //api Store
const storePaymentRouters = require("./routers/storePaymentRouters"); //api lịch sử thanh toán gói dịch vụ
const userRouters = require("./routers/userRouters"); //api các tài khoản
const productRouters = require("./routers/productRouters"); //api sản phẩm
const productGroupRouters = require("./routers/productGroupRouters"); //api nhóm sản phẩm
const stockDisposalRouters = require("./routers/stockDisposalRouters");
const stockCheckRouters = require("./routers/stockCheckRouters");
const supplierRouters = require("./routers/supplierRouters"); //api nhà cung cấp
const purchaseOrderRouters = require("./routers/purchaseOrderRouters");
const purchaseReturnRouters = require("./routers/purchaseReturnRouters");
const orderRouters = require("./routers/orderRouters"); //api đơn hàng
const taxRouters = require("./routers/taxRouters"); //api kê khai thuế
const revenueRouters = require("./routers/revenueRouters"); //api báo cáo doanh thu
const customerRouters = require("./routers/customerRouters"); // api khách hàng
const loyaltyRouters = require("./routers/loyaltyRouters"); //api hệ thống tích điểm
const financialRouters = require("./routers/financialRouters"); //api báo cáo tài chính tổng quan
const activityLogRouters = require("./routers/activityLogRouters"); // api nhật ký hoạt động
const fileRouters = require("./routers/fileRouters"); //api quản lý file
const subscriptionRouters = require("./routers/subscriptionRouters"); //api mua gói dịch vụ
const notificationRouters = require("./routers/notificationRouters"); //api list thông báo real-time
const inventoryReportRouters = require("./routers/inventoryReportRouters"); //api báo cáo tồn kho

const exportRouters = require("./routers/exportRouters"); //api xuất các báo cáo
const warehouseRouters = require("./routers/warehouseRouters"); //api quản lý kho
const inventoryVoucherRouters = require("./routers/inventoryVoucherRouters"); // api phiếu giảm giá kho????

// --- FULL CÁC API ĐÃ MOUNT ROUTERS ---
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

// --- PHẦN ROOT MẶC ĐỊNH CỦA BACKEND ---
app.get("/", (req, res) => {
  res.send("👀 Ai vừa ping tui đó? Tui thấy rồi nha! From SmartRetail team with Love 🫶");
});

// --- API TỔNG QUAN (JSON) ---
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

// --- PHẦN CỦA SWAGGER UI ---
// app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- PHẦN BÁO LỖI CỦA ERROR HANDLERS ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- KHỞI ĐỘNG SERVER ---
const PORT = process.env.PORT || 9999;

async function bootstrap() {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`🔥 Server running: http://localhost:${PORT}`);
    console.log("🔔 Socket.io đang hoạt động...");
    console.log(`📘 Swagger Docs:  http://localhost:${PORT}/docs`);
    console.log(`📋 API Overview:  http://localhost:${PORT}/api`);
  });
}

bootstrap().catch((error) => {
  console.error("❌ Không thể khởi động server:", error);
  process.exit(1);
});
