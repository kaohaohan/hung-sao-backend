const axios = require("axios");
const ecpayHelper = require("../utils/ecpayHelper");
const moment = require("moment");
const dateStr = moment().format("YYYY/MM/DD HH:mm:ss");
async function createShipment(orderData) {
  //要傳orderData -> , MerchantTradeDate,GoodsAmount,GoodsName
  //物流方式 orderData -> LogisticsType, LogisticsSubType, IsCollection,Temperature
  //收件人資訊 orderData.customerInfo
  //寄件人(店家,電話) ,商家資訊, 回傳網址在.env

  //param
  const params = {
    MerchantID: process.env.ECPAY_MERCHANT_ID,
    MerchantTradeNo: orderData.orderId,
    MerchantTradeDate: dateStr, //不確定
    GoodsAmount: orderData.amount,
    GoodsName: orderData.items[0].name,
    LogisticsType: orderData.logisticsOptions.type,
    LogisticsSubType: orderData.logisticsOptions.subType,
    Temperature: orderData.logisticsOptions.temperature,
    IsCollection: "N",
    ReceiverName: orderData.customerInfo.name,
    ReceiverCellPhone: orderData.customerInfo.phone,
    ReceiverAddress: orderData.customerInfo.address,
    ReceiverZipCode: "100", //暫時
    SenderName: process.env.SENDER_NAME,
    SenderCellPhone: process.env.SENDER_PHONE,
    ServerReplyURL: process.env.ECPAY_LOGISTICS_REPLY_URL,
    SenderAddress: process.env.SENDER_ADDRESS,
  };

  //簽章
  params.CheckMacValue = ecpayHelper.generateCheckMacValue(
    params,
    process.env.ECPAY_HASH_KEY,
    process.env.ECPAY_HASH_IV
  );

  //api
}
