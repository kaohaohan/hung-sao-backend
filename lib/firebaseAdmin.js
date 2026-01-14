const admin = require("firebase-admin");

function loadServiceAccount() {
    //有FIREBASE_SERVICE_ACCOUNT
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const config = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (config.private_key) {
        config.private_key = config.private_key.replace(/\\n/g, "\n");
      }
      return config;
    } catch (e) {
      console.error("JSON 解析失敗，請檢查 Vercel 環境變數格式");
      return null;
    }
  }

  try {
    return require("../firebase-adminsdk.json");
  } catch (error) {
    return null;
  }
}

const serviceAccount = loadServiceAccount();

// 只有在成功拿到憑證時才初始化
if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Firebase Admin 初始化成功");
} else if (!serviceAccount) {
  console.error("❌ 無法初始化 Firebase：找不到憑證");
}

module.exports = admin;
