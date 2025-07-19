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
    position: [80, 300],
  };
  nodes.push(startNode);

  let triggerNode;
  if (awm.trigger?.type === "schedule") {
    triggerNode = {
      parameters: {
        rule: {
          interval: [
            {
              unit: awm.trigger.unit || "minutes",
              value: awm.trigger.interval || 15,
            },
          ],
        },
      },
      id: uuidv4(),
      name: "Schedule Trigger",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.1,
      position: [250, 300],
    };
    nodes.push(triggerNode);
  }

  let previousNodeId = triggerNode?.id;

  awm.actions?.forEach((action) => {
    if (action.type === "website_check") {
      const httpRequestNode = {
        parameters: {
          url: action.url,
          responseFormat: "string",
          options: { ignoreSslIssues: true },
        },
        id: uuidv4(),
        name: `Check URL: ${action.url}`,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.1,
        position: [500, 300],
      };

      const ifNode = {
        parameters: {
          conditions: {
            boolean: [
              {
                value1: "={{ $json.statusCode }}",
                operation: "equal",
                value2: 200,
              },
            ],
          },
        },
        id: uuidv4(),
        name: "Is Site Up?",
        type: "n8n-nodes-base.if",
        typeVersion: 1,
        position: [750, 300],
      };

      const successNode = {
        parameters: {
          operation: "executeQuery",
          query: `INSERT INTO logs (source, content) VALUES ('${action.url}', '${action.onSuccess.message}')`,
        },
        id: uuidv4(),
        name: "Log Success",
        type: "n8n-nodes-base.postgres",
        typeVersion: 5.1,
        position: [1000, 200],
        credentials: {
          postgres: {
            id: process.env.N8N_POSTGRES_CREDENTIAL_ID,
            name: "Postgres Credential",
          },
        },
      };

      const failureNode = {
        parameters: {
          operation: "executeQuery",
          query: `INSERT INTO logs (source, content) VALUES ('${action.url}', '${action.onFailure.message}')`,
        },
        id: uuidv4(),
        name: "Log Failure",
        type: "n8n-nodes-base.postgres",
        typeVersion: 5.1,
        position: [1000, 400],
        credentials: {
          postgres: {
            id: process.env.N8N_POSTGRES_CREDENTIAL_ID,
            name: "Postgres Credential",
          },
        },
      };

      nodes.push(httpRequestNode, ifNode, successNode, failureNode);

      if (previousNodeId) {
        connections[previousNodeId] = {
          main: [[{ node: httpRequestNode.id, type: "main" }]],
        };
      }
      connections[httpRequestNode.id] = {
        main: [[{ node: ifNode.id, type: "main" }]],
      };
      connections[ifNode.id] = {
        main: [
          [{ node: successNode.id, type: "main" }], // Output 0 -> True
          [{ node: failureNode.id, type: "main" }], // Output 1 -> False
        ],
      };
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

app.post("/generate-workflow", async (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt)
    return res.status(400).json({ error: "Lütfen bir metin girin." });

  const metaPrompt = `
    Sen, doğal dildeki istekleri, aşağıda belirtilen "kullanılabilir araçlar" listesindeki eylemleri kullanarak basit bir JSON formatına (AWM) çeviren bir uzmansın.
    Kullanıcının isteği: "${userPrompt}"

    Kullanılabilir Araçlar ve Formatları:
    - schedule: Zamanlanmış görev. Örn: { "type": "schedule", "unit": "minutes", "interval": 15 }
    - website_check: Bir sitenin çalışıp çalışmadığını kontrol eder ve sonuca göre farklı loglar atar.
      Örn: { "type": "website_check", "url": "https://site.com", "onSuccess": { "message": "Site ayakta" }, "onFailure": { "message": "Site çöktü" } }
    
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

    const rawResponseText = response.generations[0].text.trim();
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
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    await axios.post(n8nWebhookUrl, workflowData);
    res.json({
      message: "Workflow creation request sent to n8n successfully.",
    });
  } catch (error) {
    console.error(
      "!!! n8n Webhook'una gönderilirken HATA OLUŞTU !!!",
      error.response?.data || error.message
    );
    res
      .status(500)
      .json({ error: "n8n webhook üzerinde workflow oluşturulamadı." });
  }
});

// --- SUNUCUYU BAŞLATMA ---
app.listen(PORT, () => {
  console.log(
    `BFF & AI Gateway http://localhost:${PORT} adresinde başlatıldı.`
  );
});
