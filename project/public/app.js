let currentUser = null;

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
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  
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
      ? data.recentRecords.map(r => `
        <div class="recent-item">
          <div class="recent-item-title">${escapeHtml(r.title)}</div>
          <div class="recent-item-meta">
            توسط ${escapeHtml(r.created_by_name || 'نامشخص')} | 
            ${formatDate(r.created_at)}
          </div>
        </div>
      `).join('')
      : '<div class="empty-state">هنوز رکوردی ثبت نشده</div>';
    
    document.getElementById('recentRecords').innerHTML = recentHtml;
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// Records
async function loadRecords(search = '') {
  try {
    const url = search ? `/api/records?search=${encodeURIComponent(search)}` : '/api/records';
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.records.length === 0) {
      document.getElementById('recordsTable').innerHTML = '<div class="empty-state table-wrapper">رکوردی یافت نشد</div>';
      return;
    }
    
    let html = '<div class="table-wrapper"><table>';
    html += '<thead><tr><th>عنوان</th><th>توضیحات</th><th>ثبت‌کننده</th><th>تاریخ</th><th>عملیات</th></tr></thead>';
    html += '<tbody>';
    
    data.records.forEach(r => {
      html += `<tr>
        <td>${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.description || '-')}</td>
        <td>${escapeHtml(r.created_by_name || 'نامشخص')}</td>
        <td>${formatDate(r.created_at)}</td>
        <td class="actions">
          <button class="btn btn-edit" onclick="editRecord(${r.id})">ویرایش</button>
          <button class="btn btn-danger" onclick="deleteRecord(${r.id})">حذف</button>
        </td>
      </tr>`;
    });
    
    html += '</tbody></table></div>';
    document.getElementById('recordsTable').innerHTML = html;
  } catch (err) {
    console.error('Error loading records:', err);
  }
}

// Search
document.getElementById('searchInput').addEventListener('input', (e) => {
  loadRecords(e.target.value);
});

// Add Record
document.getElementById('addRecordBtn').addEventListener('click', () => {
  document.getElementById('recordModalTitle').textContent = 'ثبت اطلاعات جدید';
  document.getElementById('recordId').value = '';
  document.getElementById('recordTitle').value = '';
  document.getElementById('recordDescription').value = '';
  document.getElementById('recordModal').classList.add('show');
});

// Edit Record
window.editRecord = async (id) => {
  try {
    const res = await fetch('/api/records');
    const data = await res.json();
    const record = data.records.find(r => r.id === id);
    
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
window.deleteRecord = async (id) => {
  if (!confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;
  
  try {
    const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
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
document.getElementById('recordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('recordId').value;
  const title = document.getElementById('recordTitle').value;
  const description = document.getElementById('recordDescription').value;
  
  try {
    const url = id ? `/api/records/${id}` : '/api/records';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
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
    
    data.users.forEach(u => {
      const roleName = u.role === 'admin' ? 'مدیر' : 'کاربر';
      html += `<tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${roleName}</td>
        <td>${formatDate(u.created_at)}</td>
        <td class="actions">
          <button class="btn btn-danger" onclick="deleteUser(${u.id})">حذف</button>
        </td>
      </tr>`;
    });
    
    html += '</tbody></table></div>';
    document.getElementById('usersTable').innerHTML = html;
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

// Add User
document.getElementById('addUserBtn').addEventListener('click', () => {
  document.getElementById('userName').value = '';
  document.getElementById('userUsername').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userRole').value = 'user';
  document.getElementById('userModal').classList.add('show');
});

// Delete User
window.deleteUser = async (id) => {
  if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
  
  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
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
document.getElementById('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('userName').value;
  const username = document.getElementById('userUsername').value;
  const password = document.getElementById('userPassword').value;
  const role = document.getElementById('userRole').value;
  
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password, role })
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
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

// Modal
window.closeModal = (id) => {
  document.getElementById(id).classList.remove('show');
};

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });
});

// Helpers
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fa-IR') + ' ' + date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

// Initialize
init();
