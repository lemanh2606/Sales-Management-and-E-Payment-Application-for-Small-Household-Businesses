const express = require("express");
const connectDB = require("./config/db");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser"); // 👈 cần để đọc cookie refreshToken
const errorHandler = require("./middlewares/errorHandler");
const notFoundHandler = require("./middlewares/notFoundHandler");
require("dotenv").config();

require("./models/Product");
require("./models/ProductGroup");
require("./models/Supplier");
require("./models/Employee");
require("./models/StockDisposal");
require("./models/StockCheck");
require("./models/PurchaseOrder");
require("./models/PurchaseReturn");

const app = express();

// Kết nối DB
connectDB();

// Middleware
app.use(cors({
  origin: "http://localhost:3000",  // 👈 Web client
  credentials: true, // 👈 cho phép gửi cookie cross-origin (refreshToken)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // 👈 parse cookie
app.use(morgan("dev"));

// Test route
app.get("/", (req, res) => {
  res.send("Backend đã chạy 🚀");
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
const paymentRouters = require("./routers/paymentRouters");

app.use("/api/stores", storeRouters);
app.use("/api/users", userRouters);
app.use("/api/products", productRouters);
app.use("/api/product-groups", productGroupRouters);
app.use("/api/stock-disposals", stockDisposalRouters);
app.use("/api/stock-checks", stockCheckRouters);
app.use("/api/suppliers", supplierRouters);
app.use("/api/purchase-orders", purchaseOrderRouters);
app.use("/api/purchase-returns", purchaseReturnRouters);
app.use("/api/payments", paymentRouters);

// Middleware 404 + error
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 9999;
app.listen(PORT, () => {
  console.log(`🔥 Server running: http://localhost:${PORT}`);
});
