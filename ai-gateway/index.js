require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { CohereClient } = require("cohere-ai");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3001;
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

app.use(cors());
app.use(express.json());

// --- ÇEVİRİCİ FONKSİYON ---
function buildN8nWorkflow(awm) {
  const nodes = [];
  const connections = {};

  const startNode = {
    parameters: {},
    id: uuidv4(),
    name: "Start",
    type: "n8n-nodes-base.start",
    typeVersion: 1,
    position: [250, 300],
  };
  nodes.push(startNode);

  let triggerNode;
  if (awm.trigger?.type === "schedule") {
    triggerNode = {
      parameters: {
        rule: { interval: [{ unit: awm.trigger.unit || "hours" }] },
      },
      id: uuidv4(),
      name: "Schedule Trigger",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.1,
      position: [500, 300],
    };
    nodes.push(triggerNode);
  }

  let previousNodeId = triggerNode?.id;

  awm.actions?.forEach((action, index) => {
    let currentNode;
    const position = [750 + index * 250, 300];

    if (action.type === "httpRequest") {
      currentNode = {
        parameters: { url: action.url, responseFormat: "string" },
        id: uuidv4(),
        name: `HTTP Request: ${action.url}`,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.1,
        position: position,
      };
    } else if (action.type === "database_insert") {
      const contentToInsert =
        action.data || `Data received at ${new Date().toISOString()}`;
      currentNode = {
        parameters: {
          operation: "executeQuery",
          query: `INSERT INTO logs (source, content) VALUES ('${
            action.source || "unknown"
          }', '${contentToInsert}')`,
        },
        id: uuidv4(),
        name: `Save to DB: ${action.table}`,
        type: "n8n-nodes-base.postgresDb",
        typeVersion: 2.2,
        position: position,
        credentials: {
          postgresDb: {
            id: process.env.N8N_POSTGRES_CREDENTIAL_ID,
            name: "Postgres Credential",
          },
        },
      };
    }

    if (currentNode) {
      nodes.push(currentNode);
      if (previousNodeId) {
        connections[previousNodeId] = {
          main: [[{ node: currentNode.id, type: "main" }]],
        };
      }
      previousNodeId = currentNode.id;
    }
  });

  return {
    name: awm.name || "AI Generated Workflow",
    nodes: nodes,
    connections: connections,
    settings: {},
  };
}

// --- API ENDPOINT'LERİ ---

app.get("/", (req, res) => {
  res.json({ message: "AI Gateway çalışıyor! 🚀" });
});

app.post("/generate-workflow", async (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt)
    return res.status(400).json({ error: "Lütfen bir metin girin." });

  const metaPrompt = `
    Sen, doğal dildeki istekleri, aşağıda belirtilen "kullanılabilir araçlar" listesindeki eylemleri kullanarak basit bir JSON formatına (AWM) çeviren bir uzmansın.
    Kullanıcının isteği: "${userPrompt}"

    Kullanılabilir Araçlar ve Formatları:
    - schedule: Zamanlanmış görev. Örn: { "type": "schedule", "unit": "hours" | "minutes" | "days" }
    - httpRequest: Bir web sitesine istek atar. Örn: { "type": "httpRequest", "url": "https://site.com" }
    - database_insert: Veritabanına log kaydı atar. Örn: { "type": "database_insert", "table": "logs", "source": "kaynak_adi" }
    
    Kullanıcının isteğini analiz et ve SADECE yukarıdaki araçları kullanarak aşağıdaki AWM formatında bir JSON üret.
    Format: { "name": "...", "trigger": { ... }, "actions": [ { ... } ] }
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

// --- SUNUCUYU BAŞLATMA ---
app.listen(PORT, () => {
  console.log(
    `BFF & AI Gateway http://localhost:${PORT} adresinde başlatıldı.`
  );
});
