import http from "k6/http";
import { check } from "k6";

//第一次測直接噴500
// 把vu從50改成5 來看會不會show 500
export const options = {
  scenarios: {
    rush: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: 1,
      maxDuration: "30s",
    },
  },
};

export default function () {
  const url = "http://localhost:8080/api/orders";

  const payload = JSON.stringify({
    items: [
      {
        itemId: "mutton_stew",
        name: "紅燒羊肉",
        price: 100,
        quantity: 1,
      },
    ],
    customerInfo: {
      name: "k6 rush",
      phone: "0912345678",
      address: "Taipei",
    },
    deliveryDate: "2025-02-01",
    paymentMethod: "COD",
    shippingMethod: "HOME_COOL",
    deliveryTime: "anytime",
  });

  const res = http.post(url, payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "status is 200 or 409": (r) => r.status === 200 || r.status === 409,
    "no 500": (r) => r.status !== 500,
  });
}
