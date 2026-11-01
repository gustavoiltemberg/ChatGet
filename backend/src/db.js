const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Garante que a pasta data exista
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chat.db');
const db = new sqlite3.Database(dbPath);

// Criar as tabelas na inicialização
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_color TEXT,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
});

// ================= USUÁRIOS =================

// Busca todos os usuários
function getUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT name, password FROM users', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Busca um usuário específico pelo nome
function getUserByName(name) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE name = ?', [name], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Salva um novo usuário
function saveUser(user) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO users (name, password) VALUES (?, ?)', [user.name, user.password], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// Deleta um usuário pelo nome
function deleteUserByName(name) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE name = ?', [name], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

// ================= MENSAGENS =================

// Busca o histórico de mensagens
function getHistory() {
  return new Promise((resolve, reject) => {
    db.all('SELECT user_id AS userId, user_name AS userName, user_color AS userColor, content, timestamp FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Salva uma nova mensagem (e limita a 100 mensagens no banco)
function saveMessage(msg) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT INTO messages (user_id, user_name, user_color, content, timestamp) VALUES (?, ?, ?, ?, ?)';
    db.run(sql, [msg.userId, msg.userName, msg.userColor || null, msg.content, msg.timestamp], function(err) {
      if (err) return reject(err);
      
      // Limpar mensagens antigas se passar de 100
      db.get('SELECT COUNT(*) AS count FROM messages', [], (err, row) => {
        if (!err && row.count > 100) {
          const excess = row.count - 100;
          const deleteSql = 'DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY timestamp ASC LIMIT ?)';
          db.run(deleteSql, [excess], (deleteErr) => {
            if (deleteErr) reject(deleteErr);
            else resolve();
          });
        } else {
          resolve();
        }
      });
    });
  });
}

// Deleta uma mensagem específica
function deleteMessageByTimestamp(timestamp) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM messages WHERE timestamp = ?', [timestamp], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

// Limpa todo o histórico
function clearAllMessages() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM messages', [], function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  getUsers,
  getUserByName,
  saveUser,
  deleteUserByName,
  getHistory,
  saveMessage,
  deleteMessageByTimestamp,
  clearAllMessages
};