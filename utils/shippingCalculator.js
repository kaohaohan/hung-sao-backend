// 引用剛建立的後端 config
const { PRODUCT_VOLUME, DEFAULT_VOLUME } = require("../config/productVolume");

// 箱子規則 (這也是商業邏輯，後端要有一份)
const BOX_RULES = [
  { maxPoints: 2, price: 160, name: "小箱" },
  { maxPoints: 6, price: 240, name: "中箱" },
  { maxPoints: 12, price: 290, name: "大箱" },
];

function calculateServerShipping(items, shippingMethod) {
  // 1. 如果是店取，運費 0
  if (shippingMethod === "STORE_PICKUP") return 0;

  // 2. 計算總體積點數
  let totalPoints = 0;

  // 注意：這裡 items 的結構取決於你傳給後端的物件
  // 通常是 { itemId: "...", quantity: 5, ... }
  items.forEach((item) => {
    // 取得該商品的體積點數，沒有就用預設值
    const points = PRODUCT_VOLUME[item.itemId] || DEFAULT_VOLUME;
    totalPoints += points * item.quantity;
  });

  // 3. 計算運費 (邏輯跟前端一模一樣)
  let remainingPoints = totalPoints;
  let totalFee = 0;

  // 如果一點都沒買
  if (totalPoints === 0) return 0;

  while (remainingPoints > 0) {
    if (remainingPoints > 12) {
      totalFee += 290;
      remainingPoints -= 12;
    } else {
      const box = BOX_RULES.find((rule) => remainingPoints <= rule.maxPoints);
      if (box) {
        totalFee += box.price;
        remainingPoints = 0;
      } else {
        totalFee += 290;
        remainingPoints = 0;
      }
    }
  }

  return totalFee;
}

module.exports = { calculateServerShipping };
