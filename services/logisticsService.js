// services/logisticsService.js
// 黑貓宅配直連 API

const axios = require("axios");
const moment = require("moment");
const { estimatePackageSize } = require("../utils/logisticsHelper");
/**
 * 查詢郵號 (呼叫黑貓 ParsingAddress API)
 * @param {string} address - 要查詢的地址
 * @returns {string} 6 碼郵號
 */
async function getZipCode(address) {
  const payload = {
    CustomerId: process.env.TCAT_CUSTOMER_ID,
    CustomerToken: process.env.TCAT_CUSTOMER_TOKEN,
    PostType: "01",
    Addresses: [{ Search: address }],
  };

  const response = await axios.post(
    `${process.env.TCAT_API_URL}/ParsingAddress`,
    payload
  );

  const result = response.data;
  console.log("查詢郵號結果:", JSON.stringify(result));

  if (result.IsOK === "Y" && result.Data?.Addresses?.length > 0) {
    const rawPostNum = result.Data.Addresses[0].PostNumber;
    const zipCode = rawPostNum.replace(/-/g, "").slice(-6);
    console.log(`✅ 查詢郵號成功: ${address} → ${zipCode}`);
    return zipCode;
  } else {
    throw new Error(`查詢郵號失敗: ${result.Message}`);
  }
}

/**
 * 建立託運單 (呼叫黑貓 PrintOBT API)
 * @param {Object} orderData - 訂單資料
 * @param {Date} customPickupDate - 可選，店家指定的出貨日（預設明天）
 * @returns {Object} { success, obtNumber, pdfLink } 或 { success, message }
 */
async function createShipment(orderData, customPickupDate = null) {
  try {
    console.log(`🚚 訂單 ${orderData.orderId} 準備向黑貓下單...`);
    // 1. 查寄件人的郵號
    const senderZip = await getZipCode(process.env.TCAT_SENDER_ADDRESS);

    // 2. 準備日期
    // 出貨日：如果店家有指定就用，沒有就用明天
    const shipmentDate = customPickupDate
      ? moment(customPickupDate).format("YYYYMMDD")
      : moment().add(1, "days").format("YYYYMMDD");

    // 配達日：客人選的，但不能超過出貨日 +7 天（黑貓限制）
    const shipmentMoment = moment(shipmentDate, "YYYYMMDD");
    const maxDeliveryDate = shipmentMoment.clone().add(7, "days");
    let deliveryMoment = orderData.deliveryDate
      ? moment(orderData.deliveryDate)
      : moment().add(2, "days");

    // 超過 7 天就自動修正
    if (deliveryMoment.isAfter(maxDeliveryDate)) {
      console.log(`⚠️ 配達日超過限制，自動調整為出貨日 +7 天`);
      deliveryMoment = maxDeliveryDate;
    }
    const deliveryDate = deliveryMoment.format("YYYYMMDD");
    //2.5 計算箱子大小
    const calculatedSpec = estimatePackageSize(orderData.items);

    // 3. 組裝 Payload (對照規格書 2.2.1)
    const payload = {
      CustomerId: process.env.TCAT_CUSTOMER_ID,
      CustomerToken: process.env.TCAT_CUSTOMER_TOKEN,
      PrintType: "01",
      PrintOBTType: "01",
      Orders: [
        {
          OBTNumber: "",
          OrderId: orderData.orderId,
          Thermosphere: "0002", // 冷藏
          Spec: calculatedSpec,
          ReceiptLocation: "01", // 到宅
          ReceiptStationNo: "", // 到宅時填空白

          // 收件人 (客人)
          RecipientName: orderData.customerInfo.name,
          RecipientTel: "",
          RecipientMobile: orderData.customerInfo.phone,
          RecipientAddress: orderData.customerInfo.address,

          // 寄件人 (店家)
          SenderName: process.env.TCAT_SENDER_NAME,
          SenderTel: process.env.TCAT_SENDER_PHONE, // 市話
          SenderMobile: "", // 沒有手機就留空
          SenderZipCode: senderZip,
          SenderAddress: process.env.TCAT_SENDER_ADDRESS,

          // 時間
          ShipmentDate: shipmentDate,
          DeliveryDate: deliveryDate,
          DeliveryTime: "04", // 不指定

          // 金流 (已用綠界付款，不需代收)
          IsFreight: "N",
          IsCollection: "N",
          CollectionAmount: 0,
          IsSwipe: "N",
          IsMobilePay: "N",
          IsDeclare: "N",
          DeclareAmount: 0,

          // 商品
          ProductTypeId: "0001",
          ProductName: "紅燒羊肉麵冷藏組",
          Memo: "冷藏食品，請盡速冰存",
        },
      ],
    };

    // 4. 打 API
    console.log("🚀 正在發送請求給黑貓...");
    console.log("📦 發送的 Payload:", JSON.stringify(payload, null, 2));
    const response = await axios.post(
      `${process.env.TCAT_API_URL}/PrintOBT`,
      payload
    );

    // 5. 處理回傳
    const result = response.data;
    console.log("黑貓回傳:", JSON.stringify(result, null, 2));

    if (result.IsOK === "Y") {
      const orderResult = result.Data.Orders[0];
      const fileNo = result.Data.FileNo;

      console.log(`🎉 成功！託運單號: ${orderResult.OBTNumber}`);

      // FileNo 可能包含 "/" 等特殊字元，需要 URL encode
      const encodedFileNo = encodeURIComponent(fileNo);

      return {
        success: true,
        obtNumber: orderResult.OBTNumber,
        fileNo: fileNo,
        // 測試環境用 API 格式下載 PDF
        pdfLink: `https://egs.suda.com.tw:8443/api/Egs/DownloadOBT?FileNo=${encodedFileNo}`,
      };
    } else {
      console.error(`❌ 黑貓拒絕: ${result.Message}`);
      return {
        success: false,
        message: result.Message,
      };
    }
  } catch (error) {
    console.error(`❌ 系統錯誤: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * 下載託運單 PDF (呼叫黑貓 DownloadOBT API)
 * @param {string} fileNo - 從 createShipment 取得的 FileNo
 * @returns {Buffer} PDF 二進制資料
 */
async function downloadLabel(fileNo) {
  try {
    const response = await axios.post(
      `${process.env.TCAT_API_URL}/DownloadOBT`,
      {
        CustomerId: process.env.TCAT_CUSTOMER_ID,
        CustomerToken: process.env.TCAT_CUSTOMER_TOKEN,
        FileNo: fileNo,
      },
      {
        responseType: "arraybuffer", // 重要！取得二進制資料
      }
    );

    // 檢查回傳是否為 PDF（Content-Type 應該是 application/pdf）
    const contentType = response.headers["content-type"];
    if (contentType && contentType.includes("application/pdf")) {
      console.log("✅ PDF 下載成功，大小:", response.data.length, "bytes");
      return { success: true, data: response.data };
    } else {
      // 如果不是 PDF，可能是錯誤訊息（JSON）
      const errorMsg = response.data.toString("utf8");
      console.error("❌ 下載失敗:", errorMsg);
      return { success: false, message: errorMsg };
    }
  } catch (error) {
    console.error("❌ 下載 PDF 失敗:", error.message);
    return { success: false, message: error.message };
  }
}

module.exports = {
  getZipCode,
  createShipment,
  downloadLabel,
};
