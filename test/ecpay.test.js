// tests/ecpay.test.js
const {
  generateCheckMacValue,
  verifyCheckMacValue,
} = require("../utils/ecpayHelper");
// 引入綠界官方的 SDK。這是「法官」，它算出來的永遠是對的。
const APIHelper = require("ecpay_aio_nodejs/lib/ecpay_payment/helper");

// 這是綠界測試環境的通用 Key (公開的)
const TestHashKey = "5294y06JbISpM5x9";
const TestHashIV = "v77hoKGq4kWxNNIS";

describe("綠界金流 Helper 測試", () => {
  test("generateCheckMacValue 對齊官方 SDK 計算結果", () => {
    // 模擬資料 (這是綠界官方文件裡的範例)
    const mockData = {
      MerchantID: "2000132",
      MerchantTradeNo: "Test1234",
      MerchantTradeDate: "2013/03/12 15:30:23",
      PaymentType: "aio",
      TotalAmount: "1000",
      TradeDesc: "test_desc",
      ItemName: "test_item",
      ReturnURL: "http://192.168.0.1",
      ChoosePayment: "ALL",
      EncryptType: "1",
    };

    // 用官方 SDK 當作正確答案 (對齊實際運算邏輯)
    const sdkHelper = new APIHelper({
      OperationMode: "Test",
      MercProfile: {
        MerchantID: "2000132",
        HashKey: TestHashKey,
        HashIV: TestHashIV,
      },
      IgnorePayment: [],
      IsProjectContractor: false,
    });
    // 叫官方 SDK 算出一組簽章字串。
    const expectedMacValue = sdkHelper.gen_chk_mac_value(mockData);
    //親手寫的邏輯。

    const result = generateCheckMacValue(mockData, TestHashKey, TestHashIV);
    // 最關鍵的一行：斷言 (Assertion)。
    expect(result).toBe(expectedMacValue);
  });

  test("verifyCheckMacValue 能通過合法 Webhook 簽章", () => {
    const payload = {
      MerchantID: "2000132",
      MerchantTradeNo: "Test1234",
      StoreID: "",
      RtnCode: "1",
      RtnMsg: "Succeeded",
      TradeNo: "2013121212121212",
      TradeAmt: "1000",
      PaymentDate: "2013/03/12 15:30:23",
      PaymentType: "Credit_CreditCard",
      PaymentTypeChargeFee: "0",
      TradeDate: "2013/03/12 15:30:23",
      SimulatePaid: "0",
      CustomField1: "",
      CustomField2: "",
      CustomField3: "",
      CustomField4: "",
    };

    const sdkHelper = new APIHelper({
      OperationMode: "Test",
      MercProfile: {
        MerchantID: "2000132",
        HashKey: TestHashKey,
        HashIV: TestHashIV,
      },
      IgnorePayment: [],
      IsProjectContractor: false,
    });
    const checkMacValue = sdkHelper.gen_chk_mac_value(payload);
    const isValid = verifyCheckMacValue(
      { ...payload, CheckMacValue: checkMacValue },
      TestHashKey,
      TestHashIV
    );
    expect(isValid).toBe(true);
  });

  test("verifyCheckMacValue 偵測到簽章被竄改", () => {
    //做一份payload
    const payload = {
      MerchantID: "2000132",
      MerchantTradeNo: "Test1234",
      StoreID: "",
      RtnCode: "1",
      RtnMsg: "Succeeded",
      TradeNo: "2013121212121212",
      TradeAmt: "1000",
      PaymentDate: "2013/03/12 15:30:23",
      PaymentType: "Credit_CreditCard",
      PaymentTypeChargeFee: "0",
      TradeDate: "2013/03/12 15:30:23",
      SimulatePaid: "0",
      CustomField1: "",
      CustomField2: "",
      CustomField3: "",
      CustomField4: "",
    };

    //綠界 官方SDK Helper算出正確簽章，模擬綠界會給的 CheckMacValue
    const sdkHelper = new APIHelper({
      OperationMode: "Test",
      MercProfile: {
        MerchantID: "2000132",
        HashKey: TestHashKey,
        HashIV: TestHashIV,
      },
      IgnorePayment: [],
      IsProjectContractor: false,
    });
    const checkMacValue = sdkHelper.gen_chk_mac_value(payload);
    //竄改金額
    const tampered = { ...payload, TradeAmt: "1" };
    const isValid = verifyCheckMacValue(
      { ...tampered, CheckMacValue: checkMacValue },
      TestHashKey,
      TestHashIV
    );
    expect(isValid).toBe(false);
  });
});
