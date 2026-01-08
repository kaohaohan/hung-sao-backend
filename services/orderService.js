const { Order } = require("../models/Order");
const { Product } = require("../models/Product");
const mongoose = require("mongoose");

// // 建立訂單
// async function createOrder(orderData) {
//   try {
//     const order = new Order(orderData);
//     await order.save();
//     return order;
//   } catch (error) {
//     throw new Error(`建立訂單失敗: ${error.message}`);
//   }
// }

async function listOrders(query, sort = { createdAt: -1 }) {
  const cursor = Order.find(query);
  if (sort) {
    cursor.sort(sort);
  }
  return await cursor;
}

// 根據 orderId 查詢訂單
async function getOrderById(orderId) {
  try {
    console.log(orderId);
    return await Order.findOne({ orderId });
  } catch (error) {
    throw new Error(`查詢訂單失敗: ${error.message}`);
  }
}

async function updateStatusCheck(orderId, statusCode) {
  return await Order.updateOne(
    { orderId },
    {
      $set: {
        "logisticsInfo.lastStatusCheck": new Date(),
        "logisticsInfo.lastStatusCode": statusCode || null,
      },
    }
  );
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

async function shipOrder(
  orderId,
  tcatResult,
  scheduledPickupDate = null,
  actualDeliveryDate = null
) {
  // tcatResult 是呼叫 createShipment 後回傳的物件
  // 結構: { success: true, obtNumber: "...", fileNo: "...", pdfLink: "..." }
  // scheduledPickupDate: 店家預約的出貨/取件日（可選）

  if (!tcatResult || !tcatResult.obtNumber) {
    throw new Error("缺少黑貓物流資訊 (OBTNumber)");
  }

  const updateData = {
    // 1. 更新主狀態
    logisticsStatus: "shipping",

    // 2. 用點號語法更新嵌套欄位（不會覆蓋掉其他資料）
    "logisticsInfo.trackingNumber": tcatResult.obtNumber,
    "logisticsInfo.fileNo": tcatResult.fileNo,
    "logisticsInfo.pdfLink": tcatResult.pdfLink,
    "logisticsInfo.createdAt": new Date(),
    actualDeliveryDate: actualDeliveryDate,

    updatedAt: Date.now(),
  };

  // 3. 如果有傳入出貨日，存進 pickupDate
  if (scheduledPickupDate) {
    updateData.pickupDate = new Date(scheduledPickupDate);
  }

  // 使用 $set 確保只更新指定欄位
  return await Order.findOneAndUpdate(
    { orderId },
    { $set: updateData },
    { new: true }
  );
}

/**
 * 標記 COD 訂單已送達並付款
 * 更新 paymentStatus、logisticsStatus
 * @param {string} orderId - 訂單編號
 */
async function markCODDelivered(orderId) {
  return await Order.findOneAndUpdate(
    { orderId },
    {
      $set: {
        logisticsStatus: "arrived", // 已送達
        paymentStatus: "paid", // 已付款（因為 COD 送達 = 收到錢）
        updatedAt: Date.now(),
      },
    },
    { new: true }
  );
}
//創訂單 -> 扣庫存
async function createOrderWithStock(orderData) {
  //扣庫存 → 建單 → commit
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const items = orderData.items;
    const totalQty = items.quantity;
    const maxQty = Number(process.env.MAX_ORDER_QTY || 10);
    //設buffer緩衝庫存 實際上 只能
    const safetyBuffer = Number(process.env.SAFETY_BUFFER || 0);

    if (totalQty > maxQty) throw new Error("MAX_QTY");

    for (const item of items) {
      const productId = item.itemId;
      const qty = item.quantity;
      if (qty > maxQty) throw new Error("MAX_QTY");
      // 這prodcutid 的stock>= qty
      const updatedProduct = await Product.findOneAndUpdate(
        { productId, stock: { $gte: qty + safetyBuffer } },

        { $inc: { stock: -qty } },
        { new: true, session }
      );

      if (!updatedProduct) throw new Error("庫存不足");
    }
    const savedOrder = await new Order(orderData).save({ session });

    await session.commitTransaction();

    return savedOrder;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
//付款失敗 rollback 庫存
//webhook回傳失敗回滾 假設平台重覆發送 用paymentStatus 判斷 只有pending才rollbback
async function restoreStockForOrder(orderId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. 鎖定並查詢訂單 (帶入 session)
    const order = await getOrderById(orderId);
    // 2. 雙重檢查：如果找不到單，或是狀態不是 pending，直接結束
    // 這樣可以防止綠界重複呼叫導致重複加庫存
    if (!order || order.paymentStatus !== "pending") {
      await session.abortTransaction();
      return;
    }
    for (const item of order.items || []) {
      const productId = item.itemId;
      const qty = item.quantity;
      await Product.updateOne({ productId }, { $inc: { stock: qty } });
    }

    // 4. 🔥 關鍵：在同一個交易內，直接將訂單標記為 failed
    // 這樣可以確保「庫存回補」跟「狀態更新」絕對同步
    order.paymentStatus = "failed";
    // order.logisticsStatus = "cancelled"; // 視需求是否要連物流狀態一起改
    await order.save({ session });

    await session.commitTransaction();
    console.log(`✅ 訂單 ${orderId} 庫存回補完成，狀態已更新為 failed`);
  } catch (error) {
    await session.abortTransaction();
    console.error(`❌ 回補庫存失敗: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
}

function mapCounts(rows) {
  return rows.reduce((acc, row) => {
    const key = row._id ?? "unknown";
    acc[key] = row.count;
    return acc;
  }, {});
}

async function getOrderStatusSummary() {
  const paymentRows = await Order.aggregate([
    { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
  ]);
  const logisticsRows = await Order.aggregate([
    { $group: { _id: "$logisticsStatus", count: { $sum: 1 } } },
  ]);

  const payment = mapCounts(paymentRows);
  const logistics = mapCounts(logisticsRows);

  return {
    paymentStatus: {
      pending: payment.pending || 0,
      paid: payment.paid || 0,
      failed: payment.failed || 0,
    },
    logisticsStatus: {
      unshipped: logistics.unshipped || 0,
      shipping: logistics.shipping || 0,
      arrived: logistics.arrived || 0,
      cancelled: logistics.cancelled || 0,
    },
  };
}

module.exports = {
  listOrders,
  getOrderById,
  updateOrderStatus,
  updateStatusCheck,
  shipOrder,
  markCODDelivered,
  createOrderWithStock,
  restoreStockForOrder,
  getOrderStatusSummary,
};
