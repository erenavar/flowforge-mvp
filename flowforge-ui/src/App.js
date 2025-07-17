import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "http://localhost:3001";
const N8N_URL = "http://localhost:5678";

function App() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState(""); // Durum mesajı için
  const [newWorkflowUrl, setNewWorkflowUrl] = useState(""); // Yeni workflow linki
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setNewWorkflowUrl("");
    setStatus("1/2: Yapay zeka workflow üretiyor...");

    try {
      // Adım 1: AI'dan workflow JSON'unu al
      const generateResponse = await axios.post(
        `${API_URL}/generate-workflow`,
        { userPrompt: prompt }
      );
      const workflowJson = generateResponse.data.workflow;

      setStatus("2/2: Workflow n8n'e kaydediliyor...");

      // Adım 2: Üretilen JSON'u n8n'e gönder
      const createResponse = await axios.post(
        `${API_URL}/create-n8n-workflow`,
        { workflowData: workflowJson }
      );
      const newWorkflowId = createResponse.data.id;

      setNewWorkflowUrl(`${N8N_URL}/workflow/${newWorkflowId}`);
      setStatus("Başarılı! İş akışınız oluşturuldu.");
    } catch (error) {
      console.error("İşlem sırasında hata oluştu:", error);
      setStatus("Bir hata oluştu. Lütfen tekrar deneyin.");
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
            placeholder="Oluşturmak istediğin iş akışını anlat..."
          />
          <br />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "İşlem Sürüyor..." : "İş Akışını Oluştur ve Kaydet"}
          </button>
        </form>

        {status && (
          <div className="status-container">
            <h4>İşlem Durumu:</h4>
            <p>{status}</p>
            {newWorkflowUrl && (
              <a
                href={newWorkflowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="workflow-link">
                Oluşturulan İş Akışını Görüntüle ve Aktive Et
              </a>
            )}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
