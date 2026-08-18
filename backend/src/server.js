import "dotenv/config";
import { app } from "./app.js";
import { initDatabase } from "./config/initDatabase.js";

const port = process.env.PORT || 4000;

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend rodando em http://localhost:${port} (DATA_SOURCE=${process.env.DATA_SOURCE || "mock"})`);
    });
  })
  .catch((err) => {
    console.error("Falha ao inicializar banco de dados:", err);
    process.exit(1);
  });
