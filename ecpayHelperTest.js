const crypto = require("crypto");

/**
 * 核心演算法：計算 CheckMacValue
 */
function calculateCheckMacValue(params, hashKey, hashIV) {
  // 1) 排序
  const sortedKeys = Object.keys(params).sort();

  // 2) 組合成 key=value 字串
  let checkStr = sortedKeys.map((key) => `${key}=${params[key]}`).join("&");

  // 3) 前後加上 Key 和 IV
  checkStr = `HashKey=${hashKey}&${checkStr}&HashIV=${hashIV}`;

  // 4) URL Encode 並轉為小寫
  let encodedStr = encodeURIComponent(checkStr).toLowerCase();

  // 5) 執行綠界規定的取代規則
  // 注意：這裡必須使用賦值 (=)，或是直接鏈式呼叫到底
  encodedStr = encodedStr
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%20/g, "+") // 空白變成 +
    .replace(/%3d/g, "=") // %3d 還原為 =
    .replace(/%26/g, "&"); // %26 還原為 &

  // Debug: 這裡印出來應該要有 = 和 &，且日期中間是 +
  console.log("🚀 [Final Debug] 加密前字串:", encodedStr);

  // 6) SHA256 加密並轉大寫
  return crypto
    .createHash("sha256")
    .update(encodedStr)
    .digest("hex")
    .toUpperCase();
}

/**
 * 驗證 Webhook (防守)
 */
function verifyCheckMacValue(data, hashKey, hashIV) {
  const receivedCheckMacValue = data.CheckMacValue;
  const params = { ...data };
  delete params.CheckMacValue;

  const myCheckMacValue = calculateCheckMacValue(params, hashKey, hashIV);

  // Log 方便除錯
  if (receivedCheckMacValue !== myCheckMacValue) {
    console.log("❌ 簽章不符！");
    console.log("收到的:", receivedCheckMacValue);
    console.log("計算的:", myCheckMacValue);
  }

  return receivedCheckMacValue === myCheckMacValue;
}

/**
 * 產生訂單 (進攻)
 */
function generateCheckMacValue(params, hashKey, hashIV) {
  return calculateCheckMacValue(params, hashKey, hashIV);
}

module.exports = {
  verifyCheckMacValue,
  generateCheckMacValue,
};
