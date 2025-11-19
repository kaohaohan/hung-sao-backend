const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// 載入環境變數
dotenv.config();

const app = express();

const { register } = require("./src/observability/metrics");

// 連接 MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Atlas 連接成功！");
  })
  .catch((err) => {
    console.error("❌ MongoDB 連接失敗:", err.message);
    process.exit(1);
  });

// 中間件設定
app.use(cors()); // 允許跨域
app.use(express.json()); // 解析 JSON
app.use(express.urlencoded({ extended: true })); // 解析表單

// 加入 HTTP latency 指標
const requestMetricsMiddleware = require("./src/middleware/requestMetrics");
app.use(requestMetricsMiddleware);
// 路由
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

app.use(adminRoutes);
app.use(orderRoutes);
app.use(paymentRoutes);

// 啟動伺服器
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 伺服器運行在 http://localhost:${PORT}`);
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
