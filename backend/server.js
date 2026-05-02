


const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const SECRET = process.env.JWT_SECRET || "dev";

// 🔌 SOCKET
io.on("connection", (socket) => {
  socket.on("localizacao", (data) => {
    socket.broadcast.emit("atualizacao", data);
  });
});

// 🔐 AUTH
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.sendStatus(401);

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.sendStatus(403);
  }
}

// 📝 REGISTER
app.post("/register", async (req, res) => {
  try {
    const { nome, email, senha, tipo } = req.body;

    const hash = await bcrypt.hash(senha, 10);

    await pool.query(
      "INSERT INTO users (nome,email,senha,tipo) VALUES ($1,$2,$3,$4)",
      [nome, email, hash, tipo]
    );

    res.json({ ok: true });

  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao cadastrar (email pode já existir)" });
  }
});

// 🔑 LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    const user = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (!user.rows.length) return res.sendStatus(404);

    const valid = await bcrypt.compare(senha, user.rows[0].senha);
    if (!valid) return res.sendStatus(401);

    const token = jwt.sign(
      { id: user.rows[0].id, tipo: user.rows[0].tipo },
      SECRET
    );

    res.json({
      token,
      id: user.rows[0].id,
      tipo: user.rows[0].tipo
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro no login" });
  }
});

// 📦 CRIAR CHAMADO (COMPLETO)
app.post("/chamados", auth, async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const {
      descricao,
      lat,
      lng,
      tipo_servico,
      prioridade,
      pagamento,
      valor
    } = req.body;

    if (!descricao || !tipo_servico || !prioridade || !pagamento) {
      return res.status(400).json({ erro: "Dados incompletos" });
    }

    const result = await pool.query(
      `INSERT INTO chamados 
      (cliente_id, descricao, lat, lng, tipo_servico, prioridade, pagamento, valor, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'aberto')
      RETURNING id`,
      [
        req.user.id,
        descricao,
        lat,
        lng,
        tipo_servico,
        prioridade,
        pagamento,
        valor
      ]
    );

    res.json({ id: result.rows[0].id });

  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao criar chamado" });
  }
});

// 📦 LISTAR CHAMADOS
app.get("/chamados", async (req, res) => {
  const r = await pool.query(`
    SELECT 
      c.*,
      (c.valor * 0.93) as valor_profissional
    FROM chamados c
    ORDER BY c.id DESC
  `);

  res.json(r.rows);
});

// ✅ ACEITAR CHAMADO
app.put("/chamados/:id/aceitar", auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE chamados SET status='aceito', profissional_id=$1 WHERE id=$2",
      [req.user.id, req.params.id]
    );

    io.emit("chamadoAceito", {
      id: req.params.id,
      profissional_id: req.user.id
    });

    res.json({ ok: true });

  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao aceitar chamado" });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor ON na porta " + PORT);
});