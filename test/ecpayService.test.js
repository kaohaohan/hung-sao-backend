const mockAioCheckOutAll = jest.fn(() => "<html></html>");

jest.mock("ecpay_aio_nodejs", () =>
  jest.fn().mockImplementation(() => ({
    payment_client: { aio_check_out_all: mockAioCheckOutAll },
  }))
);

process.env.ECPAY_MERCHANT_ID = "2000132";
process.env.ECPAY_HASH_KEY = "5294y06JbISpM5x9";
process.env.ECPAY_HASH_IV = "v77hoKGq4kWxNNIS";
process.env.ECPAY_WEBHOOK_URL = "https://example.com/webhook";
process.env.FRONTEND_URL = "http://localhost:3000";

const { createPayment } = require("../services/ecpayService");

describe("ECPay Service - CustomField1", () => {
  test("retry-payment 的 CustomField1 對應回原訂單", async () => {
    // P2-8: CustomField1 能對應回原訂單
    const orderData = {
      orderId: "ORD123456",
      merchantTradeNo: "RT1234567890",
      amount: 1000,
      description: "Test",
      customerInfo: {},
      items: [],
    };

    await createPayment(orderData);

    const baseParam = mockAioCheckOutAll.mock.calls[0][0];
    expect(baseParam.MerchantTradeNo).toBe("RT1234567890");
    expect(baseParam.CustomField1).toBe("ORD123456");
  });
});
