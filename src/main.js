import './style.css'

// --- State Management ---
const state = {
    viewMode: 'public', // 'public', 'internal', or 'auth'
    role: 'staff',
    currentPage: 'landing',
    authStep: 'login', // 'login', 'select', 'pin', 'biometric', 'otp'
    corporateId: '',
    userId: '',
    keyBcaResponse: '',
    pin: '',
    otp: ['', '', '', ''],
    isAuthenticating: false,
    benefitMode: false,
    user: {
        name: 'Andi Pratama',
        branch: 'KCP Menteng',
        points: 8450,
        level: 'EXPERT',
        roleType: 'Senior RO',
        progress: 75,
        badges: ['Fast Learner', 'Problem Solver', 'BCA Champion']
    },
    leaderboard: [
        { rank: 1, name: 'Siti Aminah', branch: 'KCU Surabaya', points: 3100 },
        { rank: 2, name: 'Budi Santoso', branch: 'KCU Jakarta', points: 2950 },
        { rank: 3, name: 'Andi (Anda)', branch: 'KCU Jakarta', points: 8450 }
    ],
    courses: [
        { id: 1, title: 'Business Dashboard 101', cat: 'Basic', duration: '5m', progress: 100, roles: ['Beginner', 'Senior'] },
        { id: 2, title: 'Ocean Cash Management', cat: 'Corporate', duration: '7m', progress: 75, roles: ['Senior'] },
        { id: 3, title: 'FAQ - Global Transaction', cat: 'Ops', duration: '5m', progress: 60, roles: ['Ops', 'Senior'] },
        { id: 4, title: 'Relationship Mastery', cat: 'Soft-skill', duration: '10m', progress: 20, roles: ['Beginner', 'Senior'] }
    ],
    simulations: [
        { id: 'umkm', title: 'Nasabah UMKM Retail', difficulty: 'Easy' },
        { id: 'corp', title: 'Nasabah Korporasi Premier', difficulty: 'Hard' }
    ],
    ingestionSteps: [
        { id: 1, label: 'Upload / Import File', status: 'waiting' },
        { id: 2, label: 'Ekstraksi Teks & Data', status: 'waiting' },
        { id: 3, label: 'Chunking & Embedding', status: 'waiting' },
        { id: 4, label: 'Validasi & Enrichment', status: 'waiting' },
        { id: 5, label: 'Simpan ke Vector DB', status: 'waiting' }
    ],
    chatHistory: [
        { role: 'ai', content: 'Halo Andi! Saya Ocean AI Assistant. Ingin tanya tentang fitur atau butuh script jualan?' }
    ],
    activeModule: null, 
    isIngesting: false,
    roiInputs: { branches: 1, transactions: 100 },
    selectedSector: 'Retail'
};

// --- Internal Components ---

const Sidebar = () => {
    const isAdmin = state.role === 'admin';
    const staffMenu = [
        { id: 'dashboard', label: 'Dashboard Mastery', icon: '🏠' },
        { id: 'learning', label: 'Learning Path', icon: '🛣️' },
        { id: 'ai', label: 'Ocean AI Assistant', icon: '🤖' },
        { id: 'simulation', label: 'Simulation Role-play', icon: '🤝' },
        { id: 'ingestion', label: 'Admin Hub', icon: '⚙️' }
    ];
    const adminMenu = [
        { id: 'ingestion', label: 'Ingestion Hub', icon: '⚙️' },
        { id: 'analytics', label: 'Analytics', icon: '📊' }
    ];
    const menuItems = isAdmin ? adminMenu : staffMenu;
    return `
        <aside class="sidebar">
            <div class="role-switcher">
                <button class="role-btn ${isAdmin ? 'active' : ''}" id="set-admin">ADMIN</button>
                <button class="role-btn ${!isAdmin ? 'active' : ''}" id="set-staff">STAFF</button>
            </div>
            <div class="sidebar-logo"><div class="logo-box">O</div> <span>${isAdmin ? 'Ocean Admin' : 'Ocean Mastery'}</span></div>
            <nav class="nav-links">
                ${menuItems.map(item => `
                    <li class="nav-item">
                        <a href="#" class="nav-link ${state.currentPage === item.id ? 'active' : ''}" data-page="${item.id}">
                            <span class="nav-icon">${item.icon}</span> ${item.label}
                        </a>
                    </li>
                `).join('')}
            </nav>
            <div class="sidebar-footer" id="nav-home" style="cursor: pointer;">
                <div class="user-profile">
                    <div class="avatar">${state.user.name.charAt(0)}</div>
                    <div><div class="user-name">${state.user.name}</div><div class="user-branch">${state.user.branch}</div></div>
                </div>
            </div>
        </aside>
    `;
};

const DashboardPage = () => `
    <div class="mastery-container fade-in">
        <header>
            <h1>Halo, ${state.user.name.split(' ')[0]}!</h1>
            <p class="subtitle">Anda berada di level <span style="color: var(--ocean-accent); font-weight: 800;">${state.user.level}</span>. Selesaikan 1 modul lagi ke level berikutnya.</p>
        </header>
        <div class="mastery-stats-row">
            <div class="m-stat-card"><label style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted);">TOTAL POIN SAYA</label><div class="m-val">${state.user.points}</div><div class="m-sub" style="font-size: 0.7rem; color: #10b981;">↑ 1.250 dari minggu lalu</div></div>
            <div class="m-stat-card flex-row"><div class="m-avatar-big">👨‍✈️</div><div><label style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted);">LEVEL SAYA</label><div class="m-val">${state.user.level}</div></div></div>
            <div class="m-stat-card flex-row"><div class="m-avatar-big">🏆</div><div><label style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted);">BADGE SAYA</label><div class="m-val">${state.user.badges.length}</div></div></div>
            <div class="m-stat-card bg-gradient-blue"><label style="color: rgba(255,255,255,0.8); font-size: 0.7rem; font-weight: 800;">RANK REGIONAL</label><div class="m-val" style="color: white">#5</div><div class="m-sub" style="color: rgba(255,255,255,0.7); font-size: 0.7rem;">Jakarta Region</div></div>
        </div>
        <div class="mastery-grid">
            <div class="m-card leaderboard-section">
                <h3>OCEAN CHAMPIONS (TOP 3)</h3>
                <div class="m-podium">
                    <div class="podium-col rank-2"><div class="p-avatar">🥈</div><div class="p-name" style="font-size: 0.8rem; font-weight: 700;">Sarah Wijaya</div><div class="p-step">2</div></div>
                    <div class="podium-col rank-1"><div class="p-avatar">🥇</div><div class="p-name" style="font-size: 0.8rem; font-weight: 700;">Andi Pratama</div><div class="p-step">1</div></div>
                    <div class="podium-col rank-3"><div class="p-avatar">🥉</div><div class="p-name" style="font-size: 0.8rem; font-weight: 700;">Budi Santoso</div><div class="p-step">3</div></div>
                </div>
                <table class="m-table">
                    <thead><tr><th>Rank</th><th>Cabang</th><th>Champion</th><th>Poin</th></tr></thead>
                    <tbody><tr class="active-row"><td>5</td><td>KCP Menteng</td><td>Anda</td><td>8.450</td></tr></tbody>
                </table>
            </div>
            <div class="m-card progress-section">
                <h3>PROGRESS SAYA</h3>
                <div class="m-progress-list">
                    ${state.courses.slice(0, 3).map(c => `
                        <div class="m-prog-item">
                            <div class="m-prog-icon">📄</div>
                            <div class="m-prog-details">
                                <div class="m-prog-info"><span class="m-prog-title">${c.title}</span><span class="m-prog-pct">${c.progress}%</span></div>
                                <div class="m-bar"><div class="m-fill" style="width: ${c.progress}%"></div></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-primary" style="margin-top: 1.5rem;" data-page="learning">Lanjutkan Belajar</button>
            </div>
        </div>
    </div>
`;

const LearningPage = () => {
    const roleCourses = state.courses;
    return `
    <div class="fade-in">
        <header>
            <h1>Learning Path: ${state.user.roleType}</h1>
            <p class="subtitle">Modul bite-sized 5-7 menit untuk penguasaan platform Ocean.</p>
        </header>
        <div class="learning-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
            ${roleCourses.map(course => `
                <div class="m-card course-card">
                    <div class="badge-premium">${course.cat}</div>
                    <h3 style="margin: 1rem 0;">${course.title}</h3>
                    <div class="m-prog-info"><span>${course.duration}</span> <span>${course.progress}%</span></div>
                    <div class="m-bar"><div class="m-fill" style="width: ${course.progress}%"></div></div>
                    <button class="btn-primary start-module" style="width: 100%; margin-top: 1.5rem;" data-id="${course.id}">
                        ${course.progress === 100 ? 'Review Materi' : 'Mulai Belajar'}
                    </button>
                </div>
            `).join('')}
        </div>
    </div>
    `;
};

const ModuleDetailPage = (module) => `
    <div class="fade-in module-detail-container">
        <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <a href="#" class="back-link" data-page="learning">← Kembali ke Learning Path</a>
                <h1 style="margin-top: 10px;">${module.title}</h1>
            </div>
            <div class="badge-premium">${module.cat}</div>
        </header>

        <div class="module-layout" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem;">
            <div class="module-main-content">
                <div class="video-container" style="background: black; border-radius: 24px; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; box-shadow: var(--shadow-premium);">
                    <div style="color: white; text-align: center;">
                        <div style="font-size: 5rem; margin-bottom: 1rem; cursor: pointer;" id="play-video">▶️</div>
                        <p>Video Pembelajaran: ${module.title}</p>
                    </div>
                </div>

                <div class="m-card" style="margin-top: 2rem; padding: 2rem;">
                    <h3>Deskripsi Materi</h3>
                    <p style="color: var(--text-muted); margin-top: 1rem; line-height: 1.8;">
                        Modul ini membahas tentang implementasi praktis ${module.title} untuk meningkatkan efisiensi nasabah. 
                    </p>
                </div>
            </div>

            <div class="module-sidebar">
                <div class="m-card" style="padding: 1.5rem; text-align: center;">
                    <div style="font-size: 0.8rem; font-weight: 800; color: var(--bca-blue-primary); margin-bottom: 1rem;">STATUS PROGRES</div>
                    <div class="m-val" style="font-size: 2.5rem; margin-bottom: 1rem;">${module.progress}%</div>
                    <div class="m-bar" style="margin-bottom: 2rem;"><div class="m-fill" style="width: ${module.progress}%"></div></div>
                    <button class="btn-primary" style="width: 100%;" id="complete-module" ${module.progress === 100 ? 'disabled' : ''}>
                        ${module.progress === 100 ? 'Sudah Selesai ✓' : 'Selesaikan & Klaim XP'}
                    </button>
                </div>
            </div>
        </div>
    </div>
`;

const SimulationPage = () => `
    <div class="fade-in">
        <h1>Simulation Q&A dengan Nasabah</h1>
        <div class="sim-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-top: 2rem;">
            ${state.simulations.map(sim => `
                <div class="m-card sim-card" style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">${sim.id === 'umkm' ? '🏬' : '🏢'}</div>
                    <h3>${sim.title}</h3>
                    <p>Difficulty: <b style="color: ${sim.difficulty === 'Easy' ? '#10b981' : '#ef4444'}">${sim.difficulty}</b></p>
                    <button class="btn-outline" style="width: 100%; margin-top: 1rem;">Mulai Role-play</button>
                </div>
            `).join('')}
        </div>
    </div>
`;

const AIPage = () => `
    <div class="fade-in">
        <header style="display: flex; justify-content: space-between; align-items: center;">
            <div><h1>Ocean AI Assistant</h1><p class="subtitle">Just-in-time Q&A & Benefit Translator</p></div>
            <div class="m-card" style="padding: 10px 20px; display: flex; align-items: center; gap: 10px; flex-direction: row;">
                <span style="font-size: 0.8rem; font-weight: 800; color: var(--bca-blue-primary);">BENEFIT TRANSLATOR</span>
                <label class="switch"><input type="checkbox" id="benefit-toggle" ${state.benefitMode ? 'checked' : ''}><span class="slider round"></span></label>
            </div>
        </header>
        <div class="ai-layout">
            <div class="chat-main">
                <div class="chat-content" id="chat-messages-main">${state.chatHistory.map(m => `<div class="msg ${m.role}">${m.content}</div>`).join('')}</div>
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input" id="chat-input-internal" placeholder="Tanya tentang fitur...">
                    <button class="btn-primary" id="btn-send-internal">🚀</button>
                </div>
            </div>
            <div class="ai-sources">
                <h3>RAG SOURCES</h3>
                <div class="source-item"><span>📜</span> Script Pitching CFO</div>
                <div class="source-item"><span>📄</span> Guide: Dashboard</div>
            </div>
        </div>
    </div>
`;

const IngestionPage = () => `
    <div class="fade-in">
        <header><h1>Knowledge Capture Loop</h1><p class="subtitle">Ingest data resmi ke RAG database.</p></header>
        <div class="ingestion-container">
            <div class="hub-card">
                <div class="type-grid">${['Dokumen', 'Video', 'FAQ'].map(t => `<div class="type-item"><div class="type-label">${t}</div></div>`).join('')}</div>
                <div class="upload-zone ${state.isIngesting ? 'active' : ''}"><p>${state.isIngesting ? 'Memproses data...' : 'Upload data resmi ke RAG database'}</p>
                <button class="btn-primary" style="margin-top: 1rem;" id="btn-start-ingest">Pilih File</button></div>
            </div>
            <div class="process-column">
                ${state.ingestionSteps.map(s => `<div class="process-step ${s.status}"><div class="step-num">${s.status === 'completed' ? '✓' : s.id}</div><div>${s.label}</div></div>`).join('')}
            </div>
        </div>
    </div>
`;

// --- Public Components ---

const PublicNavbar = () => `
    <nav class="public-nav">
        <div class="nav-container">
            <div class="nav-logo" id="nav-home-public" style="cursor: pointer;">
                <div class="logo-box">O</div>
                <span>Ocean by BCA</span>
            </div>
            <div class="nav-links-public">
                <a href="#" class="nav-link-p" data-page="landing">Home</a>
                <a href="#" class="nav-link-p" data-page="how-it-works">How It Works</a>
                <a href="#" class="nav-link-p" data-page="sandbox">Sandbox Demo</a>
                <a href="#" class="nav-link-p" data-page="roi">ROI Calculator</a>
                <a href="#" class="nav-link-p" data-page="security">Security</a>
            </div>
            <div class="nav-actions">
                <button class="btn-outline" id="btn-direct-internal">Internal Portal</button>
                <button class="btn-primary" id="btn-login-trigger">Masuk</button>
            </div>
        </div>
    </nav>
`;

const LandingPage = () => `
    <div class="public-layout fade-in">
        <section class="hero-section">
            <div class="hero-content">
                <span class="badge-premium">Elevate Your Business</span>
                <h1>Transformasi Digital Bisnis Anda Mulai dari Sini.</h1>
                <p>Ocean by BCA adalah ekosistem pintar untuk mengelola arus kas, otomasi transaksi, dan pertumbuhan bisnis Anda.</p>
                <div class="hero-ctas">
                    <button class="btn-primary" style="padding: 16px 32px;" data-page="sandbox">Try It Out (Sandbox)</button>
                    <button class="btn-outline" style="padding: 16px 32px;" data-page="how-it-works">Watch How It Works</button>
                </div>
            </div>
            <div class="hero-visual">
                <div class="visual-card main">
                    <div class="fake-chart"></div>
                    <div class="fake-rows"><div class="fake-row"></div><div class="fake-row"></div></div>
                </div>
            </div>
        </section>
    </div>
`;

// --- Ocean Auth (RESTORED) ---

const OceanAuth = () => {
    const renderLogin = () => `
        <div class="fade-in">
            <h2 class="auth-title" style="margin-bottom: 2rem;">Halo, Selamat Datang!</h2>
            <div class="login-form" style="text-align: left;">
                <label class="auth-label">BCA ID Bisnis</label>
                <div class="input-group-auth"><span class="input-tag">Corporate ID</span><input type="text" class="auth-field" id="corp-id" placeholder="Masukkan Corporate ID" value="${state.corporateId}"></div>
                <div class="input-group-auth" style="margin-bottom: 2rem;"><span class="input-tag">User ID</span><input type="text" class="auth-field" id="user-id" placeholder="Masukkan User ID" value="${state.userId}"></div>
                <label class="auth-label">KeyBCA Response <span class="help-icon">?</span></label>
                <div class="input-group-auth"><input type="text" class="auth-field" id="key-response" placeholder="Masukkan KeyBCA Response" value="${state.keyBcaResponse}"></div>
                <button class="btn-primary" id="btn-login-submit" style="width: 100%; margin-top: 2rem; padding: 16px; border-radius: 50px; background: #ccc;" disabled>Masuk</button>
            </div>
            <div class="back-link" id="cancel-auth" style="margin-top: 2rem; display: block; text-align: center;">Kembali ke Beranda</div>
        </div>
    `;

    const renderSelect = () => `
        <div class="fade-in">
            <h2 class="auth-title">Ocean Auth</h2>
            <p class="auth-subtitle">Pilih metode verifikasi.</p>
            <div class="method-grid">
                <button class="method-btn" data-auth="pin"><div class="method-icon">🔑</div><div class="method-info"><h4>PIN Ocean</h4><p>Gunakan 6 digit PIN</p></div></button>
                <button class="method-btn" data-auth="biometric"><div class="method-icon">👤</div><div class="method-info"><h4>Biometrik</h4><p>Face ID / Sidik Jari</p></div></button>
                <button class="method-btn" data-auth="otp"><div class="method-icon">📧</div><div class="method-info"><h4>OTP Email</h4><p>Kode ke email</p></div></button>
            </div>
            <div class="back-link" id="cancel-auth" style="display: block; text-align: center; margin-top: 1rem;">Kembali ke Beranda</div>
        </div>
    `;

    const renderPin = () => `
        <div class="fade-in">
            <h2 class="auth-title">Masukkan PIN</h2>
            <div class="pin-display">${[...Array(6)].map((_, i) => `<div class="pin-dot ${state.pin.length > i ? 'filled' : ''}"></div>`).join('')}</div>
            <div class="pin-keypad">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="key-btn" data-key="${num}">${num}</button>`).join('')}
                <button class="key-btn" style="font-size: 1rem; color: #ef4444;" data-key="clear">CLR</button>
                <button class="key-btn" data-key="0">0</button>
                <button class="key-btn" style="font-size: 1rem; color: var(--ocean-accent);" data-key="del">DEL</button>
            </div>
        </div>
    `;

    const renderBiometric = () => `
        <div class="fade-in">
            <h2 class="auth-title">Verifikasi Biometrik</h2>
            <div class="biometric-visual"><div class="scan-line"></div>${state.isAuthenticating ? '✅' : '👤'}</div>
        </div>
    `;

    const renderOtp = () => `
        <div class="fade-in">
            <h2 class="auth-title">Verifikasi OTP</h2>
            <div class="otp-grid">${state.otp.map((v, i) => `<input type="text" class="otp-input" value="${v}" maxlength="1" data-otp-idx="${i}">`).join('')}</div>
        </div>
    `;

    let stepContent = '';
    switch(state.authStep) {
        case 'login': stepContent = renderLogin(); break;
        case 'select': stepContent = renderSelect(); break;
        case 'pin': stepContent = renderPin(); break;
        case 'biometric': stepContent = renderBiometric(); break;
        case 'otp': stepContent = renderOtp(); break;
        default: stepContent = renderLogin();
    }

    return `<div class="auth-overlay"><div class="auth-card"><div class="auth-logo">O</div>${stepContent}</div></div>`;
};

// --- Router ---

const render = () => {
    const app = document.getElementById('app');
    if (!app) return;

    if (state.viewMode === 'auth') {
        app.innerHTML = OceanAuth();
        attachEventListeners();
        return;
    }

    let content = '';
    const page = state.currentPage;

    if (state.viewMode === 'public') {
        switch(page) {
            case 'landing': content = LandingPage(); break;
            default: content = LandingPage();
        }
        app.innerHTML = `<div class="public-wrapper">${PublicNavbar()}<main class="public-main-content">${content}</main></div>`;
    } else {
        switch(page) {
            case 'dashboard': content = DashboardPage(); break;
            case 'learning': content = LearningPage(); break;
            case 'module-detail': content = ModuleDetailPage(state.activeModule); break;
            case 'ai': content = AIPage(); break;
            case 'simulation': content = SimulationPage(); break;
            case 'ingestion': content = IngestionPage(); break;
            default: content = DashboardPage();
        }
        app.innerHTML = `<div class="layout">${Sidebar()}<main class="main-content">${content}</main></div>`;
    }
    attachEventListeners();
};

const attachEventListeners = () => {
    // Auth Mode
    if (state.viewMode === 'auth') {
        const validateLogin = () => {
            const btn = document.getElementById('btn-login-submit');
            const isValid = state.corporateId && state.userId && state.keyBcaResponse;
            if (btn) {
                btn.disabled = !isValid;
                btn.style.background = isValid ? 'var(--bca-blue-primary)' : '#ccc';
            }
        };
        const corp = document.getElementById('corp-id');
        const user = document.getElementById('user-id');
        const key = document.getElementById('key-response');
        if (corp) corp.oninput = (e) => { state.corporateId = e.target.value; validateLogin(); };
        if (user) user.oninput = (e) => { state.userId = e.target.value; validateLogin(); };
        if (key) key.oninput = (e) => { state.keyBcaResponse = e.target.value; validateLogin(); };
        
        const loginBtn = document.getElementById('btn-login-submit');
        if (loginBtn) loginBtn.onclick = () => { state.authStep = 'select'; render(); };

        const cancel = document.getElementById('cancel-auth');
        if (cancel) cancel.onclick = () => { state.viewMode = 'public'; state.currentPage = 'landing'; render(); };

        document.querySelectorAll('[data-auth]').forEach(btn => {
            btn.onclick = () => {
                const step = btn.getAttribute('data-auth');
                state.authStep = step;
                render();
                if (step === 'biometric') {
                    setTimeout(() => { state.isAuthenticating = true; render(); 
                        setTimeout(() => { state.viewMode = 'internal'; state.currentPage = 'dashboard'; render(); }, 1000);
                    }, 2000);
                }
            };
        });

        document.querySelectorAll('.key-btn').forEach(btn => {
            btn.onclick = () => {
                const k = btn.getAttribute('data-key');
                if (k === 'clear') state.pin = '';
                else if (k === 'del') state.pin = state.pin.slice(0, -1);
                else if (state.pin.length < 6) state.pin += k;
                render();
                if (state.pin.length === 6) setTimeout(() => { state.viewMode = 'internal'; state.currentPage = 'dashboard'; render(); }, 500);
            };
        });

        document.querySelectorAll('.otp-input').forEach((inp, i) => {
            inp.oninput = (e) => {
                state.otp[i] = e.target.value;
                if (e.target.value && i < 3) document.querySelectorAll('.otp-input')[i+1].focus();
                if (state.otp.every(v => v)) setTimeout(() => { state.viewMode = 'internal'; state.currentPage = 'dashboard'; render(); }, 500);
            };
        });
        return;
    }

    // Public/Internal Common
    document.querySelectorAll('[data-page]').forEach(el => {
        el.onclick = (e) => {
            e.preventDefault();
            state.currentPage = e.currentTarget.getAttribute('data-page');
            render();
        };
    });

    // Public Navbar
    const homePublic = document.getElementById('nav-home-public');
    if (homePublic) homePublic.onclick = () => { state.viewMode = 'public'; state.currentPage = 'landing'; render(); };
    
    const directBtn = document.getElementById('btn-direct-internal');
    if (directBtn) directBtn.onclick = () => { state.viewMode = 'internal'; state.currentPage = 'dashboard'; render(); };
    
    const loginTrigger = document.getElementById('btn-login-trigger');
    if (loginTrigger) loginTrigger.onclick = () => { state.viewMode = 'auth'; state.authStep = 'login'; render(); };

    // Internal Navigation
    const homeBtn = document.getElementById('nav-home');
    if (homeBtn) homeBtn.onclick = () => { state.viewMode = 'public'; state.currentPage = 'landing'; render(); };

    const adminBtn = document.getElementById('set-admin');
    if (adminBtn) adminBtn.onclick = () => { state.role = 'admin'; state.currentPage = 'ingestion'; render(); };
    
    const staffBtn = document.getElementById('set-staff');
    if (staffBtn) staffBtn.onclick = () => { state.role = 'staff'; state.currentPage = 'dashboard'; render(); };

    // Module Click
    document.querySelectorAll('.start-module').forEach(btn => {
        btn.onclick = (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            state.activeModule = state.courses.find(c => c.id === id);
            state.currentPage = 'module-detail';
            render();
        };
    });

    const completeBtn = document.getElementById('complete-module');
    if (completeBtn && state.activeModule) {
        completeBtn.onclick = () => {
            state.activeModule.progress = 100;
            state.user.points += 250;
            state.currentPage = 'learning';
            render();
        };
    }

    // AI Assist
    const benefitToggle = document.getElementById('benefit-toggle');
    if (benefitToggle) benefitToggle.onchange = (e) => { state.benefitMode = e.target.checked; };
    
    const sendInt = document.getElementById('btn-send-internal');
    const inputInt = document.getElementById('chat-input-internal');
    if (sendInt && inputInt) {
        sendInt.onclick = () => {
            const v = inputInt.value; if (!v) return;
            state.chatHistory.push({ role: 'user', content: v });
            let r = "Menganalisis...";
            if (state.benefitMode) r = "<b>[Benefit Translator]</b>: Fitur ini akan meningkatkan retensi nasabah.";
            setTimeout(() => { state.chatHistory.push({ role: 'ai', content: r }); render(); }, 800);
            inputInt.value = ''; render();
        };
    }

    // Ingestion
    const ingestBtn = document.getElementById('btn-start-ingest');
    if (ingestBtn) {
        ingestBtn.onclick = () => {
            if (state.isIngesting) return;
            state.isIngesting = true; render();
            let step = 0;
            const interval = setInterval(() => {
                if (step > 0) state.ingestionSteps[step-1].status = 'completed';
                if (step < 5) { state.ingestionSteps[step].status = 'active'; step++; render(); }
                else { clearInterval(interval); state.isIngesting = false; render(); }
            }, 800);
        };
    }
};

window.onload = render;
render();
