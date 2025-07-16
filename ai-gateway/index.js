const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001; // React ile çakışmaması için farklı bir port

app.use(cors()); // Farklı portlardan gelen isteklere izin ver
app.use(express.json()); // Gelen JSON verisini işle

// Temel bir test endpoint'i
app.get("/", (req, res) => {
  res.json({ message: "AI Gateway çalışıyor! 🚀" });
});

app.listen(PORT, () => {
  console.log(
    `BFF & AI Gateway http://localhost:${PORT} adresinde başlatıldı.`
  );
});
