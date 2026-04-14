/* ═══════════════════════════════════════════
   AUTH – Login & Register (login.html)
   ═══════════════════════════════════════════ */
(function () {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const indicator = document.getElementById('tab-indicator');

    if (!loginForm) return; // Not on login page

    // Tab switching
    tabLogin.addEventListener('click', () => switchTab('login'));
    tabRegister.addEventListener('click', () => switchTab('register'));

    function switchTab(tab) {
        if (tab === 'login') {
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            indicator.classList.remove('right');
        } else {
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
            tabLogin.classList.remove('active');
            tabRegister.classList.add('active');
            indicator.classList.add('right');
        }
    }

    // Password toggles
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
            }
        });
    });

    // Generate particles
    const particlesEl = document.getElementById('particles');
    if (particlesEl) {
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (10 + Math.random() * 20) + 's';
            p.style.animationDelay = (Math.random() * 15) + 's';
            p.style.opacity = (0.2 + Math.random() * 0.5);
            p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
            particlesEl.appendChild(p);
        }
    }

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            showToast('Please enter username and password', 'error');
            return;
        }

        btn.querySelector('.btn-text').textContent = 'Signing in…';
        btn.querySelector('.btn-loader').classList.remove('hidden');
        btn.disabled = true;

        try {
            await API.post('/api/login', { username, password });
            showToast('Login successful!', 'success');
            setTimeout(() => window.location.href = '/dashboard', 600);
        } catch (err) {
            showToast(err.message || 'Invalid credentials', 'error');
            btn.querySelector('.btn-text').textContent = 'Sign In';
            btn.querySelector('.btn-loader').classList.add('hidden');
            btn.disabled = false;
        }
    });

    // Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('register-btn');
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;
        const email = document.getElementById('reg-email').value.trim();
        const business = document.getElementById('reg-business').value.trim();

        if (!username || !password) {
            showToast('Username and password are required', 'error');
            return;
        }
        if (password !== confirm) {
            showToast("Passwords don't match", 'error');
            return;
        }
        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        btn.querySelector('.btn-text').textContent = 'Creating…';
        btn.querySelector('.btn-loader').classList.remove('hidden');
        btn.disabled = true;

        try {
            await API.post('/api/register', { username, password, email, business_name: business });
            showToast('Account created! Please sign in.', 'success');
            switchTab('login');
        } catch (err) {
            showToast(err.message || 'Registration failed', 'error');
        } finally {
            btn.querySelector('.btn-text').textContent = 'Create Account';
            btn.querySelector('.btn-loader').classList.add('hidden');
            btn.disabled = false;
        }
    });
})();
