require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { CohereClient } = require("cohere-ai");
const { v4: uuidv4 } = require("uuid"); // Benzersiz ID'ler üretmek için

const app = express();
const PORT = process.env.PORT || 3001;
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

app.use(cors());
app.use(express.json());

// --- YENİ MİMARİ: ÇEVİRİCİ FONKSİYON ---
// Bu fonksiyon, AI'dan gelen basit AWM'yi alır ve mükemmel n8n JSON'una dönüştürür.
function buildN8nWorkflow(awm) {
  const nodes = [];
  const connections = {};

  // 1. Start Node'u her zaman var
  const startNodeId = uuidv4();
  nodes.push({
    parameters: {},
    id: startNodeId,
    name: "Start",
    type: "n8n-nodes-base.start",
    typeVersion: 1,
    position: [250, 300],
  });

  // 2. Tetikleyici (Trigger) Node'unu oluştur
  let triggerNode;
  if (awm.trigger?.type === "schedule") {
    triggerNode = {
      parameters: { rule: { interval: [{ unit: "hours" }] } }, // Saatlik için basit bir kural
      id: uuidv4(),
      name: "Schedule Trigger",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.1,
      position: [500, 300],
    };
    nodes.push(triggerNode);
  }
  // Buraya gelecekte başka trigger'lar eklenebilir (örn: gmail, webhook)

  // 3. Eylem (Action) Node'larını oluştur ve bağla
  let previousNode = triggerNode;
  awm.actions?.forEach((action, index) => {
    let currentNode;
    if (action.type === "httpRequest") {
      currentNode = {
        parameters: { url: action.url, responseFormat: "string" },
        id: uuidv4(),
        name: `HTTP Request: ${action.url}`,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.1,
        position: [750 + index * 250, 300],
      };
    }
    // Buraya gelecekte başka action'lar eklenebilir (slack, log vb.)

    if (currentNode) {
      nodes.push(currentNode);
      // Bir önceki node'u şimdikine bağla
      if (previousNode) {
        connections[previousNode.name] = {
          main: [[{ node: currentNode.name, type: "main" }]],
        };
      }
      previousNode = currentNode;
    }
  });

  return {
    name: awm.name || "AI Generated Workflow",
    nodes: nodes,
    connections: connections,
    settings: {},
  };
}

app.post("/generate-workflow", async (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt)
    return res.status(400).json({ error: "Lütfen bir metin girin." });

  // YENİ META-PROMPT: Artık basit AWM formatını üretmesini istiyoruz
  const metaPrompt = `
    Sen, doğal dildeki istekleri, sadece trigger ve action adımlarını içeren çok basit bir JSON formatına çeviren bir uzmansın.
    Kullanıcının isteği: "${userPrompt}"

    Analiz et ve aşağıdaki formatta bir JSON üret:
    {
      "name": "Kullanıcının isteğine uygun kısa bir başlık",
      "trigger": { "type": "schedule" | "webhook" | "gmail" ... },
      "actions": [ { "type": "httpRequest", "url": "..." }, { "type": "logMessage", "message": "..." } ... ]
    }
    SADECE JSON üret.
  `;

  try {
    const response = await cohere.generate({
      model: "command-r-plus",
      prompt: metaPrompt,
      maxTokens: 1024,
      temperature: 0,
    });

    const rawResponseText = response.generations[0].text;
    console.log(
      "--- AI'dan Gelen Ham AWM Cevabı ---\n",
      rawResponseText,
      "\n----------------------------------"
    );

    const abstractWorkflowModel = JSON.parse(rawResponseText);

    // ADIM B: Basit AWM'yi alıp mükemmel n8n JSON'una çeviriyoruz.
    const finalN8nJson = buildN8nWorkflow(abstractWorkflowModel);

    console.log(
      "--- Üretilen Nihai n8n JSON ---\n",
      JSON.stringify(finalN8nJson, null, 2),
      "\n---------------------------------"
    );

    res.json({ workflow: finalN8nJson });
  } catch (error) {
    console.error("!!! AWM İŞLENİRKEN HATA OLUŞTU !!!", error);
    res.status(500).json({ error: "Yapay zeka geçerli bir AWM üretemedi." });
  }
});

app.post("/create-n8n-workflow", async (req, res) => {
  // Bu endpoint'te değişiklik yok, olduğu gibi kalıyor.
  const { workflowData } = req.body;
  if (!workflowData)
    return res.status(400).json({ error: "Workflow verisi eksik." });
  try {
    const n8nApiUrl = "http://localhost:5678/api/v1/workflows";
    const n8nApiKey = process.env.N8N_API_KEY;
    const response = await axios.post(n8nApiUrl, workflowData, {
      headers: { "X-N8N-API-KEY": n8nApiKey },
    });
    res.json(response.data);
  } catch (error) {
    console.error(
      "!!! n8n'e WORKFLOW KAYDEDİLİRKEN HATA OLUŞTU !!!",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "n8n üzerinde workflow oluşturulamadı." });
  }
});

app.listen(PORT, () => {
  console.log(
    `BFF & AI Gateway http://localhost:${PORT} adresinde başlatıldı.`
  );
});
