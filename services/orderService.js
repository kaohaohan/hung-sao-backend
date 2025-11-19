const mongoose = require("mongoose");

// 訂單 Schema 設計
const orderSchema = new mongoose.Schema({
  // 訂單基本資訊
  orderId: {
    type: String,
    required: true,
    unique: true,
  },

  // 金額
  amount: {
    type: Number,
    required: true,
  },

  // 訂單狀態
  status: {
    type: String,
    enum: ["pending", "paid", "failed", "cancelled"],
    default: "pending",
  },
  // 新增：物流單號（黑貓回傳）
  trackingNumber: {
    type: String,
  },

  //取貨日期（對應 10 天備貨規則）
  pickupDate: {
    type: Date,
    required: true,
  },

  // 商品列表（嵌套陣列）
  items: [
    {
      itemId: String,
      name: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      subtotal: Number,
      note: String, // 備註（例如：不要香菜）
    },
  ],

  // 客戶資訊（嵌套物件）
  customerInfo: {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: String,
    address: String,
  },

  // 付款訊息（綠界回傳後更新）
  paymentInfo: {
    TradeNo: String, // 綠界交易編號
    PaymentType: String, // 付款方式
    PaymentDate: Date, // 付款時間
    CheckMacValue: String, // 驗證碼
  },

  // 時間戳
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// 建立模型
const Order = mongoose.model("Order", orderSchema);

// 建立訂單
async function createOrder(orderData) {
  try {
    const order = new Order(orderData);
    await order.save();
    return order;
  } catch (error) {
    throw new Error(`建立訂單失敗: ${error.message}`);
  }
}

// 根據 orderId 查詢訂單
async function getOrderById(orderId) {
  try {
    return await Order.findOne({ orderId });
  } catch (error) {
    throw new Error(`查詢訂單失敗: ${error.message}`);
  }
}

// 更新訂單狀態（付款成功後呼叫）
async function updateOrderStatus(orderId, status, paymentInfo) {
  try {
    return await Order.findOneAndUpdate(
      { orderId },
      {
        status,
        paymentInfo,
        updatedAt: Date.now(),
      },
      { new: true }
    );
  } catch (error) {
    throw new Error(`更新訂單失敗: ${error.message}`);
  }
}

async function shipOrder(orderId, trackingNumber) {
  return await Order.findOneAndUpdate(
    { orderId },
    {
      status: "shipped",
      trackingNumber: trackingNumber || null,
      updatedAt: Date.now(),
    },
    { new: true }
  );
}
module.exports = {
  Order,
  createOrder,
  getOrderById,
  updateOrderStatus,
  shipOrder,
};
