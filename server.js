// ============================================
// 紅騷羊肉麵店 - 後端 API Server
// ============================================

// 1️⃣ 載入必要套件
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// 2️⃣ 載入環境變數（從 .env 檔案）
dotenv.config();

// 3️⃣ 建立 Express 應用程式
const app = express();

// 4️⃣ 中間件設定（Middleware）
// 🎓 教學：什麼是中間件？
// 中間件就像是「請求的過濾器」，每個請求進來都會先經過這些處理
app.use(cors()); // 允許前端跨域請求
app.use(express.json()); // 解析 JSON 格式的請求 body
app.use(express.urlencoded({ extended: true })); // 解析 URL-encoded 格式

// 5️⃣ 基礎路由（測試用）
app.get("/", (req, res) => {
  res.json({
    message: "紅騷羊肉麵店 API Server",
    status: "running",
    endpoints: {
      orders: "/api/orders",
      payment_notify: "/api/payment-notify",
    },
  });
});

// 6️⃣ 健康檢查端點（Deployment 時很重要）
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 7️⃣ 錯誤處理中間件（最後一個中間件）
// 🎓 教學：這個會捕捉所有前面沒處理的錯誤
app.use((err, req, res, next) => {
  console.error("錯誤發生:", err.stack);
  res.status(500).json({
    error: "伺服器內部錯誤",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 8️⃣ 404 處理（找不到的路由）
app.use((req, res) => {
  res.status(404).json({ error: "找不到此 API 端點" });
});

// 9️⃣ 啟動伺服器
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 後端伺服器運行在 http://localhost:${PORT}`);
  console.log(`📝 環境: ${process.env.NODE_ENV || "development"}`);
});

// 🔟 優雅關閉（生產環境重要）
process.on("SIGTERM", () => {
  console.log("收到 SIGTERM 信號，準備關閉伺服器...");
  // 這裡可以加上關閉資料庫連線等清理工作
  process.exit(0);
});
