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
  //加上驗證 不能給負數or 0
  amount: {
    type: Number,
    required: true,
    min: 1,
  },

  // 訂單狀態
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending",
  },
  logisticsStatus: {
    type: String,
    enum: ["unshipped", "shipping"],
    default: "unshipped",
  },
  // 綠界交易編號（對帳用）
  tradeNo: {
    type: String,
  },
  // 黑貓託運單號（物流用）
  trackingNumber: {
    type: String,
  },
  allPayLogisticsID: {
    type: String,
  },
  logisticsOptions: {
    type: { type: String, default: "HOME" },
    subType: { type: String, default: "TCAT" },
    temperature: { type: String, default: "0003" },
  },

  //取貨日期（對應 10 天備貨規則）
  pickupDate: {
    type: Date,
    required: true,
  },
  deliveryDate: {
    type: Date,
    required: true,
  },

  // 商品列表（嵌套陣列）
  items: [
    {
      itemId: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        required: true,
        min: 1,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
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
      match: /^09\d{8}$/,
    },
    email: String,
    address: { type: String, required: true },
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
// pre("save") 要放在mongoose.model一前註冊
// 在儲存前統一計算每項小計與訂單總額，避免信任前端金額
orderSchema.pre("save", function (next) {
  if (Array.isArray(this.items)) {
    this.items = this.items.map((item) => {
      if (item && item.price != null && item.quantity != null) {
        item.subtotal = item.price * item.quantity;
      }
      return item;
    });
    const total = this.items.reduce(
      (sum, item) => sum + (item.subtotal || 0),
      0
    );
    this.amount = total;
  }
  next();
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
async function updateOrderStatus(orderId, paymentStatus, paymentInfo) {
  try {
    return await Order.findOneAndUpdate(
      { orderId },
      {
        paymentStatus,
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
      logisticsStatus: "shipping",
      trackingNumber: trackingNumber || null, //沒傳就設 null
      updatedAt: Date.now(), //回傳「更新後」的 document，而不是「更新前」的那一筆。
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
