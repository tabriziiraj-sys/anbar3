export interface ProjectFile {
  path: string;
  content: string;
}

export const projectFiles: ProjectFile[] = [
  {
    path: 'server.js',
    content: `require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'my-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'لطفاً وارد شوید' });
  }
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'دسترسی غیرمجاز' });
  }
}

// Create default admin
function createDefaultAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || '123456';
  
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)').run(
      'مدیر سیستم', adminUsername, hash, 'admin'
    );
    console.log('Admin user created successfully');
  }
}

// ============ AUTH API ============

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
  }
  
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
  }
  
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.name = user.name;
  req.session.role = user.role;
  
  res.json({ 
    message: 'ورود موفق',
    user: { id: user.id, name: user.name, username: user.username, role: user.role }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'خروج موفق' });
});

app.get('/api/me', requireLogin, (req, res) => {
  res.json({
    user: {
      id: req.session.userId,
      name: req.session.name,
      username: req.session.username,
      role: req.session.role
    }
  });
});

// ============ RECORDS API ============

app.get('/api/records', requireLogin, (req, res) => {
  const search = req.query.search || '';
  let records;
  
  if (search) {
    records = db.prepare(\`
      SELECT r.*, u.name as created_by_name 
      FROM records r 
      LEFT JOIN users u ON r.created_by = u.id 
      WHERE r.title LIKE ? OR r.description LIKE ?
      ORDER BY r.created_at DESC
    \`).all(\`%\${search}%\`, \`%\${search}%\`);
  } else {
    records = db.prepare(\`
      SELECT r.*, u.name as created_by_name 
      FROM records r 
      LEFT JOIN users u ON r.created_by = u.id 
      ORDER BY r.created_at DESC
    \`).all();
  }
  
  res.json({ records });
});

app.post('/api/records', requireLogin, (req, res) => {
  const { title, description } = req.body;
  
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'عنوان الزامی است' });
  }
  
  const result = db.prepare(
    'INSERT INTO records (title, description, created_by) VALUES (?, ?, ?)'
  ).run(title.trim(), (description || '').trim(), req.session.userId);
  
  res.json({ message: 'رکورد ایجاد شد', id: result.lastInsertRowid });
});

app.put('/api/records/:id', requireLogin, (req, res) => {
  const { title, description } = req.body;
  const id = req.params.id;
  
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'عنوان الزامی است' });
  }
  
  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
  if (!record) {
    return res.status(404).json({ error: 'رکورد یافت نشد' });
  }
  
  db.prepare(
    'UPDATE records SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(title.trim(), (description || '').trim(), id);
  
  res.json({ message: 'رکورد بروزرسانی شد' });
});

app.delete('/api/records/:id', requireLogin, (req, res) => {
  const id = req.params.id;
  
  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
  if (!record) {
    return res.status(404).json({ error: 'رکورد یافت نشد' });
  }
  
  db.prepare('DELETE FROM records WHERE id = ?').run(id);
  res.json({ message: 'رکورد حذف شد' });
});

// ============ USERS API ============

app.get('/api/users', requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, name, username, role, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json({ users });
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { name, username, password, role } = req.body;
  
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'تمام فیلدها الزامی است' });
  }
  
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'نقش نامعتبر است' });
  }
  
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'این نام کاربری قبلاً ثبت شده' });
  }
  
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), username.trim(), hash, role);
  
  res.json({ message: 'کاربر ایجاد شد', id: result.lastInsertRowid });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  
  if (parseInt(id) === req.session.userId) {
    return res.status(400).json({ error: 'نمی‌توانید خودتان را حذف کنید' });
  }
  
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'کاربر یافت نشد' });
  }
  
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: 'کاربر حذف شد' });
});

// ============ DASHBOARD API ============

app.get('/api/dashboard', requireLogin, (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const recordCount = db.prepare('SELECT COUNT(*) as count FROM records').get().count;
  const recentRecords = db.prepare(\`
    SELECT r.*, u.name as created_by_name 
    FROM records r 
    LEFT JOIN users u ON r.created_by = u.id 
    ORDER BY r.created_at DESC 
    LIMIT 5
  \`).all();
  
  res.json({ userCount, recordCount, recentRecords });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
createDefaultAdmin();

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
  console.log(\`Open http://localhost:\${PORT} in your browser\`);
});
`
  },
  {
    path: 'database.js',
    content: `const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './data/app.db';

// Create directory if not exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(\`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
\`);

module.exports = db;
`
  },
  {
    path: 'package.json',
    content: JSON.stringify({
      "name": "simple-web-app",
      "version": "1.0.0",
      "description": "Simple web application with Express and SQLite",
      "main": "server.js",
      "scripts": {
        "start": "node server.js",
        "dev": "node server.js"
      },
      "dependencies": {
        "express": "^4.18.2",
        "better-sqlite3": "^9.4.3",
        "express-session": "^1.17.3",
        "bcrypt": "^5.1.1",
        "dotenv": "^16.3.1"
      },
      "engines": {
        "node": ">=18.0.0"
      }
    }, null, 2)
  },
  {
    path: '.env.example',
    content: `PORT=3000
DATABASE_PATH=./data/app.db
SESSION_SECRET=my-secret-key-change-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123456
NODE_ENV=development
`
  },
  {
    path: '.env',
    content: `PORT=3000
DATABASE_PATH=./data/app.db
SESSION_SECRET=my-secret-key-change-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123456
NODE_ENV=development
`
  },
  {
    path: '.gitignore',
    content: `node_modules/
data/
.env
*.db
`
  },
  {
    path: 'liara.json',
    content: JSON.stringify({
      "app": "my-app",
      "port": 3000,
      "node": {
        "version": "18"
      }
    }, null, 2)
  },
  {
    path: 'install.bat',
    content: `@echo off
echo Installing dependencies...
call npm install
echo.
echo Installation complete!
echo Now run start.bat to start the application.
pause
`
  },
  {
    path: 'start.bat',
    content: `@echo off
echo Starting application...
echo.
echo Opening browser...
start http://localhost:3000
echo.
node server.js
pause
`
  },
  {
    path: 'public/login.html',
    content: `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ورود - سیستم مدیریت</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="login-container">
    <div class="login-box">
      <h1>ورود به سیستم</h1>
      <form id="loginForm">
        <div class="form-group">
          <label for="username">نام کاربری</label>
          <input type="text" id="username" name="username" required placeholder="نام کاربری">
        </div>
        <div class="form-group">
          <label for="password">رمز عبور</label>
          <input type="password" id="password" name="password" required placeholder="رمز عبور">
        </div>
        <div id="error" class="error"></div>
        <button type="submit" class="btn btn-primary">ورود</button>
      </form>
    </div>
  </div>
  <script src="login.js"></script>
</body>
</html>
`
  },
  {
    path: 'public/index.html',
    content: `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>داشبورد - سیستم مدیریت</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav class="navbar">
    <div class="nav-brand">سیستم مدیریت</div>
    <div class="nav-links">
      <a href="#" class="nav-link active" data-page="dashboard">داشبورد</a>
      <a href="#" class="nav-link" data-page="records">اطلاعات</a>
      <a href="#" class="nav-link admin-only" data-page="users">کاربران</a>
      <a href="#" class="nav-link" id="logoutBtn">خروج</a>
    </div>
  </nav>

  <main class="container">
    <!-- Dashboard Page -->
    <div id="dashboard-page" class="page active">
      <h2>داشبورد</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number" id="userCount">0</div>
          <div class="stat-label">تعداد کاربران</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="recordCount">0</div>
          <div class="stat-label">تعداد رکوردها</div>
        </div>
      </div>
      <h3>آخرین رکوردها</h3>
      <div id="recentRecords"></div>
    </div>

    <!-- Records Page -->
    <div id="records-page" class="page">
      <h2>اطلاعات</h2>
      <div class="toolbar">
        <input type="text" id="searchInput" placeholder="جستجو..." class="search-input">
        <button class="btn btn-primary" id="addRecordBtn">+ ثبت جدید</button>
      </div>
      <div id="recordsTable"></div>
    </div>

    <!-- Users Page (Admin only) -->
    <div id="users-page" class="page">
      <h2>کاربران</h2>
      <div class="toolbar">
        <button class="btn btn-primary" id="addUserBtn">+ کاربر جدید</button>
      </div>
      <div id="usersTable"></div>
    </div>
  </main>

  <!-- Record Modal -->
  <div id="recordModal" class="modal">
    <div class="modal-content">
      <h3 id="recordModalTitle">ثبت اطلاعات جدید</h3>
      <form id="recordForm">
        <input type="hidden" id="recordId">
        <div class="form-group">
          <label for="recordTitle">عنوان</label>
          <input type="text" id="recordTitle" required>
        </div>
        <div class="form-group">
          <label for="recordDescription">توضیحات</label>
          <textarea id="recordDescription" rows="4"></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">ذخیره</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal('recordModal')">انصراف</button>
        </div>
      </form>
    </div>
  </div>

  <!-- User Modal -->
  <div id="userModal" class="modal">
    <div class="modal-content">
      <h3>ایجاد کاربر جدید</h3>
      <form id="userForm">
        <div class="form-group">
          <label for="userName">نام</label>
          <input type="text" id="userName" required>
        </div>
        <div class="form-group">
          <label for="userUsername">نام کاربری</label>
          <input type="text" id="userUsername" required>
        </div>
        <div class="form-group">
          <label for="userPassword">رمز عبور</label>
          <input type="password" id="userPassword" required>
        </div>
        <div class="form-group">
          <label for="userRole">نقش</label>
          <select id="userRole">
            <option value="user">کاربر</option>
            <option value="admin">مدیر</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">ذخیره</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal('userModal')">انصراف</button>
        </div>
      </form>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
`
  },
  {
    path: 'public/style.css',
    content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Tahoma, Arial, sans-serif;
  background: #f0f2f5;
  color: #333;
  line-height: 1.6;
}

/* Login */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  width: 100%;
  max-width: 400px;
}

.login-box h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  font-size: 24px;
}

/* Forms */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
  font-size: 14px;
  color: #555;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: Tahoma, Arial, sans-serif;
  transition: border-color 0.3s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.error {
  color: #e74c3c;
  font-size: 13px;
  margin-bottom: 10px;
  display: none;
}

.error.show {
  display: block;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-family: Tahoma, Arial, sans-serif;
  transition: all 0.3s;
}

.btn-primary {
  background: #667eea;
  color: white;
  width: 100%;
}

.btn-primary:hover {
  background: #5a6fd6;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.btn-danger {
  background: #e74c3c;
  color: white;
  padding: 6px 12px;
  font-size: 12px;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-edit {
  background: #f39c12;
  color: white;
  padding: 6px 12px;
  font-size: 12px;
}

.btn-edit:hover {
  background: #d68910;
}

/* Navbar */
.navbar {
  background: white;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand {
  font-size: 18px;
  font-weight: bold;
  color: #667eea;
  padding: 15px 0;
}

.nav-links {
  display: flex;
  gap: 5px;
}

.nav-link {
  padding: 15px 16px;
  text-decoration: none;
  color: #555;
  font-size: 14px;
  border-bottom: 3px solid transparent;
  transition: all 0.3s;
}

.nav-link:hover {
  color: #667eea;
}

.nav-link.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

/* Container */
.container {
  max-width: 1200px;
  margin: 30px auto;
  padding: 0 20px;
}

/* Pages */
.page {
  display: none;
}

.page.active {
  display: block;
}

.page h2 {
  margin-bottom: 20px;
  color: #333;
}

.page h3 {
  margin: 20px 0 10px;
  color: #555;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  text-align: center;
}

.stat-number {
  font-size: 36px;
  font-weight: bold;
  color: #667eea;
}

.stat-label {
  font-size: 14px;
  color: #777;
  margin-top: 5px;
}

/* Toolbar */
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: Tahoma, Arial, sans-serif;
}

.toolbar .btn-primary {
  width: auto;
}

/* Table */
.table-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px 16px;
  text-align: right;
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

th {
  background: #f8f9fa;
  font-weight: bold;
  color: #555;
}

tr:hover {
  background: #f8f9fa;
}

.actions {
  display: flex;
  gap: 5px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}

/* Modal */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  justify-content: center;
  align-items: center;
}

.modal.show {
  display: flex;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.modal-actions .btn-primary {
  width: auto;
}

/* Recent records */
.recent-item {
  background: white;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 10px;
  box-shadow: 0 1px 5px rgba(0,0,0,0.05);
}

.recent-item-title {
  font-weight: bold;
  color: #333;
}

.recent-item-meta {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

/* Responsive */
@media (max-width: 768px) {
  .navbar {
    flex-direction: column;
    padding: 10px;
  }
  
  .nav-links {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .nav-link {
    padding: 10px 12px;
    font-size: 13px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .toolbar {
    flex-direction: column;
  }
  
  table {
    font-size: 12px;
  }
  
  th, td {
    padding: 8px;
  }
}
`
  },
  {
    path: 'public/login.js',
    content: `document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');
  
  errorEl.classList.remove('show');
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      window.location.href = '/';
    } else {
      errorEl.textContent = data.error || 'خطا در ورود';
      errorEl.classList.add('show');
    }
  } catch (err) {
    errorEl.textContent = 'خطا در اتصال به سرور';
    errorEl.classList.add('show');
  }
});
`
  },
  {
    path: 'public/app.js',
    content: `let currentUser = null;

// Check auth on load
async function init() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    
    // Hide admin links for non-admin
    if (currentUser.role !== 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
    
    loadDashboard();
  } catch (err) {
    window.location.href = '/login.html';
  }
}

// Navigation
document.querySelectorAll('.nav-link[data-page]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    showPage(page);
  });
});

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  
  document.getElementById(page + '-page').classList.add('active');
  document.querySelector('[data-page="' + page + '"]').classList.add('active');
  
  if (page === 'dashboard') loadDashboard();
  if (page === 'records') loadRecords();
  if (page === 'users') loadUsers();
}

// Dashboard
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    
    document.getElementById('userCount').textContent = data.userCount;
    document.getElementById('recordCount').textContent = data.recordCount;
    
    const recentHtml = data.recentRecords.length > 0 
      ? data.recentRecords.map(r => {
        return '<div class="recent-item">' +
          '<div class="recent-item-title">' + escapeHtml(r.title) + '</div>' +
          '<div class="recent-item-meta">' +
            'توسط ' + escapeHtml(r.created_by_name || 'نامشخص') + ' | ' +
            formatDate(r.created_at) +
          '</div>' +
        '</div>';
      }).join('')
      : '<div class="empty-state">هنوز رکوردی ثبت نشده</div>';
    
    document.getElementById('recentRecords').innerHTML = recentHtml;
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// Records
async function loadRecords(search) {
  search = search || '';
  try {
    const url = search ? '/api/records?search=' + encodeURIComponent(search) : '/api/records';
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.records.length === 0) {
      document.getElementById('recordsTable').innerHTML = '<div class="empty-state table-wrapper">رکوردی یافت نشد</div>';
      return;
    }
    
    let html = '<div class="table-wrapper"><table>';
    html += '<thead><tr><th>عنوان</th><th>توضیحات</th><th>ثبت‌کننده</th><th>تاریخ</th><th>عملیات</th></tr></thead>';
    html += '<tbody>';
    
    data.records.forEach(function(r) {
      html += '<tr>' +
        '<td>' + escapeHtml(r.title) + '</td>' +
        '<td>' + escapeHtml(r.description || '-') + '</td>' +
        '<td>' + escapeHtml(r.created_by_name || 'نامشخص') + '</td>' +
        '<td>' + formatDate(r.created_at) + '</td>' +
        '<td class="actions">' +
          '<button class="btn btn-edit" onclick="editRecord(' + r.id + ')">ویرایش</button>' +
          '<button class="btn btn-danger" onclick="deleteRecord(' + r.id + ')">حذف</button>' +
        '</td>' +
      '</tr>';
    });
    
    html += '</tbody></table></div>';
    document.getElementById('recordsTable').innerHTML = html;
  } catch (err) {
    console.error('Error loading records:', err);
  }
}

// Search
document.getElementById('searchInput').addEventListener('input', function(e) {
  loadRecords(e.target.value);
});

// Add Record
document.getElementById('addRecordBtn').addEventListener('click', function() {
  document.getElementById('recordModalTitle').textContent = 'ثبت اطلاعات جدید';
  document.getElementById('recordId').value = '';
  document.getElementById('recordTitle').value = '';
  document.getElementById('recordDescription').value = '';
  document.getElementById('recordModal').classList.add('show');
});

// Edit Record
window.editRecord = async function(id) {
  try {
    const res = await fetch('/api/records');
    const data = await res.json();
    const record = data.records.find(function(r) { return r.id === id; });
    
    if (record) {
      document.getElementById('recordModalTitle').textContent = 'ویرایش اطلاعات';
      document.getElementById('recordId').value = record.id;
      document.getElementById('recordTitle').value = record.title;
      document.getElementById('recordDescription').value = record.description || '';
      document.getElementById('recordModal').classList.add('show');
    }
  } catch (err) {
    console.error('Error editing record:', err);
  }
};

// Delete Record
window.deleteRecord = async function(id) {
  if (!confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;
  
  try {
    const res = await fetch('/api/records/' + id, { method: 'DELETE' });
    if (res.ok) {
      loadRecords();
    } else {
      alert('خطا در حذف رکورد');
    }
  } catch (err) {
    alert('خطا در حذف رکورد');
  }
};

// Record Form
document.getElementById('recordForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const id = document.getElementById('recordId').value;
  const title = document.getElementById('recordTitle').value;
  const description = document.getElementById('recordDescription').value;
  
  try {
    const url = id ? '/api/records/' + id : '/api/records';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, description: description })
    });
    
    if (res.ok) {
      closeModal('recordModal');
      loadRecords();
    } else {
      const data = await res.json();
      alert(data.error || 'خطا در ذخیره');
    }
  } catch (err) {
    alert('خطا در ذخیره اطلاعات');
  }
});

// Users
async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    
    if (data.users.length === 0) {
      document.getElementById('usersTable').innerHTML = '<div class="empty-state table-wrapper">کاربری یافت نشد</div>';
      return;
    }
    
    let html = '<div class="table-wrapper"><table>';
    html += '<thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>تاریخ ثبت</th><th>عملیات</th></tr></thead>';
    html += '<tbody>';
    
    data.users.forEach(function(u) {
      const roleName = u.role === 'admin' ? 'مدیر' : 'کاربر';
      html += '<tr>' +
        '<td>' + escapeHtml(u.name) + '</td>' +
        '<td>' + escapeHtml(u.username) + '</td>' +
        '<td>' + roleName + '</td>' +
        '<td>' + formatDate(u.created_at) + '</td>' +
        '<td class="actions">' +
          '<button class="btn btn-danger" onclick="deleteUser(' + u.id + ')">حذف</button>' +
        '</td>' +
      '</tr>';
    });
    
    html += '</tbody></table></div>';
    document.getElementById('usersTable').innerHTML = html;
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

// Add User
document.getElementById('addUserBtn').addEventListener('click', function() {
  document.getElementById('userName').value = '';
  document.getElementById('userUsername').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userRole').value = 'user';
  document.getElementById('userModal').classList.add('show');
});

// Delete User
window.deleteUser = async function(id) {
  if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
  
  try {
    const res = await fetch('/api/users/' + id, { method: 'DELETE' });
    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'خطا در حذف کاربر');
    }
  } catch (err) {
    alert('خطا در حذف کاربر');
  }
};

// User Form
document.getElementById('userForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const name = document.getElementById('userName').value;
  const username = document.getElementById('userUsername').value;
  const password = document.getElementById('userPassword').value;
  const role = document.getElementById('userRole').value;
  
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, username: username, password: password, role: role })
    });
    
    if (res.ok) {
      closeModal('userModal');
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'خطا در ایجاد کاربر');
    }
  } catch (err) {
    alert('خطا در ایجاد کاربر');
  }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async function(e) {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

// Modal
window.closeModal = function(id) {
  document.getElementById(id).classList.remove('show');
};

// Close modal on outside click
document.querySelectorAll('.modal').forEach(function(modal) {
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });
});

// Helpers
function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    var date = new Date(dateStr);
    return date.toLocaleDateString('fa-IR') + ' ' + date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateStr;
  }
}

// Initialize
init();
`
  },
  {
    path: 'README.md',
    content: `# سیستم مدیریت ساده

یک نرم‌افزار تحت وب ساده با Node.js، Express و SQLite.

## ویژگی‌ها
- سیستم Login با Session
- داشبورد ساده
- CRUD برای اطلاعات (Records)
- مدیریت کاربران (فقط Admin)
- دیتابیس مشترک SQLite روی سرور
- قابل Deploy روی Liara.ir

## اجرای اولیه

### ۱. نصب Node.js
Node.js نسخه ۱۸ یا بالاتر را نصب کنید.

### ۲. نصب وابستگی‌ها
فایل \`install.bat\` را اجرا کنید یا:
\`\`\`bash
npm install
\`\`\`

### ۳. تنظیم فایل .env
فایل \`.env\` را ویرایش کنید:
\`\`\`
PORT=3000
DATABASE_PATH=./data/app.db
SESSION_SECRET=my-secret-key-change-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123456
\`\`\`

### ۴. اجرا
فایل \`start.bat\` را اجرا کنید یا:
\`\`\`bash
npm start
\`\`\`

### ۵. باز کردن مرورگر
به آدرس \`http://localhost:3000\` بروید.

## اطلاعات ورود اولیه
- نام کاربری: \`admin\`
- رمز عبور: \`123456\`

## دیتابیس
- مسیر: \`./data/app.db\` (قابل تغییر از \`.env\`)
- تمام اطلاعات در یک فایل SQLite ذخیره می‌شود
- تمام کاربران به یک دیتابیس مشترک دسترسی دارند

## ایجاد کاربر جدید
1. با Admin وارد شوید
2. از منوی بالا «کاربران» را انتخاب کنید
3. دکمه «کاربر جدید» را بزنید

---

## Deploy روی Liara

### مرحله ۱: ساخت برنامه
1. وارد پنل Liara شوید
2. یک برنامه Node.js جدید بسازید

### مرحله ۲: ساخت Disk
1. از بخش Disks یک دیسک جدید بسازید
2. سایز مناسب انتخاب کنید (مثلاً ۱ گیگابایت)

### مرحله ۳: Mount کردن Disk
1. به تنظیمات برنامه بروید
2. Disk را به برنامه Mount کنید
3. مسیر Mount معمولاً \`/data\` است

### مرحله ۴: تنظیم Environment Variables
از پنل Liara این مقادیر را تنظیم کنید:

| متغیر | مقدار |
|-------|-------|
| \`DATABASE_PATH\` | \`/data/app.db\` |
| \`SESSION_SECRET\` | یک رشته تصادفی طولانی |
| \`ADMIN_USERNAME\` | \`admin\` |
| \`ADMIN_PASSWORD\` | رمز عبور قوی |
| \`NODE_ENV\` | \`production\` |

### مرحله ۵: Deploy
1. پروژه را ZIP کنید (بدون node_modules)
2. از پنل Liara فایل ZIP را آپلود کنید
3. یا از Liara CLI استفاده کنید:
\`\`\`bash
liara deploy
\`\`\`

### مرحله ۶: بررسی
1. Logها را چک کنید
2. به آدرس سایت بروید
3. با Admin وارد شوید
4. یک رکورد ثبت کنید
5. از Browser دیگر وارد شوید و رکورد را ببینید

### مرحله ۷: تست پایداری
- برنامه را Restart کنید
- اطلاعات باید باقی مانده باشند
- Deploy جدید انجام دهید
- اطلاعات باید همچنان موجود باشند

**نکته مهم:** اگر \`DATABASE_PATH\` روی Persistent Disk تنظیم نشده باشد، بعد از Restart اطلاعات پاک می‌شود.
`
  }
];
