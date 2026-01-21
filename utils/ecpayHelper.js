// utils/ecpayHelper.js
const crypto = require("crypto");

/**
 * 核心演算法：計算 CheckMacValue
 */
function calculateCheckMacValue(params, hashKey, hashIV) {
  const processParams = { ...params };
  delete processParams.CheckMacValue;
  delete processParams.HashKey;
  delete processParams.HashIV;

  const sortedKeys = Object.keys(processParams).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const rawParam = sortedKeys
    .map((key) => `${key}=${processParams[key]}`)
    .join("&")
    .toLowerCase();

  const checkStr = `HashKey=${hashKey}&${rawParam}&HashIV=${hashIV}`;

  let encodedStr = encodeURIComponent(checkStr).toLowerCase();
  encodedStr = encodedStr
    .replace(/'/g, "%27")
    .replace(/~/g, "%7e")
    .replace(/%20/g, "+");

  console.log("🚀 [Final] 加密前字串:", encodedStr);

  return crypto
    .createHash("sha256")
    .update(encodedStr)
    .digest("hex")
    .toUpperCase();
}

function verifyCheckMacValue(data, hashKey, hashIV) {
  const receivedCheckMacValue = data.CheckMacValue;

  // 計算
  const myCheckMacValue = calculateCheckMacValue(data, hashKey, hashIV);

  if (receivedCheckMacValue !== myCheckMacValue) {
    console.log("❌ 簽章不符！");
    console.log("收到的:", receivedCheckMacValue);
    console.log("計算的:", myCheckMacValue);
  } else {
    console.log("✅ 簽章驗證通過！");
  }

  return receivedCheckMacValue === myCheckMacValue;
}

function generateCheckMacValue(params, hashKey, hashIV) {
  return calculateCheckMacValue(params, hashKey, hashIV);
}

module.exports = {
  verifyCheckMacValue,
  generateCheckMacValue,
};
