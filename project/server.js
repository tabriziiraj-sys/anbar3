require('dotenv').config();
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
    records = db.prepare(`
      SELECT r.*, u.name as created_by_name 
      FROM records r 
      LEFT JOIN users u ON r.created_by = u.id 
      WHERE r.title LIKE ? OR r.description LIKE ?
      ORDER BY r.created_at DESC
    `).all(`%${search}%`, `%${search}%`);
  } else {
    records = db.prepare(`
      SELECT r.*, u.name as created_by_name 
      FROM records r 
      LEFT JOIN users u ON r.created_by = u.id 
      ORDER BY r.created_at DESC
    `).all();
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
  const recentRecords = db.prepare(`
    SELECT r.*, u.name as created_by_name 
    FROM records r 
    LEFT JOIN users u ON r.created_by = u.id 
    ORDER BY r.created_at DESC 
    LIMIT 5
  `).all();
  
  res.json({ userCount, recordCount, recentRecords });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
createDefaultAdmin();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
