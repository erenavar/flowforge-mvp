import React, { useState } from "react";
import axios from "axios"; // axios'u import et
import "./App.css";

const API_URL = "http://localhost:3001";

function App() {
  const [prompt, setPrompt] = useState(""); // Kullanıcının girdiği metin
  const [aiResponse, setAiResponse] = useState(""); // AI'dan gelen cevap
  const [isLoading, setIsLoading] = useState(false); // Yükleme durumu

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setAiResponse("");

    try {
      // BFF'deki /generate endpoint'ine POST isteği gönder
      const response = await axios.post(`${API_URL}/generate`, {
        userPrompt: prompt,
      });
      setAiResponse(response.data.aiResponse);
    } catch (error) {
      console.error("Yapay zeka sorgusu gönderilirken hata oluştu:", error);
      setAiResponse("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h2>FlowForge AI Entegrasyonu</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            rows="4"
            cols="60"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Yapay zekadan ne yapmasını istersin?"
          />
          <br />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Düşünüyor..." : "Gönder"}
          </button>
        </form>

        {aiResponse && (
          <div className="response-container">
            <h4>Yapay Zeka'nın Cevabı:</h4>
            <p>{aiResponse}</p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
