require("dotenv").config(); // .env dosyasındaki değişkenleri yükler
const express = require("express");
const cors = require("cors");
const { CohereClient } = require("cohere-ai");

const app = express();
const PORT = 3001;

// Cohere client'ını API anahtarıyla başlat
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "AI Gateway çalışıyor! 🚀" });
});

// YENİ ENDPOINT: Yapay zeka'ya istek gönderecek
app.post("/generate", async (req, res) => {
  const { userPrompt } = req.body;

  if (!userPrompt) {
    return res.status(400).json({ error: "Lütfen bir metin girin." });
  }

  try {
    const response = await cohere.generate({
      model: "command-r-plus",
      prompt: `Kullanıcının şu isteğini basit bir şekilde yanıtla: "${userPrompt}"`,
      maxTokens: 100,
    });

    // Gelen cevabı frontend'e gönder
    res.json({ aiResponse: response.generations[0].text });
  } catch (error) {
    console.error("Yapay zeka sorgusunda hata:", error);
    res.status(500).json({ error: "Yapay zeka modeline ulaşılamadı." });
  }
});

app.listen(PORT, () => {
  console.log(
    `BFF & AI Gateway http://localhost:${PORT} adresinde başlatıldı.`
  );
});
