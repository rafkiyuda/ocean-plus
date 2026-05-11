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
    benefitMode: false,
    isIngesting: false,
    roiInputs: { branches: 1, transactions: 100 },
    selectedSector: 'Retail'
};

// --- Components ---

const Sidebar = () => {
    const isAdmin = state.role === 'admin';
    const staffMenu = [
        { id: 'dashboard', label: 'Dashboard Mastery', icon: '🏠' },
        { id: 'learning', label: 'Learning Path', icon: '🛣️' },
        { id: 'ai', label: 'Ocean AI Assistant', icon: '🤖' },
        { id: 'simulation', label: 'Simulation Role-play', icon: '🤝' },
        { id: 'certificates', label: 'Sertifikat', icon: '📜' },
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
            <div class="sidebar-footer">
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
        <div class="mastery-stats-row">
            <div class="m-stat-card"><label>TOTAL POIN SAYA</label><div class="m-val">8.450</div><div class="m-trend">↑ 1.250 dari minggu lalu</div></div>
            <div class="m-stat-card flex-row"><div class="m-avatar-big">👨‍✈️</div><div><label>LEVEL SAYA</label><div class="m-val">EXPERT</div><div class="m-sub">Level 3</div></div></div>
            <div class="m-stat-card flex-row"><div class="m-icon-star">🏆</div><div><label>BADGE SAYA</label><div class="m-val">12</div></div></div>
            <div class="m-stat-card bg-gradient-blue"><label style="color: rgba(255,255,255,0.8)">RANK SAYA (REGIONAL)</label><div class="m-val" style="color: white">#5</div><div class="m-sub" style="color: rgba(255,255,255,0.7)">Jakarta Region</div></div>
        </div>
        <div class="mastery-grid">
            <div class="m-card leaderboard-section">
                <h3>OCEAN CHAMPIONS (TOP 10)</h3>
                <div class="m-podium">
                    <div class="podium-col rank-2"><div class="p-avatar">🥈</div><div class="p-name">Sarah Wijaya</div><div class="p-pts">11.230 XP</div><div class="p-step">2nd</div></div>
                    <div class="podium-col rank-1"><div class="p-crown">👑</div><div class="p-avatar">🥇</div><div class="p-name">Andi Pratama</div><div class="p-pts">12.560 XP</div><div class="p-step">1st</div></div>
                    <div class="podium-col rank-3"><div class="p-avatar">🥉</div><div class="p-name">Budi Santoso</div><div class="p-pts">10.980 XP</div><div class="p-step">3rd</div></div>
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
                <button class="m-btn-flat" style="margin-top: auto;" data-page="learning">Lanjutkan Belajar</button>
            </div>
            <div class="m-card badge-section">
                <h3>BADGE TERBARU</h3>
                <div class="badge-hex-grid">
                    <div class="hex-badge b-gold">⭐</div><div class="hex-badge b-fire">🔥</div><div class="hex-badge b-blue">💎</div><div class="hex-badge b-silver">✨</div>
                </div>
            </div>
        </div>
    </div>
`;

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
                <div class="video-container" style="background: black; border-radius: 16px; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; box-shadow: var(--shadow-premium);">
                    <div style="color: white; text-align: center;">
                        <div style="font-size: 5rem; margin-bottom: 1rem; cursor: pointer;" id="play-video">▶️</div>
                        <p>Video Pembelajaran: ${module.title}</p>
                    </div>
                </div>

                <div class="m-card" style="margin-top: 2rem; padding: 2rem;">
                    <h3>Deskripsi Materi</h3>
                    <p style="color: var(--text-muted); margin-top: 1rem; line-height: 1.8;">
                        Modul ini membahas tentang implementasi praktis ${module.title} untuk meningkatkan efisiensi nasabah. 
                        Anda akan mempelajari cara melakukan pitching, handling objection, hingga teknis aktivasi di platform Ocean.
                    </p>
                    <div style="margin-top: 2rem; padding: 1.5rem; background: #f8fafc; border-radius: 12px; border-left: 4px solid var(--bca-blue-primary);">
                        <h4 style="font-size: 0.9rem; color: var(--bca-blue-primary);">Key Takeaways:</h4>
                        <ul style="margin-top: 10px; font-size: 0.85rem; padding-left: 20px;">
                            <li>Otomasi rekonsiliasi data nasabah.</li>
                            <li>Integrasi myEcosystem dengan ERP pihak ketiga.</li>
                            <li>Manajemen limit transaksi harian.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="module-sidebar">
                <div class="m-card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
                    <h3>DOKUMEN PENDUKUNG</h3>
                    <div class="doc-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; margin-top: 1rem; cursor: pointer;">
                        <span>📄</span>
                        <div style="flex: 1;">
                            <div style="font-size: 0.85rem; font-weight: 700;">Product_Guide_V2.pdf</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">PDF • 2.4 MB</div>
                        </div>
                    </div>
                </div>

                <div class="m-card" style="padding: 1.5rem; text-align: center;">
                    <div style="font-size: 0.8rem; font-weight: 800; color: var(--bca-blue-primary); margin-bottom: 1rem;">STATUS PROGRES</div>
                    <div class="m-val" style="font-size: 2.5rem; margin-bottom: 1rem;">${module.progress}%</div>
                    <div class="m-bar" style="margin-bottom: 2rem;"><div class="m-fill" style="width: ${module.progress}%"></div></div>
                    <button class="btn-primary" style="width: 100%;" id="complete-module" ${module.progress === 100 ? 'disabled' : ''}>
                        ${module.progress === 100 ? 'Sudah Selesai ✓' : 'Selesaikan Modul & Klaim XP'}
                    </button>
                </div>
            </div>
        </div>
    </div>
`;

const LearningPage = () => {
    const roleCourses = state.courses.filter(c => c.roles.includes(state.user.roleType.split(' ')[0]));
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

const SimulationPage = () => `
    <div class="fade-in">
        <h1>Simulation Q&A dengan Nasabah</h1>
        <div class="sim-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-top: 2rem;">
            ${state.simulations.map(sim => `
                <div class="m-card sim-card" style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">${sim.id === 'umkm' ? '🏬' : '🏢'}</div>
                    <h3>${sim.title}</h3>
                    <p>Difficulty: <b>${sim.difficulty}</b></p>
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
            <div class="m-card" style="padding: 10px 20px; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 0.8rem; font-weight: 800; color: var(--bca-blue-primary);">BENEFIT TRANSLATOR</span>
                <label class="switch"><input type="checkbox" id="benefit-toggle" ${state.benefitMode ? 'checked' : ''}><span class="slider round"></span></label>
            </div>
        </header>
        <div class="ai-layout">
            <div class="chat-main">
                <div class="chat-content" id="chat-messages">${state.chatHistory.map(m => `<div class="msg ${m.role}">${m.content}</div>`).join('')}</div>
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input" id="chat-input-main" placeholder="Tanya tentang fitur...">
                    <button class="btn-primary" id="btn-send-main">🚀</button>
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
        <header><h1>Knowledge Capture Loop</h1></header>
        <div class="ingestion-container">
            <div class="hub-card">
                <div class="type-grid">${['Dokumen', 'Video', 'FAQ'].map(t => `<div class="type-item"><div class="type-label">${t}</div></div>`).join('')}</div>
                <div class="upload-zone"><p>Upload data resmi ke RAG database</p></div>
            </div>
            <div class="process-column">
                ${state.ingestionSteps.map(s => `<div class="process-step ${s.status}"><div class="step-num">${s.id}</div><div>${s.label}</div></div>`).join('')}
            </div>
        </div>
    </div>
`;

const LeaderboardPage = () => `
    <div class="fade-in">
        <h1>Ocean Champion Leaderboard</h1>
        <p class="subtitle">Top adoption rate & quiz score tertinggi per Region.</p>

        <div class="mastery-grid" style="grid-template-columns: 1fr; margin-top: 2rem;">
            <div class="m-card">
                <div class="m-podium">
                    <div class="podium-col rank-2"><div class="p-avatar">🥈</div><div class="p-name">Sarah Wijaya</div><div class="p-pts">11.230 XP</div><div class="p-step">2nd</div></div>
                    <div class="podium-col rank-1"><div class="p-crown">👑</div><div class="p-avatar">🥇</div><div class="p-name">Andi Pratama</div><div class="p-pts">12.560 XP</div><div class="p-step">1st</div></div>
                    <div class="podium-col rank-3"><div class="p-avatar">🥉</div><div class="p-name">Budi Santoso</div><div class="p-pts">10.980 XP</div><div class="p-step">3rd</div></div>
                </div>
                <table class="m-table">
                    <thead><tr><th>Rank</th><th>Cabang</th><th>Champion</th><th>Poin</th></tr></thead>
                    <tbody>
                        ${state.leaderboard.map((u, i) => `
                            <tr class="${u.name.includes('Anda') ? 'active-row' : ''}"><td>${i + 1}</td><td>${u.branch}</td><td>${u.name}</td><td>${u.points}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
`;

// --- Public Components ---

const PublicNavbar = () => `
    <nav class="public-nav">
        <div class="nav-container">
            <div class="nav-logo" id="nav-home">
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
                <p>Ocean by BCA bukan sekadar perbankan bisnis. Ini adalah ekosistem pintar untuk mengelola arus kas, otomasi transaksi, dan pertumbuhan ekosistem bisnis Anda.</p>
                <div class="hero-ctas">
                    <button class="btn-primary btn-lg" data-page="sandbox">Try It Out (Sandbox)</button>
                    <button class="btn-outline btn-lg" data-page="how-it-works">Watch How It Works</button>
                </div>
            </div>
            <div class="hero-visual">
                <div class="visual-card main">
                    <div class="visual-header">
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                    </div>
                    <div class="visual-body">
                        <div class="fake-chart"></div>
                        <div class="fake-rows">
                            <div class="fake-row"></div>
                            <div class="fake-row"></div>
                        </div>
                    </div>
                </div>
                <div class="visual-card floating-1">
                    <span>⚡ Real-time Invoicing</span>
                </div>
                <div class="visual-card floating-2">
                    <span>🛡️ Bank-grade Security</span>
                </div>
            </div>
        </section>

        <section class="use-case-section">
            <h2 class="section-title">Solusi untuk Setiap Sektor</h2>
            <div class="sector-tabs">
                ${['Retail', 'Manufaktur', 'Jasa', 'Logistik'].map(s => `
                    <button class="sector-tab ${state.selectedSector === s ? 'active' : ''}" data-sector="${s}">${s}</button>
                `).join('')}
            </div>
            <div class="sector-content card-premium">
                <div class="sector-text">
                    <h3>Ocean untuk ${state.selectedSector}</h3>
                    <p>${state.selectedSector === 'Retail' ? 'Kelola ratusan cabang dengan satu dashboard. Otomasi rekonsiliasi harian dan integrasi langsung dengan POS Anda.' : 
                        state.selectedSector === 'Manufaktur' ? 'Optimalkan supply chain financing dan pembayaran vendor dalam skala besar dengan akurasi 100%.' :
                        'Solusi pembayaran invoice otomatis dan manajemen cash flow yang membantu bisnis Anda tetap likuid.'}</p>
                    <ul class="benefit-list">
                        <li><span>✓</span> Konsolidasi Rekening Otomatis</li>
                        <li><span>✓</span> Laporan Real-time 24/7</li>
                        <li><span>✓</span> Integrasi API Seamless</li>
                    </ul>
                </div>
                <div class="sector-image">
                    <img src="/public/images/feature-1.png" alt="Feature" style="width: 100%; border-radius: 12px;">
                </div>
            </div>
        </section>

        <section class="trust-section">
            <div class="trust-content">
                <span class="badge-premium">Bank-grade Trust</span>
                <h2 class="section-title">Keamanan Tingkat Perbankan</h2>
                <div class="trust-grid">
                    <div class="trust-card">
                        <div class="cert-badge">Certified</div>
                        <div class="trust-icon-box">🛡️</div>
                        <h4>ISO 27001</h4>
                        <p>Standar internasional untuk sistem manajemen keamanan informasi (ISMS).</p>
                    </div>
                    <div class="trust-card">
                        <div class="cert-badge">Compliant</div>
                        <div class="trust-icon-box">⚖️</div>
                        <h4>PDP Law</h4>
                        <p>Kepatuhan penuh terhadap regulasi Perlindungan Data Pribadi di Indonesia.</p>
                    </div>
                    <div class="trust-card">
                        <div class="cert-badge">Isolated</div>
                        <div class="trust-icon-box">💎</div>
                        <h4>Enterprise Isolation</h4>
                        <p>Data sandbox 100% terisolasi menggunakan enkripsi tingkat tinggi AES-256.</p>
                    </div>
                </div>
            </div>
        </section>
    </div>
`;

const SandboxPage = () => `
    <div class="public-layout fade-in">
        <header class="page-header-p">
            <h1>Ocean Sandbox Demo</h1>
            <p>Eksplorasi dashboard interaktif tanpa menggunakan data asli Anda.</p>
        </header>

        <div class="sandbox-container card-premium">
            <aside class="sandbox-sidebar">
                <div class="sb-menu active">🏠 Dashboard</div>
                <div class="sb-menu">📊 Analytics</div>
                <div class="sb-menu">📑 Invoicing</div>
                <div class="sb-menu">🤝 Ecosystem</div>
            </aside>
            <main class="sandbox-main">
                <div class="sb-stats">
                    <div class="sb-stat">
                        <label>Total Saldo (5 Rekening)</label>
                        <div class="val">Rp 12.450.000.000</div>
                        <span class="trend up">▲ 12% vs bulan lalu</span>
                    </div>
                    <div class="sb-stat">
                        <label>Incoming Today</label>
                        <div class="val">Rp 450.200.000</div>
                    </div>
                </div>
                <div class="sb-chart-placeholder">
                    <div class="chart-header">
                        <span>Cash Flow Trend</span>
                        <div class="chart-legend">
                            <span class="in">Inflow</span>
                            <span class="out">Outflow</span>
                        </div>
                    </div>
                    <div class="fake-chart-visual">
                        <div class="bar" style="height: 40%"></div>
                        <div class="bar" style="height: 60%"></div>
                        <div class="bar" style="height: 45%"></div>
                        <div class="bar" style="height: 80%"></div>
                        <div class="bar" style="height: 55%"></div>
                        <div class="bar" style="height: 90%"></div>
                        <div class="bar" style="height: 75%"></div>
                    </div>
                </div>
                <div class="sb-recent">
                    <h4>Transaksi Terbaru (Dummy Data)</h4>
                    <table class="sb-table">
                        <thead>
                            <tr><th>Tanggal</th><th>Deskripsi</th><th>Nominal</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>02 May 2026</td><td>Transfer Incoming - PT Retail Jaya</td><td>Rp 25.000.000</td><td><span class="tag-s">Success</span></td></tr>
                            <tr><td>02 May 2026</td><td>Vendor Payment - Logistik Abadi</td><td>Rp 12.500.000</td><td><span class="tag-s">Success</span></td></tr>
                            <tr><td>01 May 2026</td><td>Payroll Disbursement</td><td>Rp 120.000.000</td><td><span class="tag-s">Success</span></td></tr>
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
        
        <div class="sandbox-footer">
            <p>Puas dengan simulasinya? Hubungi RO kami untuk implementasi nyata.</p>
            <button class="btn-primary btn-lg">Tinggalkan Kontak</button>
        </div>
    </div>
`;

const ROICalculatorPage = () => `
    <div class="public-layout fade-in">
        <header class="page-header-p">
            <h1>ROI Calculator</h1>
            <p>Estimasi penghematan waktu dan biaya operasional dengan Ocean.</p>
        </header>

        <div class="roi-container">
            <div class="roi-form card-premium">
                <h3>Input Bisnis Anda</h3>
                <div class="input-group">
                    <label>Jumlah Cabang / Lokasi</label>
                    <input type="number" id="roi-branches" value="${state.roiInputs.branches}">
                </div>
                <div class="input-group">
                    <label>Rata-rata Transaksi Bulanan per Cabang</label>
                    <input type="number" id="roi-transactions" value="${state.roiInputs.transactions}">
                </div>
                <div class="input-group">
                    <label>Waktu Rekonsiliasi Manual (Jam/Hari)</label>
                    <input type="number" id="roi-time" value="4">
                </div>
                <button class="btn-primary" style="width: 100%;" id="calc-roi">Hitung Estimasi</button>
            </div>
            <div class="roi-results card-premium">
                <h3>Estimasi Manfaat Ocean</h3>
                <div class="roi-grid">
                    <div class="roi-res-card">
                        <div class="label">Penghematan Waktu</div>
                        <div class="val">${Math.round(state.roiInputs.branches * 2.5)} Jam / Hari</div>
                        <p>Otomasi rekonsiliasi menghemat 70% waktu tim finance.</p>
                    </div>
                    <div class="roi-res-card highlight">
                        <div class="label">Efisiensi Biaya Operasional</div>
                        <div class="val">Rp ${ (state.roiInputs.branches * 1500000).toLocaleString('id-ID') } / Bulan</div>
                        <p>Pengurangan biaya manual error dan administrasi.</p>
                    </div>
                </div>
                <div class="roi-summary">
                    <p>Estimasi ini berdasarkan data rata-rata nasabah Ocean di sektor sejenis.</p>
                </div>
            </div>
        </div>
    </div>
`;

const HowItWorksPage = () => `
    <div class="public-layout fade-in">
        <header class="page-header-p">
            <h1>How Ocean Works</h1>
            <p>Langkah mudah menuju ekosistem perbankan modern.</p>
        </header>

        <div class="how-grid">
            <div class="how-step">
                <div class="how-num">1</div>
                <div class="how-content card-premium">
                    <h4>Hubungkan Rekening</h4>
                    <p>Integrasi seamless dengan KlikBCA Bisnis Anda. Pindahkan akses tanpa ribet.</p>
                    <div class="how-visual-mini">🔗</div>
                </div>
            </div>
            <div class="how-step">
                <div class="how-num">2</div>
                <div class="how-content card-premium">
                    <h4>Aktifkan myEcosystem</h4>
                    <p>Pilih mitra strategis seperti CATAPA (HR) atau Paper.id (Invoicing) langsung dari dashboard.</p>
                    <div class="how-visual-mini">🧩</div>
                </div>
            </div>
            <div class="how-step">
                <div class="how-num">3</div>
                <div class="how-content card-premium">
                    <h4>Automasi Alur Kerja</h4>
                    <p>Biarkan Ocean menangani rekonsiliasi, pembayaran terjadwal, dan laporan keuangan Anda.</p>
                    <div class="how-visual-mini">⚙️</div>
                </div>
            </div>
        </div>

        <div class="comparison-section card-premium">
            <h3>KlikBCA Bisnis vs Ocean</h3>
            <table class="sb-table">
                <thead>
                    <tr><th>Fitur</th><th>KlikBCA Bisnis</th><th>Ocean by BCA</th></tr>
                </thead>
                <tbody>
                    <tr><td>Akses Portal</td><td>Multiple Login</td><td><b>Single Sign-On (Direct Access)</b></td></tr>
                    <tr><td>Dashboard</td><td>Tabular Only</td><td><b>Interactive Visualization</b></td></tr>
                    <tr><td>Integrasi ERP/HR</td><td>Manual Upload</td><td><b>Real-time API Integration</b></td></tr>
                    <tr><td>Insight AI</td><td>Tidak Ada</td><td><b>Ocean AI Assistant</b></td></tr>
                </tbody>
            </table>
        </div>
    </div>
`;

const SecurityPage = () => `
    <div class="public-layout fade-in">
        <header class="page-header-p">
            <h1>Keamanan & Kepatuhan</h1>
            <p>Data Anda adalah prioritas utama kami dengan standar perbankan kelas dunia.</p>
        </header>

        <div class="security-hero card-premium">
            <div class="shield-visual">🛡️</div>
            <h2>Bank-grade Security</h2>
            <p>Setiap transaksi dan pertukaran data dilindungi dengan enkripsi AES-256 dan protokol TLS terbaru.</p>
        </div>

        <div class="cert-grid">
            <div class="cert-card">
                <div class="cert-logo-container">
                    <div class="cert-logo-placeholder">ISO 27001</div>
                </div>
                <h4>Information Security</h4>
                <p>Implementasi ISMS global untuk menjamin kerahasiaan, integritas, dan ketersediaan data Anda.</p>
                <div class="cert-status"><span class="status-dot"></span> Certified & Audited</div>
            </div>
            <div class="cert-card">
                <div class="cert-logo-container">
                    <div class="cert-logo-placeholder">PDP</div>
                </div>
                <h4>Data Privacy</h4>
                <p>Seluruh proses pengolahan data mematuhi standar UU Perlindungan Data Pribadi yang berlaku.</p>
                <div class="cert-status"><span class="status-dot"></span> Compliant</div>
            </div>
            <div class="cert-card">
                <div class="cert-logo-container">
                    <div class="cert-logo-placeholder">BCA SECURE</div>
                </div>
                <h4>Internal Audit</h4>
                <p>Pengawasan dan pengujian penetrasi (Pen-test) berkala oleh tim pakar keamanan internal BCA.</p>
                <div class="cert-status"><span class="status-dot"></span> Active Monitoring</div>
            </div>
        </div>
    </div>
`;

const PublicAIChatbot = () => `
    <div class="chatbot-floating" id="chatbot-trigger">
        <div class="chat-badge">Ocean AI</div>
        <div class="chat-icon-b">🤖</div>
    </div>
    <div class="chat-window" id="chat-window" style="display: none;">
        <div class="chat-header-w">
            <span>Ocean AI Assistant</span>
            <button id="close-chat">×</button>
        </div>
        <div class="chat-body-w" id="public-chat-messages">
            <div class="msg ai">Halo! Saya Ocean AI. Bagaimana saya bisa membantu bisnis Anda hari ini?</div>
        </div>
        <div class="chat-footer-w">
            <input type="text" id="public-chat-input" placeholder="Tanya tentang benefit Ocean...">
            <button id="public-send-chat">🚀</button>
        </div>
    </div>
`;

const OceanAuth = () => {
    const renderLogin = () => `
        <div class="fade-in">
            <h2 class="auth-title" style="margin-bottom: 2rem;">Halo, Selamat Datang!</h2>
            
            <div class="login-form" style="text-align: left;">
                <label class="auth-label">BCA ID Bisnis</label>
                <div class="input-group-auth">
                    <span class="input-tag">Corporate ID</span>
                    <input type="text" class="auth-field" id="corp-id" placeholder="Masukkan Corporate ID" value="${state.corporateId}">
                </div>
                <div class="input-group-auth" style="margin-bottom: 2rem;">
                    <span class="input-tag">User ID</span>
                    <input type="text" class="auth-field" id="user-id" placeholder="Masukkan User ID" value="${state.userId}">
                </div>

                <label class="auth-label">KeyBCA Response <span class="help-icon">?</span></label>
                <div class="input-group-auth">
                    <input type="text" class="auth-field" id="key-response" placeholder="Masukkan KeyBCA Response" value="${state.keyBcaResponse}">
                </div>

                <button class="btn-primary" id="btn-login-submit" style="width: 100%; margin-top: 2rem; padding: 16px; border-radius: 50px; background: #ccc; cursor: not-allowed;" disabled>Masuk</button>
                
                <div style="margin-top: 1.5rem; text-align: center;">
                    <a href="#" class="auth-link">Buka Blokir User</a>
                </div>
            </div>
            <div class="back-link" id="cancel-auth" style="margin-top: 2rem;">Kembali ke Beranda</div>
        </div>
    `;

    const renderSelect = () => `
        <div class="fade-in">
            <h2 class="auth-title">Ocean Auth</h2>
            <p class="auth-subtitle">Pilih metode verifikasi untuk mengakses portal internal.</p>
            <div class="method-grid">
                <button class="method-btn" data-auth="pin">
                    <div class="method-icon">🔑</div>
                    <div class="method-info">
                        <h4>PIN Ocean</h4>
                        <p>Gunakan 6 digit PIN keamanan Anda</p>
                    </div>
                </button>
                <button class="method-btn" data-auth="biometric">
                    <div class="method-icon">👤</div>
                    <div class="method-info">
                        <h4>Biometrik</h4>
                        <p>Face ID atau Sidik Jari</p>
                    </div>
                </button>
                <button class="method-btn" data-auth="otp">
                    <div class="method-icon">📧</div>
                    <div class="method-info">
                        <h4>OTP Email</h4>
                        <p>Kode verifikasi ke email terdaftar</p>
                    </div>
                </button>
            </div>
            <div class="back-link" id="cancel-auth">Kembali ke Beranda</div>
        </div>
    `;

    const renderPin = () => `
        <div class="fade-in">
            <h2 class="auth-title">Masukkan PIN</h2>
            <p class="auth-subtitle">Silakan masukkan 6 digit PIN Ocean Anda.</p>
            <div class="pin-display">
                ${[...Array(6)].map((_, i) => `<div class="pin-dot ${state.pin.length > i ? 'filled' : ''}"></div>`).join('')}
            </div>
            <div class="pin-keypad">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="key-btn" data-key="${num}">${num}</button>`).join('')}
                <button class="key-btn" style="font-size: 1rem; color: #ef4444;" data-key="clear">CLR</button>
                <button class="key-btn" data-key="0">0</button>
                <button class="key-btn" style="font-size: 1rem; color: var(--ocean-accent);" data-key="del">DEL</button>
            </div>
            <div class="back-link" data-auth="select">Ganti Metode Verifikasi</div>
        </div>
    `;

    const renderBiometric = () => `
        <div class="fade-in">
            <h2 class="auth-title">Verifikasi Biometrik</h2>
            <p class="auth-subtitle">Memindai wajah atau sidik jari Anda...</p>
            <div class="biometric-visual">
                <div class="scan-line"></div>
                ${state.isAuthenticating ? '✅' : '👤'}
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted);">${state.isAuthenticating ? 'Berhasil diverifikasi!' : 'Posisikan wajah Anda pada layar'}</p>
            <div class="back-link" data-auth="select">Ganti Metode Verifikasi</div>
        </div>
    `;

    const renderOtp = () => `
        <div class="fade-in">
            <h2 class="auth-title">Verifikasi OTP</h2>
            <p class="auth-subtitle">Kami telah mengirimkan kode ke an***@bca.co.id</p>
            <div class="otp-grid">
                ${state.otp.map((v, i) => `<input type="text" class="otp-input" value="${v}" maxlength="1" data-otp-idx="${i}">`).join('')}
            </div>
            <div class="resend-timer">
                Tidak menerima kode? <span class="resend-link">Kirim Ulang (59s)</span>
            </div>
            <div class="back-link" data-auth="select">Ganti Metode Verifikasi</div>
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

    return `
        <div class="auth-overlay">
            <div class="auth-card">
                <div class="auth-logo">O</div>
                ${stepContent}
            </div>
        </div>
    `;
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
            case 'sandbox': content = SandboxPage(); break;
            case 'roi': content = ROICalculatorPage(); break;
            case 'how-it-works': content = HowItWorksPage(); break;
            case 'security': content = SecurityPage(); break;
            default: content = LandingPage();
        }

        app.innerHTML = `
            <div class="public-wrapper">
                ${PublicNavbar()}
                <main class="public-main-content">
                    ${content}
                </main>
                ${PublicAIChatbot()}
            </div>
        `;
    } else {
        switch(page) {
            case 'dashboard': content = DashboardPage(); break;
            case 'learning': content = LearningPage(); break;
            case 'module-detail': content = ModuleDetailPage(state.activeModule); break;
            case 'ai': content = AIPage(); break;
            case 'simulation': content = SimulationPage(); break;
            case 'ingestion': content = IngestionPage(); break;
            case 'leaderboard': content = LeaderboardPage(); break;
            default: content = DashboardPage();
        }

        app.innerHTML = `
            <div class="layout">
                ${Sidebar()}
                <main class="main-content">
                    ${content}
                </main>
            </div>
        `;
    }

    attachEventListeners();
};

const attachEventListeners = () => {
    // --- Auth Listeners ---
    if (state.viewMode === 'auth') {
        // Login Logic
        const corpIdInput = document.getElementById('corp-id');
        const userIdInput = document.getElementById('user-id');
        const keyBcaInput = document.getElementById('key-response');
        const loginBtn = document.getElementById('btn-login-submit');

        const validateLogin = () => {
            const isValid = state.corporateId && state.userId && state.keyBcaResponse;
            if (loginBtn) {
                loginBtn.disabled = !isValid;
                loginBtn.style.background = isValid ? 'var(--bca-blue-primary)' : '#ccc';
                loginBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
            }
        };

        if (corpIdInput) corpIdInput.addEventListener('input', (e) => { state.corporateId = e.target.value; validateLogin(); });
        if (userIdInput) userIdInput.addEventListener('input', (e) => { state.userId = e.target.value; validateLogin(); });
        if (keyBcaInput) keyBcaInput.addEventListener('input', (e) => { state.keyBcaResponse = e.target.value; validateLogin(); });

        // Initial validation
        validateLogin();

        if (loginBtn) loginBtn.addEventListener('click', () => {
            if (state.corporateId && state.userId && state.keyBcaResponse) {
                state.authStep = 'select';
                render();
            }
        });

        document.querySelectorAll('[data-auth]').forEach(btn => {
            btn.addEventListener('click', () => {
                const step = btn.getAttribute('data-auth');
                state.authStep = step;
                state.pin = ''; // Reset pin on switch
                render();

                if (step === 'biometric') {
                    state.isAuthenticating = false;
                    setTimeout(() => {
                        state.isAuthenticating = true;
                        render();
                        setTimeout(() => {
                            state.viewMode = 'internal';
                            state.currentPage = 'dashboard';
                            render();
                        }, 1000);
                    }, 2000);
                }
            });
        });

        const cancelBtn = document.getElementById('cancel-auth');
        if (cancelBtn) cancelBtn.addEventListener('click', () => {
            state.viewMode = 'public';
            state.currentPage = 'landing';
            render();
        });

        // PIN Keypad
        document.querySelectorAll('.key-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-key');
                if (key === 'clear') state.pin = '';
                else if (key === 'del') state.pin = state.pin.slice(0, -1);
                else if (state.pin.length < 6) state.pin += key;

                render();

                if (state.pin.length === 6) {
                    setTimeout(() => {
                        state.viewMode = 'internal';
                        state.currentPage = 'dashboard';
                        render();
                    }, 500);
                }
            });
        });

        // OTP Logic
        document.querySelectorAll('.otp-input').forEach((input, idx) => {
            input.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val && idx < 3) {
                    document.querySelectorAll('.otp-input')[idx + 1].focus();
                }
                state.otp[idx] = val;
                
                if (state.otp.every(o => o !== '')) {
                    setTimeout(() => {
                        state.viewMode = 'internal';
                        state.currentPage = 'dashboard';
                        render();
                    }, 500);
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && idx > 0) {
                    document.querySelectorAll('.otp-input')[idx - 1].focus();
                }
            });
        });

        return; // Don't attach other listeners in auth mode
    }

    // Nav Links & Module Handling
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            state.currentPage = e.currentTarget.getAttribute('data-page');
            render();
            window.scrollTo(0,0);
        });
    });

    document.querySelectorAll('.start-module').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const courseId = parseInt(e.currentTarget.getAttribute('data-id'));
            state.activeModule = state.courses.find(c => c.id === courseId);
            state.currentPage = 'module-detail';
            render();
        });
    });

    // Complete Module Handler
    const completeBtn = document.getElementById('complete-module');
    if (completeBtn && state.activeModule) {
        completeBtn.addEventListener('click', () => {
            state.activeModule.progress = 100;
            state.user.points += 250; // Award XP
            alert('Selamat! Anda menyelesaikan modul ini dan mendapatkan 250 XP! 🏆');
            state.currentPage = 'learning';
            render();
        });
    }

    // View Mode Switches
    const adminBtn = document.getElementById('set-admin');
    const staffBtn = document.getElementById('set-staff');
    const directInternalBtn = document.getElementById('btn-direct-internal');
    const loginTriggerBtn = document.getElementById('btn-login-trigger');
    const homeBtn = document.getElementById('nav-home');

    if (adminBtn) adminBtn.addEventListener('click', () => { state.role = 'admin'; state.currentPage = 'ingestion'; render(); });
    if (staffBtn) staffBtn.addEventListener('click', () => { state.role = 'staff'; state.currentPage = 'dashboard'; render(); });
    if (directInternalBtn) directInternalBtn.addEventListener('click', () => { state.viewMode = 'internal'; state.currentPage = 'dashboard'; render(); });
    if (loginTriggerBtn) loginTriggerBtn.addEventListener('click', () => { state.viewMode = 'auth'; state.authStep = 'login'; render(); });
    if (homeBtn) homeBtn.addEventListener('click', () => { state.viewMode = 'public'; state.currentPage = 'landing'; render(); });

    // AI & Benefits
    const benefitToggle = document.getElementById('benefit-toggle');
    if (benefitToggle) benefitToggle.addEventListener('change', (e) => { state.benefitMode = e.target.checked; });

    const sendBtn = document.getElementById('btn-send-main');
    const chatInput = document.getElementById('chat-input-main');
    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', () => {
            const val = chatInput.value; if (!val) return;
            state.chatHistory.push({ role: 'user', content: val });
            let resp = "Menganalisis basis pengetahuan...";
            if (state.benefitMode) resp = "<b>[Benefit Translator]</b>: Berdasarkan RAG, fitur ini akan memberikan efisiensi operasional sebesar 30% bagi nasabah UMKM Anda.";
            setTimeout(() => { state.chatHistory.push({ role: 'ai', content: resp }); render(); }, 800);
            chatInput.value = ''; render();
        });
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendBtn.click(); });
    }


    // Sector Selector
    document.querySelectorAll('.sector-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.selectedSector = tab.getAttribute('data-sector');
            render();
        });
    });

    // ROI Calc
    const calcBtn = document.getElementById('calc-roi');
    if (calcBtn) {
        calcBtn.addEventListener('click', () => {
            state.roiInputs.branches = parseInt(document.getElementById('roi-branches').value) || 1;
            state.roiInputs.transactions = parseInt(document.getElementById('roi-transactions').value) || 100;
            render();
        });
    }

    // Chatbot Floating
    const chatTrigger = document.getElementById('chatbot-trigger');
    const chatWindow = document.getElementById('chat-window');
    const closeChat = document.getElementById('close-chat');

    if (chatTrigger && chatWindow) {
        chatTrigger.addEventListener('click', () => {
            chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
        });
        closeChat.addEventListener('click', (e) => {
            e.stopPropagation();
            chatWindow.style.display = 'none';
        });
    }

    // Ingestion Logics (Internal)
    const btnPilih = document.getElementById('btn-pilih');
    if (btnPilih) btnPilih.addEventListener('click', () => {
        if (state.isIngesting) return;
        state.isIngesting = true;
        render();
        let step = 0;
        const interval = setInterval(() => {
            if (step > 0) state.ingestionSteps[step-1].status = 'completed';
            if (step < 5) { state.ingestionSteps[step].status = 'active'; step++; render(); }
            else { clearInterval(interval); state.isIngesting = false; render(); }
        }, 1000);
    });

    // Chat Logic (Internal)
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send-chat');
    if (chatInput && sendBtn) {
        const send = () => {
            const val = chatInput.value.trim();
            if (!val) return;
            state.chatHistory.push({ role: 'user', content: val });
            chatInput.value = '';
            render();
            setTimeout(() => {
                let aiResponse = "Menganalisis basis pengetahuan...";
                if (val.toLowerCase().includes('benefit')) {
                    aiResponse = `<b>RAG Analysis - Business Benefit Translator:</b><br><br>
                    1. <b>Multi-rekening dashboard</b> → Visibilitas arus kas real-time.<br>
                    2. <b>Real-time report</b> → Keputusan lebih cepat & akurat.<br>
                    3. <b>Otomasi Rekonsiliasi</b> → Penghematan waktu operasional hingga 70%.<br><br>
                    <b>Script Presentasi:</b> "Dengan Ocean, Bapak/Ibu bisa memantau ratusan rekening cabang dalam satu layar secara real-time..."`;
                }
                state.chatHistory.push({ role: 'ai', content: aiResponse });
                render();
            }, 1000);
        };
        sendBtn.addEventListener('click', send);
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    }

    // Chat Logic (Public)
    const pubChatInput = document.getElementById('public-chat-input');
    const pubSendBtn = document.getElementById('public-send-chat');
    if (pubChatInput && pubSendBtn) {
        const send = () => {
            const val = pubChatInput.value.trim();
            if (!val) return;
            const msgBox = document.getElementById('public-chat-messages');
            msgBox.innerHTML += `<div class="msg user">${val}</div>`;
            pubChatInput.value = '';
            setTimeout(() => {
                msgBox.innerHTML += `<div class="msg ai"><b>BCA Ocean AI:</b> Tentu! Berdasarkan kebutuhan bisnis Anda, Ocean membantu monitoring arus kas ${state.roiInputs.branches} cabang secara otomatis. Anda bisa menghemat sekitar 70% waktu administrasi harian.</div>`;
                msgBox.scrollTop = msgBox.scrollHeight;
            }, 1000);
        };
        pubSendBtn.addEventListener('click', send);
        pubChatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    }
};

render();
