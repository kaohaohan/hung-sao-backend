jest.mock("../services/logisticsService", () => ({
  createShipment: jest.fn(),
}));
jest.mock("../services/orderService", () => ({
  getOrderById: jest.fn(),
  shipOrder: jest.fn(),
}));

const { shipOrder: adminShipOrder } = require("../controllers/adminController");
const logisticsService = require("../services/logisticsService");
const orderService = require("../services/orderService");

function buildRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("Admin 出貨規則", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("COD 訂單允許在 pending 出貨", async () => {
    // P2-9: COD 訂單出貨允許
    orderService.getOrderById.mockResolvedValue({
      orderId: "ORD1",
      paymentMethod: "COD",
      paymentStatus: "pending",
      logisticsStatus: "unshipped",
    });
    logisticsService.createShipment.mockResolvedValue({
      success: true,
      obtNumber: "OBT1",
      fileNo: "F1",
      pdfLink: "http://pdf",
      actualDeliveryDate: "2025-01-02",
      wasDateAdjusted: false,
    });
    orderService.shipOrder.mockResolvedValue({ orderId: "ORD1" });

    const req = { params: { orderId: "ORD1" }, body: {} };
    const res = buildRes();

    await adminShipOrder(req, res);

    expect(logisticsService.createShipment).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalled();
  });

  test("信用卡未付款禁止出貨", async () => {
    // P2-9: 信用卡未付款禁止出貨
    orderService.getOrderById.mockResolvedValue({
      orderId: "ORD2",
      paymentMethod: "CREDIT_CARD",
      paymentStatus: "pending",
      logisticsStatus: "unshipped",
    });

    const req = { params: { orderId: "ORD2" }, body: {} };
    const res = buildRes();

    await adminShipOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "訂單尚未付款，無法出貨",
    });
    expect(logisticsService.createShipment).not.toHaveBeenCalled();
  });

  test("物流 API 回傳錯誤碼時不更新出貨狀態", async () => {
    // P3-10: HTTP 200 但回傳 Error Code (E067)
    orderService.getOrderById.mockResolvedValue({
      orderId: "ORD3",
      paymentMethod: "CREDIT_CARD",
      paymentStatus: "paid",
      logisticsStatus: "unshipped",
    });
    logisticsService.createShipment.mockResolvedValue({
      success: false,
      message: "E067",
    });

    const req = { params: { orderId: "ORD3" }, body: {} };
    const res = buildRes();

    await adminShipOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining("黑貓系統維護中"),
    });
    expect(orderService.shipOrder).not.toHaveBeenCalled();
  });

  test("物流 API 例外時回傳 400 且不更新出貨狀態", async () => {
    // P3-10: HTTP 500 / 連線失敗
    orderService.getOrderById.mockResolvedValue({
      orderId: "ORD4",
      paymentMethod: "CREDIT_CARD",
      paymentStatus: "paid",
      logisticsStatus: "unshipped",
    });
    logisticsService.createShipment.mockRejectedValue(new Error("E072"));

    const req = { params: { orderId: "ORD4" }, body: {} };
    const res = buildRes();

    await adminShipOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining("黑貓系統維護中"),
    });
    expect(orderService.shipOrder).not.toHaveBeenCalled();
  });
});
