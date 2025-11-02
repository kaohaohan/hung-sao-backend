// utils/ecpayHelper.js
const crypto = require("crypto");

/**
 * 驗證綠界的簽章
 */
function verifyCheckMacValue(data, hashKey, hashIV) {
  // Step 1: 取出綠界傳來的簽章
  const receivedCheckMacValue = data.CheckMacValue;

  // Step 2: 複製資料，移除 CheckMacValue（計算時不能包含它）
  const params = { ...data };
  delete params.CheckMacValue;

  // Step 3: TODO - 把參數按字母順序排序
  // 提示：Object.keys(params).sort()
  const sortedKeys = Object.keys(params).sort();

  // Step 4: TODO - 組合成字串 key1=value1&key2=value2
  // 提示：用 .map() 和 .join('&')
  let checkStr = sortedKeys
    .map((key) => `${key}=${params[key]}`) // ← 用 key 去 params 裡取值
    .join("&");
  // Step 5: TODO - 前後加上 HashKey 和 HashIV
  checkStr = `HashKey=${hashKey}&${checkStr}&HashIV=${hashIV}`;
  // Step 6: TODO - URL encode
  // 提示：encodeURIComponent()
  checkStr = encodeURIComponent(checkStr);
  // Step 7: TODO - 轉小寫
  checkStr = checkStr.toLowerCase();
  // Step 8: TODO - 還原特殊字元
  // .replace(/%2d/g, '-')
  // .replace(/%5f/g, '_')
  checkStr = checkStr
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%20/g, "+");

  // Step 9: TODO - SHA256 加密
  const hash = crypto.createHash("sha256");
  hash.update(checkStr);
  const myCheckMacValue = hash.digest("hex").toUpperCase();

  // Step 10: TODO - 比對簽章
  console.log("🔐 簽章驗證：");
  console.log("  收到的簽章:", receivedCheckMacValue);
  console.log("  計算的簽章:", myCheckMacValue);
  console.log(
    "  驗證結果:",
    receivedCheckMacValue === myCheckMacValue ? "✅ 通過" : "❌ 失敗"
  );
  return receivedCheckMacValue === myCheckMacValue;
}

module.exports = {
  verifyCheckMacValue,
};
