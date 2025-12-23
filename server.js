const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

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

app.use("/api/admin", adminRoutes);
app.use(orderRoutes);
app.use(paymentRoutes);

// Metrics 端點（放在路由之後）
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error("Metrics error:", error);
    res.status(500).send("Metrics unavailable");
  }
});

// 只在非 Vercel 環境下啟動伺服器（本地開發用）
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`🚀 伺服器運行在 http://localhost:${PORT}`);
  });
}

// 導出 app 給 Vercel 使用
module.exports = app;
