import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";

// Backend servisimizin adresi
const API_URL = "http://localhost:3001";

function App() {
  // Backend'den gelen mesajı saklamak için bir state
  const [message, setMessage] = useState("");

  // Bu hook, bileşen ilk yüklendiğinde sadece bir kez çalışır
  useEffect(() => {
    // BFF'e istek atacak asenkron bir fonksiyon
    const fetchMessage = async () => {
      try {
        const response = await fetch(`${API_URL}/`); // Ana endpoint'e GET isteği at
        const data = await response.json();
        setMessage(data.message); // Gelen mesajı state'e ata
      } catch (error) {
        console.error("API'ye bağlanırken hata oluştu:", error);
        setMessage(
          "Backend'e bağlanılamadı. (Sunucunun çalıştığından emin misin?)"
        );
      }
    };

    fetchMessage(); // Fonksiyonu çağır
  }, []); // Boş dependency array'i, bu etkinin sadece bir kez çalışmasını sağlar

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h2>FlowForge MVP</h2>
        <p>
          Backend'den Gelen Mesaj: <strong>{message || "Yükleniyor..."}</strong>
        </p>
      </header>
    </div>
  );
}

export default App;
