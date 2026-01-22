jest.mock("../services/orderService", () => ({
  createOrderWithStock: jest.fn(),
  prepareOrderForRetry: jest.fn(),
}));
jest.mock("../services/ecpayService", () => ({
  createPayment: jest.fn(),
}));
jest.mock("../utils/shippingCalculator", () => ({
  calculateServerShipping: jest.fn(() => 0),
}));

const {
  createOrder,
  retryPayment,
} = require("../controllers/orderController");
const orderService = require("../services/orderService");
const ecpayService = require("../services/ecpayService");

function buildRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
  };
}

describe("Order Controller - 庫存不足", () => {
  test("庫存不足時建單回 409", async () => {
    // P1-6: 庫存不足 → 建單回 409
    orderService.createOrderWithStock.mockRejectedValue(
      new Error("庫存不足")
    );

    const req = {
      body: {
        items: [
          {
            itemId: "mutton_stew",
            price: 100,
            quantity: 1,
          },
        ],
        customerInfo: {
          name: "Test User",
          phone: "0912345678",
          address: "Taipei",
        },
        deliveryDate: "2025-01-01",
        paymentMethod: "CREDIT_CARD",
        shippingMethod: "HOME_COOL",
      },
    };
    const res = buildRes();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "庫存不足" });
  });
});

describe("Order Controller - retry-payment", () => {
  test("retry-payment 會產生新的 MerchantTradeNo", async () => {
    // P2-7: retry-payment 產生新 MerchantTradeNo，不重複
    orderService.prepareOrderForRetry.mockResolvedValue({
      orderId: "ORD123456",
      amount: 1000,
      customerInfo: { name: "Test User" },
      items: [],
    });
    ecpayService.createPayment.mockResolvedValue("<html></html>");

    const req = { params: { orderId: "ORD123456" } };
    const res = buildRes();

    const nowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(1700000000000)
      .mockReturnValueOnce(1700000000001);

    await retryPayment(req, res);
    await retryPayment(req, res);

    const firstTradeNo = ecpayService.createPayment.mock.calls[0][0]
      .merchantTradeNo;
    const secondTradeNo = ecpayService.createPayment.mock.calls[1][0]
      .merchantTradeNo;

    expect(firstTradeNo).not.toBe(secondTradeNo);

    nowSpy.mockRestore();
  });
});
