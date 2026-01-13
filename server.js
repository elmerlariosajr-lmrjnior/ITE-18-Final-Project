const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all files in this folder (models, sounds, textures, js, css)
app.use(express.static(path.join(__dirname)));

// Serve main game page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Eco Rescue Ranger running at http://localhost:${PORT}`);
});
