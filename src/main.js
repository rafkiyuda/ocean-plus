import './style.css'
import { uploadDocument, importFromUrl, fetchDocuments, fetchStats, deleteDocument, chatWithRAG, chatSimulation } from './rag-service.js'

// ── Markdown renderer (lightweight, no deps) ────────────────────────────────
function renderMarkdown(text) {
    return text
        // Bold **text** or __text__
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        // Italic *text* or _text_
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Headers ### H3 / ## H2 / # H1
        .replace(/^### (.+)$/gm, '<h4 style="margin:0.8em 0 0.3em;font-size:0.95em;">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 style="margin:0.8em 0 0.3em;font-size:1.05em;">$1</h3>')
        .replace(/^# (.+)$/gm, '<h2 style="margin:0.8em 0 0.3em;font-size:1.15em;">$1</h2>')
        // Unordered list items (lines starting with * or - or •)
        .replace(/^[\*\-•]\s+(.+)$/gm, '<li style="margin:0.25em 0;">$1</li>')
        // Ordered list items
        .replace(/^\d+\.\s+(.+)$/gm, '<li style="margin:0.25em 0;">$1</li>')
        // Wrap consecutive <li> items into <ul>
        .replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, (match) => `<ul style="padding-left:1.2em;margin:0.3em 0;">${match}</ul>`)
        // Horizontal rule
        .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.15);margin:0.8em 0;">')
        // Line breaks: double newline → paragraph break
        .replace(/\n\n/g, '</p><p style="margin:0.5em 0;">')
        // Single newline → <br>
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^/, '<p style="margin:0;">')
        .replace(/$/, '</p>');
}

// --- State Management ---
const state = {
    viewMode: 'public', // 'public', 'internal', or 'auth'
    role: 'staff',
    currentPage: 'landing',
    authStep: 'login', // 'login', 'select', 'pin', 'biometric', 'otp'
    corporateId: 'BCA001',
    userId: 'ANDI01',
    keyBcaResponse: '123456',
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
    leaderboardFilter: 'Semua Cabang',
    leaderboard: [
        { rank: 1, name: 'Siti Aminah', branch: 'KCU Surabaya', points: 15200, avatar: '👩‍💼', role: 'Senior RO' },
        { rank: 2, name: 'Andi Pratama', branch: 'KCP Menteng', points: 12560, avatar: '👨‍💼', role: 'RO Pemula' },
        { rank: 3, name: 'Budi Santoso', branch: 'KCU Jakarta', points: 10980, avatar: '👨‍💻', role: 'Ops' },
        { rank: 4, name: 'Reza Pahlevi', branch: 'KCU Thamrin', points: 9500, avatar: '👨‍🚀', role: 'Senior RO' },
        { rank: 5, name: 'Anda', branch: 'KCP Menteng', points: 8450, avatar: '👨‍🚀', isMe: true, role: 'Senior RO' },
        { rank: 6, name: 'Dewi Lestari', branch: 'KCU Surabaya', points: 8120, avatar: '👩‍💻', role: 'Ops' },
        { rank: 7, name: 'Kevin Sanjaya', branch: 'KCU Jakarta', points: 7900, avatar: '👨‍💼', role: 'RO Pemula' }
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
    activeSimulation: null,
    simChatHistory: [],
    isIngesting: false,
    roiInputs: { branches: 1, transactions: 100 },
    selectedSector: 'Retail',
    productSearchQuery: '',
    productSelectedSector: 'Semua',
    productSelectedCategory: 'Rekening',
    selectedProducts: [],
    // RAG Hub state
    ragDocs: [],
    ragStats: { docs: 0, chunks: 0 },
    ragUploading: false,
    ragUploadProgress: { step: 0, message: '' },
    ragUploadError: null,
    ragActiveType: 'doc',
    ragLoaded: false,
    sandboxTab: 'dashboard',
    sandbox: {
        totalBalance: 12450000000,
        incomingToday: 450200000,
        outgoingToday: 120500000,
        pendingApprovalCount: 3,
        transactions: [
            { date: '26 May 2026', desc: 'Transfer Incoming - PT Retail Jaya', amount: 25000000, type: 'in', status: 'Success' },
            { date: '26 May 2026', desc: 'Vendor Payment - Logistik Abadi', amount: -12500000, type: 'out', status: 'Success' },
            { date: '25 May 2026', desc: 'Payroll Disbursement (45 karyawan)', amount: -120000000, type: 'out', status: 'Success' },
            { date: '25 May 2026', desc: 'VA Collection - INV-2026-0045', amount: 8750000, type: 'in', status: 'Success' },
            { date: '24 May 2026', desc: 'Auto-Debit Listrik PLN', amount: -4200000, type: 'out', status: 'Pending' }
        ],
        invoices: [
            { id: 'INV-2026-0051', customer: 'PT Retail Jaya', amount: 25000000, due: '30 Jun 2026', status: 'Lunas' },
            { id: 'INV-2026-0050', customer: 'CV Logistik Abadi', amount: 12500000, due: '15 Jun 2026', status: 'Menunggu' },
            { id: 'INV-2026-0049', customer: 'PT Mitra Teknologi', amount: 7500000, due: '20 May 2026', status: 'Jatuh Tempo' },
            { id: 'INV-2026-0048', customer: 'Koperasi Sejahtera', amount: 35000000, due: '10 Jun 2026', status: 'Lunas' },
            { id: 'INV-2026-0047', customer: 'PT Distribusi Nasional', amount: 18000000, due: '05 Jun 2026', status: 'Menunggu' }
        ],
        apiLogs: [
            { time: '16:20:31', status: 200, method: 'POST', endpoint: '/v1/transfer', duration: '124ms' },
            { time: '16:20:28', status: 200, method: 'GET', endpoint: '/v1/balance', duration: '89ms' },
            { time: '16:20:25', status: 200, method: 'POST', endpoint: '/v1/va/create', duration: '156ms' },
            { time: '16:20:20', status: 202, method: 'POST', endpoint: '/v1/disbursement/batch', duration: '1204ms' },
            { time: '16:20:15', status: 401, method: 'GET', endpoint: '/v1/statement', duration: '45ms' }
        ],
        apiSimulation: {
            activeEndpoint: 'get-balance',
            executing: false
        },
        integrations: [
            { id: 'eco-ecommerce', icon: '🏪', name: 'E-Commerce Gateway', desc: 'Shopee, Tokopedia, Lazada', trx: 1240, uptime: '99.8%', apiKey: 'oc_live_8f2d93b827e', active: true },
            { id: 'eco-erp', icon: '🏢', name: 'ERP Integration (SAP)', desc: 'Auto-Reconciliation Module', trx: 350, uptime: '99.5%', apiKey: 'oc_live_a1c937bb459', active: true },
            { id: 'eco-mbb', icon: '📱', name: 'Mobile Banking Bridge', desc: 'myBCA Bisnis SDK', trx: 820, uptime: '100%', apiKey: 'oc_live_7e44cd1d3aa', active: true },
            { id: 'eco-scf', icon: '🔗', name: 'Supply Chain Finance', desc: 'Belum Diaktifkan', trx: 0, uptime: '0%', apiKey: 'oc_live_scf37e44ab', active: false }
        ]
    }
};

// --- Components ---

const Sidebar = () => {
    const isAdmin = state.role === 'admin';
    const staffMenu = [
        { id: 'dashboard', label: 'Dashboard Mastery', icon: '🏠' },
        { title: 'Ocean AI Features', isTitle: true },
        { id: 'ai', label: 'AI Assistant', icon: '✨' },
        { id: 'learning', label: 'Micro-Learning', icon: '⏱️' },
        { id: 'learning-path', label: 'Role-based Path', icon: '🎯' },
        { id: 'simulation', label: 'Simulation Role-play', icon: '🤝' },
        { title: 'Other', isTitle: true },
        { id: 'certificates', label: 'Sertifikat', icon: '📜' }
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
            <div class="sidebar-logo" style="padding: 1rem 1.5rem; display: flex; align-items: center; gap: 0.5rem;"><img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-Ocean-by-BCA-white.png" alt="Ocean by BCA Logo" style="height: 28px; width: auto; object-fit: contain;"></div>
            <nav class="nav-links">
                ${menuItems.map(item => {
                    if (item.isTitle) {
                        return `<div style="padding: 1.5rem 1.5rem 0.5rem; font-size: 0.7rem; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px;">${item.title}</div>`;
                    }
                    return `
                    <li class="nav-item">
                        <a href="#" class="nav-link ${state.currentPage === item.id || (item.id === 'ai' && state.currentPage === 'ai-benefit') ? 'active' : ''}" data-page="${item.id}">
                            <span class="nav-icon">${item.icon}</span> ${item.label}
                        </a>
                    </li>
                    `;
                }).join('')}
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>OCEAN CHAMPIONS (TOP 10)</h3>
                    <select id="leaderboard-filter-select" class="branch-filter">
                        <option value="Semua Cabang" ${state.leaderboardFilter === 'Semua Cabang' ? 'selected' : ''}>Semua Cabang</option>
                        <option value="KCP Menteng" ${state.leaderboardFilter === 'KCP Menteng' ? 'selected' : ''}>KCP Menteng</option>
                        <option value="KCU Jakarta" ${state.leaderboardFilter === 'KCU Jakarta' ? 'selected' : ''}>KCU Jakarta</option>
                        <option value="KCU Surabaya" ${state.leaderboardFilter === 'KCU Surabaya' ? 'selected' : ''}>KCU Surabaya</option>
                        <option value="KCU Thamrin" ${state.leaderboardFilter === 'KCU Thamrin' ? 'selected' : ''}>KCU Thamrin</option>
                    </select>
                </div>
                ${(() => {
                    let filtered = state.leaderboard;
                    if (state.leaderboardFilter !== 'Semua Cabang') {
                        filtered = filtered.filter(u => u.branch === state.leaderboardFilter);
                    }
                    
                    // Recalculate rank visually based on filtered data
                    filtered = filtered.sort((a,b) => b.points - a.points).map((u, i) => ({...u, displayRank: i + 1}));

                    const top3 = filtered.slice(0, 3);
                    const rest = filtered; // Show all in table for now, or slice(3) if preferred, but usually table shows all.
                    
                    let podiumHTML = '<div class="m-podium">';
                    if (top3.length > 1) {
                        podiumHTML += `<div class="podium-col rank-2"><div class="p-avatar">${top3[1].avatar}</div><div class="p-name">${top3[1].name}</div><div class="p-pts">${top3[1].points.toLocaleString()} XP</div><div class="p-step">2nd</div></div>`;
                    }
                    if (top3.length > 0) {
                        podiumHTML += `<div class="podium-col rank-1"><div class="p-crown">👑</div><div class="p-avatar">${top3[0].avatar}</div><div class="p-name">${top3[0].name}</div><div class="p-pts">${top3[0].points.toLocaleString()} XP</div><div class="p-step">1st</div></div>`;
                    }
                    if (top3.length > 2) {
                        podiumHTML += `<div class="podium-col rank-3"><div class="p-avatar">${top3[2].avatar}</div><div class="p-name">${top3[2].name}</div><div class="p-pts">${top3[2].points.toLocaleString()} XP</div><div class="p-step">3rd</div></div>`;
                    }
                    podiumHTML += '</div>';

                    if (filtered.length === 0) return '<div style="text-align:center; padding: 2rem; color: #94a3b8;">Tidak ada data champion di cabang ini.</div>';

                    return `
                        ${top3.length > 0 ? podiumHTML : ''}
                        <table class="m-table">
                            <thead><tr><th>Rank</th><th>Cabang</th><th>Champion</th><th>Poin</th></tr></thead>
                            <tbody>
                                ${rest.map(u => `
                                    <tr class="${u.isMe ? 'active-row' : ''}">
                                        <td>${u.displayRank}</td>
                                        <td>${u.branch}</td>
                                        <td>${u.name}</td>
                                        <td>${u.points.toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                })()}
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

        <div class="champion-section fade-in">
            <!-- Header Card -->
            <div class="champ-header-card">
                <div class="champ-mascot">
                    <img src="/ocean_champion_mascot.png" alt="Ocean Champion Mascot" />
                    <div class="champ-mascot-badge">Learn. Apply. Share. Grow Together!</div>
                </div>
                <div class="champ-header-content">
                    <div class="champ-desc-wrap">
                        <span class="champ-title-inline">Ocean Champion Program</span> 
                        adalah program <span class="champ-highlight">gamification</span> yang mendorong setiap karyawan untuk aktif belajar, menerapkan knowledge, berbagi insight, dan berkontribusi bagi kemajuan bersama.
                    </div>
                    
                    <div class="champ-components-box">
                        <div class="champ-comp-title">KOMPONEN UTAMA OCEAN CHAMPION PROGRAM</div>
                        <div class="champ-comp-grid">
                            <div class="champ-comp-item">
                                <div class="cci-icon">🛡️</div>
                                <div class="cci-text">
                                    <h5>1. LEVELING SYSTEM</h5>
                                    <p>Naik level berdasarkan pengetahuan, skill, dan kontribusi.</p>
                                </div>
                                <div class="cci-label l-green">BELAJAR</div>
                            </div>
                            <div class="champ-comp-item">
                                <div class="cci-icon">📄</div>
                                <div class="cci-text">
                                    <h5>2. SERTIFIKASI</h5>
                                    <p>Sertifikat digital diberikan setelah lulus modul + quiz (KKM ≥ 85).</p>
                                </div>
                                <div class="cci-label l-blue">TERAPKAN</div>
                            </div>
                            <div class="champ-comp-item">
                                <div class="cci-icon">🏆</div>
                                <div class="cci-text">
                                    <h5>3. RANKING & LEADERBOARD</h5>
                                    <p>Peringkat per cabang & region untuk menciptakan kompetisi sehat.</p>
                                </div>
                                <div class="cci-label l-purple">BAGIKAN</div>
                            </div>
                            <div class="champ-comp-item">
                                <div class="cci-icon">🎁</div>
                                <div class="cci-text">
                                    <h5>4. BENEFIT & REWARD</h5>
                                    <p>Dapatkan berbagai reward menarik sesuai pencapaian dan level.</p>
                                </div>
                                <div class="cci-label l-orange">BERKEMBANG</div>
                            </div>
                            <div class="champ-comp-item">
                                <div class="cci-icon">👥</div>
                                <div class="cci-text">
                                    <h5>5. BCA MENTEE</h5>
                                    <p>Wajib diikuti sebagai bagian dari KPI pengembangan talenta muda.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Leveling System Section -->
            <div class="champ-leveling-wrapper">
                <div class="champ-section-title">
                    <span>Leveling System</span>
                    <div class="champ-line"></div>
                </div>

                <!-- Leveling Grid (4 Columns) -->
                <div class="leveling-grid">
                    <!-- Level 1 -->
                    <div class="lvl-card lvl-1">
                        <div class="lvl-card-bg"></div>
                        <div class="lvl-header">Level 1 Beginner</div>
                        <div class="lvl-icon-shield">🛡️</div>
                        <div class="lvl-desc">Mulai belajar & menyelesaikan modul dasar</div>
                        <div class="lvl-req">
                            <strong>Syarat:</strong>
                            <ul>
                                <li>Selesaikan modul dasar</li>
                                <li>Quiz score ≥85</li>
                            </ul>
                        </div>
                        <div class="lvl-points">0 - 1.999 Poin</div>
                    </div>
                    <!-- Level 2 -->
                    <div class="lvl-card lvl-2">
                        <div class="lvl-card-bg"></div>
                        <div class="lvl-header">Level 2 Practioner</div>
                        <div class="lvl-icon-shield">🛡️</div>
                        <div class="lvl-desc">Memahami fitur & implementasi Ocean</div>
                        <div class="lvl-req">
                            <strong>Syarat:</strong>
                            <ul>
                                <li>Selesaikan modul lanjutan</li>
                                <li>Quiz score ≥85</li>
                            </ul>
                        </div>
                        <div class="lvl-points">2.000 - 4.999 Poin</div>
                    </div>
                    <!-- Level 3 -->
                    <div class="lvl-card lvl-3">
                        <div class="lvl-card-bg"></div>
                        <div class="lvl-header">Level 3 Expert</div>
                        <div class="lvl-icon-shield">🛡️</div>
                        <div class="lvl-desc">Mahir menjelaskan benefit & solusi ke nasabah</div>
                        <div class="lvl-req">
                            <strong>Syarat:</strong>
                            <ul>
                                <li>Simulation & Role-play</li>
                                <li>Quiz score ≥85</li>
                                <li>Kontribusi knowledge</li>
                            </ul>
                        </div>
                        <div class="lvl-points">5.000 - 9.999 Poin</div>
                    </div>
                    <!-- Level 4 -->
                    <div class="lvl-card lvl-4">
                        <div class="lvl-card-bg"></div>
                        <div class="lvl-header">Level 4 Master</div>
                        <div class="lvl-icon-shield">👑</div>
                        <div class="lvl-desc">Menjadi role model & kontributor knowledge</div>
                        <div class="lvl-req">
                            <strong>Syarat:</strong>
                            <ul>
                                <li>Top performance</li>
                                <li>Kontribusi champion</li>
                                <li>Quiz score ≥90</li>
                            </ul>
                        </div>
                        <div class="lvl-points">≥10.000 Poin</div>
                    </div>
                </div>

                <!-- Jalur Leveling (Horizontal Stepper) -->
                <div class="lvl-path-banner">
                    <div class="lpb-title">JALUR LEVELING</div>
                    <div class="lpb-steps">
                        <div class="lpb-step">
                            <div class="lpb-icon">✅</div>
                            <div class="lpb-text">Belajar &<br/>Selesaikan Modul</div>
                        </div>
                        <div class="lpb-arrow">➔</div>
                        <div class="lpb-step">
                            <div class="lpb-icon">📝</div>
                            <div class="lpb-text">Kerjakan Quiz<br/>(KKM ≥85)</div>
                        </div>
                        <div class="lpb-arrow">➔</div>
                        <div class="lpb-step">
                            <div class="lpb-icon">⭐</div>
                            <div class="lpb-text">Dapatkan<br/>Poin</div>
                        </div>
                        <div class="lpb-arrow">➔</div>
                        <div class="lpb-step">
                            <div class="lpb-icon">⬆️</div>
                            <div class="lpb-text">Naik<br/>Level</div>
                        </div>
                        <div class="lpb-arrow">➔</div>
                        <div class="lpb-step">
                            <div class="lpb-icon">🎁</div>
                            <div class="lpb-text">Dapatkan<br/>Reward</div>
                        </div>
                    </div>
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

const SimulationPage = () => {
    if (!state.activeSimulation) {
        return `
            <div class="fade-in" style="padding: 1rem;">
                <h1 style="color: var(--text-main); margin-bottom: 0.5rem;">Simulation Role-play</h1>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">Pilih skenario simulasi nasabah untuk berlatih kemampuan pitching Anda.</p>
                <div class="sim-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                    ${state.simulations.map(sim => `
                        <div class="m-card sim-card" style="display: flex; flex-direction: column; text-align: center; padding: 2rem; border-radius: 16px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">${sim.id === 'umkm' ? '🏬' : '🏢'}</div>
                            <h3 style="margin: 0 0 0.5rem 0; color: var(--text-main);">${sim.title}</h3>
                            <p style="margin: 0 0 1.5rem 0; color: var(--text-muted); font-size: 0.85rem;">Tingkat Kesulitan: <b>${sim.difficulty}</b></p>
                            <button class="btn-primary btn-start-sim" data-sim-id="${sim.id}" style="margin-top: auto; padding: 0.75rem;">Mulai Role-play</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const sim = state.simulations.find(s => s.id === state.activeSimulation);
    const bgHeader = sim.id === 'umkm' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    
    return `
        <div class="premium-ai-container fade-in">
            <header class="premium-ai-header" style="background: ${bgHeader}; color: white; border: none;">
                <div class="pai-header-left">
                    <div class="pai-logo-wrap" style="background: rgba(255,255,255,0.2); box-shadow: none;">${sim.id === 'umkm' ? '🏬' : '🏢'}</div>
                    <div>
                        <h1 class="pai-title" style="color: white; margin-bottom: 2px;">Nasabah ${sim.id === 'umkm' ? 'UMKM' : 'Korporasi'}</h1>
                        <p class="pai-subtitle" style="color: rgba(255,255,255,0.8);">${sim.title}</p>
                    </div>
                </div>
                <div class="pai-header-right">
                    <button id="btn-end-sim" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.8rem; transition: background 0.2s;">Akhiri Simulasi</button>
                </div>
            </header>
            <div class="premium-ai-layout" style="background: #f8fafc;">
                <div class="pai-chat-area" style="background: transparent;">
                    <div class="pai-chat-messages" id="sim-chat-messages">
                        ${state.simChatHistory.length === 0 ? `
                            <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 2rem;">
                                Anda sedang berhadapan dengan nasabah prospek. Sapalah nasabah terlebih dahulu untuk memulai pitching!
                            </div>
                        ` : ''}
                        ${state.simChatHistory.map(m => `
                            <div class="pai-msg-row ${m.role}">
                                <div class="pai-msg-avatar" style="${m.role === 'ai' ? 'background: white; color: initial; border: 1px solid #e2e8f0;' : ''}">${m.role === 'ai' ? (sim.id === 'umkm' ? '🧑‍🌾' : '👔') : '👨‍✈️'}</div>
                                <div class="pai-msg-bubble">
                                    <div class="pai-msg-author" style="${m.role === 'ai' ? 'color: var(--text-main);' : ''}">${m.role === 'ai' ? 'Nasabah' : state.user.name}</div>
                                    <div class="pai-msg-content" style="${m.role === 'user' ? 'background: #00458b; box-shadow: 0 4px 12px rgba(0, 69, 139, 0.2);' : 'background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.05);'}">${m.role === 'ai' ? renderMarkdown(m.content) : m.content}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="pai-input-container">
                        <div class="pai-input-glass">
                            <input type="text" id="sim-chat-input" placeholder="Ketik balasan Anda ke nasabah..." class="pai-input-field" autocomplete="off" />
                            <button id="btn-sim-send" class="pai-send-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const AIPage = () => `
    <div class="premium-ai-container fade-in">
        <!-- Header -->
        <header class="premium-ai-header">
            <div class="pai-header-left">
                <div class="pai-logo-wrap">✨</div>
                <div>
                    <h1 class="pai-title">Ocean AI Assistant</h1>
                    <p class="pai-subtitle">Enterprise Intelligence · Powered by Gemini</p>
                </div>
            </div>
            <div class="pai-header-right">
                <div class="benefit-toggle-pill ${state.benefitMode ? 'active' : ''}">
                    <span class="bt-label">BENEFIT TRANSLATOR</span>
                    <label class="switch-modern">
                        <input type="checkbox" id="benefit-toggle" ${state.benefitMode ? 'checked' : ''}>
                        <span class="slider-modern"></span>
                    </label>
                </div>
            </div>
        </header>

        <!-- Main Layout -->
        <div class="premium-ai-layout">
            <!-- Chat Area -->
            <div class="pai-chat-area">
                <div class="pai-chat-messages" id="chat-messages">
                    ${state.chatHistory.map(m => `
                        <div class="pai-msg-row ${m.role}">
                            <div class="pai-msg-avatar">${m.role === 'ai' ? '🤖' : '👨‍✈️'}</div>
                            <div class="pai-msg-bubble">
                                <div class="pai-msg-author">${m.role === 'ai' ? 'Ocean AI' : state.user.name}</div>
                                <div class="pai-msg-content">${m.role === 'ai' ? renderMarkdown(m.content) : m.content}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Input Area -->
                <div class="pai-input-container">
                    <div class="pai-input-glass">
                        <input type="text" id="chat-input-main" placeholder="Tanya tentang Ocean by BCA..." class="pai-input-field" autocomplete="off" />
                        <button id="btn-send-main" class="pai-send-btn" title="Kirim">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                    <div class="pai-input-hint">AI dapat melakukan kesalahan. Harap periksa kembali informasi penting.</div>
                </div>
            </div>

            <!-- Context Sidebar -->
            <div class="pai-sidebar">
                <div class="pai-sidebar-card">
                    <h3 class="pai-sidebar-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Active Knowledge
                    </h3>
                    <p class="pai-sidebar-desc">AI menjawab berdasarkan sumber dokumen terverifikasi di bawah ini.</p>
                    
                    <div class="pai-sources-list">
                        ${state.ragDocs.length > 0 ? state.ragDocs.map(d => `
                            <div class="pai-source-item">
                                <div class="pai-si-icon doc">📄</div>
                                <div class="pai-si-info">
                                    <div class="pai-si-name">${d.name}</div>
                                    <div class="pai-si-meta">RAG Database • ${d.chunk_count || 0} chunks</div>
                                </div>
                            </div>
                        `).join('') : `
                            <div class="pai-source-item">
                                <div class="pai-si-icon doc">📜</div>
                                <div class="pai-si-info">
                                    <div class="pai-si-name">Script Pitching CFO.pdf</div>
                                    <div class="pai-si-meta">Default Context</div>
                                </div>
                            </div>
                            <div class="pai-source-item">
                                <div class="pai-si-icon doc">📄</div>
                                <div class="pai-si-info">
                                    <div class="pai-si-name">Guide: Dashboard.docx</div>
                                    <div class="pai-si-meta">Default Context</div>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

const IngestionPage = () => {
    const { ragDocs, ragStats, ragUploading, ragUploadProgress, ragUploadError, ragActiveType } = state;
    const fileTypeMap = {
        doc:   { icon: '📄', label: 'Dokumen',     exts: 'PDF, DOCX, PPTX, XLSX', accept: '.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls' },
        video: { icon: '🎥', label: 'Video',        exts: 'MP4, MOV, AVI',         accept: '.mp4,.mov,.avi' },
        audio: { icon: '🎙️', label: 'Audio',        exts: 'MP3, WAV, M4A',         accept: '.mp3,.wav,.m4a' },
        text:  { icon: '📝', label: 'Teks/Artikel', exts: 'TXT, HTML, MD',         accept: '.txt,.html,.md' },
        faq:   { icon: '❓', label: 'FAQ / Q&A',    exts: 'XLSX, CSV',             accept: '.xlsx,.csv,.xls' },
        web:   { icon: '🌐', label: 'URL / Web',    exts: 'Paste URL',             accept: '' },
        json:  { icon: '⚙️', label: 'JSON / API',   exts: 'JSON',                  accept: '.json' },
    };
    const activeType = fileTypeMap[ragActiveType] || fileTypeMap.doc;
    
    const docIconType = (ft) => {
        if (['mp4','mov','avi'].includes(ft)) return '🎥';
        if (['mp3','wav','m4a'].includes(ft)) return '🎙️';
        if (['pdf','doc','docx','ppt','pptx'].includes(ft)) return '📄';
        if (['xlsx','xls','csv'].includes(ft)) return '📊';
        if (['txt','html','md'].includes(ft)) return '📝';
        return '📁';
    };
    const docIconClass = (ft) => {
        if (['mp4','mov','avi'].includes(ft)) return 'video';
        if (['mp3','wav','m4a'].includes(ft)) return 'audio';
        if (['pdf','docx','pptx'].includes(ft)) return 'doc';
        if (['xlsx','csv'].includes(ft)) return 'faq';
        return 'doc';
    };
    const formatSize = (bytes) => {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
        return (bytes/1024/1024).toFixed(1) + ' MB';
    };
    const formatDate = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    };

    const pipelineSteps = [
        { id: 1, label: 'Validasi File',          desc: 'Format dan ukuran file diverifikasi' },
        { id: 2, label: 'Ekstraksi Konten',        desc: 'Gemini AI mengekstrak teks dari file' },
        { id: 3, label: 'Chunking & Embedding',    desc: 'Semantic chunking + vektor 768-dim' },
        { id: 4, label: 'Quality Check',           desc: 'Dedup, tagging, dan enrichment' },
        { id: 5, label: 'Simpan ke Vector DB',     desc: 'Chunks disimpan ke Supabase pgvector' },
    ];

    return `
    <div class="fade-in rag-hub-page" id="rag-hub-root">

        <!-- HIDDEN FILE INPUT -->
        <input type="file" id="rag-file-input" style="display:none"
            accept="${activeType.accept}"
            ${ragUploading ? 'disabled' : ''}>

        <!-- HEADER -->
        <div class="rag-page-header">
            <div class="rag-header-left">
                <div class="rag-breadcrumb">
                    <span>Admin</span>
                    <span class="bc-sep">›</span>
                    <span class="bc-active">Knowledge Capture Loop</span>
                </div>
                <h1 class="rag-page-title">Knowledge Capture Loop</h1>
                <p class="rag-page-subtitle">
                    Ingesti knowledge dari berbagai sumber ke RAG database — digunakan oleh Ocean AI Chatbot
                    untuk menjawab pertanyaan berdasarkan dokumen resmi BCA.
                </p>
                <div class="rag-powered-badges">
                    <span class="rag-badge gemini-badge">✦ Gemini 2.0 Flash</span>
                    <span class="rag-badge supabase-badge">⬡ Supabase pgvector</span>
                    <span class="rag-badge pakar-badge">🗂 PAKAR</span>
                    <span class="rag-badge lms-badge">🎓 myDevelopment</span>
                </div>
            </div>
            <div class="rag-header-stats">
                <div class="rag-stat-mini active-stat" id="stat-chunks">
                    <div class="rsm-val">${ragStats.chunks.toLocaleString()}</div>
                    <div class="rsm-lbl">Vector Chunks</div>
                </div>
                <div class="rag-stat-mini">
                    <div class="rsm-val">${ragStats.docs}</div>
                    <div class="rsm-lbl">Dokumen Aktif</div>
                </div>
                <div class="rag-stat-mini">
                    <div class="rsm-val">768</div>
                    <div class="rsm-lbl">Embedding Dims</div>
                </div>
            </div>
        </div>

        <!-- INTEGRATION STRIP -->
        <div class="rag-integration-strip">
            <div class="ris-item">
                <div class="ris-icon lms-c">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                </div>
                <div class="ris-info">
                    <div class="ris-name">myDevelopment LMS</div>
                    <div class="ris-sub">Single Access Point · SSO · API REST</div>
                </div>
                <span class="ris-badge connected">Connected</span>
            </div>
            <div class="ris-divider">›</div>
            <div class="ris-item">
                <div class="ris-icon ocean-c">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
                </div>
                <div class="ris-info">
                    <div class="ris-name">Ocean Mastery RAG</div>
                    <div class="ris-sub">Gemini AI · pgvector · Semantic Search</div>
                </div>
                <span class="ris-badge connected">Active</span>
            </div>
            <div class="ris-divider">›</div>
            <div class="ris-item">
                <div class="ris-icon pakar-c">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div class="ris-info">
                    <div class="ris-name">PAKAR Repository</div>
                    <div class="ris-sub">Dokumen · FAQ · Best Practice · Use Case</div>
                </div>
                <span class="ris-badge syncing">Syncing</span>
            </div>
        </div>

        <!-- MAIN CONTENT -->
        <div class="rag-main-layout">

            <!-- LEFT: UPLOAD PANEL -->
            <div class="rag-upload-panel">

                <!-- SOURCE TYPE TABS -->
                <div class="rag-card">
                    <div class="rag-card-title">Tipe Sumber Knowledge</div>
                    <div class="rag-type-tabs">
                        ${Object.entries(fileTypeMap).map(([key, t]) => `
                            <button class="rtt-btn ${ragActiveType === key ? 'active' : ''}" data-type="${key}" id="rtt-${key}">
                                <span class="rtt-icon">${t.icon}</span>
                                <span class="rtt-label">${t.label}</span>
                                <span class="rtt-ext">${t.exts}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- UPLOAD ZONE -->
                <div class="rag-card">
                    <div class="rag-card-title">Upload File</div>

                    ${ragUploading ? `
                    <div class="rag-progress-panel">
                        <div class="rpp-header">
                            <span class="rpp-spinner"></span>
                            <span class="rpp-title">Memproses file...</span>
                        </div>
                        <div class="rpp-steps">
                            ${pipelineSteps.map(s => {
                                const isDone   = s.id < ragUploadProgress.step;
                                const isActive = s.id === ragUploadProgress.step;
                                return `
                                <div class="rpp-step ${isDone ? 'done' : isActive ? 'active' : 'wait'}">
                                    <div class="rpp-dot">
                                        ${isDone ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' 
                                                 : isActive ? '<span class="rpp-pulse"></span>' 
                                                 : s.id}
                                    </div>
                                    <div class="rpp-step-info">
                                        <div class="rpp-step-label">${s.label}</div>
                                        <div class="rpp-step-desc">${isActive ? ragUploadProgress.message : isDone ? 'Selesai' : s.desc}</div>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                    ` : `
                    <div class="rag-dropzone" id="rag-dropzone" onclick="document.getElementById('rag-file-input').click()">
                        <div class="rdz-icon">${activeType.icon}</div>
                        <div class="rdz-title">Klik atau drag & drop ${activeType.label}</div>
                        <div class="rdz-sub">${activeType.exts}</div>
                        ${ragUploadError ? `<div class="rdz-error">⚠ ${ragUploadError}</div>` : ''}
                    </div>
                    `}

                    ${ragActiveType === 'web' ? `
                    <div class="rag-url-row">
                        <input type="text" id="rag-url-input" class="rag-url-input" placeholder="https://pakar.bca.co.id/dokumen/..." ${ragUploading ? 'disabled' : ''}>
                        <button class="rag-url-btn" id="btn-import-url" ${ragUploading ? 'disabled' : ''}>Import</button>
                    </div>
                    ` : ''}
                </div>

                <!-- AI CAPABILITIES INFO -->
                <div class="rag-card rag-ai-card">
                    <div class="rag-ai-header">
                        <div class="rag-ai-icon">✦</div>
                        <div>
                            <div class="rag-card-title" style="margin-bottom:0">Powered by Gemini AI</div>
                            <div class="rag-card-sub">gemini-3.5-flash · gemini-embedding-2</div>
                        </div>
                    </div>
                    <div class="rag-ai-caps">
                        <div class="rac-item">
                            <div class="rac-icon">🎙️</div>
                            <div class="rac-text">
                                <div class="rac-title">Auto Transcription</div>
                                <div class="rac-desc">Video & Audio ditranskrip otomatis ke teks</div>
                            </div>
                        </div>
                        <div class="rac-item">
                            <div class="rac-icon">📊</div>
                            <div class="rac-text">
                                <div class="rac-title">Document Understanding</div>
                                <div class="rac-desc">Ekstrak PDF, DOCX, PPTX termasuk tabel</div>
                            </div>
                        </div>
                        <div class="rac-item">
                            <div class="rac-icon">🧬</div>
                            <div class="rac-text">
                                <div class="rac-title">Semantic Embedding</div>
                                <div class="rac-desc">Vektor 768-dim untuk semantic search akurat</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT: KNOWLEDGE BASE TABLE -->
            <div class="rag-docs-panel">
                <div class="rag-card rag-docs-card">
                    <div class="rag-docs-header">
                        <div>
                            <div class="rag-card-title">Knowledge Base</div>
                            <div class="rag-card-sub">${ragDocs.length} dokumen terdaftar · data real dari Supabase</div>
                        </div>
                        <button class="rag-refresh-btn" id="btn-rag-refresh">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Refresh
                        </button>
                    </div>

                    ${ragDocs.length === 0 && ragStats.docs === 0 ? `
                    <div class="rag-empty-state">
                        <div class="res-icon">📂</div>
                        <div class="res-title">Knowledge Base kosong</div>
                        <div class="res-sub">Upload dokumen pertama Anda untuk mulai membangun RAG database</div>
                    </div>
                    ` : `
                    <div class="rag-docs-table-wrap">
                        <table class="rag-docs-table">
                            <thead>
                                <tr>
                                    <th>Dokumen</th>
                                    <th>Tipe</th>
                                    <th>Sumber</th>
                                    <th>Ukuran</th>
                                    <th>Chunks</th>
                                    <th>Status</th>
                                    <th>Tanggal</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ragDocs.map(doc => `
                                <tr>
                                    <td>
                                        <div class="rdt-name-cell">
                                            <div class="rdt-file-icon ${docIconClass(doc.file_type)}">${docIconType(doc.file_type)}</div>
                                            <span class="rdt-filename">${doc.name}</span>
                                        </div>
                                    </td>
                                    <td><span class="rdt-badge type">${doc.file_type?.toUpperCase() || '—'}</span></td>
                                    <td><span class="rdt-badge source">${doc.source || 'upload'}</span></td>
                                    <td class="rdt-muted">${formatSize(doc.size_bytes)}</td>
                                    <td class="rdt-muted">${doc.chunk_count || 0}</td>
                                    <td>
                                        <span class="rdt-status ${doc.status}">
                                            ${doc.status === 'done' ? '✓ Done' : doc.status === 'processing' ? '⚡ Processing' : '⚠ Error'}
                                        </span>
                                    </td>
                                    <td class="rdt-muted">${formatDate(doc.created_at)}</td>
                                    <td>
                                        <button class="rdt-delete-btn" data-doc-id="${doc.id}" title="Hapus dokumen">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                        </button>
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    `}

                    <!-- RETRIEVAL FLOW -->
                    <div class="rag-flow-section">
                        <div class="rag-card-title" style="margin-bottom: 1rem;">Alur Retrieval — Cara Chatbot Membaca Knowledge Base Ini</div>
                        <div class="rag-flow-row">
                            <div class="rfr-step"><div class="rfr-icon">💬</div><div class="rfr-label">User bertanya</div></div>
                            <div class="rfr-arr">→</div>
                            <div class="rfr-step"><div class="rfr-icon">🔢</div><div class="rfr-label">Query di-embed</div></div>
                            <div class="rfr-arr">→</div>
                            <div class="rfr-step"><div class="rfr-icon">🔍</div><div class="rfr-label">Vector search</div></div>
                            <div class="rfr-arr">→</div>
                            <div class="rfr-step"><div class="rfr-icon">📚</div><div class="rfr-label">Top-K chunks</div></div>
                            <div class="rfr-arr">→</div>
                            <div class="rfr-step"><div class="rfr-icon">🧠</div><div class="rfr-label">Gemini jawab</div></div>
                            <div class="rfr-arr">→</div>
                            <div class="rfr-step active-step"><div class="rfr-icon">✅</div><div class="rfr-label">Respons + sumber</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
};
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

const PublicFooter = () => `
        <!-- FOOTER SECTION -->
        <footer class="footer-official">
            <div class="footer-border-container">
                <!-- Column 1: Logo & Address & Contacts -->
                <div class="footer-col-main">
                    <div class="footer-logo">
                        <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-Ocean-by-BCA-white.png" alt="Ocean by BCA Logo" style="height: 36px; width: auto; object-fit: contain;">
                    </div>
                    <div class="footer-address">
                        <p class="addr-title">Kantor Pusat</p>
                        <p class="addr-desc">Menara BCA, Grand Indonesia,<br>Jl. MH Thamrin No. 1<br>Jakarta 10310</p>
                    </div>
                    <div class="footer-contacts">
                        <div class="contact-item">
                            <span class="icon">📞</span>
                            <span class="text">Halo BCA Bisnis | 1500998</span>
                        </div>
                        <div class="contact-item">
                            <span class="icon">@</span>
                            <span class="text">halobca@bca.co.id</span>
                        </div>
                        <div class="contact-item">
                            <span class="icon">💬</span>
                            <span class="text">62 811 1500 998</span>
                        </div>
                    </div>
                </div>

                <!-- Column 2: PERUSAHAAN -->
                <div class="footer-col-links">
                    <h4>PERUSAHAAN</h4>
                    <ul class="footer-links-list">
                        <li><a href="#">Tentang Kami</a></li>
                        <li><a href="#">Pusat Bantuan</a></li>
                        <li><a href="#">Kebijakan</a></li>
                        <li><a href="#">Syarat & Ketentuan</a></li>
                        <li><a href="https://www.bca.co.id" target="_blank">bca.co.id</a></li>
                    </ul>
                </div>

                <!-- Column 3: PRODUK -->
                <div class="footer-col-links">
                    <h4>PRODUK</h4>
                    <ul class="footer-links-list">
                        <li><a href="#">EDC BCA</a></li>
                        <li><a href="#">QRIS</a></li>
                        <li><a href="#">myBCA Bisnis</a></li>
                        <li><a href="#">Virtual Account</a></li>
                        <li><a href="#">Lihat Semua..</a></li>
                    </ul>
                </div>

                <!-- Column 4: ARTIKEL -->
                <div class="footer-col-links">
                    <h4>ARTIKEL</h4>
                    <ul class="footer-links-list">
                        <li><a href="#">Trade</a></li>
                        <li><a href="#">Food & Beverage</a></li>
                        <li><a href="#">Manufacture</a></li>
                        <li><a href="#">Tourism & Hospitality</a></li>
                        <li><a href="#">Lihat Semua..</a></li>
                    </ul>
                </div>
            </div>

            <!-- Footer Bottom Disclaimer -->
            <div class="footer-bottom-official">
                <p class="disclaimer-text">BCA berizin dan diawasi oleh Otoritas Jasa Keuangan & Bank Indonesia</p>
                <p class="disclaimer-text">BCA merupakan peserta penjaminan LPS. Maksimum nilai simpanan yang dijamin LPS per nasabah per bank adalah Rp2 miliar. Untuk cek Tingkat Bunga Penjaminan LPS, klik <a href="https://www.lps.go.id" target="_blank" class="lps-link">di sini</a></p>
                <p class="copyright-text">© 2026 PT Bank Central Asia Tbk, All Rights Reserved.</p>
            </div>
        </footer>
`;

const PublicNavbar = () => `
    <nav class="public-nav">
        <div class="nav-container">
            <div class="nav-logo" id="nav-home">
                <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-Ocean-by-BCA-white.png" alt="Ocean by BCA Logo" class="nav-logo-img">
            </div>
            <div class="nav-links-public">
                <a href="#" class="nav-link-p ${state.currentPage === 'landing' ? 'active' : ''}" data-page="landing">Home</a>
                <a href="#" class="nav-link-p ${state.currentPage === 'how-it-works' ? 'active' : ''}" data-page="how-it-works">Produk</a>
                <a href="#" class="nav-link-p ${state.currentPage === 'sandbox' ? 'active' : ''}" data-page="sandbox">
                    myEcosystem
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
                </a>
                <div class="nav-dropdown-wrapper">
                    <button class="nav-link-p nav-dropdown-trigger">
                        Quick Access
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
                    </button>
                    <div class="nav-dropdown-menu">
                        <a href="https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis" target="_blank" class="nav-dropdown-item">myBCA Bisnis</a>
                        <a href="https://ibank.klikbca.com/bisnis" target="_blank" class="nav-dropdown-item">KlikBCA Bisnis</a>
                        <a href="https://www.bca.co.id/id/bisnis/produk/transaksi-bisnis/merchant-bca" target="_blank" class="nav-dropdown-item">Merchant BCA</a>
                        <a href="https://emp.klikbca.com/bca-emp" target="_blank" class="nav-dropdown-item">e-Commerce Merchant Portal</a>
                        <a href="https://trade.klikbca.com/" target="_blank" class="nav-dropdown-item">Client Trade</a>
                        <a href="https://bagio.bca.co.id/" target="_blank" class="nav-dropdown-item">BAGIO</a>
                        <a href="https://developer.bca.co.id/" target="_blank" class="nav-dropdown-item">Developer API BCA</a>
                    </div>
                </div>
                <a href="#" class="nav-link-p ${state.currentPage === 'roi' ? 'active' : ''}" data-page="roi">ROI Calculator</a>
                <a href="#" class="nav-link-p ${state.currentPage === 'security' ? 'active' : ''}" data-page="security">Artikel</a>
                <a href="#" class="nav-link-p" id="btn-direct-internal">Pusat Bantuan</a>
            </div>
            <div class="nav-actions">
                <button class="lang-selector-btn">
                    <div class="flag-circle">
                        <div class="flag-red"></div>
                        <div class="flag-white"></div>
                    </div>
                    <span class="lang-label">ID</span>
                </button>
                <button class="btn-masuk" id="btn-login-trigger">
                    Masuk
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-masuk-arrow"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                </button>
            </div>
            <button class="mobile-menu-btn" id="btn-toggle-mobile-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="4" y1="12" x2="20" y2="12"></line>
                    <line x1="4" y1="6" x2="20" y2="6"></line>
                    <line x1="4" y1="18" x2="20" y2="18"></line>
                </svg>
            </button>
        </div>
    </nav>

    <!-- MOBILE MENU DRAWER -->
    <div class="mobile-menu-drawer" id="mobile-menu-drawer">
        <div class="mobile-menu-header">
            <div class="nav-logo">
                <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-Ocean-by-BCA-white.png" alt="Ocean by BCA Logo" class="nav-logo-img">
            </div>
            <button class="mobile-menu-close-btn" id="btn-close-mobile-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="mobile-menu-links">
            <a href="#" class="mobile-menu-link ${state.currentPage === 'landing' ? 'active' : ''}" data-page="landing">Home</a>
            <a href="#" class="mobile-menu-link ${state.currentPage === 'how-it-works' ? 'active' : ''}" data-page="how-it-works">Produk</a>
            <div class="mobile-menu-dropdown-trigger">
                <span>myEcosystem</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
            </div>
            <div class="mobile-menu-dropdown-trigger" id="mobile-quick-access-btn">
                <span>Quick Access</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mobile-nav-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
            </div>
            <div class="mobile-nav-dropdown-menu" id="mobile-quick-access-menu" style="display: none;">
                <a href="https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis" target="_blank" class="mobile-dropdown-item">myBCA Bisnis</a>
                <a href="https://ibank.klikbca.com/bisnis" target="_blank" class="mobile-dropdown-item">KlikBCA Bisnis</a>
                <a href="https://www.bca.co.id/id/bisnis/produk/transaksi-bisnis/merchant-bca" target="_blank" class="mobile-dropdown-item">Merchant BCA</a>
                <a href="https://emp.klikbca.com/bca-emp" target="_blank" class="mobile-dropdown-item">e-Commerce Merchant Portal</a>
                <a href="https://trade.klikbca.com/" target="_blank" class="mobile-dropdown-item">Client Trade</a>
                <a href="https://bagio.bca.co.id/" target="_blank" class="mobile-dropdown-item">BAGIO</a>
                <a href="https://developer.bca.co.id/" target="_blank" class="mobile-dropdown-item">Developer API BCA</a>
            </div>
            <a href="#" class="mobile-menu-link ${state.currentPage === 'roi' ? 'active' : ''}" data-page="roi">ROI Calculator</a>
            <a href="#" class="mobile-menu-link ${state.currentPage === 'security' ? 'active' : ''}" data-page="security">Artikel</a>
            <a href="#" class="mobile-menu-link" id="btn-mobile-help">Pusat Bantuan</a>
        </div>
        <div class="mobile-menu-footer">
            <div class="mobile-lang-row">
                <span>Bahasa</span>
                <button class="lang-selector-btn">
                    <div class="flag-circle">
                        <div class="flag-red"></div>
                        <div class="flag-white"></div>
                    </div>
                    <span class="lang-label">ID</span>
                </button>
            </div>
            <button class="btn-masuk-mobile" id="btn-login-mobile-trigger">
                Masuk
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-masuk-arrow"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </button>
        </div>
    </div>
`;

const LandingPage = () => `
    <div class="fade-in">
        <!-- HERO SECTION 1 (Image 2 style) -->
        <section class="hero-official-container">
            <div class="hero-official-content" style="position: relative; z-index: 10;">
                <h1>Kolaborasi. Inovasi. Ekspansi.</h1>
                <p>Ocean by BCA menghubungkan bisnis dengan ekosistem perbankan, operasional, dan jaringan dalam industri.</p>
                <button class="btn-mulai-pelajari" data-page="how-it-works">Mulai Pelajari</button>
            </div>
            <div class="video-official-box" id="official-video-container" style="position: relative; z-index: 10;">
                <div class="video-play-pill-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="play-icon-svg"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    <span>Simak Video Perkenalan Ocean by BCA</span>
                </div>
            </div>

            <!-- Ocean Waves SVG markup -->
            <div class="ocean-waves-container">
              <div class="ocean-waves-scale-wrapper">
                <svg class="ocean-wave-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2560 520" width="2560" height="520" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <clipPath id="wave-clip-path">
                      <rect width="2560" height="520" x="0" y="0"></rect>
                    </clipPath>
                  </defs>
                  <g clip-path="url(#wave-clip-path)">
                    <!-- Wave Layer 1 -->
                    <g class="wave-layer wave-layer-1">
                      <path fill="#00335D" fill-opacity="0.25" d=" M440.9739990234375,289.7969970703125 C573.7969970703125,277.2980041503906 704.4810180664062,265 853.3330078125,265 C1002.1900024414062,265 1132.8699951171875,277.2980041503906 1265.68994140625,289.7969970703125 C1402.9300537109375,302.7120056152344 1542.4599609375,315.84100341796875 1706.6700439453125,315.84100341796875 C1870.8800048828125,315.84100341796875 2010.4000244140625,302.7120056152344 2147.639892578125,289.7969970703125 C2280.4599609375,277.2980041503906 2411.14990234375,265 2560,265 C2708.85009765625,265 2839.5400390625,277.2980041503906 2972.360107421875,289.7969970703125 C3109.550048828125,302.7070007324219 3249.030029296875,315.8330078125 3413.169921875,315.84100341796875 C3577.300048828125,315.8330078125 3716.780029296875,302.7070007324219 3853.969970703125,289.7969970703125 C3986.800048828125,277.2980041503906 4117.47998046875,265 4266.330078125,265 C4415.18994140625,265 4545.8701171875,277.2980041503906 4678.68994140625,289.7969970703125 C4815.93017578125,302.7120056152344 4955.4599609375,315.84100341796875 5119.669921875,315.84100341796875 C5283.8701171875,315.84100341796875 5423.39990234375,302.7120056152344 5560.64013671875,289.7969970703125 C5693.4599609375,277.2980041503906 5824.14990234375,265 5973,265 C5973,265 5973,520 5973,520 C5973,520 0,520 0,520 C0,520 0,315.84100341796875 0,315.84100341796875 C164.20799255371094,315.84100341796875 303.7330017089844,302.7120056152344 440.9739990234375,289.7969970703125 C440.9739990234375,289.7969970703125 C440.9739990234375,289.7969970703125 C440.9739990234375,289.7969970703125z"></path>
                    </g>
                    <!-- Wave Layer 2 -->
                    <g class="wave-layer wave-layer-2">
                      <path fill="#00335D" fill-opacity="0.25" d=" M640,264 C528.3610229492188,264 430.34698486328125,276.2980041503906 330.7300109863281,288.7969970703125 C227.7989959716797,301.7120056152344 123.15599822998047,314.84100341796875 0,314.84100341796875 C0,314.84100341796875 0,520 0,520 C0,520 7680,520 7680,520 C7680,520 7680,314.84100341796875 7680,314.84100341796875 C7556.83984375,314.84100341796875 7452.2001953125,301.7120056152344 7349.27001953125,288.7969970703125 C7249.64990234375,276.2980041503906 7151.64013671875,264 7040,264 C6928.35986328125,264 6830.35009765625,276.2980041503906 6730.72998046875,288.7969970703125 C6627.7998046875,301.7120056152344 6523.16015625,314.84100341796875 6400,314.84100341796875 C6276.83984375,314.84100341796875 6172.2001953125,301.7120056152344 6069.27001953125,288.7969970703125 C5969.64990234375,276.2980041503906 5871.64013671875,264 5760,264 C5648.35986328125,264 5550.35009765625,276.2980041503906 5450.72998046875,288.7969970703125 C5347.7998046875,301.7120056152344 5243.16015625,314.84100341796875 5120,314.84100341796875 C4996.83984375,314.84100341796875 4892.2001953125,301.7120056152344 4789.27001953125,288.7969970703125 C4689.64990234375,276.2980041503906 4591.64013671875,264 4480,264 C4368.35986328125,264 4270.35009765625,276.2980041503906 4170.72998046875,288.7969970703125 C4067.800048828125,301.7120056152344 3963.159912109375,314.84100341796875 3840,314.84100341796875 C3716.840087890625,314.84100341796875 3612.199951171875,301.7120056152344 3509.27001953125,288.7969970703125 C3409.64990234375,276.2980041503906 3311.639892578125,264 3200,264 C3088.360107421875,264 2990.35009765625,276.2980041503906 2890.72998046875,288.7969970703125 C2787.800048828125,301.7120056152344 2683.159912109375,314.84100341796875 2560,314.84100341796875 C2436.840087890625,314.84100341796875 2332.199951171875,301.7120056152344 2229.27001953125,288.7969970703125 C2129.64990234375,276.2980041503906 2031.6400146484375,264 1920,264 C1808.3599853515625,264 1710.3499755859375,276.2980041503906 1610.72998046875,288.7969970703125 C1507.800048828125,301.7120056152344 1403.1600341796875,314.84100341796875 1280,314.84100341796875 C1156.8399658203125,314.84100341796875 1052.199951171875,301.7120056152344 949.27001953125,288.7969970703125 C849.6530151367188,276.2980041503906 751.6389770507812,264 640,264 C640,264 640,264 640,264z"></path>
                    </g>
                    <!-- Wave Layer 3 -->
                    <g class="wave-layer wave-layer-3">
                      <path fill="#00335D" fill-opacity="0.25" d=" M309.2699890136719,315.4779968261719 C209.6529998779297,305.6600036621094 111.63899993896484,296 0.000021731300876126625,296 C0.000021731300876126625,296 0,520 0,520 C0,520 5120,520 5120,520 C5120,520 5120,296 5120,296 C5008.35986328125,296 4910.35009765625,305.6600036621094 4810.72998046875,315.4779968261719 C4707.7998046875,325.62200927734375 4603.16015625,335.93499755859375 4480,335.93499755859375 C4356.83984375,335.93499755859375 4252.2001953125,325.62200927734375 4149.27001953125,315.4779968261719 C4049.64990234375,305.6600036621094 3951.639892578125,296 3840,296 C3728.360107421875,296 3630.35009765625,305.6600036621094 3530.72998046875,315.4779968261719 C3427.800048828125,325.62200927734375 3323.159912109375,335.93499755859375 3200,335.93499755859375 C3076.840087890625,335.93499755859375 2972.199951171875,325.62200927734375 2869.27001953125,315.4779968261719 C2769.64990234375,305.6600036621094 2671.639892578125,296 2560,296 C2448.360107421875,296 2350.35009765625,305.6600036621094 2250.72998046875,315.4779968261719 C2147.800048828125,325.62200927734375 2043.1600341796875,335.93499755859375 1920,335.93499755859375 C1796.8399658203125,335.93499755859375 1692.199951171875,325.62200927734375 1589.27001953125,315.4779968261719 C1489.6500244140625,305.6600036621094 1391.6400146484375,296 1280,296 C1168.3599853515625,296 1070.3499755859375,305.6600036621094 970.72998046875,315.4779968261719 C867.7990112304688,325.62200927734375 763.156005859375,335.93499755859375 640,335.93499755859375 C516.843994140625,335.93499755859375 412.20098876953125,325.62200927734375 309.2699890136719,315.4779968261719 C309.2699890136719,315.4779968261719 C309.2699890136719,315.4779968261719 C309.2699890136719,315.4779968261719z"></path>
                    </g>
                  </g>
                </svg>
              </div>
            </div>
        </section>

        <!-- TENTANG OCEAN BY BCA SECTION (Official Site Style) -->
        <section class="tentang-ocean-section">
            <h2 class="tentang-title">TENTANG OCEAN BY BCA</h2>
            <div class="tentang-grid">
                <!-- Card 1 -->
                <div class="tentang-card" style="background-image: url('https://pustaka.bca.co.id/Ocean/Homepage/collaboration.jpg');" data-page="how-it-works">
                    <div class="tentang-glass-overlay">
                        <h3>Integrasi Digital</h3>
                        <p>Pantau dan akses berbagai produk perbankan bisnis BCA melalui satu platform.</p>
                    </div>
                </div>
                <!-- Card 2 -->
                <div class="tentang-card" style="background-image: url('https://pustaka.bca.co.id/Ocean/Homepage/bca-tower.jpg');" data-page="sandbox">
                    <div class="tentang-glass-overlay">
                        <h3>Produk Pilihan</h3>
                        <p>Optimalkan potensi bisnis dengan rekomendasi produk yang tepat untuk bisnis Anda.</p>
                    </div>
                </div>
                <!-- Card 3 -->
                <div class="tentang-card" style="background-image: url('https://pustaka.bca.co.id/Ocean/Homepage/harbour.jpg');" data-page="roi">
                    <div class="tentang-glass-overlay">
                        <h3>Jaringan Bisnis</h3>
                        <p>Perluas jaringan bisnis dan tumbuh bersama ratusan ribu nasabah bisnis BCA lainnya.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- SOLUSI DARI OCEAN BY BCA SECTION (Official Site Style) -->
        <section class="solusi-ocean-section">
            <span class="solusi-badge">SOLUSI DARI OCEAN BY BCA</span>
            <h2 class="solusi-main-title">Bagaimana Ocean by BCA membantu bisnis Anda?</h2>
            
            <div class="solusi-grid">
                <!-- Card 1 -->
                <a target="_blank" class="solusi-card card-teal col-2-row-2" href="https://ocean.bca.co.id/id/artikel/transaksi-aman-untuk-menunjang-kelancaran-bisnis?article_id=477f5e89-ef91-47d8-b5ab-9e41be97839b&lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af&source=landing">
                    <div class="solusi-img-wrapper">
                        <img src="https://pustaka.bca.co.id/Ocean/Business%20News/Tips_Aman_Bertransaksi_dengan_myBCA%20Bisnis_dan_Ocean.jpeg" alt="Transaksi Aman untuk Menunjang Kelancaran Bisnis">
                    </div>
                    <div class="solusi-text-block">
                        <h3>Transaksi Aman untuk Menunjang Kelancaran Bisnis</h3>
                        <span class="solusi-link">
                            Pelajari Lebih Lanjut
                            <span class="arrow-icon"></span>
                        </span>
                    </div>
                </a>

                <!-- Card 2 -->
                <a target="_blank" class="solusi-card card-navy col-2-reverse" href="https://ocean.bca.co.id/id/artikel/integrasi-bisnis-dengan-mybca-bisnis-lite?article_id=f670a5fa-35ad-418d-a17c-0d3a5a5e2f5e&lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af&source=landing">
                    <div class="solusi-img-wrapper">
                        <img src="https://pustaka.bca.co.id/Ocean/Business%20News/Artikel%20myBCA%20Bisnis%20Lite.jpg" alt="Bisnis Terintegrasi di Mana Saja dengan myBCA Bisnis Lite">
                    </div>
                    <div class="solusi-text-block">
                        <h3>Bisnis Terintegrasi di Mana Saja dengan myBCA Bisnis Lite</h3>
                        <span class="solusi-link">
                            Pelajari Lebih Lanjut
                            <span class="arrow-icon"></span>
                        </span>
                    </div>
                </a>

                <!-- Card 3 (Overlay Style) -->
                <a target="_blank" class="solusi-card card-overlay" href="https://ocean.bca.co.id/id/artikel/pengertian-supply-chain-management?source=landing&article_id=6689ed21-dc96-4386-afe3-5d354289ef97&lob_id=b7a6426a-4d61-4034-8760-04d8ba5f5ada">
                    <div class="solusi-img-wrapper full-height">
                        <div class="gradient-overlay"></div>
                        <img src="https://pustaka.bca.co.id/Ocean/Business%20News/Agustus%202025/Supply%20Chain%20Management%20Bisnis.jpg" alt="Supply Chain Management: Definisi, Komponen, dan Manfaatnya untuk Bisnis">
                        <div class="glass-overlay-card">
                            <h3>Supply Chain Management: Definisi, Komponen, dan Manfaatnya untuk Bisnis</h3>
                            <span class="solusi-link">
                                Pelajari Lebih Lanjut
                                <span class="arrow-icon"></span>
                            </span>
                        </div>
                    </div>
                </a>

                <!-- Card 4 (Overlay Style) -->
                <a target="_blank" class="solusi-card card-overlay" href="https://ocean.bca.co.id/id/artikel/pengertian-bisnis-internasional?source=landing&article_id=1b4f98eb-6163-4167-81c7-f47c34940b82&lob_id=e33d16d0-7883-44f5-8637-3a324026ced0">
                    <div class="solusi-img-wrapper full-height">
                        <div class="gradient-overlay"></div>
                        <img src="https://pustaka.bca.co.id/Ocean/Business%20News/Agustus%202025/Bisnis%20Internasional%20Ekspor%20Impor.jpg" alt="Bisnis Internasional: Pengertian, Jenis, dan Contohnya">
                        <div class="glass-overlay-card">
                            <h3>Bisnis Internasional: Pengertian, Jenis, dan Contohnya</h3>
                            <span class="solusi-link">
                                Pelajari Lebih Lanjut
                                <span class="arrow-icon"></span>
                            </span>
                        </div>
                    </div>
                </a>

                <!-- Card 5 (Full-width style) -->
                <a target="_blank" class="solusi-card card-white col-3-full" href="https://ocean.bca.co.id/id/artikel/alat-pembayaran-non-tunai?source=landing&article_id=78dea3d4-26b9-4633-a8e9-182efdccd4c7&lob_id=b7a6426a-4d61-4034-8760-04d8ba5f5ada">
                    <div class="solusi-img-wrapper">
                        <img src="https://pustaka.bca.co.id/Ocean/Business%20News/Agustus%202025/Alat%20Pembayaran%20Nontunai.jpg" alt="4 Alat Pembayaran Non Tunai Paling Populer untuk Bisnis">
                    </div>
                    <div class="solusi-text-block">
                        <h3>4 Alat Pembayaran Non Tunai Paling Populer untuk Bisnis</h3>
                        <span class="solusi-link blue-theme">
                            Pelajari Lebih Lanjut
                            <span class="arrow-icon blue-theme"></span>
                        </span>
                    </div>
                </a>
            </div>
        </section>

        <!-- MENGAPA OCEAN BY BCA SECTION (Official Site Style) -->
        <section class="mengapa-ocean-section">
            <div class="mengapa-gradient-overlay"></div>
            <div class="mengapa-content-container">
                <div>
                    <span class="mengapa-badge">MENGAPA OCEAN BY BCA</span>
                    <h3 class="mengapa-title">Membangun Ekosistem Bisnis Potensial dan Berkelanjutan</h3>
                </div>
                
                <div class="mengapa-cards-grid">
                    <!-- Card 1 -->
                    <div class="mengapa-card">
                        <h3>Dipercaya ±34 Juta Nasabah</h3>
                        <p>Perbesar potensi bisnis dengan jangkauan pasar yang lebih luas.</p>
                    </div>
                    
                    <!-- Card 2 -->
                    <div class="mengapa-card">
                        <h3>Volume Transaksi Tumbuh 76%</h3>
                        <p><i>Cashflow</i> dan operasional lancar, bisnis siap untuk bertumbuh.</p>
                    </div>
                    
                    <!-- Card 3 -->
                    <div class="mengapa-card">
                        <h3>99% Transaksi Berbasis Digital</h3>
                        <p>Adaptasi digital untuk mengakomodasi kebiasaan baru customer.</p>
                    </div>
                    
                    <!-- Footer Note -->
                    <p class="mengapa-disclaimer">*Data dihimpun di tahun 2025</p>
                </div>
            </div>
        </section>

        <!-- TRY OCEAN NOW (Self-Service Discovery) SECTION -->
        <section class="try-ocean-section">
            <div class="try-ocean-header">
                <h2>Try Ocean Now</h2>
                <p>Temukan solusi yang tepat untuk bisnis Anda dan eksplorasi integrasi API kami secara instan tanpa perlu login.</p>
            </div>
            
            <div class="try-ocean-grid">
                <!-- Product Matcher -->
                <div class="to-card to-matcher card-premium">
                    <div class="to-card-header">
                        <span class="to-icon">🎯</span>
                        <h3>Product Matcher</h3>
                    </div>
                    <p class="to-desc">Jawab 3 pertanyaan singkat dan temukan produk Ocean yang paling cocok untuk bisnis Anda.</p>
                    
                    <div class="to-matcher-form">
                        <div class="input-group">
                            <label>Apa peran Anda di perusahaan?</label>
                            <select id="to-role-select" class="to-select">
                                <option value="" disabled selected>Pilih Peran...</option>
                                <option value="ceo_cfo">CEO / CFO / Pemilik Bisnis</option>
                                <option value="ops">Manajer Operasional / Finance</option>
                                <option value="developer">Developer / IT</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Apa industri bisnis Anda?</label>
                            <select id="to-industry-select" class="to-select">
                                <option value="" disabled selected>Pilih Industri...</option>
                                <option value="ecommerce">E-Commerce & Retail</option>
                                <option value="b2b">B2B & Korporasi</option>
                                <option value="fintech">Fintech & Layanan Keuangan</option>
                                <option value="fnb">F&B dan Hospitality</option>
                                <option value="logistics">Logistik & Distribusi</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Kebutuhan utama Anda?</label>
                            <select id="to-need-select" class="to-select">
                                <option value="" disabled selected>Pilih Kebutuhan...</option>
                                <option value="collection">Penerimaan Pembayaran</option>
                                <option value="disbursement">Pembayaran & Payroll</option>
                                <option value="cash_management">Manajemen Kas & Rekening</option>
                                <option value="financing">Pembiayaan & Kredit</option>
                                <option value="integration">Integrasi Sistem (API)</option>
                            </select>
                        </div>
                        <button id="btn-match-product" class="btn-primary" style="width:100%; margin-top:0.5rem;">Temukan Solusi</button>
                    </div>
                    
                    <div id="to-match-result" class="to-result hidden">
                        <div class="match-badge" id="to-match-badge">Rekomendasi untuk CEO/CFO</div>
                        <div id="to-match-cards"></div>
                        <button id="btn-go-sandbox" class="btn-primary" style="width:100%; margin-top:1.25rem;">🚀 Coba Langsung di Ocean Sandbox Demo</button>
                    </div>
                </div>

                <!-- API Sandbox Simulator -->
                <div class="to-card to-sandbox card-premium">
                    <div class="to-card-header">
                        <span class="to-icon">💻</span>
                        <h3>API Sandbox Preview</h3>
                    </div>
                    <p class="to-desc">Lihat bagaimana mudahnya mengintegrasikan Ocean API ke dalam sistem Anda.</p>
                    
                    <div class="api-terminal">
                        <div class="api-term-header">
                            <div class="mac-btns"><span class="red"></span><span class="yellow"></span><span class="green"></span></div>
                            <div class="api-tabs">
                                <span class="api-tab active">Request (cURL)</span>
                                <span class="api-tab">Response (JSON)</span>
                            </div>
                        </div>
                        <div class="api-term-body">
<pre id="api-req-code" class="api-code active"><code>curl -X POST https://sandbox.ocean.bca.co.id/v1/transfer \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 1000000,
    "beneficiaryAccount": "1234567890",
    "currency": "IDR",
    "remark": "Pembayaran Invoice INV-2025-10"
  }'</code></pre>
<pre id="api-res-code" class="api-code hidden"><code>{
  "status": "SUCCESS",
  "transactionId": "TRX9988776655",
  "timestamp": "2026-05-26T14:30:00Z",
  "data": {
    "amount": 1000000,
    "status": "COMPLETED",
    "receipt": "https://ocean.bca.co.id/receipt/TRX9988776655"
  }
}</code></pre>
                        </div>
                    </div>
                    <button id="btn-run-api" class="btn-outline" style="width:100%; margin-top:1rem;">Simulasi Eksekusi API</button>
                </div>
            </div>
        </section>
        
        <!-- MODAL PENGAJUAN AKSES SANDBOX -->
        <div id="sandbox-req-modal" class="sb-modal-overlay hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px);">
            <div class="sb-modal-card card-premium" style="background: white; border-radius: 20px; width: 100%; max-width: 500px; padding: 2.5rem; text-align: left; box-shadow: 0 20px 50px rgba(0,0,0,0.15); animation: fadeIn 0.3s ease; box-sizing: border-box;">
                <h3 style="margin-bottom: 0.5rem; color: var(--bca-blue-dark); font-weight: 800; font-size: 1.4rem;">Pengajuan Akses Sandbox</h3>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem; line-height: 1.4;">Silakan lengkapi formulir pendaftaran di bawah ini untuk mengajukan akses khusus ke kunci API simulasi Ocean Sandbox.</p>
                
                <div class="sb-req-form" id="sb-req-fields">
                    <div class="input-group" style="margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--bca-blue-primary);">Nama Lengkap</label>
                        <input type="text" id="sb-req-name" class="to-select" placeholder="Masukkan nama lengkap Anda" style="margin-bottom: 0;" required>
                    </div>
                    <div class="input-group" style="margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--bca-blue-primary);">Email Perusahaan</label>
                        <input type="email" id="sb-req-email" class="to-select" placeholder="Masukkan email korporat/kerja Anda" style="margin-bottom: 0;" required>
                    </div>
                    <div class="input-group" style="margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--bca-blue-primary);">Nama Perusahaan</label>
                        <input type="text" id="sb-req-company" class="to-select" placeholder="Masukkan nama badan usaha/PT Anda" style="margin-bottom: 0;" required>
                    </div>
                    <div class="input-group" style="margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--bca-blue-primary);">Nomor Handphone / WhatsApp</label>
                        <input type="text" id="sb-req-phone" class="to-select" placeholder="Masukkan nomor handphone aktif" style="margin-bottom: 0;" required>
                    </div>
                    
                    <div class="modal-buttons" style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button class="btn-outline" id="btn-sb-req-cancel" style="padding: 0.6rem 1.5rem; border-radius: 50px; border: 1px solid #cbd5e1; font-weight: 700; cursor: pointer; background: transparent;">Batal</button>
                        <button class="btn-primary" id="btn-sb-req-submit" style="padding: 0.6rem 1.5rem; border-radius: 50px; font-weight: 700; cursor: pointer;">Kirim Pengajuan</button>
                    </div>
                </div>

                <div class="sb-req-success hidden" id="sb-req-success-view" style="text-align: center;">
                    <div style="font-size: 3.5rem; margin-bottom: 1rem; animation: bounce 1s infinite;">📩</div>
                    <h4 style="color: #16a34a; font-weight: 800; font-size: 1.25rem; margin-bottom: 0.5rem;">Pengajuan Berhasil Dikirim!</h4>
                    <p style="font-size: 0.85rem; color: #475569; margin-bottom: 1.5rem; line-height: 1.5;">
                        Terima kasih. Permohonan Anda telah masuk ke sistem kami untuk ditinjau oleh tim Ocean by BCA. <br>
                        <strong style="color: var(--bca-blue-dark);">Namun untuk kemudahan demo simulasi ini, Anda dapat langsung mengeksplorasi Sandbox sekarang!</strong>
                    </p>
                    <button class="btn-primary" id="btn-sb-req-sandbox-direct" style="width: 100%; padding: 0.8rem; border-radius: 50px; font-weight: 700;">Buka Sandbox Demo 🚀</button>
                </div>
            </div>
        </div>

        <!-- FITUR UNGGULAN SECTION (Interactive Slideshow) -->
        <section class="fitur-unggulan-section">
            <div class="fitur-unggulan-container">
                <!-- Slide List -->
                <div class="fitur-slides-wrapper">
                    <!-- Slide 1 (Active) -->
                    <div class="fitur-slide active" data-slide="0">
                        <div class="fitur-slide-content">
                            <span class="fitur-badge-premium">FITUR UNGGULAN</span>
                            <span class="fitur-slide-title">Dashboard Terintegrasi</span>
                            <h2 class="fitur-slide-subtitle">Pantau Setiap Aktivitas Bisnis dalam Satu Layar</h2>
                            <p class="fitur-slide-desc">Dashboard yang bisa disesuaikan dengan kebutuhan bisnis Anda, mulai dari arus kas, tren transaksi, hingga analisis bisnis. Pengambilan keputusan menjadi lebih efektif dengan data yang akurat.</p>
                        </div>
                        <div class="fitur-slide-image-box">
                            <img src="https://pustaka.bca.co.id/Ocean/Homepage/feature_01_png.png" alt="Dashboard Terintegrasi">
                        </div>
                    </div>

                    <!-- Slide 2 -->
                    <div class="fitur-slide" data-slide="1">
                        <div class="fitur-slide-content">
                            <span class="fitur-badge-premium">FITUR UNGGULAN</span>
                            <span class="fitur-slide-title">Rekomendasi Produk</span>
                            <h2 class="fitur-slide-subtitle">Temukan Solusi Tepat untuk Perkembangan Bisnis</h2>
                            <p class="fitur-slide-desc">Ocean by BCA mengerti setiap bisnis memiliki kebutuhan yang berbeda-beda. Temukan solusi simpanan, transaksi, pinjaman, asuransi, investasi, dan operasional sesuai. Ajukan langsung dalam satu layar.</p>
                        </div>
                        <div class="fitur-slide-image-box">
                            <img src="https://pustaka.bca.co.id/Ocean/Homepage/feature_02_png.png" alt="Rekomendasi Produk">
                        </div>
                    </div>

                    <!-- Slide 3 -->
                    <div class="fitur-slide" data-slide="2">
                        <div class="fitur-slide-content">
                            <span class="fitur-badge-premium">FITUR UNGGULAN</span>
                            <span class="fitur-slide-title">myEcosystem</span>
                            <h2 class="fitur-slide-subtitle">Bangun Jaringan, Penuhi Kebutuhan Operasional</h2>
                            <p class="fitur-slide-desc">Miliki pengelolaan karyawan yang terstruktur, administrasi penagihan yang sistematis, pelaporan pajak yang pruden, manajemen risiko perusahaan, hingga kesempatan berkolaborasi dengan ratusan ribu nasabah bisnis BCA lainnya.</p>
                        </div>
                        <div class="fitur-slide-image-box">
                            <img src="https://pustaka.bca.co.id/Ocean/Homepage/feature_03_png.png" alt="myEcosystem">
                        </div>
                    </div>
                </div>

                <!-- Navigation controls (positioned bottom-left of content) -->
                <div class="fitur-controls">
                    <button class="fitur-control-btn btn-prev" aria-label="Previous Slide">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button class="fitur-control-btn btn-next" aria-label="Next Slide">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <div class="fitur-dots">
                        <span class="fitur-dot active" data-dot="0"></span>
                        <span class="fitur-dot" data-dot="1"></span>
                        <span class="fitur-dot" data-dot="2"></span>
                    </div>
                </div>
            </div>
        </section>

        <!-- STEPS SECTION -->
        <section class="steps-section-official">
            <h2>Cara Bergabung dengan Ocean by BCA</h2>
            
            <div class="steps-grid-official">
                <!-- Step 1 -->
                <div class="step-card-official">
                    <img class="step-icon-img" src="https://pustaka.bca.co.id/Ocean/Homepage/Icon%20Steps/deposit.png" alt="Buka Rekening Bisnis BCA">
                    <div class="step-badge-circle">1</div>
                    <h4>Buka Rekening Bisnis BCA</h4>
                    <p>Pastikan memiliki rekening bisnis BCA (Tahapan Gold/Rekening Giro)</p>
                </div>
                <!-- Step 2 -->
                <div class="step-card-official">
                    <img class="step-icon-img" src="https://pustaka.bca.co.id/Ocean/Homepage/Icon%20Steps/super-admin.png" alt="Buat BCA ID Bisnis">
                    <div class="step-badge-circle">2</div>
                    <h4>Buat BCA ID Bisnis</h4>
                    <p>Dapatkan BCA ID Bisnis dengan registrasi di Ocean by BCA</p>
                </div>
                <!-- Step 3 -->
                <div class="step-card-official">
                    <img class="step-icon-img" src="https://pustaka.bca.co.id/Ocean/Homepage/Icon%20Steps/ocean-logo.png" alt="Masuk Ocean by BCA">
                    <div class="step-badge-circle">3</div>
                    <h4>Masuk Ocean by BCA</h4>
                    <p>Gunakan BCA ID Bisnis untuk login ke Ocean by BCA</p>
                </div>
            </div>
        </section>

        <!-- CONTACT FORM (Punya pertanyaan?) -->
        <section class="contact-section-official">
            <div class="contact-container-official">
                <!-- Left Side image -->
                <div class="contact-image-side">
                    <img src="https://pustaka.bca.co.id/Ocean/Homepage/form-card.png" alt="Person with packages">
                </div>
                
                <!-- Right Side form -->
                <div class="contact-form-side">
                    <h2 class="contact-form-title">Punya pertanyaan?</h2>
                    <p class="contact-form-subtitle">Silakan tinggalkan kontak untuk dihubungi.</p>
                    
                    <form id="ocean-contact-form" class="contact-grid-form">
                        <!-- Row 1 -->
                        <div class="contact-form-group">
                            <label for="contact-pic">Nama PIC</label>
                            <input type="text" id="contact-pic" placeholder="Masukkan nama Anda" required autocomplete="off">
                        </div>
                        <div class="contact-form-group">
                            <label for="contact-usaha">Nama Usaha</label>
                            <input type="text" id="contact-usaha" placeholder="Masukkan nama perusahaan Anda" required autocomplete="off">
                        </div>
                        
                        <!-- Row 2 -->
                        <div class="contact-form-group">
                            <label for="contact-tel">Nomor Telepon <span class="label-optional">(opsional)</span></label>
                            <input type="tel" id="contact-tel" placeholder="Masukkan nomor telepon Anda" autocomplete="off">
                        </div>
                        <div class="contact-form-group email-group">
                            <label for="contact-email">Alamat Email</label>
                            <div class="email-input-wrapper">
                                <span class="email-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </span>
                                <input type="email" id="contact-email" placeholder="Masukkan alamat email Anda" required autocomplete="off">
                            </div>
                        </div>
                        
                        <!-- Row 3: Textarea -->
                        <div class="contact-form-group full-width textarea-group">
                            <label for="contact-desc">Deskripsi Kebutuhan Bisnis</label>
                            <div class="textarea-wrapper">
                                <textarea id="contact-desc" placeholder="Masukkan pertanyaan Anda" maxlength="500" required autocomplete="off"></textarea>
                                <span class="char-counter">0 / 500</span>
                            </div>
                        </div>
                        
                        <!-- Row 4: Checkboxes -->
                        <div class="contact-form-group full-width consent-group">
                            <p class="consent-header">Saya dengan ini menyatakan hal-hal berikut:</p>
                            
                            <label class="consent-checkbox-label">
                                <input type="checkbox" id="consent-1" required>
                                <span class="custom-checkbox"></span>
                                <span class="consent-text">Seluruh data yang saya berikan dalam Layanan Leave Contact ini adalah benar, lengkap, dan akurat, serta merupakan data milik saya pribadi</span>
                            </label>
                            
                            <label class="consent-checkbox-label">
                                <input type="checkbox" id="consent-2" required>
                                <span class="custom-checkbox"></span>
                                <span class="consent-text">Saya bersedia dihubungi oleh pihak PT Bank Central Asia Tbk melalui sarana komunikasi pribadi yang saya berikan dalam Layanan Leave Contact ini untuk menerima penjelasan/informasi lebih lanjut mengenai produk/layanan yang terdapat pada portal Ocean by BCA</span>
                            </label>
                        </div>
                        
                        <!-- Row 5: Action Button -->
                        <div class="contact-form-group full-width submit-wrapper">
                            <button type="submit" id="btn-submit-contact" class="btn-submit-disabled" disabled>Kirim</button>
                        </div>
                    </form>
                </div>
            </div>
        </section>

        <!-- FOOTER SECTION -->
        ${PublicFooter()}
    </div>
`;

const SandboxPage = () => {
    const tab = state.sandboxTab;

    // Calculate Invoicing stats dynamically
    let paidSum = 0;
    let pendingSum = 0;
    let overdueSum = 0;
    state.sandbox.invoices.forEach(inv => {
        if (inv.status === 'Lunas') paidSum += inv.amount;
        else if (inv.status === 'Menunggu') pendingSum += inv.amount;
        else if (inv.status === 'Jatuh Tempo') overdueSum += inv.amount;
    });

    const totalInv = paidSum + pendingSum + overdueSum;
    const paidPct = totalInv > 0 ? Math.round((paidSum / totalInv) * 100) : 0;
    const pendingPct = totalInv > 0 ? Math.round((pendingSum / totalInv) * 100) : 0;
    const overduePct = totalInv > 0 ? Math.round((overdueSum / totalInv) * 100) : 0;

    const dashboardContent = `
        <div class="sb-stats">
            <div class="sb-stat" style="border-left: 4px solid var(--bca-blue-primary);">
                <label>💵 Total Saldo (5 Rekening)</label>
                <div class="val">Rp ${state.sandbox.totalBalance.toLocaleString('id-ID')}</div>
                <span class="trend up">▲ 12% vs bulan lalu</span>
            </div>
            <div class="sb-stat" style="border-left: 4px solid #16a34a;">
                <label>📥 Incoming Today</label>
                <div class="val" style="color: #16a34a;">Rp ${state.sandbox.incomingToday.toLocaleString('id-ID')}</div>
                <span class="trend up">▲ 8% vs kemarin</span>
            </div>
            <div class="sb-stat" style="border-left: 4px solid #dc2626;">
                <label>📤 Outgoing Today</label>
                <div class="val" style="color: #dc2626;">Rp ${state.sandbox.outgoingToday.toLocaleString('id-ID')}</div>
                <span class="trend down">▼ 3% vs kemarin</span>
            </div>
            <div class="sb-stat" style="border-left: 4px solid #d97706;">
                <label>⚠️ Pending Approval</label>
                <div class="val sb-val-warning">${state.sandbox.pendingApprovalCount} Transaksi</div>
                <span class="trend" style="color: #cbd5e1;">Menunggu review</span>
            </div>
        </div>
        
        <div class="sb-chart-placeholder">
            <div class="chart-header">
                <span style="font-weight: 700; color: var(--bca-blue-dark);">Cash Flow Trend (6 Bulan Terakhir)</span>
                <div class="chart-legend">
                    <span class="in">Inflow</span>
                    <span class="out">Outflow</span>
                </div>
            </div>
            <div class="fake-chart-visual">
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 40%" data-tooltip="Inflow Jan: Rp 2.4M"></div>
                    <div class="bar bar-out" style="height: 25%" data-tooltip="Outflow Jan: Rp 1.5M"></div>
                    <span class="bar-label">Jan</span>
                </div>
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 60%" data-tooltip="Inflow Feb: Rp 3.6M"></div>
                    <div class="bar bar-out" style="height: 35%" data-tooltip="Outflow Feb: Rp 2.1M"></div>
                    <span class="bar-label">Feb</span>
                </div>
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 45%" data-tooltip="Inflow Mar: Rp 2.7M"></div>
                    <div class="bar bar-out" style="height: 30%" data-tooltip="Outflow Mar: Rp 1.8M"></div>
                    <span class="bar-label">Mar</span>
                </div>
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 80%" data-tooltip="Inflow Apr: Rp 4.8M"></div>
                    <div class="bar bar-out" style="height: 50%" data-tooltip="Outflow Apr: Rp 3.0M"></div>
                    <span class="bar-label">Apr</span>
                </div>
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 55%" data-tooltip="Inflow Mei: Rp 3.3M"></div>
                    <div class="bar bar-out" style="height: 40%" data-tooltip="Outflow Mei: Rp 2.4M"></div>
                    <span class="bar-label">Mei</span>
                </div>
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 90%" data-tooltip="Inflow Jun: Rp 5.4M"></div>
                    <div class="bar bar-out" style="height: 45%" data-tooltip="Outflow Jun: Rp 2.7M"></div>
                    <span class="bar-label">Jun</span>
                </div>
            </div>
        </div>
        
        <div class="sb-recent">
            <h4 style="color: var(--bca-blue-dark); font-weight:700; margin-bottom:1rem;">Transaksi Terbaru</h4>
            <table class="sb-table">
                <thead>
                    <tr><th>Tanggal</th><th>Deskripsi</th><th>Nominal</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${state.sandbox.transactions.map(t => {
                        const isOut = t.amount < 0;
                        const amountStr = (isOut ? '- ' : '+ ') + 'Rp ' + Math.abs(t.amount).toLocaleString('id-ID');
                        const classAmount = isOut ? 'sb-amount-out' : 'sb-amount-in';
                        const classTag = t.status === 'Success' ? 'tag-s' : (t.status === 'Pending' ? 'tag-pending' : 'tag-overdue');
                        return `
                            <tr>
                                <td>${t.date}</td>
                                <td>${t.desc}</td>
                                <td class="${classAmount}">${amountStr}</td>
                                <td><span class="${classTag}">${t.status}</span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    const analyticsContent = `
        <div class="sb-analytics-header">
            <h3 style="color: var(--bca-blue-dark); font-weight:700;">📊 Business Analytics Dashboard</h3>
            <div class="sb-filter-row">
                <select id="sb-analytics-period" class="branch-filter">
                    <option value="monthly" selected>Bulanan</option>
                    <option value="weekly">Mingguan</option>
                    <option value="daily">Harian</option>
                </select>
                <select id="sb-analytics-account" class="branch-filter">
                    <option value="all" selected>Semua Rekening</option>
                    <option value="giro">Giro Utama</option>
                    <option value="va">Virtual Account</option>
                </select>
            </div>
        </div>
        <div class="sb-analytics-grid">
            <div class="sb-metric-card">
                <div class="sb-metric-icon" style="background:#eff6ff;color:#1d4ed8;">📈</div>
                <div class="sb-metric-info">
                    <label>Total Volume Transaksi</label>
                    <div class="val">1.245</div>
                    <span class="trend up">▲ 18% dari periode sebelumnya</span>
                </div>
            </div>
            <div class="sb-metric-card">
                <div class="sb-metric-icon" style="background:#f0fdf4;color:#16a34a;">💰</div>
                <div class="sb-metric-info">
                    <label>Rata-Rata Nilai Transaksi</label>
                    <div class="val">Rp 15.200.000</div>
                    <span class="trend up">▲ 5% dari periode sebelumnya</span>
                </div>
            </div>
            <div class="sb-metric-card">
                <div class="sb-metric-icon" style="background:#fef3c7;color:#d97706;">⏱️</div>
                <div class="sb-metric-info">
                    <label>Waktu Settlement Rata-Rata</label>
                    <div class="val">2.3 Detik</div>
                    <span class="trend up">▲ 40% lebih cepat</span>
                </div>
            </div>
            <div class="sb-metric-card">
                <div class="sb-metric-icon" style="background:#fdf2f8;color:#db2777;">🔄</div>
                <div class="sb-metric-info">
                    <label>Tingkat Rekonsiliasi Otomatis</label>
                    <div class="val">98.7%</div>
                    <span class="trend up">Match rate sangat tinggi</span>
                </div>
            </div>
        </div>
        <div class="sb-chart-placeholder" style="margin-top:1.5rem;">
            <div class="chart-header">
                <span style="font-weight: 700; color: var(--bca-blue-dark);">Tren Volume Transaksi per Kategori</span>
                <div class="chart-legend">
                    <span class="in">Collection</span>
                    <span class="out">Disbursement</span>
                </div>
            </div>
            <div class="fake-chart-visual">
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 55%" data-tooltip="Collection W1: 550 Trx"></div>
                    <div class="bar bar-out" style="height: 30%" data-tooltip="Disbursement W1: 300 Trx"></div>
                    <span class="bar-label">W1</span>
                </div>
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 70%" data-tooltip="Collection W2: 700 Trx"></div>
                    <div class="bar bar-out" style="height: 45%" data-tooltip="Disbursement W2: 450 Trx"></div>
                    <span class="bar-label">W2</span>
                </div>
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 65%" data-tooltip="Collection W3: 650 Trx"></div>
                    <div class="bar bar-out" style="height: 50%" data-tooltip="Disbursement W3: 500 Trx"></div>
                    <span class="bar-label">W3</span>
                </div>
                <div class="bar-group">
                    <div class="bar bar-in" style="height: 85%" data-tooltip="Collection W4: 850 Trx"></div>
                    <div class="bar bar-out" style="height: 40%" data-tooltip="Disbursement W4: 400 Trx"></div>
                    <span class="bar-label">W4</span>
                </div>
            </div>
        </div>
        <div class="sb-top-counterparties">
            <h4 style="color: var(--bca-blue-dark); font-weight:700; margin-bottom:1rem;">Top 5 Counterparty (Berdasarkan Volume)</h4>
            <table class="sb-table">
                <thead><tr><th>#</th><th>Nama Perusahaan</th><th>Jumlah Trx</th><th>Total Volume</th><th>Tren</th></tr></thead>
                <tbody>
                    <tr><td>1</td><td>PT Retail Jaya Sentosa</td><td>124</td><td>Rp 3.2 Milyar</td><td><span class="trend up">▲ 22%</span></td></tr>
                    <tr><td>2</td><td>CV Logistik Abadi</td><td>98</td><td>Rp 2.1 Milyar</td><td><span class="trend up">▲ 15%</span></td></tr>
                    <tr><td>3</td><td>PT Mitra Teknologi</td><td>76</td><td>Rp 1.8 Milyar</td><td><span class="trend down">▼ 3%</span></td></tr>
                    <tr><td>4</td><td>Koperasi Sejahtera</td><td>65</td><td>Rp 980 Juta</td><td><span class="trend up">▲ 8%</span></td></tr>
                    <tr><td>5</td><td>PT Distribusi Nasional</td><td>52</td><td>Rp 750 Juta</td><td><span class="trend up">▲ 31%</span></td></tr>
                </tbody>
            </table>
        </div>
    `;

    const invoicingContent = `
        <div class="sb-invoicing-header">
            <h3 style="color: var(--bca-blue-dark); font-weight:700;">📑 Invoice & Collection Manager</h3>
            <button id="btn-sb-create-invoice" class="btn-primary">+ Buat Invoice Baru</button>
        </div>
        <div class="sb-invoice-stats">
            <div class="sb-inv-stat" style="border-top: 4px solid #16a34a;">
                <div class="sb-inv-stat-val" style="color:#16a34a;">Rp ${paidSum.toLocaleString('id-ID')}</div>
                <div class="sb-inv-stat-label">Sudah Dibayar</div>
                <div class="sb-inv-stat-bar"><div style="width:${paidPct}%; background:#16a34a;"></div></div>
            </div>
            <div class="sb-inv-stat" style="border-top: 4px solid #d97706;">
                <div class="sb-inv-stat-val" style="color:#d97706;">Rp ${pendingSum.toLocaleString('id-ID')}</div>
                <div class="sb-inv-stat-label">Menunggu Pembayaran</div>
                <div class="sb-inv-stat-bar"><div style="width:${pendingPct}%; background:#d97706;"></div></div>
            </div>
            <div class="sb-inv-stat" style="border-top: 4px solid #dc2626;">
                <div class="sb-inv-stat-val" style="color:#dc2626;">Rp ${overdueSum.toLocaleString('id-ID')}</div>
                <div class="sb-inv-stat-label">Jatuh Tempo</div>
                <div class="sb-inv-stat-bar"><div style="width:${overduePct}%; background:#dc2626;"></div></div>
            </div>
        </div>
        
        <div id="sb-invoice-form" class="sb-invoice-form hidden">
            <h4 style="color: var(--bca-blue-dark); font-weight:700; margin-bottom:1rem;">Buat Invoice Baru (Demo)</h4>
            <div class="sb-inv-form-grid">
                <div class="input-group" style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:0.75rem;">
                    <label style="font-weight:700; font-size:0.8rem; color:var(--bca-blue-primary);">Nama Pelanggan</label>
                    <input type="text" id="sb-inv-customer" placeholder="PT Contoh Perusahaan" class="to-select" style="margin-bottom:0;">
                </div>
                <div class="input-group" style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:0.75rem;">
                    <label style="font-weight:700; font-size:0.8rem; color:var(--bca-blue-primary);">Nominal (Rp)</label>
                    <input type="number" id="sb-inv-amount" placeholder="10000000" class="to-select" style="margin-bottom:0;">
                </div>
                <div class="input-group" style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:0.75rem;">
                    <label style="font-weight:700; font-size:0.8rem; color:var(--bca-blue-primary);">Jatuh Tempo</label>
                    <input type="date" id="sb-inv-due" class="to-select" style="margin-bottom:0;">
                </div>
                <div class="input-group" style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:0.75rem;">
                    <label style="font-weight:700; font-size:0.8rem; color:var(--bca-blue-primary);">Metode Pembayaran</label>
                    <select id="sb-inv-method" class="to-select" style="margin-bottom:0;">
                        <option value="va">Virtual Account</option>
                        <option value="transfer">Transfer Manual</option>
                        <option value="qris">QRIS</option>
                    </select>
                </div>
            </div>
            <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:1.25rem;">
                <button id="btn-sb-cancel-invoice" class="btn-outline" style="border:1px solid #cbd5e1; padding:0.6rem 1.5rem; border-radius:50px; font-weight:700;">Batal</button>
                <button id="btn-sb-submit-invoice" class="btn-primary" style="padding:0.6rem 1.5rem; border-radius:50px; font-weight:700;">Kirim Invoice</button>
            </div>
        </div>

        <div class="sb-recent" style="margin-top:1.5rem;">
            <h4 style="color: var(--bca-blue-dark); font-weight:700; margin-bottom:1rem;">Daftar Invoice</h4>
            <table class="sb-table">
                <thead><tr><th>No. Invoice</th><th>Pelanggan</th><th>Nominal</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody id="sb-invoice-table-body">
                    ${state.sandbox.invoices.map(inv => {
                        const classTag = inv.status === 'Lunas' ? 'tag-s' : (inv.status === 'Menunggu' ? 'tag-pending' : 'tag-overdue');
                        const isPending = inv.status === 'Menunggu' || inv.status === 'Jatuh Tempo';
                        const actionBtn = isPending 
                            ? `<button class="sb-btn-sm sb-btn-pay" data-inv-id="${inv.id}" style="background:#16a34a; color:white; border:none; border-radius:6px; font-weight:700; cursor:pointer;">Bayar</button>
                               <button class="sb-btn-sm sb-btn-remind" data-inv-id="${inv.id}" style="margin-left:4px; cursor:pointer;">Ingatkan</button>`
                            : `<button class="sb-btn-sm" style="opacity:0.5; cursor:not-allowed;" disabled>Lunas</button>`;
                        return `
                            <tr>
                                <td>${inv.id}</td>
                                <td>${inv.customer}</td>
                                <td style="font-weight: 700;">Rp ${inv.amount.toLocaleString('id-ID')}</td>
                                <td>${inv.due}</td>
                                <td><span class="${classTag}">${inv.status}</span></td>
                                <td>${actionBtn}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    const activeSimulation = state.sandbox.apiSimulation;
    let simulatedReqPayload = '';
    let simulatedResPayload = 'Klik "Kirim Request" untuk memulai.';
    
    if (activeSimulation.activeEndpoint === 'get-balance') {
        simulatedReqPayload = `GET /v1/balance HTTP/1.1\nHost: api.ocean.bca.co.id\nAuthorization: Bearer oc_live_***8f2d\nAccept: application/json`;
        if (activeSimulation.response) {
            simulatedResPayload = JSON.stringify(activeSimulation.response, null, 2);
        }
    } else if (activeSimulation.activeEndpoint === 'create-va') {
        simulatedReqPayload = `POST /v1/va/create HTTP/1.1\nHost: api.ocean.bca.co.id\nContent-Type: application/json\nAuthorization: Bearer oc_live_***8f2d\n\n{\n  "amount": 15000000,\n  "customer_name": "PT Cipta Karya",\n  "due_date": "2026-06-30",\n  "description": "Invoice Pembayaran"\n}`;
        if (activeSimulation.response) {
            simulatedResPayload = JSON.stringify(activeSimulation.response, null, 2);
        }
    } else if (activeSimulation.activeEndpoint === 'transfer') {
        simulatedReqPayload = `POST /v1/transfer HTTP/1.1\nHost: api.ocean.bca.co.id\nContent-Type: application/json\nAuthorization: Bearer oc_live_***8f2d\n\n{\n  "beneficiary_account": "0123456789",\n  "amount": 25000000,\n  "remark": "Disbursement Gaji"\n}`;
        if (activeSimulation.response) {
            simulatedResPayload = JSON.stringify(activeSimulation.response, null, 2);
        }
    }

    const ecosystemContent = `
        <div class="sb-eco-header">
            <h3 style="color: var(--bca-blue-dark); font-weight:700;">🤝 Ecosystem & API Integration</h3>
            <p class="sb-eco-subtitle">Pantau semua koneksi API dan partner yang terintegrasi dengan Ocean secara real-time.</p>
        </div>
        <div class="sb-eco-grid">
            ${state.sandbox.integrations.map(item => {
                const activeClass = item.active ? '' : 'sb-eco-inactive';
                const statusClass = item.active ? 'sb-eco-active' : '';
                const btnLabel = item.active ? 'Deaktifkan' : 'Aktifkan Sekarang';
                const btnClass = item.active ? 'btn-outline sb-btn-deactivate' : 'btn-primary sb-btn-activate';
                return `
                    <div class="sb-eco-card ${activeClass}" id="card-${item.id}">
                        <div class="sb-eco-status ${statusClass}"></div>
                        <div class="sb-eco-icon">${item.icon}</div>
                        <h4 style="color: var(--bca-blue-dark); font-weight:700;">${item.name}</h4>
                        <p>${item.desc}</p>
                        <div class="sb-eco-stats-row">
                            <div><span class="sb-eco-num">${item.active ? item.trx.toLocaleString('id-ID') : '-'}</span><br><small>Trx/Hari</small></div>
                            <div><span class="sb-eco-num">${item.active ? item.uptime : '-'}</span><br><small>Uptime</small></div>
                        </div>
                        <div class="sb-eco-api-key" style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0;">
                            <span style="font-size:0.7rem; font-family:monospace; color:#475569;">Key: <code>${item.apiKey.substring(0, 10)}...</code></span>
                            <button class="sb-copy-btn" data-key="${item.apiKey}" style="background:transparent; border:none; cursor:pointer; font-size:0.85rem; padding:0; display:flex; align-items:center;" title="Salin API Key">📋</button>
                        </div>
                        <button class="${btnClass}" data-eco-id="${item.id}" style="width:100%; margin-top:0.75rem; font-size:0.8rem; padding:0.4rem 0.8rem; border-radius:50px; font-weight:700;">${btnLabel}</button>
                    </div>
                `;
            }).join('')}
        </div>
        
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; margin-top: 2rem; align-items: flex-start;">
            <div class="sb-eco-logs">
                <h4 style="color: var(--bca-blue-dark); font-weight:700; margin-bottom:1rem; display:flex; align-items:center; gap:8px;">
                    <span>📊 API Call Logs (Live Traffic)</span>
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; animation: pulse 1.5s infinite;"></span>
                </h4>
                <div class="sb-log-list" id="sb-log-list">
                    ${state.sandbox.apiLogs.map(log => {
                        const statusColorClass = (log.status >= 200 && log.status < 300) ? 'status-200' : 'status-401';
                        const methodClass = log.method.toLowerCase();
                        return `
                            <div class="sb-log-entry" style="border-bottom:1px solid #1e293b; padding:10px 0;">
                                <span class="sb-log-time" style="color: #64748b; font-family:'Fira Code',monospace;">${log.time}</span>
                                <span class="sb-log-method ${methodClass}">${log.method}</span>
                                <span class="sb-log-status ${statusColorClass}">${log.status}</span>
                                <code style="color:#e2e8f0; font-family:'Fira Code',monospace; flex:1; overflow-x:auto;">${log.endpoint}</code>
                                <span class="sb-log-dur" style="color:#64748b;">${log.duration}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="sb-api-client card-premium" style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 1.5rem; color: #e2e8f0;">
                <h4 style="margin-top:0; margin-bottom:0.75rem; color: #38bdf8; display:flex; align-items:center; gap:8px; font-size:1rem; font-weight:800;">
                    <span>💻 Interactive API Request Console</span>
                </h4>
                <p style="font-size:0.75rem; color:#94a3b8; margin-bottom:1.25rem; line-height:1.4; text-align:left;">Pilih salah satu endpoint untuk mensimulasikan panggilan API Ocean secara langsung dan lihat hasilnya.</p>
                
                <div style="display:flex; gap:0.5rem; margin-bottom:1.25rem;">
                    <select id="sb-api-endpoint" class="to-select" style="margin-bottom:0; background:#1e293b; color:white; border-color:#334155; font-size:0.85rem; padding:0.5rem; flex:1; outline:none;">
                        <option value="get-balance" ${activeSimulation.activeEndpoint === 'get-balance' ? 'selected' : ''}>GET /v1/balance (Cek Saldo)</option>
                        <option value="create-va" ${activeSimulation.activeEndpoint === 'create-va' ? 'selected' : ''}>POST /v1/va/create (Buat VA)</option>
                        <option value="transfer" ${activeSimulation.activeEndpoint === 'transfer' ? 'selected' : ''}>POST /v1/transfer (Disbursement)</option>
                    </select>
                    <button id="btn-sb-send-api" class="btn-primary" style="padding:0 1.25rem; font-size:0.85rem; white-space:nowrap; border-radius:8px; font-weight:700; ${activeSimulation.executing ? 'background:#64748b; cursor:not-allowed;' : ''}" ${activeSimulation.executing ? 'disabled' : ''}>
                        ${activeSimulation.executing ? 'Mengirim...' : 'Kirim Request'}
                    </button>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr; gap:1.25rem;">
                    <div>
                        <div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; font-weight:700; margin-bottom:0.35rem; text-align:left;">Request Headers & Payload</div>
                        <pre id="sb-api-req-payload" style="background:#1e293b; padding:0.75rem; border-radius:8px; margin:0; font-family:'Fira Code',monospace; font-size:0.7rem; overflow-x:auto; height:110px; border:1px solid #334155; color:#cbd5e1; text-align:left; white-space:pre; border-left:3px solid #38bdf8;">${simulatedReqPayload}</pre>
                    </div>
                    <div>
                        <div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; font-weight:700; margin-bottom:0.35rem; text-align:left;">Response (Simulasi JSON)</div>
                        <pre id="sb-api-res-payload" style="background:#1e293b; padding:0.75rem; border-radius:8px; margin:0; font-family:'Fira Code',monospace; font-size:0.7rem; overflow-x:auto; height:120px; border:1px solid #334155; color:#a7f3d0; text-align:left; white-space:pre; border-left:3px solid #34d399;">${simulatedResPayload}</pre>
                    </div>
                </div>
            </div>
        </div>
    `;

    const contents = { dashboard: dashboardContent, analytics: analyticsContent, invoicing: invoicingContent, ecosystem: ecosystemContent };
    const menuLabels = { dashboard: '🏠 Dashboard', analytics: '📊 Analytics', invoicing: '📑 Invoicing', ecosystem: '🤝 Ecosystem' };

    return `
    <div class="public-layout fade-in" style="max-width:1200px; margin:0 auto; padding:2rem 1.5rem;">
        <header class="page-header-p" style="margin-bottom:2rem; text-align:left; border-bottom: 2px solid #e2e8f0; padding-bottom: 1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h1 style="color: var(--bca-blue-dark); font-weight:800; font-size:2rem; margin-bottom:0.5rem;">Ocean Sandbox Demo</h1>
                    <p style="color:#64748b; font-size:0.95rem; margin:0;">Eksplorasi dashboard interaktif dan simulasi API tanpa menggunakan data asli Anda.</p>
                </div>
                <div style="background:#dcfce7; border:1px solid #bbf7d0; color:#15803d; padding:0.5rem 1rem; border-radius:50px; font-size:0.78rem; font-weight:700; display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; animation: pulse 1.5s infinite;"></span>
                    Sandbox Connected
                </div>
            </div>
        </header>

        <div class="sandbox-container card-premium" style="background:white; border-radius:16px; border:1px solid #e2e8f0; box-shadow:var(--shadow-premium);">
            <aside class="sandbox-sidebar" style="border-right:1px solid #e2e8f0; background:#f8fafc; padding:2rem 1.25rem;">
                <div style="display:flex; flex-direction:column; gap:0.25rem; flex:1;">
                    ${Object.keys(menuLabels).map(key => `
                        <div class="sb-menu ${tab === key ? 'active' : ''}" data-sb-tab="${key}" style="padding:12px 16px; border-radius:8px; font-weight:700; font-size:0.9rem; color:#64748b; cursor:pointer; display:flex; align-items:center; gap:10px; transition:all 0.2s;">
                            ${menuLabels[key]}
                        </div>
                    `).join('')}
                </div>
                <div class="sb-sidebar-divider" style="height:1px; background:#e2e8f0; margin:1.5rem 0;"></div>
                <div class="sb-sidebar-info" style="background: white; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div class="sb-sidebar-label" style="font-size:0.65rem; color:#94a3b8; font-weight:800; letter-spacing:1px; margin-bottom:0.35rem;">COMPANY ACCOUNT</div>
                    <div class="sb-sidebar-company" style="font-weight:800; font-size:0.85rem; color:var(--bca-blue-dark);">${state.corporateId ? state.corporateId : 'PT Demo Sejahtera'}</div>
                    <div class="sb-sidebar-id" style="font-size:0.7rem; color:#94a3b8; margin-top:0.25rem;">ID: OCN-DEMO-2026</div>
                </div>
            </aside>
            <main class="sandbox-main" style="padding:2.5rem; background:#ffffff;">
                ${contents[tab] || contents.dashboard}
            </main>
        </div>
        
        <div class="sandbox-footer" style="margin-top:2.5rem; text-align:center; background:linear-gradient(135deg, var(--bca-blue-dark), var(--bca-blue-primary)); color:white; padding:3.5rem 2rem; border-radius:16px; box-shadow:var(--shadow-premium);">
            <h2 style="font-weight:800; font-size:1.6rem; margin-bottom:0.75rem;">Ingin Menggunakan Solusi Asli untuk Bisnis Anda?</h2>
            <p style="font-size:0.95rem; color:#bfdbfe; margin-bottom:2rem; max-width:600px; margin-left:auto; margin-right:auto;">Hubungi Relationship Officer kami untuk mendiskusikan integrasi nyata dengan rekening korporasi BCA Anda.</p>
            <button class="btn-primary btn-lg" id="btn-sb-contact" style="background:#00a4ad; color:white; border:none; padding:0.8rem 2.5rem; border-radius:50px; font-weight:700; cursor:pointer; font-size:1rem; box-shadow:0 10px 20px rgba(0, 164, 173, 0.3);">Tinggalkan Kontak / Hubungi Kami</button>
        </div>
    </div>
    `;
};

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

const PRODUCTS = [
    {
        "id": "rekening/edeposito",
        "name": "e-Deposito",
        "subtitle": "Simpanan berjangka yang mudah dan fleksibel",
        "category": "Rekening",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Properti"
        ],
        "desc": "Deposito Rupiah yang dapat dibuka nasabah melalui KlikBCA Bisnis (KBB)",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/01438506-7542-4444-80CB-719E2A5E0520/Logo/asuransi-savings.svg",
        "link": "https://ocean.bca.co.id/id/produk/rekening/edeposito"
    },
    {
        "id": "rekening/deposito-berjangka",
        "name": "Deposito Berjangka",
        "subtitle": "Pengelolaan dana minim risiko dengan return yang pasti",
        "category": "Rekening",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Properti"
        ],
        "desc": "Deposito dengan berbagai pilihan mata uang dan jangka waktu",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/22C86F77-871C-4ED0-B07D-99B15EF01BEA/Logo/asuransi-savings.svg",
        "link": "https://ocean.bca.co.id/id/produk/rekening/deposito-berjangka"
    },
    {
        "id": "rekening/giro",
        "name": "Giro",
        "subtitle": "Dana perusahaan disimpan dengan aman",
        "category": "Rekening",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Apply Giro untuk tingkatkan produktivitas transaksi jual beli dengan aman",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/AB2A53C7-8C95-4EB9-BE7E-1705198CFF30/Logo/icon-giro.svg",
        "link": "https://ocean.bca.co.id/id/produk/rekening/giro"
    },
    {
        "id": "rekening/tahapan-gold",
        "name": "Tahapan Gold",
        "subtitle": "Pantau transaksi secara rinci",
        "category": "Rekening",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan"
        ],
        "desc": "Rekening khusus bisnis dengan fitur detail mutasi dari Tahapan Gold",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/E3BFCE4C-6D47-449D-B1C0-13C730F097C9/Logo/tahaka.svg",
        "link": "https://ocean.bca.co.id/id/produk/rekening/tahapan-gold"
    },
    {
        "id": "transaksi/ocean-by-bca",
        "name": "Ocean by BCA",
        "subtitle": "Integrasi bisnis dalam satu ekosistem digital",
        "category": "Transaksi",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan"
        ],
        "desc": "Seluruh aktivitas bisnis terorganisir dengan rapi dalam satu platform ",
        "icon": "https://pustaka.bca.co.id/Ocean/Assets/Icon/Ocean.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca"
    },
    {
        "id": "transaksi/ocean-by-bca/mybca-bisnis",
        "name": "myBCA Bisnis",
        "subtitle": "Bertransaksi dengan mudah dan nyaman",
        "category": "Transaksi",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Temukan berbagai solusi bertransaksi untuk kebutuhan Bisnis Anda di myBCA Bisnis.",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/12759FA7-753B-4E55-B28E-76C5D2ED115E/Logo/Logo myBCA Bisnis_Type 3_Color.png",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis"
    },
    {
        "id": "transaksi/virtual-account",
        "name": "Virtual Account",
        "subtitle": "Apapun usahanya, terima pembayaran jadi mudah dan lancar",
        "category": "Transaksi",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Properti"
        ],
        "desc": "Solusi untuk membantu nasabah bisnis dalam mengidentifikasi pembayaran dari pelanggan",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/6C20F9A8-917C-4EC2-A9EF-54F373986CAF/Logo/icon-virtual-account.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/virtual-account"
    },
    {
        "id": "transaksi/edc-bca",
        "name": "EDC BCA",
        "subtitle": "Terima pembayaran langsung dengan berbagai metode",
        "category": "Transaksi",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Perdagangan"
        ],
        "desc": "Bisa terima pembayaran dengan kartu debit, kartu kredit, dan QR di EDC BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/85FE58F8-A2FE-45CF-8788-2ECFDDFA9F52/Logo/icon-edc.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/edc-bca"
    },
    {
        "id": "transaksi/api",
        "name": "API BCA",
        "subtitle": "Jalankan instruksi transaksi keuangan melalui platform Anda",
        "category": "Transaksi",
        "sectors": [
            "Umum"
        ],
        "desc": "Kemudahan dalam menjalankan berbagai instruksi transaksi keuangan, langsung dari platform Anda",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/87E5FD00-623F-4373-AB21-A18F51128CE8/Logo/icon-API.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/api"
    },
    {
        "id": "transaksi/qris-bisnis",
        "name": "QRIS",
        "subtitle": "Terima pembayaran secara digital",
        "category": "Transaksi",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Perdagangan"
        ],
        "desc": "Pembayaran lebih mudah melalui QRIS dan pantau transaksi dengan aplikasi merchant BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/EF39500A-38BC-4792-B139-8F2B2808077A/Logo/icon-QRIS (1).svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/qris-bisnis"
    },
    {
        "id": "pinjaman/kredit-investasi",
        "name": "Kredit Investasi",
        "subtitle": "Miliki aset tetap bisnis Anda",
        "category": "Pinjaman",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Properti"
        ],
        "desc": "Dapatkan pembiayaan dengan bunga kompetitif dari Kredit Investasi BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/5B64A84A-6DA6-46EF-8349-D0CAF96E2A30/Logo/kredit-usaha-kredit-usaha-rakyat.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/kredit-investasi"
    },
    {
        "id": "pinjaman/kredit-multiguna-usaha",
        "name": "Kredit Multiguna Usaha",
        "subtitle": "Pembiayaan modal usaha untuk lengkapi kebutuhan bisnis Anda",
        "category": "Pinjaman",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Properti"
        ],
        "desc": "Penuhi berbagai kebutuhan usaha seperti modal kerja, investasi aktiva tetap, dan berbagai biaya lain",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/82EDFBAF-EE04-4039-B680-C2729BB0F851/Logo/kpr-kredit-multiguna.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/kredit-multiguna-usaha"
    },
    {
        "id": "pinjaman/kredit-sepeda-motor",
        "name": "Kredit Sepeda Motor",
        "subtitle": "Miliki kendaraan operasional untuk bisnis Anda",
        "category": "Pinjaman",
        "sectors": [
            "Umum",
            "Logistik",
            "Otomotif dan Transportasi"
        ],
        "desc": "Aktivitas bisnis jadi lebih produktif dengan memiliki sepeda motor melalui Kredit Sepeda Motor BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/C4973BF8-1E5C-4AA2-AC6B-BBF52BCED7D7/Logo/kkb-mobil-refinancing.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/kredit-sepeda-motor"
    },
    {
        "id": "pinjaman/kredit-usaha",
        "name": "Kredit Usaha",
        "subtitle": "Jadikan perputaran usaha lebih lancar",
        "category": "Pinjaman",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan"
        ],
        "desc": "Kredit Usaha memberikan modal pembiayaan perputaran usaha guna menciptakan kelancaran bisnis Anda",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/CE8063DA-0661-4CF5-BE78-5877C113B587/Logo/kredit-usaha-kredit-usaha-rakyat.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/kredit-usaha"
    },
    {
        "id": "pinjaman/bca-visa-corporate",
        "name": "BCA Visa Corporate",
        "subtitle": "Pembiayaan transaksi bisnis mudah dan fleksibel",
        "category": "Pinjaman",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Properti"
        ],
        "desc": "Penuhi kebutuhan transaksi bisnis perusahaan dengan Kartu Kredit BCA Visa Corporate",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/D34ADEA7-C46B-4D17-9167-6E3630913D51/Logo/icon-visa-corporate.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/bca-visa-corporate"
    },
    {
        "id": "pinjaman/kkb",
        "name": "KKB BCA",
        "subtitle": "Miliki kendaraan operasional untuk pengadaan",
        "category": "Pinjaman",
        "sectors": [
            "Umum",
            "Logistik",
            "Pariwisata dan Perhotelan",
            "Perdagangan"
        ],
        "desc": "Tingkatkan produktivitas operasional bisnis Anda dengan kendaraan operasional ",
        "icon": "https://pustaka.bca.co.id/Ocean/Assets/Icon/finance.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/kkb"
    },
    {
        "id": "investasi/investasi-bisnis/reksa-dana",
        "name": "Reksa Dana",
        "subtitle": "Tanam dana tertimbun di perusahaan dengan minim risiko",
        "category": "Investasi",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Perluas portofolio investasi bisnis dengan pilihan Reksa Dana dari manajer investasi yang kredibel",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/85704A7C-A3B4-4CDA-BFAB-C93DA650D69E/Logo/investasi-reksadana.svg",
        "link": "https://ocean.bca.co.id/id/produk/investasi/investasi-bisnis/reksa-dana"
    },
    {
        "id": "investasi/investasi-bisnis/obligasi-sbn",
        "name": "Obligasi & SBN",
        "subtitle": "Hasilkan arus kas dari dana menganggur",
        "category": "Investasi",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Mulai investasikan dana berlebih di perusahaan Anda ke Obligasi dan SBN, dapatkan imbalan kompetitif",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/2BF4B6D2-8D2B-4C1D-9353-5069C4C47993/Logo/investasi-obligasi.svg",
        "link": "https://ocean.bca.co.id/id/produk/investasi/investasi-bisnis/obligasi-sbn"
    },
    {
        "id": "asuransi/asuransi-property-all-risks",
        "name": "Asuransi Property All Risks",
        "subtitle": "Perlindungan menyeluruh untuk tempat usaha Anda",
        "category": "Asuransi",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Asuransi BCAinsurance yang memberikan perlindungan menyeluruh dari risiko kerusakan tempat usaha ",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/98FBA4CE-3E11-4688-BCAD-CC326F21EBC2/Logo/icon-asuransi-property-all-risks.svg",
        "link": "https://ocean.bca.co.id/id/produk/asuransi/asuransi-property-all-risks"
    },
    {
        "id": "asuransi/asuransi-kendaraan-bermotor",
        "name": "Asuransi Kendaraan Bermotor",
        "subtitle": "Lindungi kendaraan operasional bisnis dari kerusakan",
        "category": "Asuransi",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Asuransi BCAinsurance yang memberikan perlindungan optimal untuk kendaraan operasional bisnis",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/99224291-720B-402B-93F8-AFBE4ACFAE2B/Logo/icon-asuransi-kendaraan-bermotor (1).svg",
        "link": "https://ocean.bca.co.id/id/produk/asuransi/asuransi-kendaraan-bermotor"
    },
    {
        "id": "asuransi/asuransi-kebakaran",
        "name": "Asuransi Kebakaran",
        "subtitle": "Lindungi tempat usaha dari risiko kerugian akibat kebakaran",
        "category": "Asuransi",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Asuransi BCAinsurance yang memberikan perlindungan bagi tempat usaha dan persediaan barang",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/ED5C5DA6-2A6E-464F-AE98-D15E5BFD7728/Logo/icon-asuransi-kebakaran (1).svg",
        "link": "https://ocean.bca.co.id/id/produk/asuransi/asuransi-kebakaran"
    },
    {
        "id": "solusi-digital/stream-b2b",
        "name": "Stream B2B",
        "subtitle": "Rantai pasok efisien dengan sistem transparan end-to-end",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Food & Beverages",
            "Manufaktur",
            "Perdagangan"
        ],
        "desc": "Temukan produk, ajukan RFQ, kelola PO, DO, invoicing dalam satu platform",
        "icon": "https://pustaka.bca.co.id/Ocean/MyEcosystem/Stream-B2B/Stream-B2B.png",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/stream-b2b"
    },
    {
        "id": "solusi-digital/catapa",
        "name": "CATAPA",
        "subtitle": "Proses payroll cepat, mudah, dan aman",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Platform HR CATAPA yang dapat diotorisasi langsung di Business Assistant KlikBCA Bisnis",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/2A00C2FD-D51E-485A-A5F2-8F778C23B5F6/Logo/catapa logo_vertical-color (2).png",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/catapa"
    },
    {
        "id": "solusi-digital/Jejakin",
        "name": "Jejakin",
        "subtitle": "Mulai langkah nyata dekarbonisasi bisnis Anda",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Institusi Finansial",
            "Kesehatan"
        ],
        "desc": "Pantau dan implementasikan bisnis ramah lingkungan dengan hitung emisi secara transparan",
        "icon": "https://pustaka.bca.co.id/Ocean/MyEcosystem/Jejakin/Logo_Jejakin.png",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/Jejakin"
    },
    {
        "id": "solusi-digital/matchmade",
        "name": "Matchmade",
        "subtitle": "Rekonsiliasi data secara otomatis tanpa selisih ",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan"
        ],
        "desc": "Solusi rekonsiliasi data perusahaan dari berbagai sumber",
        "icon": "https://pustaka.bca.co.id/Ocean/MyEcosystem/Matchmade/Logo_Matchmade.png",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/matchmade"
    },
    {
        "id": "op-business-banking",
        "name": "OP Business Banking",
        "subtitle": "Pembayaran invoice dan pajak terintegrasi",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Manufaktur",
            "Perdagangan"
        ],
        "desc": "Alur pembayaran invoice dan pajak yang lengkap dengan e-faktur, bupot, dan rekonsiliasi otomatis",
        "icon": "https://pustaka.bca.co.id/Ocean/MyEcosystem/OBB/Logo-OBB.png",
        "link": "https://ocean.bca.co.id/id/produk/invoicing/op-business-banking"
    },
    {
        "id": "solusi-digital/Paper",
        "name": "Paper",
        "subtitle": "Kelola invoice  pembayaran bisnis Anda secara digital",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages"
        ],
        "desc": "Buat invoice digital dengan mudah dan bayar dengan kartu kredit BCA untuk biaya transaksi khusus",
        "icon": "https://pustaka.bca.co.id/Ocean/MyEcosystem/PaperID/Paper_Logogram.png",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/Paper"
    },
    {
        "id": "solusi-digital/Pawoon",
        "name": "Pawoon",
        "subtitle": "Transaksi lebih nyaman, manajemen stok lebih mudah",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan"
        ],
        "desc": "Manajemen stok hingga proses transaksi lebih sederhana dengan POS cloud dari Pawoon",
        "icon": "https://pustaka.bca.co.id/Ocean/MyEcosystem/Pawoon/Logo%20Pawoon%20Color.svg?v=1766132712121",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/Pawoon"
    },
    {
        "id": "solusi-digital/stream-hris",
        "name": "Stream HRIS",
        "subtitle": "Kelola seluruh data karyawan dalam satu sistem terpusat",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan"
        ],
        "desc": "Mulai modernisasi pekerjaan HR dari absensi hingga gaji karyawan dengan Stream HRIS",
        "icon": "https://pustaka.bca.co.id/Ocean/Assets/image/Logo_Stream%20HRIS.svg?v=1766482497099",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/stream-hris"
    },
    {
        "id": "solusi-digital/pajakku",
        "name": "Pajakku",
        "subtitle": "Layanan end-to-end solution untuk kebutuhan perpajakan",
        "category": "Solusi Digital",
        "sectors": [
            "Umum",
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek",
            "Properti"
        ],
        "desc": "Hitung pajak melalui aplikasi Pajakku dan otorisasi di Business Assistant KlikBCA Bisnis.",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/F3EBC4ED-4DA8-458D-8252-BD93A757EEC5/Logo/Logo Kotak Pajakku.png",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/pajakku"
    },
    {
        "id": "api-transfer",
        "name": "API Transfer",
        "subtitle": "Lakukan pembayaran ke vendor dengan lebih cepat dan mudah",
        "category": "Transaksi",
        "sectors": [
            "Asuransi",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Multifinance",
            "Pendidikan",
            "Perdagangan",
            "Perusahaan Efek"
        ],
        "desc": "Kirimkan instruksi pembayaran dari platform Anda melalui API Transfer BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/14295A15-FE24-43C2-AA27-CDF25F0421E3/Logo/icon-API.svg",
        "link": "https://developer.bca.co.id/id/Fitur-API#:~:text=Baca%20Dokumentasi-,Transfer%20Dana,-Notifikasi%20Tolakan%20Transfer"
    },
    {
        "id": "api-account-debiting-consent",
        "name": "API SKPR",
        "subtitle": "Dapatkan kuasa debet dari nasabah dengan mudah",
        "category": "Transaksi",
        "sectors": [
            "Asuransi"
        ],
        "desc": "Nasabah dapat mengirimkan kuasa pendebetan rekening secara real time melalui platform Anda",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/43D36CA2-534A-4E02-836A-0F5A926B0781/Logo/icon-API.svg",
        "link": "https://developer.bca.co.id/id/Fitur-API#:~:text=Baca%20Dokumentasi-,Collection,-Inquiry%20Status%20Kuasa"
    },
    {
        "id": "transaksi/business-debit-card",
        "name": "Business Debit Card",
        "subtitle": "Untuk kemudahan pengelolaan keuangan perusahaan Anda",
        "category": "Transaksi",
        "sectors": [
            "Asuransi",
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan",
            "Properti"
        ],
        "desc": "Solusi kartu debit bagi nasabah demi operasional bisnis mudah ataupun pemberian reward/loyalty",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/70C5B77C-E173-48BD-BF23-5B6E62B9E416/Logo/corporate-card-bca-card.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/business-debit-card"
    },
    {
        "id": "api-collection",
        "name": "API Collection",
        "subtitle": "Pembayaran premi asuransi lebih mudah",
        "category": "Transaksi",
        "sectors": [
            "Asuransi"
        ],
        "desc": "Debet pembayaran premi asuransi secara otomatis dengan API Collection dari BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/B8767540-BDE1-44D1-8332-F6D19AAFE34B/Logo/icon-API.svg",
        "link": "https://developer.bca.co.id/id/Fitur-API#:~:text=Baca%20Dokumentasi-,Collection,-Inquiry%20Status%20Kuasa"
    },
    {
        "id": "transaksi/payment-link",
        "name": "Payment Link",
        "subtitle": "Cara mudah membuat link pembayaran",
        "category": "Transaksi",
        "sectors": [
            "Asuransi",
            "Fashion & Beauty",
            "Manufaktur",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan"
        ],
        "desc": "Payment Link BCA memudahkan pelanggan untuk bayar dengan kartu tanpa harus ke lokasi",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/C878E7D5-38EF-4B1F-A85C-30316E24C8DA/Logo/reward-bca-daftar-merchant.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/payment-link"
    },
    {
        "id": "api-account-information",
        "name": "API Info Saldo & Mutasi Rekening",
        "subtitle": "Rekonsiliasi transaksi dengan lebih mudah dan cepat",
        "category": "Transaksi",
        "sectors": [
            "Asuransi",
            "Food & Beverages",
            "Kesehatan",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Perusahaan Efek"
        ],
        "desc": "Menyediakan informasi saldo dan mutasi rekening untuk mempermudah rekonsiliasi transaksi",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/E07DE635-15FB-43D5-ADB3-9DE27BCD7327/Logo/icon-API.svg",
        "link": "https://developer.bca.co.id/id/Fitur-API#:~:text=Baca%20Dokumentasi-,Informasi%20Rekening,-Mutasi%20Rekening"
    },
    {
        "id": "transaksi/klikbca-bisnis/multi-transaksi",
        "name": "Multi Transaksi (MAT & MP)",
        "subtitle": "Dapatkan kemudahan transaksi payroll dan transfer",
        "category": "Transaksi",
        "sectors": [
            "Asuransi",
            "Food & Beverages",
            "Migas",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pendidikan",
            "Properti"
        ],
        "desc": "Tingkatkan efisiensi operasional perusahaan dengan fitur Multi Transaksi KlikBCA Bisnis",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/F386592D-1E33-48B4-9499-DF502CCAA615/Logo/Multi Transaksi.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/klikbca-bisnis/multi-transaksi"
    },
    {
        "id": "transaksi/oneklik",
        "name": "OneKlik",
        "subtitle": "Berikan kemudahan belanja online bagi pelanggan",
        "category": "Transaksi",
        "sectors": [
            "Fashion & Beauty",
            "Pariwisata dan Perhotelan"
        ],
        "desc": "Permudah pembayaran online pelanggan di platform dengan OneKlik",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/02C125D7-354D-4E06-BF0E-349A24EEF3B1/Logo/icon-oneklik.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/oneklik"
    },
    {
        "id": "transaksi/remittance",
        "name": "Remittance BCA",
        "subtitle": "Layanan pengiriman dan penerimaan valas dalam  luar negeri",
        "category": "Transaksi",
        "sectors": [
            "Fashion & Beauty",
            "Food & Beverages",
            "Institusi Finansial",
            "Migas",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Perdagangan"
        ],
        "desc": "Nikmati layanan pengiriman dan penerimaan valas dengan jaringan korespondensi yang luas",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/E113E6C4-DE35-45C5-90FE-06FBF62B5660/Logo/remittance-outward.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/remittance"
    },
    {
        "id": "pinjaman/kredit-tempat-usaha",
        "name": "Kredit Tempat Usaha",
        "subtitle": "Penyediaan dana untuk properti bisnis",
        "category": "Pinjaman",
        "sectors": [
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Multifinance",
            "Otomotif dan Transportasi",
            "Pendidikan",
            "Perdagangan",
            "Properti"
        ],
        "desc": "Wujudkan kepemilikan tempat usaha sesuai bisnis Anda dengan Kredit Tempat Usaha BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/1DEFE94F-7BCC-4746-9684-382D638300FE/Logo/kpr-pembelian-pertama.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/kredit-tempat-usaha"
    },
    {
        "id": "pinjaman/bca-smartcash",
        "name": "BCA Smartcash",
        "subtitle": "Modal pinjaman untuk penuhi keperluan individu bisnis",
        "category": "Pinjaman",
        "sectors": [
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Manufaktur",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan"
        ],
        "desc": "Transaksi bisnis dan tarik tunai untuk kebutuhan individu bisnis lebih mudah dengan Kartu Kredit BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/7320131B-D1D6-41A4-B655-1F405F642668/Logo/icon-smartcash.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/bca-smartcash"
    },
    {
        "id": "pinjaman/kredit-usaha-rakyat",
        "name": "Kredit Usaha Rakyat",
        "subtitle": "Penuhi keperluan dana untuk bisnis skala kecil dan mikro",
        "category": "Pinjaman",
        "sectors": [
            "Fashion & Beauty",
            "Food & Beverages",
            "Perdagangan"
        ],
        "desc": "Nikmati akses pembiayaan dengan bunga rendah untuk UMKM melalui Kredit Usaha Rakyat BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/856BEA34-4947-413F-94B3-5397483DE31E/Logo/kredit-usaha-kredit-usaha-rakyat.svg",
        "link": "https://ocean.bca.co.id/id/produk/pinjaman/kredit-usaha-rakyat"
    },
    {
        "id": "solusi-digital/program-promosi-bca",
        "name": "Program Promosi BCA",
        "subtitle": "Kenalkan Usaha Anda untuk jangkauan lebih luas",
        "category": "Solusi Digital",
        "sectors": [
            "Fashion & Beauty",
            "Food & Beverages",
            "Kesehatan",
            "Logistik",
            "Otomotif dan Transportasi",
            "Pariwisata dan Perhotelan",
            "Pendidikan",
            "Perdagangan"
        ],
        "desc": "Kenalkan Usaha Anda untuk jangkauan lebih luas bersama Program Promosi BCA (khusus area JADETABEK)",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/3D63CAB9-2FA4-4BD9-8A26-03CF754D825F/Logo/shakehand.svg",
        "link": "https://ocean.bca.co.id/id/produk/solusi-digital/program-promosi-bca"
    },
    {
        "id": "rekening/giro-vostro",
        "name": "Giro Vostro",
        "subtitle": "Simpan dana perusahaan secara aman",
        "category": "Rekening",
        "sectors": [
            "Institusi Finansial"
        ],
        "desc": "Gunakan layanan Giro untuk mendukung kelancaran dan kecepatan transaksi bisnis dengan aman",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/900FD94C-5DDA-4CD8-AA7B-3BE7AD054676/Logo/asuransi-savings.svg",
        "link": "https://ocean.bca.co.id/id/produk/rekening/giro-vostro"
    },
    {
        "id": "transaksi/fire-cash-bca",
        "name": "Fire Cash BCA",
        "subtitle": "Solusi bisnis transfer dana yang cepat, mudah dan aman",
        "category": "Transaksi",
        "sectors": [
            "Institusi Finansial"
        ],
        "desc": "Pengiriman dan penerimaan valas lebih cepat dan aman",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/36A85F62-11A0-4693-B94F-4A5C77E64C2F/Logo/usp.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/fire-cash-bca"
    },
    {
        "id": "transaksi/fire-cash-bca/fire-untuk-mitra",
        "name": "Fire untuk Mitra",
        "subtitle": "Solusi untuk Institusi keungan dengan bisnis transfer",
        "category": "Transaksi",
        "sectors": [
            "Institusi Finansial"
        ],
        "desc": "Pengiriman dan penerimaan valas lebih cepat dan aman",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/3D63CAB9-2FA4-4BD9-8A26-03CF754D825F/Logo/shakehand.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/fire-cash-bca/fire-untuk-mitra"
    },
    {
        "id": "transaksi/cash-pick-up",
        "name": "Cash Pick Up",
        "subtitle": "Kelola pengiriman dan penukaran uang tunai dengan mudah",
        "category": "Transaksi",
        "sectors": [
            "Kesehatan",
            "Logistik"
        ],
        "desc": "Layanan pengiriman dan penerimaan uang tunai sesuai lokasi dan waktu yang ditentukan nasabah",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/A5A1CE01-2007-4719-8034-DAEFA1A3D4E6/Logo/icon-cash-pickup.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/cash-pick-up"
    },
    {
        "id": "transaksi/fleet-card",
        "name": "Fleet Card",
        "subtitle": "Kelola biaya operasional transportasi dengan mudah",
        "category": "Transaksi",
        "sectors": [
            "Logistik",
            "Manufaktur",
            "Migas",
            "Otomotif dan Transportasi"
        ],
        "desc": "Dapatkan kartu Fleet untuk dapat mengelola biaya operasional transportasi secara lebih mudah",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/E808AF71-A1EC-4CEE-9897-CB0D32F65B69/Logo/corporate-card-bca-card.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/fleet-card"
    },
    {
        "id": "transaksi/pembukaan-rekening-kolektif",
        "name": "Pembukaan Rekening Kolektif",
        "subtitle": "Pembukaan rekening banyak karyawan perusahaan sekaligus",
        "category": "Transaksi",
        "sectors": [
            "Manufaktur"
        ],
        "desc": "Pembukaan rekening bagi karyawan secara serentak untuk mudahkan kebutuhan pembayaran payroll",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/2897CF0A-D13B-4C72-A77C-E6A36ABBE9FE/Logo/asuransi-savings.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/pembukaan-rekening-kolektif"
    },
    {
        "id": "forex",
        "name": "Forex",
        "subtitle": "Dapatkan valuta asing untuk transaksi bisnis Anda",
        "category": "Transaksi",
        "sectors": [
            "Manufaktur",
            "Perusahaan Efek"
        ],
        "desc": "Transaksi valuta asing dengan harga kompetitif dan beragam mata uang dengan Forex BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/493F7623-ED9C-4588-A3D7-0D9E17454761/Logo/icon-forex.svg",
        "link": null
    },
    {
        "id": "instruksi-bayar-elektronik-(ibe)",
        "name": "Instruksi Bayar Elektronik (IBE)",
        "subtitle": "Kemudahan untuk memonitor arus kas",
        "category": "Transaksi",
        "sectors": [
            "Manufaktur",
            "Multifinance",
            "Perdagangan"
        ],
        "desc": "Instruksi transfer untuk dijalankan pada tanggal efektif tertentu",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/73FA43A4-2E9C-4B65-887A-7398BE6BDEDB/Logo/icon-instruksi-bayar-elektronik.svg",
        "link": null
    },
    {
        "id": "transaksi/klikbca-bisnis/b2b-pertamina",
        "name": "B2B Pertamina",
        "subtitle": "Beli produk Pertamina dengan mudah",
        "category": "Transaksi",
        "sectors": [
            "Migas"
        ],
        "desc": "Gunakan fitur B2B Pertamina untuk pembelian bahan bakar, pelumas, LPG, dll. di KlikBCA Bisnis",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/1660729F-073B-43C5-93B2-AEAA1DAEBADC/Logo/icon-b2b-pertamina (1).svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/klikbca-bisnis/b2b-pertamina"
    },
    {
        "id": "transaksi/trade-bca/bank-garansi-BCA",
        "name": "Bank Garansi BCA",
        "subtitle": "Mitra terpercaya untuk penyelesaian proyek anda ",
        "category": "Pinjaman",
        "sectors": [
            "Migas",
            "Properti"
        ],
        "desc": "Berikan jaminan pembelian kepada lawan transaksi Anda dengan Bank Garansi dari BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/0A8CE012-2382-494A-AA24-98C4047A42D5/Logo/icon-bank-garansi.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/trade-bca/bank-garansi-BCA"
    },
    {
        "id": "forex-line",
        "name": "Forex Line",
        "subtitle": "Pembiayaan untuk transaksi jual beli valas",
        "category": "Pinjaman",
        "sectors": [
            "Otomotif dan Transportasi"
        ],
        "desc": "Dapatkan plafond kredit untuk permudah transaksi jual beli valas di kemudian hari dengan Forex Line ",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/E834FDD3-3B98-4698-80FD-6A4EEA4A5586/Logo/icon-forex line.svg",
        "link": null
    },
    {
        "id": "transaksi/rdn",
        "name": "Rekening Dana Nasabah (RDN)",
        "subtitle": "Berikan kemudahan penyelesaian transaksi efek untuk nasabah ",
        "category": "Transaksi",
        "sectors": [
            "Perusahaan Efek"
        ],
        "desc": "Permudah penyelesaian transaksi efek untuk nasabah perorangan dan korporasi dengan RDN BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/814D8768-D750-422E-AD22-1C3E40D8E1EB/Logo/icon-RDN.svg",
        "link": "https://ocean.bca.co.id/id/produk/transaksi/rdn"
    },
    {
        "id": "api-customer-fund-account-notification",
        "name": "API Notifikasi RDN",
        "subtitle": "Notifikasi aktivitas transaksi RDN secara real time",
        "category": "Transaksi",
        "sectors": [
            "Perusahaan Efek"
        ],
        "desc": "Dapatkan notifikasi aktivitas transaksi rekening dana nasabah dengan API Notifikasi RDN dari BCA",
        "icon": "https://pustaka.bca.co.id/Ocean/Product/833576E3-8CAD-4B22-BDE3-BCD20D03E32E/Logo/icon-API.svg",
        "link": "https://developer.bca.co.id/id/Fitur-API#:~:text=Baca%20Dokumentasi-,Informasi%20Rekening,-Mutasi%20Rekening"
    }
];

const getCategoryIcon = (category, isActive) => {
    const suffix = isActive ? '-selected.png' : '.png';
    const baseUrl = 'https://pustaka.bca.co.id/Ocean/Product/Categories/';
    switch(category) {
        case 'Rekening':
            return `<img src="${baseUrl}Rekening${suffix}" class="category-icon-img" alt="Rekening">`;
        case 'Transaksi':
            return `<img src="${baseUrl}Transaksi${suffix}" class="category-icon-img" alt="Transaksi">`;
        case 'Pinjaman':
            return `<img src="${baseUrl}Pinjaman${suffix}" class="category-icon-img" alt="Pinjaman">`;
        case 'Investasi':
            return `<img src="${baseUrl}Investasi${suffix}" class="category-icon-img" alt="Investasi">`;
        case 'Asuransi':
            return `<img src="${baseUrl}Asuransi${suffix}" class="category-icon-img" alt="Asuransi">`;
        case 'Solusi Digital':
            return `<img src="${baseUrl}Solusi%20Digital${suffix}" class="category-icon-img" alt="Solusi Digital">`;
        default:
            return '';
    }
};

const HowItWorksPage = () => {
    const filtered = PRODUCTS.filter(p => {
        const matchesSector = state.productSelectedSector === 'Semua' || p.sectors.includes(state.productSelectedSector);
        const matchesCategory = p.category === state.productSelectedCategory;
        const matchesSearch = state.productSearchQuery === '' || 
            p.name.toLowerCase().includes(state.productSearchQuery.toLowerCase()) || 
            p.desc.toLowerCase().includes(state.productSearchQuery.toLowerCase()) || 
            p.subtitle.toLowerCase().includes(state.productSearchQuery.toLowerCase());
        return matchesSector && matchesCategory && matchesSearch;
    });

    const sectors = ['Semua', 'Umum', 'Asuransi', 'Fashion & Beauty', 'Food & Beverages', 'Institusi Finansial', 'Kesehatan', 'Logistik', 'Manufaktur', 'Migas', 'Multifinance', 'Otomotif dan Transportasi', 'Pariwisata dan Perhotelan', 'Pendidikan', 'Perdagangan', 'Perusahaan Efek', 'Properti'];
    const categories = ['Rekening', 'Transaksi', 'Pinjaman', 'Investasi', 'Asuransi', 'Solusi Digital'];

    return `
        <div class="product-page-layout fade-in">
            <div id="product-big-header" class="product-hero-header"></div>
            
            <div class="product-container-wrap">
                <div class="product-content-card-wrap">
                    <div class="product-card-title-row">
                        <div class="title-icon-container">
                            <img src="/images/request.svg" class="title-icon-img" alt="Request Icon">
                        </div>
                        <h2 class="product-card-main-title">Produk BCA untuk Kemudahan Bisnis Anda</h2>
                    </div>

                    <div class="featured-banner-card">
                        <div class="glass-info-block">
                            <h3 class="glass-banner-title">Virtual Account BCA</h3>
                            <p class="glass-banner-desc">Terima pembayaran dengan mudah, cepat, dan lancar dengan Virtual Account BCA.</p>
                            <a href="https://ocean.bca.co.id/id/produk/transaksi/virtual-account" target="_blank" class="btn-learn-more-pill" onclick="event.stopPropagation();">Pelajari Lebih Lanjut</a>
                        </div>
                    </div>

                    <div class="product-card-header">
                        <p>Pilih berbagai produk sesuai kebutuhan bisnis Anda, lalu tinggalkan kontak untuk kami hubungi.</p>
                        <div class="product-search-wrapper">
                            <div class="product-search-bar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input type="text" id="product-search-input" value="${state.productSearchQuery}" placeholder="Cari produk atau solusi bisnis...">
                            </div>
                        </div>
                    </div>

                    <div class="product-filters-row">
                        <!-- Left Column: Sector select -->
                        <div class="product-sector-col">
                            <label for="product-sector-select" class="product-sector-label">Pilih Bidang Usaha</label>
                            <div class="product-select-wrapper">
                                <select id="product-sector-select" class="product-select">
                                    ${sectors.map(sec => `
                                        <option value="${sec}" ${state.productSelectedSector === sec ? 'selected' : ''}>${sec}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <!-- Right Column: Category buttons -->
                        <div class="product-category-col">
                            <div class="category-header-row">
                                <span class="category-title-label">Pilih Kategori Produk</span>
                                ${state.selectedProducts.length > 0 ? `
                                    <div class="btn-reset-filters cursor-pointer">Reset Filter</div>
                                ` : ''}
                            </div>
                            <div class="category-buttons-grid">
                                ${categories.map(cat => {
                                    const isActive = state.productSelectedCategory === cat;
                                    return `
                                        <div class="category-item ${isActive ? 'active' : ''}" data-category="${cat}">
                                            <div class="category-icon-circle">
                                                ${getCategoryIcon(cat, isActive)}
                                            </div>
                                            <span class="category-label">${cat}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Selected products chips bar -->
                    ${state.selectedProducts.length > 0 ? `
                        <div class="selected-products-info-bar">
                            <span class="info-label">
                                ${state.selectedProducts.length === 10 
                                    ? 'Anda telah mencapai jumlah maksimal produk yang dipilih :' 
                                    : 'Anda telah memilih :'}
                            </span>
                            <div class="selected-chips-list">
                                ${state.selectedProducts.map(p => `
                                    <div class="product-chip">
                                        <span class="chip-text">${p.name}</span>
                                        <button class="btn-remove-chip" data-product-id="${p.id}">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div class="products-list-results">
                        <div class="products-count-bar">
                            Menampilkan <span>${filtered.length}</span> produk
                        </div>

                        ${filtered.length === 0 ? `
                            <div class="products-empty-state">
                                <div class="empty-icon">🔍</div>
                                <h4>Produk tidak ditemukan</h4>
                                <p>Tidak ada produk yang cocok dengan pencarian atau filter Anda. Coba gunakan kata kunci lain.</p>
                            </div>
                        ` : `
                            <div class="products-cards-grid-wrap">
                                ${filtered.map(p => {
                                    const isChecked = state.selectedProducts.some(sp => sp.id === p.id);
                                    const isDisabled = state.selectedProducts.length === 10 && !isChecked;
                                    return `
                                        <div class="product-item-card-premium ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}" data-product-id="${p.id}">
                                            <div class="product-card-top-row">
                                                ${!isDisabled ? `
                                                    <div class="product-card-checkbox ${isChecked ? 'checked' : ''}">
                                                        ${isChecked ? `
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        ` : ''}
                                                    </div>
                                                ` : ''}
                                                <span class="product-badge-category" title="${p.category}">${p.category}</span>
                                            </div>
                                            <div class="product-card-icon-container">
                                                <img src="${p.icon}" alt="${p.name} Icon" class="product-card-icon-img">
                                            </div>
                                            <h3 class="product-card-name">${p.name}</h3>
                                            <h4 class="product-card-subtitle">${p.subtitle}</h4>
                                            <p class="product-card-desc">${p.desc}</p>
                                            <a href="${p.link}" target="_blank" class="product-card-more-link" onclick="event.stopPropagation();">
                                                Selengkapnya
                                            </a>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}

                        <!-- Bottom Submit Button Container -->
                        <div class="product-bottom-submit-container">
                            <button id="product-btn-bottom-submit" class="btn-bottom-submit" ${state.selectedProducts.length === 0 ? 'disabled' : ''}>
                                Tinggalkan Kontak
                            </button>
                        </div>

                        <div class="product-cta-banner-official">
                            <div class="product-cta-image-side">
                                <img src="https://pustaka.bca.co.id/Ocean/Homepage/image-cta.svg" alt="CTA Image">
                            </div>
                            <div class="product-cta-info-side">
                                <h2>Temukan rekomendasi produk yang sesuai untuk tingkatkan bisnis Anda</h2>
                                <a href="https://main.ocean.bca.co.id/visitor/product" target="_blank" class="btn-cta-learn-more">
                                    Pelajari Lebih Lanjut
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right ml-1"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="riwayat-pengajuan-card">
                    <div class="riwayat-left">
                        <div class="riwayat-icon-container">
                            <img src="/images/history.svg" class="riwayat-icon-img" alt="History Icon">
                        </div>
                        <div class="riwayat-text-col">
                            <span class="riwayat-title-text">Riwayat Pengajuan</span>
                            <p class="riwayat-sub-text">Cek pengajuan sebelumnya dan lanjutkan proses pengajuan.</p>
                        </div>
                    </div>
                    <a href="#" class="btn-lihat-riwayat" id="btn-lihat-riwayat">
                        <span>Lihat Riwayat Pengajuan</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chevron-right-svg">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </a>
                </div>
            </div>

            <!-- Leave Contact Modal -->
            <div id="product-contact-modal" class="modal-overlay-contact">
                <div class="modal-card-contact">
                    <button class="modal-close-btn-contact" id="btn-close-contact-modal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <h2 class="modal-title-contact">Tinggalkan Kontak</h2>
                    <p class="modal-subtitle-contact">Tertarik dengan <span id="modal-product-name-label" style="font-weight: 700; color: #005CAA;"></span>? Hubungi kami untuk penawaran terbaik.</p>
                    
                    <form id="product-modal-contact-form" class="contact-grid-form">
                        <input type="hidden" id="modal-contact-product-name">
                        <div class="contact-form-group">
                            <label for="modal-contact-pic">Nama PIC</label>
                            <input type="text" id="modal-contact-pic" placeholder="Masukkan nama Anda" required autocomplete="off">
                        </div>
                        <div class="contact-form-group">
                            <label for="modal-contact-usaha">Nama Usaha</label>
                            <input type="text" id="modal-contact-usaha" placeholder="Masukkan nama perusahaan Anda" required autocomplete="off">
                        </div>
                        <div class="contact-form-group">
                            <label for="modal-contact-tel">Nomor Telepon <span class="label-optional">(opsional)</span></label>
                            <input type="tel" id="modal-contact-tel" placeholder="Masukkan nomor telepon Anda" autocomplete="off">
                        </div>
                        <div class="contact-form-group email-group">
                            <label for="modal-contact-email">Alamat Email</label>
                            <div class="email-input-wrapper">
                                <span class="email-icon">@</span>
                                <input type="email" id="modal-contact-email" placeholder="Masukkan alamat email Anda" required autocomplete="off">
                            </div>
                        </div>
                        <div class="contact-form-group full-width textarea-group">
                            <label for="modal-contact-desc">Deskripsi Kebutuhan Bisnis</label>
                            <div class="textarea-wrapper">
                                <textarea id="modal-contact-desc" placeholder="Masukkan deskripsi kebutuhan bisnis Anda" maxlength="500" required autocomplete="off"></textarea>
                                <span class="modal-char-counter char-counter">0 / 500</span>
                            </div>
                        </div>
                        <div class="contact-form-group full-width consent-group">
                            <div class="consent-header">Persetujuan</div>
                            <label class="consent-checkbox-label">
                                <input type="checkbox" id="modal-consent-1" required>
                                <span class="custom-checkbox"></span>
                                <span class="consent-text">Seluruh data yang saya berikan dalam Layanan Leave Contact ini adalah benar, lengkap, dan akurat, serta merupakan data milik saya pribadi</span>
                            </label>
                            <label class="consent-checkbox-label">
                                <input type="checkbox" id="modal-consent-2" required>
                                <span class="custom-checkbox"></span>
                                <span class="consent-text">Saya bersedia dihubungi oleh pihak PT Bank Central Asia Tbk melalui sarana komunikasi pribadi yang saya berikan dalam Layanan Leave Contact ini untuk menerima penjelasan/informasi lebih lanjut mengenai produk/layanan yang terdapat pada portal Ocean by BCA</span>
                            </label>
                        </div>
                        <div class="contact-form-group full-width submit-wrapper">
                            <button type="submit" id="btn-submit-modal-contact" class="btn-submit-disabled" disabled>Kirim</button>
                        </div>
                    </form>
                </div>
            </div>

            ${PublicFooter()}
        </div>
    `;
};

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
            <h2 class="ocean-login-form-title">Halo, Selamat Datang!</h2>
            
            <div class="ocean-login-form-group">
                <label class="ocean-login-form-label">BCA ID Bisnis</label>
                <div class="ocean-login-form-group" style="margin-bottom: 1rem;">
                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--bca-blue-primary);">Corporate ID</span>
                    <div class="ocean-login-input-wrapper">
                        <input type="text" class="ocean-login-field" id="corp-id" placeholder="Masukkan Corporate ID" value="${state.corporateId || ''}">
                    </div>
                </div>
                <div class="ocean-login-form-group" style="margin-bottom: 0.5rem;">
                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--bca-blue-primary);">User ID</span>
                    <div class="ocean-login-input-wrapper">
                        <input type="text" class="ocean-login-field" id="user-id" placeholder="Masukkan User ID" value="${state.userId || ''}">
                    </div>
                </div>
                <div class="ocean-login-info-row" style="display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem; margin-top: 0.25rem; margin-bottom: 1rem;">
                    <img alt="BCA ID Card" loading="lazy" width="18" height="18" decoding="async" style="color:transparent;" src="https://main.ocean.bca.co.id/images/bca-id-card.svg"/>
                    <a href="https://main.ocean.bca.co.id/help-center/ocean/BCA-ID-Bisnis/apa-itu-bca-id-bisnis" target="_blank" class="ocean-login-info-link" style="font-size: 0.75rem; color: #0284c7; text-decoration: none;">Apa itu BCA ID Bisnis?</a>
                </div>
            </div>

            <div class="ocean-login-form-group" style="margin-top: 1.5rem;">
                <label class="ocean-login-form-label" style="display: flex; align-items: center; gap: 0.25rem;">
                    <span>KeyBCA Response</span>
                    <button type="button" style="border: none; background: transparent; cursor: help; color: var(--bca-blue-primary); font-size: 1rem; padding: 0; line-height: 1;">❓</button>
                </label>
                <div class="ocean-login-input-wrapper">
                    <input type="password" class="ocean-login-field" id="key-response" placeholder="Masukkan KeyBCA Response" value="${state.keyBcaResponse || ''}">
                    <img alt="Show Password" loading="lazy" width="20" height="20" decoding="async" class="cursor-pointer" style="color:transparent; cursor: pointer; opacity: 0.5;" src="https://main.ocean.bca.co.id/images/eye-close.svg"/>
                </div>
            </div>

            <button class="ocean-login-submit-btn" id="btn-login-submit" disabled>Masuk</button>
            
            <div class="ocean-login-action-link-row">
                <a href="#" class="ocean-login-action-link">Buka Blokir User</a>
            </div>
            
            <div style="margin-top: 1.5rem; text-align: center;">
                <a href="#" class="ocean-login-action-link btn-cancel-auth" style="font-size: 0.8rem; opacity: 0.7;">Kembali ke Beranda</a>
            </div>
        </div>
    `;

    const renderSelect = () => `
        <div class="fade-in">
            <h2 class="ocean-login-form-title">Pilih Verifikasi</h2>
            <p style="font-size: 0.85rem; color: #64748b; text-align: center; margin-bottom: 2rem;">Pilih metode verifikasi tambahan untuk masuk ke portal internal.</p>
            
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
            
            <div style="margin-top: 2rem; text-align: center;">
                <a href="#" class="ocean-login-action-link btn-cancel-auth">Kembali ke Beranda</a>
            </div>
        </div>
    `;

    const renderPin = () => `
        <div class="fade-in">
            <h2 class="ocean-login-form-title">Masukkan PIN</h2>
            <p style="font-size: 0.85rem; color: #64748b; text-align: center; margin-bottom: 2rem;">Silakan masukkan 6 digit PIN Ocean Anda.</p>
            <div class="pin-display">
                ${[...Array(6)].map((_, i) => `<div class="pin-dot ${state.pin.length > i ? 'filled' : ''}"></div>`).join('')}
            </div>
            <div class="pin-keypad">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="key-btn" data-key="${num}">${num}</button>`).join('')}
                <button class="key-btn" style="font-size: 1rem; color: #ef4444;" data-key="clear">CLR</button>
                <button class="key-btn" data-key="0">0</button>
                <button class="key-btn" style="font-size: 1rem; color: var(--ocean-accent);" data-key="del">DEL</button>
            </div>
            <div class="ocean-login-action-link-row" style="margin-top: 2rem;">
                <a href="#" class="ocean-login-action-link" data-auth="select">Ganti Metode Verifikasi</a>
            </div>
        </div>
    `;

    const renderBiometric = () => `
        <div class="fade-in" style="text-align: center;">
            <h2 class="ocean-login-form-title">Verifikasi Biometrik</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 2rem;">Memindai wajah atau sidik jari Anda...</p>
            <div class="biometric-visual" style="margin: 2rem auto;">
                <div class="scan-line"></div>
                <div style="font-size: 3rem; display: flex; align-items: center; justify-content: center; height: 100%;">${state.isAuthenticating ? '✅' : '👤'}</div>
            </div>
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 2rem;">
                ${state.isAuthenticating ? 'Berhasil diverifikasi!' : 'Posisikan wajah Anda pada layar'}
            </p>
            <div class="ocean-login-action-link-row">
                <a href="#" class="ocean-login-action-link" data-auth="select">Ganti Metode Verifikasi</a>
            </div>
        </div>
    `;

    const renderOtp = () => `
        <div class="fade-in">
            <h2 class="ocean-login-form-title">Verifikasi OTP</h2>
            <p style="font-size: 0.85rem; color: #64748b; text-align: center; margin-bottom: 2rem;">Kami telah mengirimkan kode ke an***@bca.co.id</p>
            <div class="otp-grid" style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 2rem;">
                ${state.otp.map((v, i) => `<input type="text" class="otp-input" value="${v}" maxlength="1" data-otp-idx="${i}" style="width: 45px; height: 45px; text-align: center; font-size: 1.25rem; font-weight: 700; border: 2px solid #cbd5e1; border-radius: 8px; outline: none; transition: border-color 0.2s;">`).join('')}
            </div>
            <div style="text-align: center; font-size: 0.8rem; color: #64748b; margin-bottom: 2rem;">
                Tidak menerima kode? <span style="color: var(--bca-blue-primary); font-weight: 700; cursor: pointer;">Kirim Ulang (59s)</span>
            </div>
            <div class="ocean-login-action-link-row">
                <a href="#" class="ocean-login-action-link" data-auth="select">Ganti Metode Verifikasi</a>
            </div>
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
        <div class="ocean-login-page">
            <div class="ocean-login-top-banner" style="background: #00213d url('https://main.ocean.bca.co.id/images/headline-bg.png') no-repeat center/cover !important; height: 244px; width: 100%; display: block; position: relative;"></div>
            
            <div class="ocean-login-main">
                <div class="ocean-login-header-container">
                    <a href="#" class="ocean-login-logo-link btn-cancel-auth">
                        <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-Ocean-by-BCA-white.svg" alt="Ocean by BCA Logo">
                    </a>
                    <div class="h-10 w-[68px] items-center rounded-full border border-[#5D879F] bg-transparent p-2 text-white z-10 ml-auto flex" style="display: flex; align-items: center; gap: 0.5rem; border: 1px solid #5D879F; background: transparent; padding: 0.4rem 0.5rem; border-radius: 50px; cursor: pointer; color: white;">
                        <div class="h-6 w-6 overflow-hidden rounded-full" style="width: 24px; height: 24px; border-radius: 50%; overflow: hidden; display: flex; flex-direction: column;">
                            <div style="height: 50%; background: #FF0000; width: 100%;"></div>
                            <div style="height: 50%; background: #FFFFFF; width: 100%;"></div>
                        </div>
                        <span class="font-bold text-white" style="font-weight: 700; font-size: 0.85rem;">ID</span>
                    </div>
                </div>
                
                <div class="ocean-login-body-grid">
                    <!-- Left promo column -->
                    <div class="ocean-login-promo-container">
                        <a href="https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis" target="_blank" class="ocean-login-promo-banner" style="padding: 0;">
                            <div class="ocean-login-promo-banner-inner">
                                <img alt="MBB Banner" style="position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;object-fit:cover;object-position:left center;" src="https://main.ocean.bca.co.id/images/mbb-banner.png"/>
                                <img alt="BCA Logo Banner" class="absolute right-0 top-0 hidden rounded-r-xl sm:block" style="position: absolute; right: 0; top: 0; height: 100%; width: auto; object-fit: contain;" src="https://main.ocean.bca.co.id/images/logo-bca-mbb-banner.png"/>
                                
                                <div class="absolute left-0 top-0 flex flex-col justify-center gap-2 px-5" style="position: absolute; left: 0; top: 0; display: flex; flex-direction: column; justify-content: center; height: 100%; width: 60%; padding-left: 2rem; box-sizing: border-box;">
                                    <div class="text-base font-bold leading-4 sm:text-xl sm:leading-none md:text-2xl lg:text-lg xl:text-2xl" style="color: #00213d; font-weight: 800; font-size: 1.5rem; text-align: left; line-height: 1.2;">Nikmati Kemudahan Bertransaksi Dengan</div>
                                    <div class="relative h-5 w-28 sm:h-7 sm:w-36" style="height: 28px; width: 144px;">
                                        <img alt="MBB Logo" style="height: 100%; width: auto; object-fit: contain;" src="https://main.ocean.bca.co.id/images/logo-mbb-text.png"/>
                                    </div>
                                    <div class="text-[8px] sm:text-xs" style="color: #475569; font-size: 0.8rem; text-align: left; margin-top: 0.25rem;">Solusi yang aman dan terpercaya untuk berbagai kebutuhan bisnis Anda.</div>
                                </div>
                            </div>
                        </a>
                        
                        <div class="ocean-login-articles-grid">
                            <div class="ocean-login-article-card">
                                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                                    <img alt="Eduka Tips Logo" style="height: 32px; width: auto; object-fit: contain;" src="https://main.ocean.bca.co.id/images/edukatips.png"/>
                                </div>
                                <a href="https://www.bca.co.id/id/informasi/Edukatips/2024/05/28/08/04/cara-registrasi-dan-tips-seputar-login-mybca-bisnis" target="_blank" class="ocean-login-article-title">
                                    Cara Registrasi dan Tips Seputar Login myBCA Bisnis
                                </a>
                                <p class="ocean-login-article-desc">
                                    Layanan myBCA Bisnis hadir untuk membantu nasabah pebisnis dalam melakukan segala aktivitas perbankan bisnis, termasuk mengatur alur kas perusahaan.
                                </p>
                            </div>
                            <div class="ocean-login-article-card">
                                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                                    <img alt="Awas Modus Logo" style="height: 32px; width: auto; object-fit: contain;" src="https://main.ocean.bca.co.id/images/awasmodus.png"/>
                                </div>
                                <a href="https://ocean.bca.co.id/id/artikel/transaksi-aman-untuk-menunjang-kelancaran-bisnis" target="_blank" class="ocean-login-article-title">
                                    Transaksi Aman untuk Menunjang Kelancaran Bisnis
                                </a>
                                <p class="ocean-login-article-desc">
                                    Salah satu cara menjaga keberlangsungan aktivitas bisnis adalah dengan memastikan seluruh transaksi digital dilakukan secara aman untuk menghindari phishing.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Right login card column -->
                    <div class="ocean-login-card-container">
                        ${stepContent}
                    </div>
                </div>
                
                <!-- Footer -->
                <footer class="ocean-login-footer">
                    <div class="ocean-login-footer-row">
                        <span>© 2026 PT Bank Central Asia Tbk, All Rights Reserved.</span>
                        <div class="ocean-login-footer-links">
                            <a href="https://bca.co.id/id/" target="_blank" class="ocean-login-footer-link">bca.co.id</a>
                            <a href="https://www.bca.co.id/id/informasi/Kebijakan" target="_blank" class="ocean-login-footer-link">Kebijakan</a>
                            <a href="https://www.bca.co.id/id/Syarat-dan-Ketentuan" target="_blank" class="ocean-login-footer-link">Syarat & Ketentuan</a>
                            <div class="ocean-login-footer-tel">
                                📞 Halo BCA Bisnis 1500998
                            </div>
                        </div>
                    </div>
                    
                    <div class="ocean-login-footer-disclaimer">
                        <span>BCA berizin dan diawasi oleh Otoritas Jasa Keuangan & Bank Indonesia</span>
                        <span>BCA merupakan peserta penjaminan LPS. Maksimum nilai simpanan yang dijamin LPS per nasabah per bank adalah Rp2 miliar.</span>
                    </div>
                </footer>
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
            case 'learning-path': content = LearningPage(); break;
            case 'module-detail': content = ModuleDetailPage(state.activeModule); break;
            case 'ai': content = AIPage(); break;
            case 'ai-benefit': 
                state.benefitMode = true;
                content = AIPage(); 
                break;
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

const showToast = (title, message, type = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: white;
        color: var(--text-main);
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        border-left: 4px solid ${type === 'success' ? '#16a34a' : (type === 'warning' ? '#d97706' : '#dc2626')};
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 320px;
        pointer-events: auto;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s;
        opacity: 0;
        box-sizing: border-box;
    `;
    
    toast.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.9rem; font-weight:700; color:var(--bca-blue-dark);">${title}</strong>
            <span style="cursor:pointer; font-size:1.1rem; line-height:1; color:#94a3b8;" onclick="this.closest('.toast').remove()">×</span>
        </div>
        <p style="font-size:0.8rem; color:#64748b; margin:0; line-height:1.4; text-align:left;">${message}</p>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });
    
    // Auto remove
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

let logInterval = null;
const startLogSimulator = () => {
    if (logInterval) return;
    
    const endpoints = [
        { method: 'GET', endpoint: '/v1/balance', statuses: [200, 200, 200, 401] },
        { method: 'POST', endpoint: '/v1/va/create', statuses: [200, 200, 200, 400] },
        { method: 'POST', endpoint: '/v1/transfer', statuses: [200, 200, 202, 500] },
        { method: 'GET', endpoint: '/v1/statement', statuses: [200, 200, 200] },
        { method: 'POST', endpoint: '/v1/disbursement/batch', statuses: [202, 202, 200] }
    ];

    logInterval = setInterval(() => {
        if (state.currentPage !== 'sandbox') return;
        
        // Pick random endpoint
        const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
        const status = ep.statuses[Math.floor(Math.random() * ep.statuses.length)];
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const duration = status === 202 ? (Math.floor(Math.random() * 800) + 800) + 'ms' : (Math.floor(Math.random() * 150) + 30) + 'ms';
        
        const newLog = {
            time: timeStr,
            status: status,
            method: ep.method,
            endpoint: ep.endpoint,
            duration: duration
        };
        
        // Add to state
        state.sandbox.apiLogs.unshift(newLog);
        if (state.sandbox.apiLogs.length > 20) {
            state.sandbox.apiLogs.pop();
        }
        
        // 20% chance to add a simulated transaction
        if (Math.random() < 0.2) {
            const amount = Math.floor(Math.random() * 4500000) + 500000; // 500k to 5M
            const isIncoming = Math.random() < 0.7; // 70% incoming
            
            const trx = {
                date: 'Hari Ini',
                desc: isIncoming ? 'Simulasi VA Collection - Auto Trx' : 'Simulasi Pembayaran Vendor - Auto Trx',
                amount: isIncoming ? amount : -amount,
                type: isIncoming ? 'in' : 'out',
                status: 'Success'
            };
            
            state.sandbox.transactions.unshift(trx);
            if (state.sandbox.transactions.length > 10) {
                state.sandbox.transactions.pop();
            }
            
            if (isIncoming) {
                state.sandbox.totalBalance += amount;
                state.sandbox.incomingToday += amount;
            } else {
                state.sandbox.totalBalance -= amount;
                state.sandbox.outgoingToday += amount;
            }
        }
        
        // Only re-render if active sandbox tab is dashboard or ecosystem
        if (state.currentPage === 'sandbox' && (state.sandboxTab === 'dashboard' || state.sandboxTab === 'ecosystem')) {
            render();
        }
    }, 7000);
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

        document.querySelectorAll('.btn-cancel-auth').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                state.viewMode = 'public';
                state.currentPage = 'landing';
                render();
            });
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
            const mobileDrawer = document.getElementById('mobile-menu-drawer');
            if (mobileDrawer) {
                mobileDrawer.classList.remove('open');
            }
            render();
            window.scrollTo(0,0);
        });
    });

    // Mobile Menu Toggles
    const toggleMobileBtn = document.getElementById('btn-toggle-mobile-menu');
    const closeMobileBtn = document.getElementById('btn-close-mobile-menu');
    const mobileDrawer = document.getElementById('mobile-menu-drawer');
    const loginMobileTrigger = document.getElementById('btn-login-mobile-trigger');
    const mobileHelpBtn = document.getElementById('btn-mobile-help');

    if (toggleMobileBtn && mobileDrawer) {
        toggleMobileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mobileDrawer.classList.add('open');
        });
    }
    if (closeMobileBtn && mobileDrawer) {
        closeMobileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mobileDrawer.classList.remove('open');
        });
    }
    if (loginMobileTrigger && mobileDrawer) {
        loginMobileTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            mobileDrawer.classList.remove('open');
            state.viewMode = 'auth';
            state.authStep = 'login';
            render();
        });
    }
    if (mobileHelpBtn && mobileDrawer) {
        mobileHelpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mobileDrawer.classList.remove('open');
            state.viewMode = 'internal';
            state.currentPage = 'dashboard';
            render();
        });
    }

    // Mobile Quick Access Dropdown Toggle
    const mobileQuickAccessBtn = document.getElementById('mobile-quick-access-btn');
    const mobileQuickAccessMenu = document.getElementById('mobile-quick-access-menu');
    if (mobileQuickAccessBtn && mobileQuickAccessMenu) {
        mobileQuickAccessBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = mobileQuickAccessMenu.style.display === 'none';
            mobileQuickAccessMenu.style.display = isHidden ? 'flex' : 'none';
            // Optionally rotate chevron
            const chevron = mobileQuickAccessBtn.querySelector('svg');
            if (chevron) {
                chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                chevron.style.transition = 'transform 0.3s ease';
            }
        });
    }

    // Auth Flows

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

    const linkBenefit = document.getElementById('link-benefit');
    if (linkBenefit) {
        linkBenefit.addEventListener('click', () => {
            state.benefitMode = true;
            // The data-page="ai" listener will handle the navigation
        });
    }

    const leaderboardFilterSelect = document.getElementById('leaderboard-filter-select');
    if (leaderboardFilterSelect) {
        leaderboardFilterSelect.addEventListener('change', (e) => {
            state.leaderboardFilter = e.target.value;
            render();
        });
    }

    const sendBtn = document.getElementById('btn-send-main');
    const chatInput = document.getElementById('chat-input-main');
    if (sendBtn && chatInput) {
        const sendMessage = async () => {
            const val = chatInput.value.trim();
            if (!val || sendBtn.disabled) return;
            state.chatHistory.push({ role: 'user', content: val });
            chatInput.value = '';
            sendBtn.disabled = true;
            // Show typing indicator
            state.chatHistory.push({ role: 'ai', content: '<span class="typing-dots">●●●</span>' });
            render();
            try {
                const { reply, sources } = await chatWithRAG(val, state.benefitMode);
                // Replace typing indicator with real response
                state.chatHistory[state.chatHistory.length - 1] = {
                    role: 'ai',
                    content: reply + (sources.length > 0
                        ? `<div class="rag-sources-tag">📚 Berdasarkan ${sources.length} sumber dari Knowledge Base</div>`
                        : '')
                };
            } catch (err) {
                state.chatHistory[state.chatHistory.length - 1] = {
                    role: 'ai',
                    content: 'Maaf, terjadi kesalahan saat menghubungi AI. Coba lagi.'
                };
            } finally {
                sendBtn.disabled = false;
                render();
            }
        };
        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    }

    const dashChatSend = document.getElementById('dash-chat-send');
    const dashChatInput = document.getElementById('dash-chat-input');
    const dashChatHistory = document.getElementById('dash-chat-history');
    if (dashChatSend && dashChatInput && dashChatHistory) {
        const sendDashMessage = async () => {
            const val = dashChatInput.value.trim();
            if (!val || dashChatSend.disabled) return;
            
            // Add user message
            const userMsg = document.createElement('div');
            userMsg.className = 'msg user';
            userMsg.textContent = val;
            dashChatHistory.appendChild(userMsg);
            
            dashChatInput.value = '';
            dashChatSend.disabled = true;
            
            // Add typing indicator
            const typingMsg = document.createElement('div');
            typingMsg.className = 'msg ai typing';
            typingMsg.innerHTML = '<span class="typing-dots">●●●</span>';
            dashChatHistory.appendChild(typingMsg);
            dashChatHistory.scrollTop = dashChatHistory.scrollHeight;

            try {
                const { reply } = await chatWithRAG(val, false);
                typingMsg.className = 'msg ai';
                typingMsg.innerHTML = renderMarkdown(reply);
            } catch (err) {
                typingMsg.className = 'msg ai';
                typingMsg.textContent = 'Maaf, terjadi kesalahan saat menghubungi AI. Coba lagi.';
            } finally {
                dashChatSend.disabled = false;
                dashChatHistory.scrollTop = dashChatHistory.scrollHeight;
            }
        };
        dashChatSend.addEventListener('click', sendDashMessage);
        dashChatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendDashMessage(); });
    }
    // --- Simulation Role-play Listeners ---
    document.querySelectorAll('.btn-start-sim').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const simId = e.currentTarget.getAttribute('data-sim-id');
            state.activeSimulation = simId;
            state.simChatHistory = []; // Reset history
            render();
        });
    });

    const endSimBtn = document.getElementById('btn-end-sim');
    if (endSimBtn) {
        endSimBtn.addEventListener('click', () => {
            state.activeSimulation = null;
            state.simChatHistory = [];
            render();
        });
    }

    const simSendBtn = document.getElementById('btn-sim-send');
    const simChatInput = document.getElementById('sim-chat-input');
    if (simSendBtn && simChatInput) {
        const sendSimMessage = async () => {
            const val = simChatInput.value.trim();
            if (!val || simSendBtn.disabled) return;
            
            state.simChatHistory.push({ role: 'user', content: val });
            simChatInput.value = '';
            simSendBtn.disabled = true;
            
            // Show typing indicator
            state.simChatHistory.push({ role: 'ai', content: '<span class="typing-dots">●●●</span>' });
            render();

            try {
                // Pass history excluding the typing indicator
                const history = state.simChatHistory.slice(0, -1);
                const reply = await chatSimulation(val, state.activeSimulation, history);
                
                state.simChatHistory[state.simChatHistory.length - 1] = {
                    role: 'ai',
                    content: reply
                };
            } catch (err) {
                state.simChatHistory[state.simChatHistory.length - 1] = {
                    role: 'ai',
                    content: 'Maaf, nasabah sedang tidak dapat merespons. Coba lagi.'
                };
            } finally {
                simSendBtn.disabled = false;
                render();
            }
        };
        simSendBtn.addEventListener('click', sendSimMessage);
        simChatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendSimMessage(); });
    }


    // Official Video Handler
    const officialVideo = document.getElementById('official-video-container');
    if (officialVideo) {
        // Attempt to load custom hero-photo with extensions fallback
        const setBg = (url) => {
            officialVideo.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('${url}')`;
            officialVideo.style.backgroundSize = 'cover';
            officialVideo.style.backgroundPosition = 'center';
        };

        const tryLoadImage = (exts, index) => {
            if (index >= exts.length) {
                // Fallback to official default cover image
                setBg('https://pustaka.bca.co.id/Ocean/Homepage/ocean-hero-image.jpg');
                return;
            }
            const tempImg = new Image();
            const url = `/images/hero/hero-photo.${exts[index]}`;
            tempImg.src = url;
            tempImg.onload = () => {
                setBg(url);
            };
            tempImg.onerror = () => {
                tryLoadImage(exts, index + 1);
            };
        };

        // Try png, then jpg, then jpeg
        tryLoadImage(['png', 'jpg', 'jpeg'], 0);

        officialVideo.addEventListener('click', () => {
            officialVideo.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/Ua6NWwCSJGE?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 12px; border: none; width: 100%; height: 100%;"></iframe>`;
            officialVideo.style.cursor = 'default';
            officialVideo.style.backgroundImage = 'none';
        });
    }


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

    // TRY OCEAN NOW SECTION (Product Matcher)
    const btnMatchProduct = document.getElementById('btn-match-product');
    const toMatchResult = document.getElementById('to-match-result');
    if (btnMatchProduct && toMatchResult) {
        btnMatchProduct.addEventListener('click', () => {
            const role = document.getElementById('to-role-select').value;
            const industry = document.getElementById('to-industry-select').value;
            const need = document.getElementById('to-need-select').value;
            
            if (!role || !industry || !need) {
                alert('Silakan pilih peran, industri, dan kebutuhan Anda terlebih dahulu.');
                return;
            }
            
            let selectedProducts = [];
            let badgeText = '';

            if (role === 'ceo_cfo') {
                badgeText = 'Rekomendasi Strategis untuk CEO / CFO';
                if (need === 'collection') {
                    selectedProducts = [
                        { id: 'virtual-account', name: 'Virtual Account', category: 'Transaksi', subtitle: 'Identifikasi Pembayaran Otomatis', desc: 'Sangat cocok untuk CEO/CFO dalam memantau arus kas masuk secara instan tanpa verifikasi manual.', link: 'https://ocean.bca.co.id/id/produk/transaksi/virtual-account' },
                        { id: 'qris-bca', name: 'QRIS BCA', category: 'Transaksi', subtitle: 'Satu QR untuk Semua E-Wallet', desc: 'Solusi penerimaan dana cepat di semua ritel/online untuk mengoptimalkan working capital.', link: 'https://ocean.bca.co.id/id/produk/transaksi/qris-bisnis' }
                    ];
                } else if (need === 'disbursement') {
                    selectedProducts = [
                        { id: 'mybca-bisnis', name: 'myBCA Bisnis', category: 'Rekening', subtitle: 'Kelola Keuangan Bisnis Terpadu', desc: 'Platform single sign-on untuk otorisasi pembayaran bulk transfer dan payroll karyawan secara aman dan efisien.', link: 'https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis' }
                    ];
                } else if (need === 'cash_management') {
                    selectedProducts = [
                        { id: 'mybca-bisnis', name: 'myBCA Bisnis', category: 'Rekening', subtitle: 'Kelola Keuangan Bisnis Terpadu', desc: 'Pantau saldo konsolidasi dari seluruh rekening cabang Anda dalam satu dashboard eksekutif.', link: 'https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis' },
                        { id: 'e-deposito', name: 'e-Deposito', category: 'Investasi', subtitle: 'Investasi Dana Efisien', desc: 'Tempatkan kelebihan likuiditas perusahaan secara online dengan bunga deposito kompetitif.', link: 'https://ocean.bca.co.id/id/produk/rekening/e-deposito' }
                    ];
                } else if (need === 'financing') {
                    selectedProducts = [
                        { id: 'kur-bca', name: 'Kredit Usaha Rakyat (KUR)', category: 'Pinjaman', subtitle: 'Pembiayaan Modal Kerja Subsidi', desc: 'Pembiayaan bunga murah bersubsidi untuk mendukung ekspansi bisnis skala menengah Anda.', link: 'https://ocean.bca.co.id/id/produk/pinjaman/kur' },
                        { id: 'kredit-lokal', name: 'Kredit Lokal', category: 'Pinjaman', subtitle: 'Kebutuhan Modal Kerja Dinamis', desc: 'Fasilitas pinjaman fleksibel yang dapat ditarik sewaktu-waktu sesuai kebutuhan perputaran kas.', link: 'https://ocean.bca.co.id/id/produk/pinjaman/kredit-lokal' }
                    ];
                } else {
                    selectedProducts = [
                        { id: 'bca-api', name: 'BCA API', category: 'Solusi Digital', subtitle: 'Integrasi Finansial Real-time', desc: 'Maksimalkan otomatisasi rekonsiliasi keuangan dengan menghubungkan sistem ERP internal langsung ke core banking BCA.', link: 'https://ocean.bca.co.id/id/produk/solusi-digital/bca-api' }
                    ];
                }
            } else if (role === 'ops') {
                badgeText = 'Rekomendasi Operasional untuk Finance & Ops';
                if (need === 'collection') {
                    selectedProducts = [
                        { id: 'virtual-account', name: 'Virtual Account', category: 'Transaksi', subtitle: 'Rekonsiliasi Otomatis', desc: 'Eliminasi proses pengecekan mutasi manual. Setiap transaksi teridentifikasi otomatis berdasarkan ID pelanggan.', link: 'https://ocean.bca.co.id/id/produk/transaksi/virtual-account' },
                        { id: 'edc-bca', name: 'EDC BCA', category: 'Transaksi', subtitle: 'Menerima Pembayaran Kartu', desc: 'Menerima berbagai jenis kartu debit/kredit dan metode QRIS di toko fisik secara andal.', link: 'https://ocean.bca.co.id/id/produk/transaksi/edc-bca' }
                    ];
                } else if (need === 'disbursement') {
                    selectedProducts = [
                        { id: 'mybca-bisnis', name: 'myBCA Bisnis', category: 'Rekening', subtitle: 'Bulk Transfer & Payroll', desc: 'Kirim dana ke ribuan vendor atau karyawan sekaligus dalam sekali upload file excel/CSV.', link: 'https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis' }
                    ];
                } else if (need === 'cash_management') {
                    selectedProducts = [
                        { id: 'tahapan-gold', name: 'Tahapan Gold', category: 'Rekening', subtitle: 'Tabungan Bisnis Praktis', desc: 'Tabungan operasional dengan mutasi detail, limit transaksi harian besar, dan info SMS/Email berita.', link: 'https://ocean.bca.co.id/id/produk/rekening/tahapan-gold' },
                        { id: 'giro-bca', name: 'Giro BCA', category: 'Rekening', subtitle: 'Kemudahan Cek & Bilyet Giro', desc: 'Fasilitas rekening koran dengan penarikan via Cek atau Bilyet Giro untuk operasional B2B sehari-hari.', link: 'https://ocean.bca.co.id/id/produk/rekening/giro' }
                    ];
                } else if (need === 'financing') {
                    selectedProducts = [
                        { id: 'kredit-lokal', name: 'Kredit Lokal', category: 'Pinjaman', subtitle: 'Working Capital', desc: 'Bantu operasional dengan tambahan modal kerja siap pakai saat piutang pelanggan belum cair.', link: 'https://ocean.bca.co.id/id/produk/pinjaman/kredit-lokal' }
                    ];
                } else {
                    selectedProducts = [
                        { id: 'bca-api', name: 'BCA API', category: 'Solusi Digital', subtitle: 'Integrasi Finansial Real-time', desc: 'Hubungkan mutasi rekening koran langsung ke dashboard operasional divisi keuangan Anda secara real-time.', link: 'https://ocean.bca.co.id/id/produk/solusi-digital/bca-api' }
                    ];
                }
            } else {
                badgeText = 'Rekomendasi Integrasi & Tech untuk Developer / IT';
                if (need === 'collection') {
                    selectedProducts = [
                        { id: 'bca-api', name: 'BCA API (Virtual Account)', category: 'Solusi Digital', subtitle: 'API VA Integration', desc: 'Webhook notifikasi pembayaran VA instan untuk mengupdate status invoice di database Anda secara realtime.', link: 'https://ocean.bca.co.id/id/produk/solusi-digital/bca-api' }
                    ];
                } else if (need === 'disbursement') {
                    selectedProducts = [
                        { id: 'bca-api', name: 'BCA API (Transfer Dana)', category: 'Solusi Digital', subtitle: 'API Transfer Integration', desc: 'Otomatisasi pengiriman dana massal (payroll/vendor payment) terintegrasi langsung dari ERP internal.', link: 'https://ocean.bca.co.id/id/produk/solusi-digital/bca-api' }
                    ];
                } else if (need === 'cash_management') {
                    selectedProducts = [
                        { id: 'bca-api', name: 'BCA API (Mutasi & Saldo)', category: 'Solusi Digital', subtitle: 'Inquiry API Integration', desc: 'API mutasi dan cek saldo otomatis untuk ditarik ke dalam dashboard pelaporan finance internal.', link: 'https://ocean.bca.co.id/id/produk/solusi-digital/bca-api' }
                    ];
                } else if (need === 'financing') {
                    selectedProducts = [
                        { id: 'bca-api', name: 'BCA API (E-Kredit)', category: 'Solusi Digital', subtitle: 'API Credit Request', desc: 'Integrasi pengajuan fasilitas kredit merchant langsung dari dashboard backend e-commerce Anda.', link: 'https://ocean.bca.co.id/id/produk/solusi-digital/bca-api' }
                    ];
                } else {
                    selectedProducts = [
                        { id: 'bca-api', name: 'BCA API (Developer Portal)', category: 'Solusi Digital', subtitle: 'Sandboxed API Testing', desc: 'Akses instan ke credentials sandbox, API docs lengkap, dan simulator transaksi di Portal Developer BCA.', link: 'https://ocean.bca.co.id/id/produk/solusi-digital/bca-api' }
                    ];
                }
            }

            // Render output
            const badgeEl = document.getElementById('to-match-badge');
            if (badgeEl) badgeEl.textContent = badgeText;

            const cardsContainer = document.getElementById('to-match-cards');
            if (cardsContainer) {
                cardsContainer.className = 'to-product-cards-container';
                cardsContainer.innerHTML = selectedProducts.map(p => `
                    <div class="to-product-card">
                        <div class="to-product-card-header">
                            <h4 class="to-product-card-title">${p.name}</h4>
                            <span class="to-product-card-category">${p.category}</span>
                        </div>
                        <div class="to-product-card-subtitle">${p.subtitle}</div>
                        <p class="to-product-card-desc">${p.desc}</p>
                        <a href="${p.link}" target="_blank" class="to-product-card-action">
                            Lihat Detail Produk ↗
                        </a>
                    </div>
                `).join('');
            }
            
            toMatchResult.classList.remove('hidden');
        });
    }

    // Go to Sandbox button (from Try Ocean Now section) - Opens Request Access Modal
    const btnGoSandbox = document.getElementById('btn-go-sandbox');
    const reqModal = document.getElementById('sandbox-req-modal');
    if (btnGoSandbox && reqModal) {
        btnGoSandbox.addEventListener('click', () => {
            reqModal.classList.remove('hidden');
            // reset modal views
            document.getElementById('sb-req-fields').classList.remove('hidden');
            document.getElementById('sb-req-success-view').classList.add('hidden');
            document.getElementById('sb-req-name').value = '';
            document.getElementById('sb-req-email').value = '';
            document.getElementById('sb-req-company').value = '';
            document.getElementById('sb-req-phone').value = '';
        });
    }

    // Modal Cancel Button
    const btnSbReqCancel = document.getElementById('btn-sb-req-cancel');
    if (btnSbReqCancel && reqModal) {
        btnSbReqCancel.addEventListener('click', () => {
            reqModal.classList.add('hidden');
        });
    }

    // Modal Submit Form
    const btnSbReqSubmit = document.getElementById('btn-sb-req-submit');
    if (btnSbReqSubmit) {
        btnSbReqSubmit.addEventListener('click', () => {
            const name = document.getElementById('sb-req-name').value.trim();
            const email = document.getElementById('sb-req-email').value.trim();
            const company = document.getElementById('sb-req-company').value.trim();
            const phone = document.getElementById('sb-req-phone').value.trim();

            if (!name || !email || !company || !phone) {
                alert('Mohon lengkapi seluruh kolom pendaftaran.');
                return;
            }

            // Transition to success screen
            document.getElementById('sb-req-fields').classList.add('hidden');
            document.getElementById('sb-req-success-view').classList.remove('hidden');
        });
    }

    // Modal Success - Redirect to Sandbox
    const btnSbReqSandboxDirect = document.getElementById('btn-sb-req-sandbox-direct');
    if (btnSbReqSandboxDirect && reqModal) {
        btnSbReqSandboxDirect.addEventListener('click', () => {
            reqModal.classList.add('hidden');
            state.currentPage = 'sandbox';
            state.sandboxTab = 'dashboard';
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Sandbox tab navigation
    document.querySelectorAll('[data-sb-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            state.sandboxTab = tab.getAttribute('data-sb-tab');
            render();
        });
    });

    // Sandbox: Invoice create form toggle
    const btnCreateInvoice = document.getElementById('btn-sb-create-invoice');
    const invoiceForm = document.getElementById('sb-invoice-form');
    if (btnCreateInvoice && invoiceForm) {
        btnCreateInvoice.addEventListener('click', () => {
            invoiceForm.classList.remove('hidden');
        });
    }

    const btnCancelInvoice = document.getElementById('btn-sb-cancel-invoice');
    if (btnCancelInvoice && invoiceForm) {
        btnCancelInvoice.addEventListener('click', () => {
            invoiceForm.classList.add('hidden');
        });
    }

    // Sandbox: Submit Invoice
    const btnSubmitInvoice = document.getElementById('btn-sb-submit-invoice');
    if (btnSubmitInvoice) {
        btnSubmitInvoice.addEventListener('click', () => {
            const customer = document.getElementById('sb-inv-customer')?.value.trim();
            const amountStr = document.getElementById('sb-inv-amount')?.value;
            const dueStr = document.getElementById('sb-inv-due')?.value;
            
            if (!customer || !amountStr || !dueStr) {
                showToast('Gagal Membuat Invoice', 'Mohon lengkapi semua field invoice.', 'error');
                return;
            }

            const amount = parseInt(amountStr);
            const due = new Date(dueStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            const invNo = 'INV-2026-' + String(Math.floor(Math.random() * 9000) + 1000);

            // Add to state
            state.sandbox.invoices.unshift({
                id: invNo,
                customer: customer,
                amount: amount,
                due: due,
                status: 'Menunggu'
            });

            // Add api log
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            state.sandbox.apiLogs.unshift({
                time: timeStr,
                status: 200,
                method: 'POST',
                endpoint: `/v1/va/create`,
                duration: '115ms'
            });

            showToast('Invoice Terkirim', `Invoice ${invNo} untuk ${customer} berhasil dibuat!`, 'success');
            render();
        });
    }

    // Sandbox: Remind button
    document.querySelectorAll('.sb-btn-remind').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const invId = e.target.getAttribute('data-inv-id');
            const origText = e.target.textContent;
            e.target.textContent = '✓ Terkirim!';
            e.target.disabled = true;
            e.target.style.background = '#16a34a';
            e.target.style.color = 'white';
            
            showToast('Pengingat Terkirim', `Email pengingat pembayaran untuk invoice ${invId} telah dikirim ke pelanggan.`, 'success');

            // Add api log
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            state.sandbox.apiLogs.unshift({
                time: timeStr,
                status: 200,
                method: 'POST',
                endpoint: `/v1/va/remind`,
                duration: '95ms'
            });

            setTimeout(() => {
                e.target.textContent = origText;
                e.target.disabled = false;
                e.target.style.background = '';
                e.target.style.color = '';
            }, 2000);
        });
    });

    // Sandbox: Pay button (Simulated customer payment)
    document.querySelectorAll('.sb-btn-pay').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const invId = e.target.getAttribute('data-inv-id');
            const invoice = state.sandbox.invoices.find(inv => inv.id === invId);
            
            if (invoice) {
                invoice.status = 'Lunas';
                state.sandbox.totalBalance += invoice.amount;
                state.sandbox.incomingToday += invoice.amount;

                // Add to transactions
                state.sandbox.transactions.unshift({
                    date: 'Hari Ini',
                    desc: `VA Payment - ${invoice.customer} (${invoice.id})`,
                    amount: invoice.amount,
                    type: 'in',
                    status: 'Success'
                });

                // Add api log
                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                state.sandbox.apiLogs.unshift({
                    time: timeStr,
                    status: 200,
                    method: 'POST',
                    endpoint: `/v1/va/callback (${invoice.id})`,
                    duration: '142ms'
                });

                showToast('Pembayaran Berhasil', `Simulasi pembayaran untuk ${invoice.id} sebesar Rp ${invoice.amount.toLocaleString('id-ID')} telah diterima!`, 'success');
                render();
            }
        });
    });

    // Sandbox: Copy API key
    document.querySelectorAll('.sb-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.target.getAttribute('data-key');
            navigator.clipboard.writeText(key).then(() => {
                showToast('Disalin', 'Kunci API berhasil disalin ke clipboard.', 'success');
                e.target.textContent = '✓';
                setTimeout(() => e.target.textContent = '📋', 1500);
            });
        });
    });

    // Sandbox: Activate ecosystem card
    document.querySelectorAll('.sb-btn-activate').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ecoId = e.target.getAttribute('data-eco-id');
            const integration = state.sandbox.integrations.find(item => item.id === ecoId);
            if (integration) {
                integration.active = true;
                integration.trx = Math.floor(Math.random() * 500) + 100;
                integration.uptime = '99.' + (Math.floor(Math.random() * 9) + 1) + '%';
                
                // Add api log
                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                state.sandbox.apiLogs.unshift({
                    time: timeStr,
                    status: 200,
                    method: 'POST',
                    endpoint: `/v1/keys/activate (${integration.id})`,
                    duration: '105ms'
                });

                showToast('Koneksi Diaktifkan', `Integrasi untuk ${integration.name} berhasil diaktifkan.`, 'success');
                render();
            }
        });
    });

    // Sandbox: Deactivate ecosystem card
    document.querySelectorAll('.sb-btn-deactivate').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ecoId = e.target.getAttribute('data-eco-id');
            const integration = state.sandbox.integrations.find(item => item.id === ecoId);
            if (integration) {
                integration.active = false;
                
                // Add api log
                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                state.sandbox.apiLogs.unshift({
                    time: timeStr,
                    status: 200,
                    method: 'POST',
                    endpoint: `/v1/keys/deactivate (${integration.id})`,
                    duration: '85ms'
                });

                showToast('Koneksi Dinonaktifkan', `Integrasi untuk ${integration.name} dinonaktifkan.`, 'warning');
                render();
            }
        });
    });

    // API Console Endpoint Selection change
    const apiEndpointSelect = document.getElementById('sb-api-endpoint');
    if (apiEndpointSelect) {
        apiEndpointSelect.addEventListener('change', (e) => {
            state.sandbox.apiSimulation.activeEndpoint = e.target.value;
            state.sandbox.apiSimulation.response = null;
            render();
        });
    }

    // API Console Run Simulation
    const btnSbSendApi = document.getElementById('btn-sb-send-api');
    if (btnSbSendApi) {
        btnSbSendApi.addEventListener('click', () => {
            state.sandbox.apiSimulation.executing = true;
            render();

            setTimeout(() => {
                const endpoint = state.sandbox.apiSimulation.activeEndpoint;
                let response = {};

                if (endpoint === 'get-balance') {
                    response = {
                        status: "success",
                        account_number: "1234567890",
                        balance: state.sandbox.totalBalance,
                        currency: "IDR",
                        timestamp: new Date().toISOString()
                    };
                } else if (endpoint === 'create-va') {
                    response = {
                        status: "created",
                        va_number: "988776655102",
                        amount: 15000000,
                        customer_name: "PT Cipta Karya",
                        trx_id: "VA-" + Math.floor(Math.random() * 900000 + 100000),
                        timestamp: new Date().toISOString()
                    };
                } else if (endpoint === 'transfer') {
                    response = {
                        status: "success",
                        reference_number: "TRX-" + Math.floor(Math.random() * 90000000 + 10000000),
                        amount: 25000000,
                        beneficiary: "CV Logistik Abadi",
                        timestamp: new Date().toISOString()
                    };
                }

                state.sandbox.apiSimulation.executing = false;
                state.sandbox.apiSimulation.response = response;

                // Add to api logs
                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                state.sandbox.apiLogs.unshift({
                    time: timeStr,
                    status: 200,
                    method: endpoint === 'get-balance' ? 'GET' : 'POST',
                    endpoint: endpoint === 'get-balance' ? '/v1/balance' : (endpoint === 'create-va' ? '/v1/va/create' : '/v1/transfer'),
                    duration: (Math.floor(Math.random() * 80) + 40) + 'ms'
                });

                showToast('API Executed', 'Ocean API Simulator berhasil mengembalikan response JSON.', 'success');
                render();
            }, 800);
        });
    }

    // TRY OCEAN NOW SECTION (API Sandbox)
    const btnRunApi = document.getElementById('btn-run-api');
    const apiTabs = document.querySelectorAll('.api-tab');
    const reqCode = document.getElementById('api-req-code');
    const resCode = document.getElementById('api-res-code');
    
    if (btnRunApi) {
        btnRunApi.addEventListener('click', () => {
            reqCode.classList.add('hidden');
            resCode.classList.remove('hidden');
            apiTabs[0].classList.remove('active');
            apiTabs[1].classList.add('active');
            btnRunApi.textContent = 'API Berhasil Dieksekusi!';
            btnRunApi.disabled = true;
            setTimeout(() => {
                btnRunApi.textContent = 'Simulasi Eksekusi API';
                btnRunApi.disabled = false;
            }, 3000);
        });
    }
    
    if (apiTabs.length >= 2) {
        apiTabs[0].addEventListener('click', () => {
            apiTabs[1].classList.remove('active');
            apiTabs[0].classList.add('active');
            resCode.classList.add('hidden');
            reqCode.classList.remove('hidden');
        });
        apiTabs[1].addEventListener('click', () => {
            apiTabs[0].classList.remove('active');
            apiTabs[1].classList.add('active');
            reqCode.classList.add('hidden');
            resCode.classList.remove('hidden');
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

    // ═══════════════════════════════════════════════════════════
    // REAL RAG HUB EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════

    async function startFileUpload(file) {
        if (!file) return;
        state.ragUploading   = true;
        state.ragUploadError = null;
        state.ragUploadProgress = { step: 1, message: 'Memvalidasi file...' };
        render();

        try {
            await uploadDocument(file, state.ragActiveType === 'pakar' ? 'pakar' : 'upload', (step, message) => {
                state.ragUploadProgress = { step, message };
                render();
            });
            // Refresh docs list
            state.ragDocs  = await fetchDocuments();
            state.ragStats = await fetchStats();
        } catch (err) {
            state.ragUploadError = err.message;
        } finally {
            state.ragUploading = false;
            render();
        }
    }

    // File input — hidden <input type="file">
    const ragFileInput = document.getElementById('rag-file-input');
    if (ragFileInput) {
        ragFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) startFileUpload(file);
            ragFileInput.value = ''; // reset so same file can be re-uploaded
        });
    }

    // Dropzone drag & drop
    const dropzone = document.getElementById('rag-dropzone');
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) startFileUpload(file);
        });
    }

    // URL Import
    const btnImportUrl = document.getElementById('btn-import-url');
    if (btnImportUrl) {
        btnImportUrl.addEventListener('click', async () => {
            const urlInput = document.getElementById('rag-url-input');
            const url = urlInput?.value.trim();
            if (!url) return;
            state.ragUploading   = true;
            state.ragUploadError = null;
            state.ragUploadProgress = { step: 1, message: 'Mengakses URL...' };
            render();
            try {
                await importFromUrl(url, (step, message) => {
                    state.ragUploadProgress = { step, message };
                    render();
                });
                state.ragDocs  = await fetchDocuments();
                state.ragStats = await fetchStats();
                if (urlInput) urlInput.value = '';
            } catch (err) {
                state.ragUploadError = err.message;
            } finally {
                state.ragUploading = false;
                render();
            }
        });
    }

    // Refresh button
    const btnRefresh = document.getElementById('btn-rag-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            btnRefresh.disabled = true;
            btnRefresh.textContent = '↻ Loading...';
            try {
                state.ragDocs  = await fetchDocuments();
                state.ragStats = await fetchStats();
                render();
            } catch (err) {
                console.error('Refresh failed:', err);
            }
        });
    }

    // Delete document buttons
    document.querySelectorAll('.rdt-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const docId = btn.dataset.docId;
            if (!docId || !confirm('Hapus dokumen ini dan semua chunk-nya dari knowledge base?')) return;
            try {
                await deleteDocument(docId);
                state.ragDocs  = await fetchDocuments();
                state.ragStats = await fetchStats();
                render();
            } catch (err) {
                alert('Gagal menghapus: ' + err.message);
            }
        });
    });

    // Source type tab switching
    document.querySelectorAll('.rtt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.ragActiveType = btn.dataset.type;
            render();
        });
    });

    // Load RAG data on page mount (only once per page visit)
    if (state.currentPage === 'ingestion' && !state.ragLoaded) {
        state.ragLoaded = true;
        fetchDocuments().then(docs => {
            state.ragDocs = docs;
            return fetchStats();
        }).then(stats => {
            state.ragStats = stats;
            render();
        }).catch(err => console.warn('Failed to load RAG data:', err));
    }


    // Chat Logic (Internal)
    const chatInputInternal = document.getElementById('chat-input');
    const sendBtnInternal = document.getElementById('btn-send-chat');
    if (chatInputInternal && sendBtnInternal) {
        const send = async () => {
            const val = chatInputInternal.value.trim();
            if (!val || sendBtnInternal.disabled) return;
            state.chatHistory.push({ role: 'user', content: val });
            chatInputInternal.value = '';
            sendBtnInternal.disabled = true;
            state.chatHistory.push({ role: 'ai', content: '<span class="typing-dots">●●●</span>' });
            render();
            try {
                const { reply, sources } = await chatWithRAG(val);
                state.chatHistory[state.chatHistory.length - 1] = {
                    role: 'ai',
                    content: reply + (sources.length > 0
                        ? `<div class="rag-sources-tag">📚 Berdasarkan ${sources.length} sumber dari Knowledge Base</div>`
                        : '')
                };
            } catch (err) {
                state.chatHistory[state.chatHistory.length - 1] = {
                    role: 'ai',
                    content: 'Maaf, terjadi kesalahan saat menghubungi AI. Coba lagi.'
                };
            } finally {
                sendBtnInternal.disabled = false;
                render();
            }
        };
        sendBtnInternal.addEventListener('click', send);
        chatInputInternal.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    }

    // Chat Logic (Public)
    const pubChatInput = document.getElementById('public-chat-input');
    const pubSendBtn = document.getElementById('public-send-chat');
    if (pubChatInput && pubSendBtn) {
        const send = async () => {
            const val = pubChatInput.value.trim();
            if (!val || pubSendBtn.disabled) return;
            const msgBox = document.getElementById('public-chat-messages');
            msgBox.insertAdjacentHTML('beforeend', `<div class="msg user">${val}</div>`);
            pubChatInput.value = '';
            pubSendBtn.disabled = true;
            
            const typingId = 'typing-' + Date.now();
            msgBox.insertAdjacentHTML('beforeend', `<div class="msg ai" id="${typingId}"><span class="typing-dots">●●●</span></div>`);
            msgBox.scrollTop = msgBox.scrollHeight;

            try {
                const { reply, sources } = await chatWithRAG(val);
                const typingEl = document.getElementById(typingId);
                if (typingEl) {
                    typingEl.innerHTML = renderMarkdown(reply) + (sources.length > 0 
                        ? `<br><br><small style="opacity:0.7">📚 Berdasarkan ${sources.length} sumber KB</small>`
                        : '');
                }
            } catch (err) {
                const typingEl = document.getElementById(typingId);
                if (typingEl) typingEl.innerHTML = 'Maaf, layanan AI sedang sibuk. Silakan coba lagi.';
            } finally {
                pubSendBtn.disabled = false;
                msgBox.scrollTop = msgBox.scrollHeight;
            }
        };
        pubSendBtn.addEventListener('click', send);
        pubChatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    }

    // Fitur Unggulan Slideshow Listener
    const slides = document.querySelectorAll('.fitur-slide');
    const dots = document.querySelectorAll('.fitur-dot');
    const prevBtn = document.querySelector('.fitur-controls .btn-prev');
    const nextBtn = document.querySelector('.fitur-controls .btn-next');
    
    if (slides.length > 0) {
        let currentSlide = 0;
        const showSlide = (index) => {
            slides.forEach((slide, idx) => {
                if (idx === index) {
                    slide.classList.add('active');
                } else {
                    slide.classList.remove('active');
                }
            });
            dots.forEach((dot, idx) => {
                if (idx === index) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
            currentSlide = index;
        };

        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                let prev = currentSlide - 1;
                if (prev < 0) prev = slides.length - 1;
                showSlide(prev);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                let next = currentSlide + 1;
                if (next >= slides.length) next = 0;
                showSlide(next);
            });
        }

        dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt(e.currentTarget.getAttribute('data-dot'));
                showSlide(index);
            });
        });
    }

    // Punya Pertanyaan Contact Form Validation
    const contactForm = document.getElementById('ocean-contact-form');
    if (contactForm) {
        const picInput = document.getElementById('contact-pic');
        const usahaInput = document.getElementById('contact-usaha');
        const emailInput = document.getElementById('contact-email');
        const descInput = document.getElementById('contact-desc');
        const consent1 = document.getElementById('consent-1');
        const consent2 = document.getElementById('consent-2');
        const submitBtn = document.getElementById('btn-submit-contact');
        const charCounter = document.querySelector('.char-counter');

        const validateForm = () => {
            const isPicValid = picInput.value.trim() !== '';
            const isUsahaValid = usahaInput.value.trim() !== '';
            const isEmailValid = emailInput.value.trim() !== '' && emailInput.checkValidity();
            const isDescValid = descInput.value.trim() !== '';
            const isConsent1Checked = consent1.checked;
            const isConsent2Checked = consent2.checked;

            const isFormValid = isPicValid && isUsahaValid && isEmailValid && isDescValid && isConsent1Checked && isConsent2Checked;

            if (isFormValid) {
                submitBtn.disabled = false;
                submitBtn.className = 'btn-submit-active';
            } else {
                submitBtn.disabled = true;
                submitBtn.className = 'btn-submit-disabled';
            }
        };

        // Textarea Char Counter
        descInput.addEventListener('input', () => {
            const length = descInput.value.length;
            charCounter.textContent = `${length} / 500`;
            validateForm();
        });

        // Event listeners for change and input
        [picInput, usahaInput, emailInput, consent1, consent2].forEach(element => {
            element.addEventListener('input', validateForm);
            element.addEventListener('change', validateForm);
        });

        // Form Submit
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Terima kasih! Kontak Anda telah terkirim. Relationship Officer kami akan segera menghubungi Anda.');
            contactForm.reset();
            charCounter.textContent = '0 / 500';
            validateForm();
        });
    }

    // --- Product Catalog Listeners ---
    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.productSearchQuery = e.target.value;
            render();
            // Refocus search input and set cursor to end
            const refocusedInput = document.getElementById('product-search-input');
            if (refocusedInput) {
                refocusedInput.focus();
                refocusedInput.setSelectionRange(refocusedInput.value.length, refocusedInput.value.length);
            }
        });
    }

    const sectorSelect = document.getElementById('product-sector-select');
    if (sectorSelect) {
        sectorSelect.addEventListener('change', (e) => {
            state.productSelectedSector = e.target.value;
            render();
        });
    }

    document.querySelectorAll('.category-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = e.currentTarget.getAttribute('data-category');
            if (cat) {
                state.productSelectedCategory = cat;
                render();
            }
        });
    });

    document.querySelectorAll('.product-item-card-premium').forEach(card => {
        card.addEventListener('click', (e) => {
            if (card.classList.contains('disabled')) return;
            const productId = card.getAttribute('data-product-id');
            const product = PRODUCTS.find(p => p.id === productId);
            if (!product) return;

            const existingIndex = state.selectedProducts.findIndex(p => p.id === product.id);
            if (existingIndex > -1) {
                state.selectedProducts.splice(existingIndex, 1);
            } else {
                if (state.selectedProducts.length < 10) {
                    state.selectedProducts.push(product);
                }
            }
            render();
        });
    });

    document.querySelectorAll('.btn-remove-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const productId = btn.getAttribute('data-product-id');
            state.selectedProducts = state.selectedProducts.filter(p => p.id !== productId);
            render();
        });
    });

    const resetFiltersBtn = document.querySelector('.btn-reset-filters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            state.productSelectedSector = 'Semua';
            state.productSelectedCategory = 'Rekening';
            state.productSearchQuery = '';
            state.selectedProducts = [];
            render();
        });
    }

    // Modal Events Handling
    let validateModalForm = () => {};

    const closeBtn = document.getElementById('btn-close-contact-modal');
    const modal = document.getElementById('product-contact-modal');
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }

    const bottomSubmitBtn = document.getElementById('product-btn-bottom-submit');
    if (bottomSubmitBtn && modal) {
        bottomSubmitBtn.addEventListener('click', () => {
            const nameLabel = document.getElementById('modal-product-name-label');
            const nameInput = document.getElementById('modal-contact-product-name');
            const descInput = document.getElementById('modal-contact-desc');
            const charCounter = document.querySelector('.modal-char-counter');
            
            const productNames = state.selectedProducts.map(p => p.name).join(', ');
            if (nameLabel) nameLabel.textContent = productNames;
            if (nameInput) nameInput.value = productNames;
            if (descInput) {
                descInput.value = `Saya tertarik dengan produk ${productNames} dan ingin mendapatkan penjelasan lebih lanjut mengenai solusi ini untuk bisnis saya.`;
                if (charCounter) charCounter.textContent = `${descInput.value.length} / 500`;
            }
            modal.classList.add('show');
            validateModalForm();
        });
    }

    const modalForm = document.getElementById('product-modal-contact-form');
    if (modalForm) {
        const picInput = document.getElementById('modal-contact-pic');
        const usahaInput = document.getElementById('modal-contact-usaha');
        const emailInput = document.getElementById('modal-contact-email');
        const descInput = document.getElementById('modal-contact-desc');
        const consent1 = document.getElementById('modal-consent-1');
        const consent2 = document.getElementById('modal-consent-2');
        const submitBtn = document.getElementById('btn-submit-modal-contact');
        const charCounter = document.querySelector('.modal-char-counter');

        validateModalForm = () => {
            const isPicValid = picInput.value.trim() !== '';
            const isUsahaValid = usahaInput.value.trim() !== '';
            const isEmailValid = emailInput.value.trim() !== '' && emailInput.checkValidity();
            const isDescValid = descInput.value.trim() !== '';
            const isConsent1Checked = consent1.checked;
            const isConsent2Checked = consent2.checked;

            const isFormValid = isPicValid && isUsahaValid && isEmailValid && isDescValid && isConsent1Checked && isConsent2Checked;

            if (submitBtn) {
                if (isFormValid) {
                    submitBtn.disabled = false;
                    submitBtn.className = 'btn-submit-active';
                } else {
                    submitBtn.disabled = true;
                    submitBtn.className = 'btn-submit-disabled';
                }
            }
        };

        if (descInput && charCounter) {
            descInput.addEventListener('input', () => {
                const length = descInput.value.length;
                charCounter.textContent = `${length} / 500`;
                validateModalForm();
            });
        }

        [picInput, usahaInput, emailInput, consent1, consent2].forEach(element => {
            if (element) {
                element.addEventListener('input', validateModalForm);
                element.addEventListener('change', validateModalForm);
            }
        });

        modalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const productName = document.getElementById('modal-contact-product-name').value;
            alert(`Terima kasih! Kontak Anda untuk produk "${productName}" telah terkirim. Relationship Officer kami akan segera menghubungi Anda.`);
            modalForm.reset();
            if (charCounter) charCounter.textContent = '0 / 500';
            if (modal) modal.classList.remove('show');
            state.selectedProducts = [];
            render();
        });
    }

    const lihatRiwayatBtn = document.getElementById('btn-lihat-riwayat');
    if (lihatRiwayatBtn) {
        lihatRiwayatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            state.viewMode = 'auth';
            state.authStep = 'login';
            render();
        });
    }
};

render();
startLogSimulator();
