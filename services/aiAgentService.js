// services/aiAgentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { calculateProductionNeeds } = require("./productionService");
const { getLowStockProducts } = require("./productService");
const { getOrderStatusSummary } = require("./orderService");
const { getExpiringBatches } = require("./batchService");
const { getProducts } = require("./productService");

// 1. 增強 System Prompt
const SYSTEM_PROMPT = `
你是「紅騷羊肉麵」的智慧生產助理，請用台灣繁體中文回答。
你的角色是協助老闆（爸爸）規劃生產排程。

回答原則：
1. **先講結論**：直接告訴老闆「總共要煮幾鍋」。
2. **數據佐證**：列出缺貨的品項、目前庫存量、以及訂單需求量。
3. **語氣**：專業、令人安心，並適當使用 Emoji (🥘, 📦, ⚠️, ✅)。
4. 如果資料顯示 needToMake 為 0，請恭喜老闆不用煮。
5. 請限制在 3 行內，不要表格
`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. 意圖判斷 - 哈囉
function isGreeting(text) {
  const trimmed = text.trim();
  const greetingRegex = /^(早|哈囉|哈啰|你好|嗨|hi|hello|hey|早安|午安|晚安)$/i;
  return greetingRegex.test(trimmed);
}
function getSmartGreeting() {
  const hour = new Date().getHours(); // 取得現在幾點 (0-23)

  // 1. 根據時間段挑選問候語
  let timeSpecific = [];
  if (hour >= 5 && hour < 11) {
    timeSpecific = [
      "早安老闆！一日之計在於晨，今天備料還順利嗎？☀️",
      "老闆早！今天也要充滿活力喔！💪",
      "早安！記得吃早餐再來忙喔！🥯",
    ];
  } else if (hour >= 11 && hour < 14) {
    timeSpecific = [
      "老闆中午好！午餐時段辛苦了！🍜",
      "中午生意很忙吧？加油加油！🔥",
      "老闆午安，記得找時間休息一下喔！",
    ];
  } else if (hour >= 14 && hour < 18) {
    timeSpecific = [
      "老闆下午好！要不要來杯茶休息一下？🍵",
      "下午好！現在來查庫存剛剛好。📋",
      "老闆辛苦了，下午的備料進度如何？",
    ];
  } else if (hour >= 18 && hour < 22) {
    timeSpecific = [
      "晚上好！晚餐時段衝刺一下！🚀",
      "老闆晚上好，今天生意不錯吧？💰",
      "辛苦了一整天，要不要看看今天的成果？",
    ];
  } else {
    // 深夜時段 (22點以後 ~ 凌晨5點)
    timeSpecific = [
      "老闆，這麼晚還在忙？要注意身體喔！🌙",
      "夜深了，查完庫存早點休息吧！💤",
      "老闆辛苦了！深夜加班別太累了。",
    ];
  }

  // 2. 通用問候語 (隨時都可用)
  const general = [
    "嗨老闆！我是您的 AI 店長，隨時為您服務！🤖",
    "老闆好！今天想關心哪部分的數據呢？📊",
    "哈囉！羊肉爐的庫存我都幫您看著呢！👁️",
    "老闆好！有什麼我可以幫您的嗎？",
  ];

  // 3. 混合兩組清單
  const allGreetings = [...timeSpecific, ...general];

  // 4. 隨機挑選一句
  const randomIndex = Math.floor(Math.random() * allGreetings.length);
  return allGreetings[randomIndex];
}

// 3. 意圖判斷 - 查庫存 Rule-based (保留，用來觸發 RAG)
function isProductionQuery(text) {
  const keywords = [
    "這週",
    "下週",
    "要煮",
    "要出貨",
    "備貨",
    "缺口",
    "幾包",
    "幾鍋",
    "紅騷",
    "當歸",
    "鴨血",
    "羊肉",
    "豆腐",
    "產品",
  ];
  return keywords.some((keyword) => text.includes(keyword));
}

// 3.1 意圖判斷 - 查「鍋數」
function isBatchQuery(text) {
  const keywords = ["幾鍋", "煮幾鍋", "鍋數"];
  return keywords.some((keyword) => text.includes(keyword));
}
// 3.2 意圖判斷 - 查「包數」
function isPackageQuery(text) {
  const keywords = ["幾包"];
  return keywords.some((keyword) => text.includes(keyword));
}
function getProductionIntent(text) {
  if (isPackageQuery(text)) return "package";
  if (isBatchQuery(text)) return "batch";
  return "production";
}
function detectTargetProductId(text) {
  const t = (text || "").trim();

  // 1) 鴨血 / 臭豆腐 → duck_blood
  if (t.includes("鴨血") || t.includes("臭豆腐")) return "duck_blood";

  // 2) 當歸 → angelica_mutton
  // 注意：要在「羊肉」之前判斷，避免「當歸羊肉」被誤判成 mutton_stew
  if (t.includes("當歸")) return "angelica_mutton";

  // 3) 紅騷 / 羊肉 → mutton_stew
  if (t.includes("紅騷") || t.includes("羊肉")) return "mutton_stew";

  return null;
}

function isLowStockQuery(text) {
  return (
    /低庫存|庫存不足|庫存警告|快沒|缺貨/.test(text) ||
    /庫存.*(低|少|不足)/.test(text)
  );
}

function isOrderStatusQuery(text) {
  const keywords = [
    "訂單狀態",
    "狀態總覽",
    "卡在哪",
    "卡住",
    "shipping",
    "arrived",
    "pending",
    "paid",
  ];
  return keywords.some((keyword) => text.includes(keyword));
}

function isExpiryQuery(text) {
  return /即將到期|到期|效期|過期/.test(text);
}
function isStockQuery(text) {
  return /庫存|幾包|剩|還有/.test(text);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function formatLowStockAnswer(items, threshold) {
  if (!items.length) {
    return `目前沒有庫存低於 ${threshold} 的品項。`;
  }
  const lines = [`⚠️ 低庫存警告（< ${threshold}）`];
  for (const item of items) {
    lines.push(`${item.name || item.productId}：剩 ${item.stock} 包`);
  }
  return lines.join("\n");
}

function formatOrderStatusAnswer(summary) {
  const payment = summary.paymentStatus;
  const logistics = summary.logisticsStatus;
  return [
    `付款狀態：pending ${payment.pending}、paid ${payment.paid}、failed ${payment.failed}`,
    `物流狀態：unshipped ${logistics.unshipped}、shipping ${logistics.shipping}、arrived ${logistics.arrived}`,
  ].join("\n");
}

function formatExpiryAnswer(batches, days) {
  if (!batches.length) {
    return `未來 ${days} 天內沒有即將到期的批次。`;
  }
  const lines = [`⚠️ 未來 ${days} 天到期批次`];
  for (const batch of batches) {
    lines.push(
      `${batch.productId}：${formatDate(batch.expDate)} 到期，剩 ${
        batch.quantity
      } 包`
    );
  }
  return lines.join("\n");
}

async function askAgent({ question, startDate, endDate }) {
  try {
    const safeQuestion = (question || "").trim();
    const targetProductId = detectTargetProductId(safeQuestion);
    //先檢查「幾包」，再檢查「幾鍋」，都沒有就當一般生產查詢
    const intent = isPackageQuery(safeQuestion)
      ? "package"
      : isBatchQuery(safeQuestion)
      ? "batch"
      : null;
    // A. 簡單招呼：直接回，不浪費 AI 資源 (Rule-based)
    if (isGreeting(safeQuestion)) {
      return getSmartGreeting();
    }

    if (isOrderStatusQuery(safeQuestion)) {
      const summary = await getOrderStatusSummary();
      return formatOrderStatusAnswer(summary);
    }

    if (isLowStockQuery(safeQuestion)) {
      const threshold = 10;
      const items = await getLowStockProducts(threshold);
      return formatLowStockAnswer(items, threshold);
    }

    if (isExpiryQuery(safeQuestion)) {
      const days = 7;
      const batches = await getExpiringBatches(days);
      return formatExpiryAnswer(batches, days);
    }

    // B. 生產相關問題：混合模式 (RAG)
    //  判斷斷意圖 → 直接呼叫 calculateProductionNeeds()
    //拿到 JSON塞進 prompt
    let productionData = null;
    let isRAG = false;
    let userPrompt = "";
    // 如果命中關鍵字帶入資料

    if (isProductionQuery(safeQuestion)) {
      const intent = getProductionIntent(safeQuestion);

      console.log("🔍 偵測到生產意圖:", intent);
      //productionData 回傳一個物件
      productionData = await calculateProductionNeeds({ startDate, endDate });

      if (productionData && productionData.productionAdvice) {
        //反正假設意圖 是幾鍋那就->看productId 是紅騷跟當歸
        if (intent === "batch") {
          productionData.productionAdvice =
            productionData.productionAdvice.filter(
              (item) =>
                item.productId === "mutton_stew" ||
                item.productId === "angelica_mutton"
            );
          //那假設 是幾包 + 指定品項 只留 targetProductId
        } else if (intent === "package" && targetProductId) {
          productionData.productionAdvice =
            productionData.productionAdvice.filter(
              (item) => item.productId === targetProductId
            );
        }
      }
      isRAG = true;
    }

    if (isStockQuery(safeQuestion)) {
      const products = await getProducts();
      const stockData = products.map((p) => ({
        productId: p.productId,
        name: p.name,
        stock: p.stock,
      }));
    }

    // 準備模型
    // 用gemini 2.5-flash，
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: SYSTEM_PROMPT,
    });
    const intentHint =
      intent === "package"
        ? "只回答包數，不要換算鍋數。"
        : intent === "batch"
        ? "請回答鍋數。"
        : "";

    // 組合 Prompt：這是 RAG 的精髓
    // 我們告訴 AI：「這是使用者的問題」以及「這是剛出爐的數據」
    if (isRAG && productionData) {
      userPrompt = `
【使用者問題】：${safeQuestion}
${intentHint ? `【回覆規則】：${intentHint}` : ""}
【後台即時數據 (JSON)】：
${JSON.stringify(productionData, null, 2)}
請根據上述數據回答。
`;
    } else {
      userPrompt = `
【使用者問題】：${safeQuestion}
注意：目前沒有提供後台數據。
如果問題不明確，請反問是否要查「庫存」「訂單」或「備貨」。
`;
    }

    // 呼叫 Gemini
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("Gemini error:", err.message);
    return "❌ AI 腦袋打結了，請檢查後端 Log。";
  }
}

module.exports = { askAgent };
