const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const { Product } = require("../../models/Product");
const { Order } = require("../../models/Order");

//開一個箱子存in-memory Mongo instance
let mongoServer;
//存express app打API用
let app;

//整份檔案做一次 setup 初始化  MongoMemory ->啟動 -> 讓server用“test"DB
//注意 我們有用MongoDB Transaction 所以要在 Replica Set 上跑他能允許 transaction
beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.NODE_ENV = "test";
  process.env.VERCEL = "1";
  process.env.SAFETY_BUFFER = "5";
  process.env.MAX_ORDER_QTY = "10";

  // Import after env setup so server connects to memory DB.
  app = require("../../server");
  await mongoose.connection.asPromise();
});

afterEach(async () => {
  await Order.deleteMany({});
  await Product.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("POST /api/orders (COD)", () => {
  test("success: stock = qty + buffer (just enough)", async () => {
    const qty = 2;
    const buffer = Number(process.env.SAFETY_BUFFER || 0);
    const initialStock = qty + buffer;

    // 模擬測試資料：庫存剛好滿足 safety buffer
    await Product.create({
      productId: "mutton_stew",
      name: "紅燒羊肉",
      price: 100,
      stock: initialStock,
    });

    const payload = {
      items: [
        {
          itemId: "mutton_stew",
          name: "紅燒羊肉",
          price: 100,
          quantity: qty,
        },
      ],
      customerInfo: {
        name: "Test User",
        phone: "0912345678",
        address: "Taipei",
      },
      deliveryDate: "2025-02-01",
      paymentMethod: "COD",
      shippingMethod: "HOME_COOL",
      deliveryTime: "anytime",
    };

    const res = await request(app).post("/api/orders").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toMatch(/^ORD/);

    const order = await Order.findOne({ orderId: res.body.orderId });
    expect(order).toBeTruthy();
    expect(order.paymentStatus).toBe("pending");

    const product = await Product.findOne({ productId: "mutton_stew" });
    expect(product.stock).toBe(initialStock - qty);
  });

  test("fail: stock = qty + buffer - 1 (should 409)", async () => {
    const qty = 2;
    const buffer = Number(process.env.SAFETY_BUFFER || 0);
    const initialStock = qty + buffer - 1;

    await Product.create({
      productId: "mutton_stew",
      name: "紅燒羊肉",
      price: 100,
      stock: initialStock,
    });

    const payload = {
      items: [
        {
          itemId: "mutton_stew",
          name: "紅燒羊肉",
          price: 100,
          quantity: qty,
        },
      ],
      customerInfo: {
        name: "Test User",
        phone: "0912345678",
        address: "Taipei",
      },
      deliveryDate: "2025-02-01",
      paymentMethod: "COD",
      shippingMethod: "HOME_COOL",
      deliveryTime: "anytime",
    };

    const res = await request(app).post("/api/orders").send(payload);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("庫存不足");

    expect(await Order.countDocuments({})).toBe(0);

    const product = await Product.findOne({ productId: "mutton_stew" });
    expect(product.stock).toBe(initialStock);
  });
});
