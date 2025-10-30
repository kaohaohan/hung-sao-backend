const express = require("express");
const app = express();
const cors = require("cors"); //前端能跨領域請求
const dotenv = require("dotenv");
dotenv.config(); //讀取.env 載入到process.env

// 中間件設定
app.use(cors()); // 允許跨域
app.use(express.json()); // 解析 JSON
app.use(express.urlencoded({ extended: true })); // 解析表單

const orderRoutes = require("./routes/orderRoutes");
app.use(orderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 伺服器運行在 http://localhost:${PORT}`);
});
