import './style.css'

// --- State Management ---
const state = {
    viewMode: 'public', // 'public' or 'internal'
    role: 'staff',
    currentPage: 'landing',
    user: {
        name: 'Andi RO Senior',
        branch: 'KCU Jakarta Area',
        points: 2450,
        level: 'Expert',
        progress: 85,
        badges: ['Fast Learner', 'Problem Solver', 'BCA Champion']
    },
    leaderboard: [
        { rank: 1, name: 'Siti Aminah', branch: 'KCU Surabaya', points: 3100 },
        { rank: 2, name: 'Budi Santoso', branch: 'KCU Jakarta', points: 2950 },
        { rank: 3, name: 'Andi (Anda)', branch: 'KCU Jakarta', points: 2450 },
        { rank: 4, name: 'Dewi Lestari', branch: 'KCU Medan', points: 2200 }
    ],
    courses: [
        { id: 1, title: 'Mastering Business Dashboard', cat: 'Technical', progress: 40, duration: '7 min' },
        { id: 2, title: 'Pitching for UMKM', cat: 'Soft Skill', progress: 100, duration: '5 min' },
        { id: 3, title: 'Ocean API Security', cat: 'Compliance', progress: 10, duration: '10 min' }
    ],
    ingestionSteps: [
        { id: 1, label: 'Upload / Import File', status: 'waiting' },
        { id: 2, label: 'Ekstraksi Teks & Data', status: 'waiting' },
        { id: 3, label: 'Chunking & Embedding', status: 'waiting' },
        { id: 4, label: 'Validasi & Enrichment', status: 'waiting' },
        { id: 5, label: 'Simpan ke Vector DB', status: 'waiting' }
    ],
    chatHistory: [
        { role: 'ai', content: 'Halo! Saya Ocean AI Assistant. Ada yang bisa saya bantu terkait solusi bisnis BCA?' }
    ],
    isIngesting: false,
    roiInputs: {
        branches: 1,
        transactions: 100
    },
    selectedSector: 'Retail'
};

// --- Components ---

const Sidebar = () => {
    const isAdmin = state.role === 'admin';
    
    const adminMenu = [
        { id: 'analytics', label: 'Adoption Analytics', icon: '📊' },
        { id: 'ingestion', label: 'Ingestion Hub', icon: '⚙️' },
        { id: 'sources', label: 'Data Sources', icon: '📂' },
        { id: 'reports', label: 'Branch Reports', icon: '📈' },
        { id: 'settings', label: 'Admin Settings', icon: '⚙️' }
    ];

    const staffMenu = [
        { id: 'dashboard', label: 'My Dashboard', icon: '🏠' },
        { id: 'ai', label: 'Ocean AI Assistant', icon: '🤖' },
        { id: 'learning', label: 'Learning Mastery', icon: '🎓' },
        { id: 'simulation', label: 'Simulation Role-play', icon: '🤝' },
        { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
        { id: 'settings-ai', label: 'My Profile', icon: '👤' }
    ];

    const menuItems = isAdmin ? adminMenu : staffMenu;

    return `
        <aside class="sidebar">
            <div class="role-switcher">
                <button class="role-btn ${isAdmin ? 'active' : ''}" id="set-admin">ADMIN (Knowledge)</button>
                <button class="role-btn ${!isAdmin ? 'active' : ''}" id="set-staff">STAFF (RO/Ops)</button>
            </div>

            <div class="sidebar-logo">
                <div class="logo-box">O</div>
                <span>${isAdmin ? 'Ocean Admin' : 'Ocean Platform'}</span>
            </div>

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
                    <div>
                        <div class="user-name">${state.user.name}</div>
                        <div class="user-branch">${state.user.branch}</div>
                    </div>
                </div>
            </div>
        </aside>
    `;
};

const DashboardPage = () => `
    <div class="fade-in">
        <header>
            <h1>Halo, Andi! Anda berada di Level <span style="color: var(--ocean-accent);">${state.user.level}</span></h1>
            <p class="subtitle">Selesaikan 1 modul lagi untuk mencapai level Master & klaim bonus KPI.</p>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Poin Karir</div>
                <div class="stat-val">${state.user.points} XP</div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${state.user.progress}%"></div></div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Tinggal 550 XP ke Master</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Peringkat Region</div>
                <div class="stat-val">#3</div>
                <div style="font-size: 0.75rem; color: #10b981; font-weight: 700;">▲ Naik 2 peringkat</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Sertifikat Digital</div>
                <div class="stat-val">8</div>
                <div style="font-size: 0.75rem; color: var(--bca-blue-primary);">Lihat semua sertifikat →</div>
            </div>
        </div>

        <section style="margin-top: 3rem;">
            <h2 style="margin-bottom: 1.5rem;">Rekomendasi Micro-learning</h2>
            <div class="learning-grid">
                ${state.courses.map(course => `
                    <div class="course-card">
                        <div class="course-tag">${course.cat}</div>
                        <h3>${course.title}</h3>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0.5rem 0;">Durasi: ${course.duration}</p>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${course.progress}%"></div></div>
                        <button class="btn-primary" style="width: 100%; padding: 10px; margin-top: 1rem;">${course.progress === 100 ? 'Review' : 'Mulai Belajar'}</button>
                    </div>
                `).join('')}
            </div>
        </section>
    </div>
`;

const AIPage = () => `
    <div class="fade-in">
        <header style="display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h1>Ocean AI Assistant</h1>
                <p class="subtitle">Just-in-time Q&A & Benefit Translator</p>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-outline active">Mode Tanya Jawab</button>
                <button class="btn-outline">Mode Translator</button>
            </div>
        </header>

        <div class="ai-layout">
            <div class="chat-main">
                <div class="chat-content" id="chat-messages">
                    ${state.chatHistory.map(msg => `
                        <div class="msg ${msg.role}">${msg.content}</div>
                    `).join('')}
                </div>
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input" id="chat-input" placeholder="Tanya: Bagaimana jelaskan benefit Business Dashboard ke CFO?">
                    <button class="btn-send-chat" id="btn-send-chat">🚀</button>
                </div>
            </div>

            <div class="ai-sources">
                <h3 style="font-size: 0.9rem; margin-bottom: 1rem;">Reference & Script</h3>
                <div class="source-item"><span>📜</span> Script: Pitching CFO</div>
                <div class="source-item"><span>📄</span> Document: Dashboard Guide</div>
                <div class="source-item"><span>🎥</span> Video: HO Socialization</div>
                <div style="margin-top: 2rem; background: var(--bca-blue-light); padding: 1rem; border-radius: 12px;">
                    <p style="font-size: 0.75rem; font-weight: 700; color: var(--bca-blue-primary);">Punya Best Practice?</p>
                    <p style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 1rem;">Upload video sosialisasi Anda untuk poin XP tambahan!</p>
                    <button class="btn-primary" style="width: 100%; font-size: 0.7rem; padding: 8px;">Upload Sekarang</button>
                </div>
            </div>
        </div>
    </div>
`;

const IngestionPage = () => `
    <div class="fade-in">
        <header>
            <h1>Admin: Knowledge Capture Loop</h1>
            <p class="subtitle">Ingest data resmi & video best practice ke dalam RAG database</p>
        </header>

        <div class="ingestion-container">
            <div class="hub-card">
                <h2 style="font-size: 1.2rem; margin-bottom: 1.5rem; color: var(--bca-blue-dark);">Ocean Knowledge Hub</h2>
                <div class="type-grid">
                    ${['Dokumen', 'Video Sosialisasi', 'Audio', 'Teks', 'FAQ', 'Web Link'].map((t, i) => `
                        <div class="type-item">
                            <div class="type-icon">${['📄', '🎬', '🎧', '📝', '❓', '🔗'][i]}</div>
                            <div class="type-label">${t}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="upload-zone ${state.isIngesting ? 'active' : ''}" id="upload-zone">
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Upload Video Sosialisasi / Dokumen Baru</p>
                    <button class="btn-primary" id="btn-pilih" style="margin-top: 1rem;">Pilih File</button>
                </div>
            </div>

            <div class="process-column">
                <h2 style="font-size: 0.9rem; text-align: center; color: var(--bca-blue-primary); margin-bottom: 1rem;">RAG PROCESSING</h2>
                ${state.ingestionSteps.map(step => `
                    <div class="process-step ${step.status}">
                        <div class="step-num">${step.status === 'completed' ? '✓' : step.id}</div>
                        <div style="font-size: 0.85rem; font-weight: 600;">${step.label}</div>
                    </div>
                `).join('')}
            </div>

            <div class="vector-db">
                <div class="db-icon">🗄️</div>
                <div style="font-weight: 800; font-size: 0.9rem; color: var(--bca-blue-dark);">RAG Vector DB</div>
                <div style="font-size: 0.7rem; color: var(--ocean-accent);">Updated Real-time</div>
            </div>
        </div>
    </div>
`;

const LeaderboardPage = () => `
    <div class="fade-in">
        <h1>Ocean Champion Leaderboard</h1>
        <p class="subtitle">Top adoption rate & quiz score tertinggi per Region.</p>

        <div class="leaderboard-podium">
            ${state.leaderboard.slice(0, 3).map((u, i) => `
                <div class="podium-item rank-${u.rank}">
                    <div class="podium-avatar">${u.name.charAt(0)}</div>
                    <div style="font-weight: 800; margin-top: 1rem;">${u.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${u.branch}</div>
                    <div style="font-size: 1.2rem; font-weight: 800; color: var(--bca-blue-primary); margin-top: 0.5rem;">${u.points} XP</div>
                </div>
            `).join('')}
        </div>

        <div class="leaderboard-list">
            ${state.leaderboard.map(u => `
                <div class="leaderboard-row">
                    <span style="font-weight: 800; width: 30px;">#${u.rank}</span>
                    <span style="flex: 1; font-weight: 600;">${u.name}</span>
                    <span style="width: 150px; color: var(--text-muted);">${u.branch}</span>
                    <span style="font-weight: 800; color: var(--bca-blue-primary);">${u.points} XP</span>
                </div>
            `).join('')}
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
                <button class="btn-outline" id="switch-internal">Internal Portal</button>
                <button class="btn-primary">Open Account</button>
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

// --- Router ---

const render = () => {
    const app = document.getElementById('app');
    if (!app) return;
    
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
            case 'ai': content = AIPage(); break;
            case 'ingestion': content = IngestionPage(); break;
            case 'leaderboard': content = LeaderboardPage(); break;
            case 'learning': content = DashboardPage(); break; 
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
    // Nav Links
    document.querySelectorAll('.nav-link, .nav-link-p, [data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            state.currentPage = e.currentTarget.getAttribute('data-page');
            render();
            window.scrollTo(0,0);
        });
    });

    // View Mode Switches
    const adminBtn = document.getElementById('set-admin');
    const staffBtn = document.getElementById('set-staff');
    const internalBtn = document.getElementById('switch-internal');
    const homeBtn = document.getElementById('nav-home');

    if (adminBtn) adminBtn.addEventListener('click', () => { state.role = 'admin'; state.currentPage = 'ingestion'; render(); });
    if (staffBtn) staffBtn.addEventListener('click', () => { state.role = 'staff'; state.currentPage = 'dashboard'; render(); });
    if (internalBtn) internalBtn.addEventListener('click', () => { state.viewMode = 'internal'; state.currentPage = 'dashboard'; render(); });
    if (homeBtn) homeBtn.addEventListener('click', () => { state.viewMode = 'public'; state.currentPage = 'landing'; render(); });

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
