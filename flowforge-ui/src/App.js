import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "http://localhost:3001";

function App() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("1/2: Yapay zeka, iş akışı planını üretiyor...");

    try {
      const generateResponse = await axios.post(
        `${API_URL}/generate-workflow`,
        { userPrompt: prompt }
      );
      const workflowJson = generateResponse.data.workflow;

      setStatus("2/2: Plan, n8n üzerinde iş akışına dönüştürülüyor...");

      await axios.post(`${API_URL}/create-n8n-workflow`, {
        workflowData: workflowJson,
      });

      setStatus(
        "Başarılı! Yeni iş akışınız n8n'de oluşturuldu. Kontrol etmek için n8n arayüzündeki 'Workflows' listesini yenileyin."
      );
    } catch (error) {
      console.error("İşlem sırasında hata oluştu:", error);
      setStatus("Bir hata oluştu. Backend loglarını kontrol edin.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h2>FlowForge AI Workflow Generator</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            rows="4"
            cols="70"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Oluşturmak istediğin iş akışını anlat... (Örn: Her 15 dakikada bir ntv.com.tr'yi kontrol et, site çalışmıyorsa 'DOWN' olarak logla)"
            disabled={isLoading}
          />
          <br />
          <button type="submit" disabled={!prompt || isLoading}>
            {isLoading ? "İşlem Sürüyor..." : "İş Akışını Oluştur"}
          </button>
        </form>

        {status && (
          <div className="status-container">
            <h4>İşlem Durumu:</h4>
            <p>{status}</p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
