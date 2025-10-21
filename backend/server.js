require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const listEndpoints = require("express-list-endpoints");
const path = require("path");
const errorHandler = require("./middlewares/errorHandler");
const notFoundHandler = require("./middlewares/notFoundHandler");
// Swagger
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml")); // 👈 nhớ tạo file swagger.yaml
// --- DB CONNECT ---
connectDB();
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
const server = http.createServer(app); // 👈 Tạo server http để gắn socket.io

// ⚡ Khởi tạo Socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // 👈 FE React
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
  },
});

// Lưu io vào app để controller có thể sử dụng (req.app.get("io"))
app.set("io", io);
// 🧠 Khi có client kết nối socket
io.on("connection", (socket) => {
  console.log(`🟢 Client kết nối: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`🔴 Client ngắt kết nối: ${socket.id}`);
  });
});
require("./services/cronJobs");

// Webhook PayOS phải viết trước express.json()
const orderWebhookHandler = require("./routers/orderWebhookHandler");
app.post("/api/orders/vietqr-webhook", express.raw({ type: "*/*" }), orderWebhookHandler);

// --- MIDDLEWARE ---
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// --- ROUTERS ---
const storeRouters = require("./routers/storeRouters");
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

// --- MOUNT ROUTERS ---
app.use("/api/stores", storeRouters);
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

// --- ROOT ---
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy ổn định 🚀");
});

// --- API OVERVIEW (JSON) ---
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

// --- SWAGGER UI ---
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- ERROR HANDLERS ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- SERVER START ---
const PORT = process.env.PORT || 9999;
server.listen(PORT, () => {
  console.log(`🔥 Server running: http://localhost:${PORT}`);
  console.log("🔔 Socket.io đang hoạt động...");
  console.log(`📘 Swagger Docs:  http://localhost:${PORT}/docs`);
  console.log(`📋 API Overview:  http://localhost:${PORT}/api`);
});
