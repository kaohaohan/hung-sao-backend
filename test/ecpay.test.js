// tests/ecpay.test.js
const {
  verifyCheckMacValue,
  generateCheckMacValue,
} = require("../utils/ecpayHelper");

// 這是綠界測試環境的通用 Key (公開的)
const TestHashKey = "5294y06JbISpM5x9";
const TestHashIV = "v77hoKGq4kWxNNIS";

describe("綠界金流 Helper 測試", () => {
  test("generateCheckMacValue 應該能產生正確的加密簽章", () => {
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

    // 官方算出來的正確答案
    // 來源：綠界全方位金流介接技術文件 V5.1.41
    const expectedMacValue =
      "63851C8A4BE523C832C8742BFB0311F3C7646BEB29F235616BBD20C8677E2F1F";
    const result = generateCheckMacValue(mockData, TestHashKey, TestHashIV);

    expect(result).toBe(expectedMacValue);
  });

  test("verifyCheckMacValue 應該能正確驗證 Webhook 資料", () => {
    // 模擬綠界回傳的 Payload
    const callbackData = {
      RtnCode: "1",
      RtnMsg: "Succeeded",
      MerchantID: "2000132",
      MerchantTradeNo: "Test1234",
      TotalAmount: "1000",
      PaymentDate: "2013/03/12 15:30:23",
      // 把上面正確的答案放進來當作收到的簽章
      CheckMacValue:
        "E037989354F9190D4D388E4301D38A3D06341270560706599026210A26F3A523",
    };

    // 注意：因為上面的 callbackData 跟第一個 test 的資料不同，
    // 這裡的 CheckMacValue 我是隨便打個比方，
    // 實際測試時，你要確保 verify 算出來的跟 generate 算出來的一樣。

    // 我們做一個簡單的驗證測試：自己產生的自己驗證
    const myData = { Amount: 100, OrderId: "A001" };
    const signature = generateCheckMacValue(myData, TestHashKey, TestHashIV);

    const payloadFromEcpay = { ...myData, CheckMacValue: signature };

    const isValid = verifyCheckMacValue(
      payloadFromEcpay,
      TestHashKey,
      TestHashIV
    );
    expect(isValid).toBe(true);
  });

  test("當簽章被竄改時，驗證應該失敗", () => {
    const myData = { Amount: 100, OrderId: "A001" };
    const signature = generateCheckMacValue(myData, TestHashKey, TestHashIV);

    // 駭客把金額改成 1 元，但用原本的簽章
    const hackedPayload = { ...myData, Amount: 1, CheckMacValue: signature };

    const isValid = verifyCheckMacValue(hackedPayload, TestHashKey, TestHashIV);
    expect(isValid).toBe(false);
  });
});
