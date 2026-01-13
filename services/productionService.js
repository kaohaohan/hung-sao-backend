const { Order } = require("../models/Order");
const { Product } = require("../models/Product");

const BATCH_SIZE = 50;
// 固定三品項的中文顯示名稱
const DISPLAY_NAME = {
  mutton_stew: "紅騷羊肉真空包",
  angelica_mutton: "當歸羊肉真空包",
  duck_blood: "鴨血臭豆腐",
};
// 限定只統計這三個品項
const ALLOWED_PRODUCT_IDS = ["mutton_stew", "angelica_mutton", "duck_blood"];
const safetyBuffer = Number(process.env.SAFETY_BUFFER || 0);

async function calculateProductionNeeds({ startDate, endDate } = {}) {
  // 預設查詢區間：今天 00:00 到 +7 天 00:00
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);

  const end = endDate ? new Date(endDate) : new Date(start);
  if (!endDate) end.setDate(end.getDate() + 7);
  end.setHours(0, 0, 0, 0);

  // 把日期也 放進去 只抓會出貨的訂單：已付款 + COD 待付款
  const orders = await Order.find({
    deliveryDate: { $gte: start, $lt: end },
    $or: [
      { paymentStatus: "paid" },
      { paymentStatus: "pending", paymentMethod: "COD" },
    ],
  });
  // 預先建立三個品項，確保回傳時一定都有
  const summary = Object.fromEntries(ALLOWED_PRODUCT_IDS.map((id) => [id, 0]));

  // 逐筆訂單累加每個品項的需求量
  for (const order of orders) {
    for (const item of order.items || []) {
      const key = item.itemId;
      // 不在三品項清單內就忽略
      if (summary[key] == null) continue;
      summary[key] += item.quantity;
    }
  }

  // 讀取這三個品項的庫存
  const products = await Product.find(
    { productId: { $in: ALLOWED_PRODUCT_IDS } },
    { productId: 1, stock: 1, _id: 0 }
  ).lean();
  const stockMap = Object.fromEntries(
    products.map((p) => [p.productId, p.stock ?? 0])
  );

  // 轉成前端/老闆可讀的回傳格式
  const productionAdvice = ALLOWED_PRODUCT_IDS.map((itemId) => {
    //這週需求
    const count = summary[itemId];
    const stock = stockMap[itemId] ?? 0;
    const needToMake = Math.max(0, count + safetyBuffer - stock);
    return {
      productName: DISPLAY_NAME[itemId] || itemId,
      count, // 本週需要出貨的包數
      stock, // 目前庫存
      needToMake, // 需要再做多少包
      batches: Math.ceil(needToMake / BATCH_SIZE), // 需要補做的鍋數
      safetyBuffer,
    };
  });
  const totalPackages = Object.values(summary).reduce((sum, count) => {
    return sum + count;
  }, 0);

  // 回傳給 API
  return {
    startDate: start,
    endDate: end,
    totalOrders: orders.length,
    totalPackages,
    productionAdvice,
  };
}

module.exports = { calculateProductionNeeds };

/*{
  startDate: Date,         // 查詢區間起始日 (今天 00:00)
  endDate: Date,           // 查詢區間結束日 (+7天 00:00)
  totalOrders: Number,     // 符合條件的訂單筆數
  totalPackages: Number,   // 本週所有品項的總包數
  productionAdvice: [
    {
      productName: String, // 品項中文名
      count: Number,       // 本週需求量
      stock: Number,       // 目前庫存
      needToMake: Number,  // 還要補做幾包 (含 safety buffer)
      batches: Number,     // 要煮幾鍋
      safetyBuffer: Number // 安全庫存
    }
  ]
} */
