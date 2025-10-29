# 紅騷羊肉麵店 - 後端 API

> Node.js + Express 後端服務，處理訂單管理與金流整合

## 🛠️ 技術棧

- **Runtime**: Node.js v18+
- **Framework**: Express.js
- **Payment**: ECPay SDK
- **Architecture**: RESTful API

## 📁 專案結構

```
backend/
├── server.js           # 主程式進入點
├── routes/            # API 路由定義
├── controllers/       # 商業邏輯處理
├── services/          # 第三方服務整合
├── .env              # 環境變數（不上傳）
└── package.json      # 專案依賴
```

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `.env.example` 並填入你的設定：

```bash
cp .env.example .env
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

伺服器會運行在 `http://localhost:5000`

## 📡 API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/` | API 狀態檢查 |
| `GET` | `/health` | 健康檢查 |
| `POST` | `/api/orders` | 建立訂單 + 產生付款連結 |
| `POST` | `/api/payment-notify` | 接收金流 Webhook |

## 🔒 安全性

- ✅ 環境變數存放敏感資訊
- ✅ CORS 設定限制來源
- ✅ 金流 Webhook 簽章驗證

## 📦 部署

建議部署平台：Railway、Heroku、Render

```bash
# 正式環境啟動
npm start
```

## 🤝 前端專案

前端 Next.js 專案：[hung-sao-mutton-noodles](https://github.com/kaohaohan/hung-sao-mutton-noodles)

## 📝 授權

MIT

