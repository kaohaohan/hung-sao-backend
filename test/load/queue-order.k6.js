import http from "k6/http";
import { check, sleep } from "k6";

// k6 - Redis + BullMQ (queued) load test
//
// Goal:
// - Under concurrent order creation, API should stay stable:
//   - 202 (queued) or 409 (out of stock) are acceptable
//   - 500 should NOT happen
//
// Usage examples:
//   k6 run test/load/queue-order.k6.js
//   BASE_URL=http://localhost:8080 VUS=50 ITERS=1 ITEM_ID=angelica_mutton QTY=1 k6 run test/load/queue-order.k6.js

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const VUS = Number(__ENV.VUS || 5);
const ITERS = Number(__ENV.ITERS || 1);

const ITEM_ID = __ENV.ITEM_ID || "angelica_mutton";
const ITEM_NAME = __ENV.ITEM_NAME || "Angelica Mutton";
const PRICE = Number(__ENV.PRICE || 750);
const QTY = Number(__ENV.QTY || 1);

export const options = {
  scenarios: {
    rush: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: ITERS,
      maxDuration: "1m",
    },
  },
  thresholds: {
    // Treat 409 (out of stock) as an expected response, so it won't count as http_req_failed.
    http_req_failed: ["rate<0.01"], // unexpected failures should be very rare
    http_req_duration: ["p(95)<2000"], // keep API response reasonably fast (tune as needed)
    checks: ["rate>0.99"],
  },
};

// By default, k6 considers 4xx/5xx as "failed" (http_req_failed). In this system,
// 409 (out of stock) is an expected business outcome, so we whitelist it here.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 409));

export default function () {
  const url = `${BASE_URL}/api/orders`;

  const payload = JSON.stringify({
    items: [
      {
        itemId: ITEM_ID,
        name: ITEM_NAME,
        price: PRICE,
        quantity: QTY,
      },
    ],
    customerInfo: {
      name: "k6",
      phone: "0912345678",
      address: "Taipei",
    },
    deliveryDate: "2026-02-01",
    paymentMethod: "COD",
    shippingMethod: "HOME_COOL",
    deliveryTime: "anytime",
  });

  const res = http.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: "30s",
  });

  const ok = check(res, {
    "status is 202 or 409": (r) => r.status === 202 || r.status === 409,
    "no 500": (r) => r.status !== 500,
    "202 returns queued json": (r) => {
      if (r.status !== 202) return true;
      try {
        const body = r.json();
        return body && body.status === "queued" && typeof body.orderId === "string";
      } catch (_) {
        return false;
      }
    },
  });

  // Small pacing to avoid all VUs re-hitting at the exact same millisecond when ITERS > 1.
  if (!ok) sleep(0.1);
}
