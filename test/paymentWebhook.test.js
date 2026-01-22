jest.mock("../services/orderService", () => ({
  getOrderById: jest.fn(),
  updateOrderStatus: jest.fn(),
  restoreStockForOrder: jest.fn(),
}));
jest.mock("../utils/ecpayHelper", () => ({
  verifyCheckMacValue: jest.fn(),
}));
const { receivePaymentNotify } = require("../controllers/paymentController");
const orderService = require("../services/orderService");
const ecpayHelper = require("../utils/ecpayHelper");

function buildRes() {
  return {
    send: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("Webhook 冪等性", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("重送 webhook 不會重複更新訂單或扣庫存", async () => {
    ecpayHelper.verifyCheckMacValue.mockReturnValue(true);

    const req = {
      body: {
        RtnCode: "1",
        RtnMsg: "Succeeded",
        MerchantTradeNo: "ORD123",
        TradeNo: "T123",
        PaymentType: "Credit_CreditCard",
        PaymentDate: "2013/03/12 15:30:23",
        CheckMacValue: "DUMMY",
      },
    };
    const res = buildRes();

    // 第一次：pending；第二次：paid（重送）
    orderService.getOrderById
      .mockResolvedValueOnce({ paymentStatus: "pending" })
      .mockResolvedValueOnce({ paymentStatus: "paid" });

    orderService.updateOrderStatus.mockResolvedValue({
      orderId: "ORD123",
      paymentStatus: "paid",
    });

    await receivePaymentNotify(req, res);
    await receivePaymentNotify(req, res);

    expect(orderService.updateOrderStatus).toHaveBeenCalledTimes(1);
    expect(orderService.restoreStockForOrder).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledTimes(2);
    expect(res.send).toHaveBeenCalledWith("1|OK");
  });

  test("付款失敗會回補庫存且不更新為 paid", async () => {
    ecpayHelper.verifyCheckMacValue.mockReturnValue(true);

    const req = {
      body: {
        RtnCode: "0",
        RtnMsg: "Failed",
        MerchantTradeNo: "ORD999",
        TradeNo: "T999",
        PaymentType: "Credit_CreditCard",
        PaymentDate: "2013/03/12 15:30:23",
        CheckMacValue: "DUMMY",
      },
    };
    const res = buildRes();

    orderService.getOrderById.mockResolvedValue({ paymentStatus: "pending" });
    orderService.restoreStockForOrder.mockResolvedValue();

    await receivePaymentNotify(req, res);

    expect(orderService.restoreStockForOrder).toHaveBeenCalledTimes(1);
    expect(orderService.restoreStockForOrder).toHaveBeenCalledWith("ORD999");
    expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith("1|OK");
  });
});
