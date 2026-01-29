const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const { Order } = require("../../models/Order");
const { Product } = require("../../models/Product");
const ecpayHelper = require("../../utils/ecpayHelper");

jest.mock("../../utils/ecpayHelper", () => ({
  verifyCheckMacValue: jest.fn(),
}));

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.NODE_ENV = "test";
  process.env.VERCEL = "1";
  process.env.SAFETY_BUFFER = "5";
  process.env.MAX_ORDER_QTY = "10";

  app = require("../../server");
  await mongoose.connection.asPromise();
});

afterEach(async () => {
  await Order.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe("TC-PAY-001 POST /api/orders/payment-notify (success)", () => {
  test("pending -> paid and writes paymentInfo", async () => {
    // 1) 先建一筆 pending order
    await Order.create({
      orderId: "ORD1001",
      amount: 100,
      paymentStatus: "pending",
      deliveryDate: new Date("2025-02-01"),
      customerInfo: {
        name: "Test User",
        phone: "0912345678",
        address: "Taipei",
      },
      items: [
        {
          itemId: "mutton_stew",
          name: "紅燒羊肉",
          price: 100,
          quantity: 1,
        },
      ],
    });

    // 2) mock verifyCheckMacValue 回 true
    ecpayHelper.verifyCheckMacValue.mockReturnValue(true);

    // 3) 送 webhook
    const payload = {
      RtnCode: "1",
      RtnMsg: "Succeeded",
      MerchantTradeNo: "ORD1001",
      CustomField1: "ORD1001", // 讓 controller 用這個 orderId
      TradeNo: "T123",
      PaymentType: "Credit_CreditCard",
      PaymentDate: "2013/03/12 15:30:23",
      CheckMacValue: "DUMMY",
    };

    const res = await request(app)
      .post("/api/orders/payment-notify")
      .send(payload);

    // 4) 斷言 response
    expect(res.text).toBe("1|OK");

    // 5) 斷言 DB
    const updated = await Order.findOne({ orderId: "ORD1001" });
    expect(updated.paymentStatus).toBe("paid");
    expect(updated.paymentInfo).toBeTruthy();
    expect(updated.paymentInfo.TradeNo).toBe("T123");
  });
});

describe("TC-PAY-002 POST /api/orders/payment-notify (fail)", () => {
  test("pending -> failed and restores stock", async () => {
    // 1) 建立一筆 pending order + 先建商品庫存
    const qty = 2;
    const buffer = Number(process.env.SAFETY_BUFFER || 0);
    const initialStock = qty + buffer;

    await Product.create({
      productId: "mutton_stew",
      name: "紅燒羊肉",
      price: 100,
      stock: initialStock,
    });

    await Order.create({
      orderId: "ORD2002",
      amount: 100,
      paymentStatus: "pending",
      deliveryDate: new Date("2025-02-01"),
      customerInfo: {
        name: "Test User",
        phone: "0912345678",
        address: "Taipei",
      },
      items: [
        {
          itemId: "mutton_stew",
          name: "紅燒羊肉",
          price: 100,
          quantity: qty,
        },
      ],
    });

    // 模擬「下單時已扣庫存」
    await Product.updateOne(
      { productId: "mutton_stew" },
      { $inc: { stock: -qty } }
    );

    // 2) mock verifyCheckMacValue 回 true
    ecpayHelper.verifyCheckMacValue.mockReturnValue(true);

    // 3) 送 webhook (失敗)
    const payload = {
      RtnCode: "0",
      RtnMsg: "Failed",
      MerchantTradeNo: "ORD2002",
      CustomField1: "ORD2002",
      TradeNo: "T999",
      PaymentType: "Credit_CreditCard",
      PaymentDate: "2013/03/12 15:30:23",
      CheckMacValue: "DUMMY",
    };

    const res = await request(app)
      .post("/api/orders/payment-notify")
      .send(payload);

    // 4) 斷言 response
    expect(res.text).toBe("1|OK");

    // 5) 斷言 DB
    const updated = await Order.findOne({ orderId: "ORD2002" });
    expect(updated.paymentStatus).toBe("failed");

    const product = await Product.findOne({ productId: "mutton_stew" });
    expect(product.stock).toBe(initialStock);
  });
});

describe("TC-PAY-003 POST /api/orders/payment-notify (invalid signature)", () => {
  test("should reject and keep paymentStatus pending", async () => {
    await Order.create({
      orderId: "ORD3003",
      amount: 100,
      paymentStatus: "pending",
      deliveryDate: new Date("2025-02-01"),
      customerInfo: {
        name: "Test User",
        phone: "0912345678",
        address: "Taipei",
      },
      items: [
        {
          itemId: "mutton_stew",
          name: "紅燒羊肉",
          price: 100,
          quantity: 1,
        },
      ],
    });

    ecpayHelper.verifyCheckMacValue.mockReturnValue(false);

    const payload = {
      RtnCode: "1",
      RtnMsg: "Succeeded",
      MerchantTradeNo: "ORD3003",
      CustomField1: "ORD3003",
      TradeNo: "T3003",
      PaymentType: "Credit_CreditCard",
      PaymentDate: "2013/03/12 15:30:23",
      CheckMacValue: "BAD",
    };

    const res = await request(app)
      .post("/api/orders/payment-notify")
      .send(payload);

    // Controller returns plain text without status code override
    expect(res.text).toBe("0|CheckMacValue Error");

    const updated = await Order.findOne({ orderId: "ORD3003" });
    expect(updated.paymentStatus).toBe("pending");
  });
});

describe("TC-PAY-004 POST /api/orders/payment-notify (idempotency)", () => {
  test("duplicate success webhook should not re-apply side effects", async () => {
    await Order.create({
      orderId: "ORD4004",
      amount: 100,
      paymentStatus: "pending",
      deliveryDate: new Date("2025-02-01"),
      customerInfo: {
        name: "Test User",
        phone: "0912345678",
        address: "Taipei",
      },
      items: [
        {
          itemId: "mutton_stew",
          name: "紅燒羊肉",
          price: 100,
          quantity: 1,
        },
      ],
    });

    ecpayHelper.verifyCheckMacValue.mockReturnValue(true);

    const payload = {
      RtnCode: "1",
      RtnMsg: "Succeeded",
      MerchantTradeNo: "ORD4004",
      CustomField1: "ORD4004",
      TradeNo: "T4004",
      PaymentType: "Credit_CreditCard",
      PaymentDate: "2013/03/12 15:30:23",
      CheckMacValue: "DUMMY",
    };

    // First webhook
    const res1 = await request(app)
      .post("/api/orders/payment-notify")
      .send(payload);
    expect(res1.text).toBe("1|OK");

    // Second webhook (duplicate)
    const res2 = await request(app)
      .post("/api/orders/payment-notify")
      .send(payload);
    expect(res2.text).toBe("1|OK");

    const updated = await Order.findOne({ orderId: "ORD4004" });
    expect(updated.paymentStatus).toBe("paid");
    expect(updated.paymentInfo).toBeTruthy();
    expect(updated.paymentInfo.TradeNo).toBe("T4004");
  });
});
