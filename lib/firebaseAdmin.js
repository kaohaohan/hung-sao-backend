const admin = require("firebase-admin");
const serviceAccount = require("../firebase-adminsdk.json"); // 路徑根據你的資料夾結構調整

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
