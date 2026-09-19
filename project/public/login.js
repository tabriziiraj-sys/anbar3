document.getElementById('loginForm').addEventListener('submit', async (e) => {
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
