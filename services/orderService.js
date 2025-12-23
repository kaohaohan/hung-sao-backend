const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  // ==========================================
  // 1. 訂單核心識別 (Core Identity)
  // ==========================================
  orderId: {
    type: String,
    required: true,
    unique: true, // 例如: ORD1734928374
  },

  // ==========================================
  // 2. 金額計算 (Accounting) - 你的帳本
  // ==========================================
  subtotal: {
    type: Number,
    default: 0, // 商品小計 (麵錢)
  },
  shippingFee: {
    type: Number,
    default: 0, // 運費 (根據材積或設定計算)
  },
  amount: {
    type: Number,
    required: true,
    min: 1, // 總金額 (綠界實際要收的錢 = subtotal + shippingFee)
  },

  // ==========================================
  // 3. 狀態管理 (Status Flags)
  // ==========================================
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"], // 待付款, 已付款, 失敗
    default: "pending",
  },
  logisticsStatus: {
    type: String,
    enum: ["unshipped", "shipping", "shipped", "arrived"], // 備貨中, 配送中, 已出貨, 已送達
    default: "unshipped",
  },

  // 前端選擇的付款方式 (CREDIT_CARD / COD)，以及後續由 webhook 對應的實際通道
  paymentMethod: {
    type: String,
    enum: [
      "CREDIT_CARD",
      "COD",
      "ATM",
      "CVS",
      "BARCODE",
      "APPLE_PAY",
      "GOOGLE_PAY",
      "UNKNOWN",
      null,
    ],
    default: null,
  },

  // ==========================================
  // 4. 顧客與商品 (Customer & Items)
  // ==========================================
  customerInfo: {
    name: { type: String, required: true },
    phone: { type: String, required: true, match: /^09\d{8}$/ },
    email: String,
    address: { type: String, required: true },
  },
  items: [
    {
      itemId: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      subtotal: Number,
      note: String,
    },
  ],

  // ==========================================
  // 5. 黑貓物流設定 (Black Cat / TCAT Config)
  // 這裡存的是「你要怎麼寄」以及「客人想什麼時候收」
  // ==========================================
  logisticsOptions: {
    // 物流類型 (預設黑貓宅配)
    type: { type: String, default: "HOME" },
    subType: { type: String, default: "TCAT" },

    // 🔥 溫層設定 (重要：0002 代表冷藏)
    temperature: {
      type: String,
      default: "0002",
      enum: ["0001", "0002", "0003"], // 常溫, 冷藏, 冷凍
    },

    // 🔥 配送時段 (客人選的)
    // 對應黑貓代碼: 1(13前), 2(14-18), 4(不指定)
    deliveryTime: {
      type: String,
      default: "anytime",
      enum: ["anytime", "before_13", "14_18"],
    },
  },

  // 🚚 日期設定 (獨立出來比較好查詢)
  // 給黑貓：你要司機哪一天來你店裡收貨？ (通常是 T+1 明天)
  pickupDate: {
    type: Date,
    required: true,
  },
  // 給黑貓：客人希望哪一天收到？
  deliveryDate: {
    type: Date,
    required: true,
  },

  // ==========================================
  // 6. 綠界金流回傳 (Green World / ECPay Response)
  // 當綠界通知我們付款成功時，更新這裡
  // ==========================================
  paymentInfo: {
    TradeNo: String, // 綠界交易編號（保持綠界原始欄位名）
    PaymentType: String, // 付款方式（保持綠界原始欄位名）
    PaymentDate: Date, // 付款時間（保持綠界原始欄位名）
    CheckMacValue: String, // 檢查碼（保持綠界原始欄位名）
  },

  // ==========================================
  // 7. 黑貓物流回傳 (Logistics Provider Response)
  // 當物流訂單建立成功後，回填這裡
  // ==========================================
  logisticsInfo: {
    trackingNumber: String, // 託運單號 (最重要的！印在單子上的號碼)
    rtnCode: String, // 物流介接回傳碼
    rtnMsg: String, // 物流訊息
    allPayLogisticsID: String, // 綠界物流訂單編號 (如果透過綠界串黑貓才有)
    cvsPaymentNo: String, // 寄貨編號 (C2C常用，宅配較少用)
    bookingNote: String, // 託運單下載連結 (HTML/PDF)
  },

  // ==========================================
  // 8. 系統時間
  // ==========================================
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
// pre("save") 要放在mongoose.model一前註冊
// 在儲存前統一計算每項小計與訂單總額，避免信任前端金額
orderSchema.pre("save", function (next) {
  // 只有當 items 有變動或是新訂單時才重算，節省效能
  if (this.isModified("items") || this.isNew) {
    if (Array.isArray(this.items)) {
      // A. 重算每項商品的 subtotal
      this.items = this.items.map((item) => {
        if (item && item.price != null && item.quantity != null) {
          item.subtotal = item.price * item.quantity;
        }
        return item;
      });

      // B. 計算商品總小計 (Subtotal)
      const itemTotal = this.items.reduce(
        (sum, item) => sum + (item.subtotal || 0),
        0
      );
      this.subtotal = itemTotal; // 存入資料庫，方便以後查帳

      // C. 【關鍵修改】總金額 = 商品小計 + 運費
      // 確保 shippingFee 有值，沒有就當 0
      const shipping = this.shippingFee || 0;
      this.amount = this.subtotal + shipping;
    }
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
async function updateOrderStatus(
  orderId,
  paymentStatus,
  paymentInfo,
  paymentMethod = null
) {
  try {
    const updatePayload = {
      paymentStatus,
      paymentInfo,
      updatedAt: Date.now(),
    };

    if (paymentMethod) {
      updatePayload.paymentMethod = paymentMethod;
    }

    return await Order.findOneAndUpdate({ orderId }, updatePayload, {
      new: true,
    });
  } catch (error) {
    throw new Error(`更新訂單失敗: ${error.message}`);
  }
}

async function shipOrder(orderId, trackingNumber, logisticsInfo = null) {
  const updateData = {
    logisticsStatus: "shipping",
    trackingNumber: trackingNumber || null,
    updatedAt: Date.now(),
  };

  // 如果有提供完整的物流資訊，就一起存入
  if (logisticsInfo) {
    updateData.logisticsInfo = {
      obtNumber: logisticsInfo.obtNumber,
      fileNo: logisticsInfo.fileNo,
      pdfLink: logisticsInfo.pdfLink,
      createdAt: new Date(),
    };
  }

  return await Order.findOneAndUpdate({ orderId }, updateData, { new: true });
}
module.exports = {
  Order,
  createOrder,
  getOrderById,
  updateOrderStatus,
  shipOrder,
};
