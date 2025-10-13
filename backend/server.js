require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const errorHandler = require("./middlewares/errorHandler");
const notFoundHandler = require("./middlewares/notFoundHandler");

require("./models/Product");
require("./models/ProductGroup");
require("./models/Supplier");
require("./models/Employee");
require("./models/StockDisposal");
require("./models/StockCheck");
require("./models/PurchaseOrder");
require("./models/PurchaseReturn");

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

connectDB();
require("./services/cronJobs");

// Webhook PayOS phải viết trước express.json()
const orderWebhookHandler = require("./routers/orderWebhookHandler");
app.post("/api/orders/vietqr-webhook", express.raw({ type: "*/*" }), orderWebhookHandler);

// Middleware
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

// Test route
app.get("/", (req, res) => {
  res.send("Backend đã chạy 🚀 (Socket.io active 🔔)");
});

// Routers
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
app.use("/api/tax", taxRouters);

// Middleware 404 + error
app.use(notFoundHandler);
app.use(errorHandler);

// Khởi động server
const PORT = process.env.PORT || 9999;
server.listen(PORT, () => {
  console.log(`🔥 Server running: http://localhost:${PORT}`);
  console.log("🔔 Socket.io đang hoạt động...");
});
