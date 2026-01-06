// controllers/adminController.js

const {
  createShipment,
  downloadLabel,
  checkShipmentStatus,
} = require("../services/logisticsService");
const {
  listOrders,
  getOrderById,
  shipOrder: updateShipStatus,
  markCODDelivered,
  updateStatusCheck,
} = require("../services/orderService");
const {
  getProducts: fetchProducts,
  upsertProduct: saveProduct,
  updateStock: updateProductStock,
} = require("../services/productService");
/**
 * GET /api/admin/orders
 * 查詢訂單列表（可依狀態、時間篩選）
 */
async function getOrders(req, res) {
  try {
    const { paymentStatus, logisticsStatus, startDate, endDate } = req.query;

    let query = {};

    // 狀態過濾
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    if (logisticsStatus) {
      query.logisticsStatus = logisticsStatus;
    }

    // 日期篩選（createdAt）
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await listOrders(query);

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "無法取得訂單列表: " + error.message });
  }
}

/**
 * POST /api/admin/orders/:orderId/ship
 * 出貨：呼叫黑貓 API 拿託運單號，更新訂單狀態
 */
async function shipOrder(req, res) {
  try {
    //1.從URL 取得 訂單的編號
    const { orderId } = req.params;

    // 2.去DB 查訂單  存在嗎？
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "找不到訂單" });
    }

    // 2. 檢查付款狀態
    // COD（貨到付款）可以在 pending 狀態出貨
    // 信用卡必須 paid 才能出貨
    if (order.paymentMethod !== "COD" && order.paymentStatus !== "paid") {
      return res.status(400).json({ error: "訂單尚未付款，無法出貨" });
    }

    // 3. 檢查是否已出貨（避免重複出貨）
    if (order.logisticsStatus === "shipping") {
      return res.status(400).json({ error: "訂單已出貨" });
    }

    // 4. 取得店家指定的出貨日（可選，沒填就用明天）
    const scheduledPickupDate = req.body.pickupDate || null;

    // 5. 呼叫黑貓 API（傳入  scheduledPickupDate
    const shipResult = await createShipment(order, scheduledPickupDate);

    if (!shipResult.success) {
      return res
        .status(500)
        .json({ error: "黑貓下單失敗: " + shipResult.message });
    }

    // 6. 更新訂單狀態，並呼叫 orderService 寫回 DB（狀態/物流資訊/日期）
    const updated = await updateShipStatus(
      orderId,
      shipResult,
      scheduledPickupDate,
      shipResult.actualDeliveryDate
    );
    //假設wasDateAdjusted 被改true 要回傳actualDeliveryDate
    //回傳 JSON 給前端：包含 trackingNumber / pdfLink / actualDeliveryDate / warning。

    res.json({
      message: "訂單已出貨",
      order: updated,
      trackingNumber: shipResult.obtNumber,
      pdfLink: shipResult.pdfLink,
      actualDeliveryDate: shipResult.actualDeliveryDate,
      warning: shipResult.wasDateAdjusted
        ? `⚠️ 配達日已自動調整為 ${shipResult.actualDeliveryDate}`
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/orders/:orderId/label
 * 下載託運單 PDF
 */
async function printLabel(req, res) {
  try {
    // 你的程式碼
    //取得 orderId（從 req.params）
    const { orderId } = req.params;
    //查訂單一樣 格式{ 欄位名: 值 }
    const order = await getOrderById(orderId);
    //取得 fileNo
    const fileNo = order.logisticsInfo.fileNo;
    //找不到回傳 錯誤
    if (!fileNo) {
      return res.status(404).json({ error: "找不到 fileNo" });
    }

    // 如果成功
    const pdfResult = await downloadLabel(fileNo);
    const trackingNumber = order.logisticsInfo.trackingNumber;

    if (pdfResult.success) {
      res.setHeader("Content-Type", "application/pdf"); // PDF 的 MIME type
      res.setHeader(
        "Content-Disposition",
        `inline; filename=${trackingNumber}.pdf`
      ); // 檔名
      res.send(pdfResult.data); // 送什麼資料給前端？
    } else {
      res.status(500).json({ error: "PDF 下載失敗: " + pdfResult.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// / POST /api/admin/orders/sync-status
//同步出貨貨態  檢查 所有配送中+貨到付款
//回傳json 裡有一個result
//total 檢查一共幾筆 到貨付款+Shipping的訂單
// updated  檢查哪寫已經是已送達＋已付款
// skipped： 幾筆被跳過（例如沒有 trackingNumber 或不是 301）
//failed：有幾筆查詢黑貓失敗
async function syncOrderStatus(req, res) {
  try {
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const orders = await listOrders({
      paymentMethod: "COD", // 貨到付款
      logisticsStatus: "shipping", // 配送中
    }, null);

    const results = { total: orders.length, updated: 0, skipped: 0, failed: 0 };

    for (let order of orders) {
      const lastCheck = order.logisticsInfo?.lastStatusCheck;
      if (lastCheck && Date.now() - new Date(lastCheck).getTime() < TWO_HOURS) {
        results.skipped++;
        console.log(
          "[sync-cod] skipped (rate-limit):",
          order.orderId,
          lastCheck
        );
        continue;
      }
      const trackingNumber = order.logisticsInfo?.trackingNumber;
      if (!trackingNumber) {
        results.skipped++;
        console.log("[sync-cod] skipped (no tracking):", order.orderId);
      } else {
        //有trackingNumber
        const statusResult = await checkShipmentStatus(trackingNumber);
        await updateStatusCheck(order.orderId, statusResult.statusCode);
        if (!statusResult.success) {
          //問失敗 / 丟錯 / success=false → failed
          results.failed++;
          console.log(
            "[sync-cod] failed:",
            order.orderId,
            statusResult.message
          );
        } else {
          if (statusResult.statusCode === "301") {
            await markCODDelivered(order.orderId);
            results.updated++;
            console.log("[sync-cod] updated:", order.orderId);
          } else {
            //問成功但不是 301 → skipped
            results.skipped++;
            console.log(
              "[sync-cod] skipped (status):",
              order.orderId,
              statusResult.statusCode
            );
          }
        }
      }
    }

    res.json({ message: "同步完成", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ==========================================
// 商品管理 API
// ==========================================

/**
 * GET /api/admin/products - 取得所有商品
 */
async function getProducts(req, res) {
  try {
    const products = await fetchProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/products - 新增或更新商品
 * Body: { productId, name, price, stock }
 */
async function upsertProduct(req, res) {
  try {
    const { productId, name, price, stock } = req.body;

    if (!productId || !name || price == null || stock == null) {
      return res.status(400).json({ error: "缺少必要欄位" });
    }

    const product = await saveProduct({ productId, name, price, stock });

    res.json({ message: "商品已儲存", product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /api/admin/products/:productId/stock - 更新庫存
 * Body: { stock } 或 { adjust: 5 } (增加 5) 或 { adjust: -3 } (減少 3)
 */
async function updateStock(req, res) {
  try {
    const { productId } = req.params;
    const { stock, adjust } = req.body;

    const product = await updateProductStock(productId, stock, adjust);
    if (!product && stock == null && adjust == null) {
      return res.status(400).json({ error: "請提供 stock 或 adjust" });
    }

    if (!product) {
      return res.status(404).json({ error: "商品不存在" });
    }

    res.json({ message: "庫存已更新", product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getOrders,
  shipOrder,
  printLabel,
  syncOrderStatus,
  getProducts,
  upsertProduct,
  updateStock,
};
