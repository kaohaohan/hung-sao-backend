import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
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
      name: "k6 smoke",
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
    "status is 200": (r) => r.status === 200,
  });
}
