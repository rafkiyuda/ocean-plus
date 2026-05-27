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
                <div class="nav-dropdown-wrapper">
                    <button class="nav-link-p nav-dropdown-trigger">
                        myEcosystem
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
                    </button>
                    <div class="nav-dropdown-menu">
                        <a href="#" class="nav-dropdown-item">Invoicing</a>
                        <a href="#" class="nav-dropdown-item">Financing</a>
                        <a href="#" class="nav-dropdown-item">HR & Payroll</a>
                        <a href="#" class="nav-dropdown-item">Manajemen Pajak</a>
                    </div>
                </div>
                <a href="#" class="nav-link-p ${state.currentPage === 'sandbox' ? 'active' : ''}" data-page="sandbox">Sandbox Demo</a>
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
                <a href="#" class="nav-link-p ${state.currentPage === 'article' ? 'active' : ''}" data-page="article">Artikel</a>
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
            <div class="mobile-menu-dropdown-trigger" id="mobile-myecosystem-btn">
                <span>myEcosystem</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mobile-nav-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
            </div>
            <div class="mobile-nav-dropdown-menu" id="mobile-myecosystem-menu" style="display: none;">
                <a href="#" class="mobile-dropdown-item">Invoicing</a>
                <a href="#" class="mobile-dropdown-item">Financing</a>
                <a href="#" class="mobile-dropdown-item">HR & Payroll</a>
                <a href="#" class="mobile-dropdown-item">Manajemen Pajak</a>
            </div>
            <a href="#" class="mobile-menu-link ${state.currentPage === 'sandbox' ? 'active' : ''}" data-page="sandbox">Sandbox Demo</a>
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
            <a href="#" class="mobile-menu-link ${state.currentPage === 'article' ? 'active' : ''}" data-page="article">Artikel</a>
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
    <div class="public-layout fade-in" style="background:#f1f5f9;">
        <div class="roi-hero">
            <h1>ROI Calculator</h1>
            <p>Estimasi seberapa besar penghematan waktu dan efisiensi operasional yang bisa dicapai bisnis Anda dengan Ocean by BCA.</p>
        </div>

        <div class="roi-dashboard">
            <div class="roi-panel">
                <div class="roi-panel-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    Parameter Bisnis
                </div>
                
                <div class="roi-form-group">
                    <label>Jumlah Cabang / Titik Lokasi</label>
                    <div class="roi-input-wrapper">
                        <svg class="roi-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        <input type="number" id="roi-branches" value="${state.roiInputs.branches || 5}">
                    </div>
                </div>

                <div class="roi-form-group">
                    <label>Rata-rata Transaksi Bulanan per Cabang</label>
                    <div class="roi-input-wrapper">
                        <svg class="roi-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M7 15h0M2 9.5h20"></path></svg>
                        <input type="number" id="roi-transactions" value="${state.roiInputs.transactions || 1000}">
                    </div>
                </div>

                <div class="roi-form-group">
                    <label>Waktu Rekonsiliasi Manual Saat Ini (Jam/Hari)</label>
                    <div class="roi-input-wrapper">
                        <svg class="roi-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <input type="number" id="roi-time" value="4">
                    </div>
                </div>

                <button class="roi-btn" id="calc-roi">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Kalkulasi Estimasi
                </button>
            </div>

            <div class="roi-panel" style="background: transparent; box-shadow: none; border: none; padding: 0;">
                <div class="roi-result-card highlight">
                    <div class="roi-result-label">Efisiensi Biaya Operasional</div>
                    <div class="roi-result-val">Rp ${ ((state.roiInputs.branches || 5) * 1500000).toLocaleString('id-ID') } / Bulan</div>
                    <div class="roi-result-desc">Potensi penghematan dari pengurangan biaya manual error, lembur administrasi, dan rekonsiliasi yang terotomatisasi secara end-to-end.</div>
                    
                    <div class="roi-chart-placeholder">
                        <div class="roi-bar" style="height: 40%;" title="Tanpa Ocean"></div>
                        <div class="roi-bar" style="height: 100%;" title="Dengan Ocean"></div>
                    </div>
                </div>

                <div class="roi-result-card" style="background: white; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                    <div class="roi-result-label">Penghematan Waktu Produktif</div>
                    <div class="roi-result-val">${Math.round((state.roiInputs.branches || 5) * 2.5)} Jam / Hari</div>
                    <div class="roi-result-desc">Otomasi dashboard myBCA Bisnis dan ERP terintegrasi memotong 70% waktu tim finance dari proses manual tiap harinya.</div>
                </div>
            </div>
        </div>
    </div>
`;

const HelpCenterPage = () => `
    <div class="public-layout fade-in" style="min-height: 100vh; display: flex; flex-direction: column;">
        <!-- HERO SECTION -->
        <div style="height: 334px; background-color: #00213D; background-image: url('https://main.ocean.bca.co.id/images/ocean-help-center-header-logo.svg'); background-size: cover; background-position: center; background-repeat: no-repeat; background-blend-mode: difference; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 0 24px;">
            
            <h1 style="position: relative; z-index: 10; text-align: center; font-size: 32px; font-weight: 600; color: white; margin-bottom: 24px;">
                Ada yang bisa kami bantu?
            </h1>
            
            <div style="position: relative; z-index: 10; display: flex; align-items: center; justify-content: center; width: 100%;">
                <div style="width: 100%; max-width: 800px;">
                    <div style="display: flex; width: 100%; flex-direction: column; align-items: flex-start; gap: 4px;">
                        <div style="display: flex; height: 56px; width: 100%; align-items: center; gap: 12px; border-radius: 12px; border: 1px solid #cbd5e1; background-color: #e2e8f0; padding: 12px 16px; font-weight: 400;">
                            <span>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="color: #334155;">
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M10.3958 15.2917C13.0997 15.2917 15.2917 13.0997 15.2917 10.3958C15.2917 7.69194 13.0997 5.5 10.3958 5.5C7.69194 5.5 5.5 7.69194 5.5 10.3958C5.5 13.0997 7.69194 15.2917 10.3958 15.2917ZM15.9135 14.5327C16.7789 13.3803 17.2917 11.948 17.2917 10.3958C17.2917 6.58737 14.2043 3.5 10.3958 3.5C6.58737 3.5 3.5 6.58737 3.5 10.3958C3.5 14.2043 6.58737 17.2917 10.3958 17.2917C11.9308 17.2917 13.3486 16.7902 14.4944 15.942L18.2721 19.7198C18.6627 20.1103 19.2958 20.1103 19.6864 19.7198C20.0769 19.3293 20.0769 18.6961 19.6864 18.3056L15.9135 14.5327ZM8.29175 8.9868C8.14054 9.21261 8.02685 9.46103 7.95476 9.72225C7.93307 9.80085 7.90219 9.87698 7.86329 9.94805C7.72252 10.2052 7.47677 10.3958 7.18177 10.3958C6.80524 10.3958 6.49393 10.0883 6.55949 9.71751C6.58084 9.59674 6.60785 9.47728 6.64035 9.35951C6.733 9.0238 6.87031 8.70183 7.04862 8.4024C7.21243 8.12732 7.41085 7.87127 7.64106 7.64106C7.87127 7.41085 8.12732 7.21243 8.4024 7.04862C8.70183 6.87031 9.0238 6.733 9.35952 6.64035C9.47728 6.60785 9.59674 6.58084 9.71751 6.55949C10.0883 6.49393 10.3958 6.80524 10.3958 7.18177C10.3958 7.47677 10.2052 7.72252 9.94805 7.86329C9.87699 7.90219 9.80085 7.93307 9.72225 7.95476C9.46103 8.02685 9.21261 8.14054 8.9868 8.29175C8.85068 8.3829 8.72277 8.48769 8.60523 8.60523C8.48769 8.72277 8.3829 8.85068 8.29175 8.9868Z" fill="currentColor"></path>
                                </svg>
                            </span>
                            <input type="text" placeholder="Tulis kata kunci" style="width: 100%; height: 100%; background: transparent; border: none; outline: none; font-size: 14px; color: #334155; padding-left: 8px;" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%; padding: 40px 24px;">
            <div style="width: 100%; max-width: 1140px; display: flex; flex-direction: column; gap: 56px;">
                
                <!-- KATEGORI SECTION -->
                <section style="display: flex; flex-direction: column; gap: 24px;">
                    <div style="display: flex; gap: 12px; align-items: center; font-weight: 700; color: #00213D; font-size: 24px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="color: #00213D;">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M23 12C23 18.0749 18.0749 23 12 23C5.92512 23 1 18.0749 1 12C1 5.92511 5.92512 0.999999 12 0.999999C18.0749 1 23 5.92512 23 12ZM12 21C16.9703 21 21 16.9703 21 12C21 7.02968 16.9703 3 12 3C7.02969 3 3 7.02968 3 12C3 16.9703 7.02968 21 12 21ZM10.8445 16.3003L10.8445 11.7221C10.8445 11.0846 11.3617 10.5667 12 10.5667C12.6383 10.5667 13.1555 11.0846 13.1555 11.7221L13.1555 16.3003C13.1555 16.9386 12.6383 17.4558 12 17.4558C11.3617 17.4558 10.8445 16.9386 10.8445 16.3003ZM12 9.30563C11.4383 9.30563 10.932 8.96735 10.7172 8.44859C10.5015 7.92983 10.6203 7.33219 11.0179 6.93531C11.4148 6.53765 12.0125 6.41891 12.5312 6.63375C13.0508 6.84859 13.389 7.35563 13.389 7.91735C13.389 8.28531 13.2422 8.63845 12.982 8.89939C12.7218 9.15955 12.3679 9.30563 12 9.30563L12 9.30563Z" fill="currentColor"></path>
                        </svg>
                        <span>Kategori</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
                        
                        <!-- CARD 1: Ocean by BCA -->
                        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 24px; min-height: 440px; display: flex; flex-direction: column; gap: 24px;">
                            <div style="display: flex; flex-direction: column; gap: 24px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;">
                                        <img src="https://main.ocean.bca.co.id/help-center/images/base-icon-category.svg?w=128&q=75" style="position: absolute; width: 56px; height: 56px;" />
                                        <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Ocean.svg" style="position: relative; width: 35px; object-fit: contain;" />
                                    </div>
                                    <span style="font-size: 20px; font-weight: 700; color: #00213D;">Ocean by BCA</span>
                                </div>
                                <span style="font-size: 16px; color: #475569; line-height: 1.5;">Platform bisnis yang dilengkapi dengan berbagai layanan digital yang optimalkan perkembangan bisnis Anda.</span>
                            </div>
                            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; margin-top: auto;">
                                <div style="display: grid; gap: 12px;">
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">BCA ID Bisnis</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Business Dashboard</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Form Leave Contact</a>
                                </div>
                                <a href="#" style="margin-top: 20px; display: flex; align-items: center; font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none; gap: 4px;">
                                    Selengkapnya <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                                </a>
                            </div>
                        </div>

                        <!-- CARD 2: myBCA Bisnis -->
                        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 24px; min-height: 440px; display: flex; flex-direction: column; gap: 24px;">
                            <div style="display: flex; flex-direction: column; gap: 24px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;">
                                        <img src="https://main.ocean.bca.co.id/help-center/images/base-icon-category.svg?w=128&q=75" style="position: absolute; width: 56px; height: 56px;" />
                                        <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/MBB.svg" style="position: relative; width: 35px; object-fit: contain;" />
                                    </div>
                                    <span style="font-size: 20px; font-weight: 700; color: #00213D;">myBCA Bisnis</span>
                                </div>
                                <span style="font-size: 16px; color: #475569; line-height: 1.5;">Internet banking yang dapat diakses melalui berbagai perangkat untuk melakukan transaksi perbankan kebutuhan bisnis Anda.</span>
                            </div>
                            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; margin-top: auto;">
                                <div style="display: grid; gap: 12px;">
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Aktivitas</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Host-to-Host</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Kenali Produk</a>
                                </div>
                                <a href="#" style="margin-top: 20px; display: flex; align-items: center; font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none; gap: 4px;">
                                    Selengkapnya <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                                </a>
                            </div>
                        </div>

                        <!-- CARD 3: Client Trade -->
                        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 24px; min-height: 440px; display: flex; flex-direction: column; gap: 24px;">
                            <div style="display: flex; flex-direction: column; gap: 24px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;">
                                        <img src="https://main.ocean.bca.co.id/help-center/images/base-icon-category.svg?w=128&q=75" style="position: absolute; width: 56px; height: 56px;" />
                                        <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-Client-Trade.svg" style="position: relative; width: 35px; object-fit: contain;" />
                                    </div>
                                    <span style="font-size: 20px; font-weight: 700; color: #00213D;">Client Trade</span>
                                </div>
                                <span style="font-size: 16px; color: #475569; line-height: 1.5;">Platform digital yang menyediakan keleluasaan dalam melakukan transaksi Trade untuk keperluan bisnis Anda.</span>
                            </div>
                            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; margin-top: auto;">
                                <div style="display: grid; gap: 12px;">
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Monitoring</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Proses</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Temukan Produk</a>
                                </div>
                                <a href="#" style="margin-top: 20px; display: flex; align-items: center; font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none; gap: 4px;">
                                    Selengkapnya <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                                </a>
                            </div>
                        </div>

                        <!-- CARD 4: EDC Layar Sentuh -->
                        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 24px; min-height: 440px; display: flex; flex-direction: column; gap: 24px;">
                            <div style="display: flex; flex-direction: column; gap: 24px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;">
                                        <img src="https://main.ocean.bca.co.id/help-center/images/base-icon-category.svg?w=128&q=75" style="position: absolute; width: 56px; height: 56px;" />
                                        <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-EDC-Layar-Sentuh.svg" style="position: relative; width: 35px; object-fit: contain;" />
                                    </div>
                                    <span style="font-size: 20px; font-weight: 700; color: #00213D;">EDC Layar Sentuh</span>
                                </div>
                                <span style="font-size: 16px; color: #475569; line-height: 1.5;">Perangkat pintar yang mengakomodasi semua metode pembayaran, mulai dari kartu, QRIS, hingga e-wallet sebagai solusi transaksi bisnis Anda.</span>
                            </div>
                            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; margin-top: auto;">
                                <div style="display: grid; gap: 12px;">
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Device</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Operasional</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">QRIS</a>
                                </div>
                                <a href="#" style="margin-top: 20px; display: flex; align-items: center; font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none; gap: 4px;">
                                    Selengkapnya <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                                </a>
                            </div>
                        </div>

                        <!-- CARD 5: myBCA Bisnis Lite -->
                        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 24px; min-height: 440px; display: flex; flex-direction: column; gap: 24px;">
                            <div style="display: flex; flex-direction: column; gap: 24px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;">
                                        <img src="https://main.ocean.bca.co.id/help-center/images/base-icon-category.svg?w=128&q=75" style="position: absolute; width: 56px; height: 56px;" />
                                        <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Icon_MBB_lite.png" style="position: relative; width: 35px; object-fit: contain;" />
                                    </div>
                                    <span style="font-size: 20px; font-weight: 700; color: #00213D;">myBCA Bisnis Lite</span>
                                </div>
                                <span style="font-size: 16px; color: #475569; line-height: 1.5;">myBCA Bisnis Lite adalah aplikasi <i>complementary</i> dari myBCA Bisnis untuk nasabah bisnis BCA melakukan aktivitas otorisasi dan menggunakan layanan token digital.</span>
                            </div>
                            <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; margin-top: auto;">
                                <div style="display: grid; gap: 12px;">
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Aktivasi</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Otorisasi</a>
                                    <a href="#" style="font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none;">Soft Token</a>
                                </div>
                                <a href="#" style="margin-top: 20px; display: flex; align-items: center; font-size: 16px; font-weight: 600; color: #005b9f; text-decoration: none; gap: 4px;">
                                    Selengkapnya <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                                </a>
                            </div>
                        </div>

                    </div>
                </section>

                <!-- ARTIKEL PILIHAN SECTION -->
                <section style="display: flex; flex-direction: column; gap: 24px;">
                    <div style="display: flex; gap: 12px; align-items: center; font-weight: 700; color: #00213D; font-size: 24px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="color: #00213D;">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M17 20.2H7C6.33726 20.2 5.8 19.6627 5.8 19V5C5.8 4.33726 6.33726 3.8 7 3.8H12.1V7C12.1 8.60163 13.3984 9.9 15 9.9H18.2V19C18.2 19.6627 17.6627 20.2 17 20.2ZM17.5544 8.1L15.7272 6.27279L13.9 4.44559V7C13.9 7.60751 14.3925 8.1 15 8.1H17.5544ZM4 5C4 3.34315 5.34315 2 7 2H13.1716C13.702 2 14.2107 2.21071 14.5858 2.58579L17 5L19.4142 7.41421C19.7893 7.78929 20 8.29799 20 8.82843V19C20 20.6569 18.6569 22 17 22H7C5.34315 22 4 20.6569 4 19V5ZM8.1 13C8.1 12.5029 8.50295 12.1 9 12.1H15C15.4971 12.1 15.9 12.5029 15.9 13C15.9 13.4971 15.4971 13.9 15 13.9H9C8.50295 13.9 8.1 13.4971 8.1 13ZM9 16.1C8.50295 16.1 8.1 16.5029 8.1 17C8.1 17.4971 8.50295 17.9 9 17.9H15C15.4971 17.9 15.9 17.4971 15.9 17C15.9 16.5029 15.4971 16.1 15 16.1H9Z" fill="currentColor"></path>
                        </svg>
                        <span>Artikel Pilihan</span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${[
                            "Apa saja dokumen yang dibutuhkan untuk pendaftaran myBCA Bisnis",
                            "Syarat untuk menjadi Nasabah myBCA Bisnis",
                            "Bagaimana cara menggunakan fitur Rekomendasi Produk",
                            "Kapan saya akan dihubungi oleh pihak BCA",
                            "Pengaturan Workflow oleh Sysadmin",
                            "Cara membuka pemblokiran pada User ID",
                            "Apa itu myBCA Bisnis",
                            "Apa itu BCA ID Bisnis",
                            "Bagaimana cara mendapatkan BCA ID Bisnis"
                        ].map(q => `
                        <div style="background: white;">
                            <button style="width: 100%; display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 20px 32px; border: none; background: transparent; border-bottom: 2px solid #e2e8f0; cursor: pointer; color: #475569; font-size: 20px; font-weight: 600;" onmouseover="this.style.color='#00213D';" onmouseout="this.style.color='#475569';">
                                <span>${q}</span>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="color: #005b9f;"><path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M12 5V19" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
                            </button>
                        </div>
                        `).join('')}
                    </div>
                </section>
            </div>
        </div>
        
        <div style="flex-grow: 1;"></div>
        
        <div style="height: 4px; width: 100%; background: linear-gradient(to right, #06b6d4, #5eead4);"></div>
        ${PublicFooter()}
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
                            <img src="https://ocean.bca.co.id/images/request.svg" class="title-icon-img" alt="Request Icon">
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
                            <img src="https://ocean.bca.co.id/images/history.svg" class="riwayat-icon-img" alt="History Icon">
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

const ArticlePage = () => `
    <div class="public-layout fade-in">
<section class="relative overflow-hidden bg-oceanV2-neutral-200 pt-4">
  <img class="pointer-events-none absolute left-0 right-0 top-0 w-full rotate-180 object-cover opacity-50" draggable="false" src="https://ocean.bca.co.id/images/bg/bg-pattern.png"/>
  <div class="container">
   <!--$-->
   <div class="relative w-full">
    <nav class="w-full rounded-xl border border-oceanV2-neutral-300 bg-oceanV2-neutral-100">
     <div class="swiper swiper-initialized swiper-horizontal swiper-free-mode !mx-0 !pl-4 !pr-0 swiper-backface-hidden">
      <div class="swiper-wrapper" style="transform: translate3d(0px, 0px, 0px);">
       <div class="swiper-slide swiper-slide-active !mr-auto !w-auto !ml-auto" style="margin-right: 1px;">
        <a class="lob block whitespace-nowrap px-3 py-3 text-oceanV2-neutral-600 hover:text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?lobTitleID=Umum&amp;lobTitleEN=General">
         Umum
         <!-- -->
        </a>
       </div>
       <div class="swiper-slide swiper-slide-next !mr-auto !w-auto" style="margin-right: 1px;">
        <a class="lob block whitespace-nowrap px-3 py-3 text-oceanV2-neutral-600 hover:text-oceanV2-primary-500" href="/id/article/c/d914ed58-48c1-43bb-bc0b-91db77ac9381?lobTitleID=Fashion &amp; Beauty&amp;lobTitleEN=Fashion &amp; Beauty">
         Fashion &amp; Beauty
         <!-- -->
        </a>
       </div>
       <div class="swiper-slide !mr-auto !w-auto" style="margin-right: 1px;">
        <a class="lob block whitespace-nowrap px-3 py-3 text-oceanV2-neutral-600 hover:text-oceanV2-primary-500" href="/id/article/c/5bcf60a5-2d54-4b1c-9d23-3071f14194a7?lobTitleID=Food &amp; Beverages&amp;lobTitleEN=Food &amp; Beverages">
         Food &amp; Beverages
         <!-- -->
        </a>
       </div>
       <div class="swiper-slide !mr-auto !w-auto" style="margin-right: 1px;">
        <a class="lob block whitespace-nowrap px-3 py-3 text-oceanV2-neutral-600 hover:text-oceanV2-primary-500" href="/id/article/c/e10a249e-35aa-45e3-9200-5b552b34ec88?lobTitleID=Institusi Finansial&amp;lobTitleEN=Financial Institutions">
         Institusi Finansial
         <!-- -->
        </a>
       </div>
       <div class="swiper-slide !mr-auto !w-auto" style="margin-right: 1px;">
        <a class="lob block whitespace-nowrap px-3 py-3 text-oceanV2-neutral-600 hover:text-oceanV2-primary-500" href="/id/article/c/0292f3eb-b030-400c-9db7-ff3a932ac884?lobTitleID=Kesehatan&amp;lobTitleEN=Healthcare">
         Kesehatan
         <!-- -->
        </a>
       </div>
       <div class="swiper-slide !mr-auto !w-auto" style="margin-right: 1px;">
        <a class="lob block whitespace-nowrap px-3 py-3 text-oceanV2-neutral-600 hover:text-oceanV2-primary-500" href="/id/article/c/ca2424aa-aefe-461b-9a0e-17b1f10d57af?lobTitleID=Logistik&amp;lobTitleEN=Logistic">
         Logistik
         <!-- -->
        </a>
       </div>
       <div class="swiper-slide !mr-auto !w-auto" style="margin-right: 1px;">
        <div class="relative">
         <button aria-expanded="false" aria-haspopup="true" class="flex items-center px-3 py-3 text-oceanV2-neutral-600 hover:text-oceanV2-primary-500/60">
          Lainnya
          <svg class="lucide lucide-chevron-down ml-1 h-4 w-4 transition-transform" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
           <path d="m6 9 6 6 6-6">
           </path>
          </svg>
         </button>
        </div>
       </div>
      </div>
     </div>
    </nav>
   </div>
   <!--/$-->
   <!--$-->
   <!--$-->
   <!--/$-->
   <!--$-->
   <section class="my-10">
    <section class="relative z-10">
     <div class="mb-[6px] flex items-center justify-between gap-4">
      <h3 class="flex items-center gap-2 text-xl font-bold text-oceanV2-primary-700">
       <img alt="" class="inline-block" src="https://ocean.bca.co.id/images/icons/icon--artikel-terkini.png"/>
       <p class="inline-block">
        Artikel Terkini
       </p>
      </h3>
      <a class="group inline-flex items-center gap-1 text-oceanV2-primary-500 transition-all duration-300 hover:text-oceanV2-primary-700" href="#articles">
       Lihat Semua
       <img alt="right" class="inline-block filter transition-transform duration-300 group-hover:brightness-[.60]" height="20" src="https://ocean.bca.co.id/icons/ArrowRight.svg" width="20"/>
      </a>
     </div>
     <p class="mb-6 text-oceanV2-neutral-700">
      Dapatkan informasi terbaru mengenai tren bisnis utama, wawasan strategis, dan perkembangan industri.
     </p>
     <div class="hidden h-full grid-cols-1 items-stretch gap-6 md:grid md:grid-cols-2 xl:grid-cols-3">
      <a class="hidden h-full w-full md:flex" href="/id/artikel/kelola-dan-monitor-keuangan-jadi-lebih-mudah-dengan-business-sub-account?article_id=b396f079-6d5f-4729-90e7-91d86f049fe1&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af&amp;source=landing">
       <div class="rounded-xl bg-card text-card-foreground group cursor-pointer flex-col justify-between overflow-hidden transition-all duration-300 hidden h-full w-full md:flex">
        <div>
         <div class="relative overflow-hidden">
          <div class="absolute left-4 top-4 z-10">
           <div class="items-center px-[14px] py-[8px] text-xs md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border rounded-xl block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap">
            Umum
           </div>
          </div>
          <div class="relative h-[106px] md:h-[248px] lg:h-[198px] lg:w-full xl:h-[212px] xl:w-full">
           <img alt="Kelola dan Monitor Keuangan jadi Lebih Mudah dengan Business Sub Account  " class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Gambar%20Background%20Artikel%20BSA%20Rupiah_ENG.png"/>
          </div>
         </div>
         <div class="flex flex-col space-y-1.5 p-6 pb-2 pt-4 transition-colors duration-300">
          <h3 class="line-clamp-3 text-base font-semibold leading-6 text-oceanV2-neutral-800 transition-colors duration-200 md:text-xl md:leading-7">
           Kelola dan Monitor Keuangan jadi Lebih Mudah dengan Business Sub Account
          </h3>
         </div>
         <div class="p-6 pt-0 transition-colors duration-300 pb-0">
          <p class="!line-clamp-3 text-sm text-oceanV2-neutral-700">
           BCA hadirkan Business Sub Account Rupiah untuk kelola keuangan bisnis lebih efektif. Buat hingga 1000 sub account dari 1 rekening utama, personalisasi fungsi, atur limit &amp; akses user, serta monitor mutasi dalam 1 laporan konsolidasi via myBCA Bisnis.
          </p>
         </div>
        </div>
        <div class="p-6 !mt-auto flex items-center gap-[3px] px-4 text-xs text-oceanV2-neutral-600 transition-colors duration-300 md:gap-2 pt-4">
         <img alt="clock" class="h-4 w-4 transition-colors duration-200 md:h-5 md:w-5 md:-translate-y-[1px]" src="https://ocean.bca.co.id/icons/clock.svg"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.12em]">
          3 MIN READ
         </span>
         <img alt="" class="mx-1 md:-translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.16em]">
          22 Mei 2026
         </span>
        </div>
       </div>
      </a>
      <a class="hidden h-full w-full xl:flex" href="/id/artikel/jual-beli-valas-dengan-mudah-untuk-transaksi-keuangan-yang-lebih-efisien?article_id=9646b0eb-dd3f-4672-bf3c-1fc2c918f679&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af&amp;source=landing">
       <div class="rounded-xl bg-card text-card-foreground group cursor-pointer flex-col justify-between overflow-hidden transition-all duration-300 hidden h-full w-full xl:flex">
        <div>
         <div class="relative overflow-hidden">
          <div class="absolute left-4 top-4 z-10">
           <div class="items-center px-[14px] py-[8px] text-xs md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border rounded-xl block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap">
            Umum
           </div>
          </div>
          <div class="relative h-[106px] md:h-[248px] lg:h-[198px] lg:w-full xl:h-[212px] xl:w-full">
           <img alt="Jual Beli Valas Dengan Mudah untuk Transaksi Keuangan yang Lebih Efisien" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Jual_Beli_Valas_myBCA_Bisnis.jpg"/>
          </div>
         </div>
         <div class="flex flex-col space-y-1.5 p-6 pb-2 pt-4 transition-colors duration-300">
          <h3 class="line-clamp-3 text-base font-semibold leading-6 text-oceanV2-neutral-800 transition-colors duration-200 md:text-xl md:leading-7">
           Jual Beli Valas Dengan Mudah untuk Transaksi Keuangan yang Lebih Efisien
          </h3>
         </div>
         <div class="p-6 pt-0 transition-colors duration-300 pb-0">
          <p class="!line-clamp-3 text-sm text-oceanV2-neutral-700">
           Dalam era globalisasi, kebutuhan transaksi lintas mata uang (valuta asing/valas) menjadi semakin penting bagi pelaku usaha
          </p>
         </div>
        </div>
        <div class="p-6 !mt-auto flex items-center gap-[3px] px-4 text-xs text-oceanV2-neutral-600 transition-colors duration-300 md:gap-2 pt-4">
         <img alt="clock" class="h-4 w-4 transition-colors duration-200 md:h-5 md:w-5 md:-translate-y-[1px]" src="https://ocean.bca.co.id/icons/clock.svg"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.12em]">
          3 MIN READ
         </span>
         <img alt="" class="mx-1 md:-translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.16em]">
          11 Mei 2026
         </span>
        </div>
       </div>
      </a>
      <div class="h-[470px] overflow-auto rounded-[12px] bg-oceanV2-neutral-100 py-6 pl-6 pr-2 shadow">
       <div class="rounded-xl bg-card text-card-foreground w-full textarea-scroll hidden h-full overflow-auto md:block">
        <div class="space-y-6 p-0">
         <div class="space-y-1">
          <a class="text-sm font-medium uppercase tracking-wide text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?source=landing">
           Umum
          </a>
          <a class="!line-clamp-3 block text-lg font-semibold text-oceanV2-neutral-800 hover:text-oceanV2-primary-500" href="/id/artikel/jual-beli-valas-dengan-mudah-untuk-transaksi-keuangan-yang-lebih-efisien?source=landing&amp;article_id=9646b0eb-dd3f-4672-bf3c-1fc2c918f679&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af">
           Jual Beli Valas Dengan Mudah untuk Transaksi Keuangan yang Lebih Efisien
          </a>
         </div>
         <div class="space-y-1">
          <a class="text-sm font-medium uppercase tracking-wide text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?source=landing">
           Umum
          </a>
          <a class="!line-clamp-3 block text-lg font-semibold text-oceanV2-neutral-800 hover:text-oceanV2-primary-500" href="/id/artikel/pentingnya-verifikasi-berlapis-untuk-transaksi-korporasi?source=landing&amp;article_id=16c90baa-a526-4050-904f-66fcfd9019d0&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af">
           Pentingnya Verifikasi Berlapis untuk Transaksi Korporasi
          </a>
         </div>
         <div class="space-y-1">
          <a class="text-sm font-medium uppercase tracking-wide text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?source=landing">
           Umum
          </a>
          <a class="!line-clamp-3 block text-lg font-semibold text-oceanV2-neutral-800 hover:text-oceanV2-primary-500" href="/id/artikel/Mengelola_AI_Secara_Bertanggung_Jawab_Langkah_BCA_Menuju_Keberlanjutan_Digital?source=landing&amp;article_id=3d81ab37-d991-4ded-ae2e-73a4975052c8&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af">
           Mengelola AI Secara Bertanggung Jawab: Langkah BCA Menuju Keberlanjutan Digital
          </a>
         </div>
         <div class="space-y-1">
          <a class="text-sm font-medium uppercase tracking-wide text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?source=landing">
           Umum
          </a>
          <a class="!line-clamp-3 block text-lg font-semibold text-oceanV2-neutral-800 hover:text-oceanV2-primary-500" href="/id/artikel/strategi-mencari-mitra-bisnis?source=landing&amp;article_id=2e111735-ae5b-4c00-bb32-eb2dbd4938c3&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af">
           Ini Strategi Jitu Mencari Mitra Bisnis yang Tepat untuk Usaha Anda
          </a>
         </div>
         <div class="space-y-1">
          <a class="text-sm font-medium uppercase tracking-wide text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?source=landing">
           Umum
          </a>
          <a class="!line-clamp-3 block text-lg font-semibold text-oceanV2-neutral-800 hover:text-oceanV2-primary-500" href="/id/artikel/definisi-omnichannel?source=landing&amp;article_id=a147b4d6-f762-42b8-89e2-b349a3cd30aa&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af">
           Mengenal Omnichannel: Definisi, Jenis, Cara Kerja, dan Contoh Penerapannya
          </a>
         </div>
         <div class="space-y-1">
          <a class="text-sm font-medium uppercase tracking-wide text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?source=landing">
           Umum
          </a>
          <a class="!line-clamp-3 block text-lg font-semibold text-oceanV2-neutral-800 hover:text-oceanV2-primary-500" href="/id/artikel/pengertian-payment-gateway?source=landing&amp;article_id=70a9de84-649d-4505-868a-aeabc40ffaad&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af">
           Serba-Serbi tentang Payment Gateway yang Perlu Anda Pahami
          </a>
         </div>
         <div class="space-y-1">
          <a class="text-sm font-medium uppercase tracking-wide text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?source=landing">
           Umum
          </a>
          <a class="!line-clamp-3 block text-lg font-semibold text-oceanV2-neutral-800 hover:text-oceanV2-primary-500" href="/id/artikel/environmental-social-and-governance?source=landing&amp;article_id=4a9ae585-361d-4541-a69f-bedf1f91a720&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af">
           Mengenal ESG (Environmental, Social, and Governance): Pilar Pembangunan Berkelanjutan
          </a>
         </div>
         <div class="space-y-1">
          <a class="text-sm font-medium uppercase tracking-wide text-oceanV2-primary-500" href="/id/article/c/5d1cedf0-a0ed-4112-a636-b70446c495af?source=landing">
           Umum
          </a>
          <a class="!line-clamp-3 block text-lg font-semibold text-oceanV2-neutral-800 hover:text-oceanV2-primary-500" href="/id/artikel/pentingnya-kredit-sepeda-motor-untuk-perkembangan-bisnis?source=landing&amp;article_id=0ada2dd8-e5fc-4c0f-9770-9fa262dc188d&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af">
           Pentingnya Kredit Sepeda Motor untuk Perkembangan Bisnis
          </a>
         </div>
        </div>
       </div>
      </div>
     </div>
     <div class="scrollbar-hide flex w-full gap-4 overflow-auto md:hidden">
      <a class="w-full" href="/id/artikel/kelola-dan-monitor-keuangan-jadi-lebih-mudah-dengan-business-sub-account?article_id=b396f079-6d5f-4729-90e7-91d86f049fe1&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af&amp;source=landing">
       <div class="rounded-xl bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden transition-all duration-300 w-full">
        <div>
         <div class="relative overflow-hidden">
          <div class="absolute left-4 top-4 z-10">
           <div class="items-center px-[14px] py-[8px] text-xs md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border rounded-xl block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap">
            Umum
           </div>
          </div>
          <div class="relative h-[106px] min-w-[220px] sm:min-w-auto md:h-[248px] lg:h-[198px] lg:w-full xl:h-[212px] xl:w-full">
           <img alt="Kelola dan Monitor Keuangan jadi Lebih Mudah dengan Business Sub Account  " class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Gambar%20Background%20Artikel%20BSA%20Rupiah_ENG.png"/>
          </div>
         </div>
         <div class="flex flex-col space-y-1.5 p-6 pb-2 pt-4 transition-colors duration-300">
          <h3 class="line-clamp-3 text-base font-semibold leading-6 text-oceanV2-neutral-800 transition-colors duration-200 md:text-xl md:leading-7">
           Kelola dan Monitor Keuangan jadi Lebih Mudah dengan Business Sub Account
          </h3>
         </div>
         <div class="p-6 pt-0 pb-8 transition-colors duration-300">
          <p class="!line-clamp-3 text-sm text-oceanV2-neutral-700 !hidden md:block">
           BCA hadirkan Business Sub Account Rupiah untuk kelola keuangan bisnis lebih efektif. Buat hingga 1000 sub account dari 1 rekening utama, personalisasi fungsi, atur limit &amp; akses user, serta monitor mutasi dalam 1 laporan konsolidasi via myBCA Bisnis.
          </p>
         </div>
        </div>
        <div class="p-6 !mt-auto flex items-center gap-[3px] px-4 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300 md:gap-2">
         <img alt="clock" class="h-4 w-4 transition-colors duration-200 md:h-5 md:w-5 md:-translate-y-[1px]" src="https://ocean.bca.co.id/icons/clock.svg"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.12em]">
          3 MIN READ
         </span>
         <img alt="" class="mx-1 md:-translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.16em]">
          22 Mei 2026
         </span>
        </div>
       </div>
      </a>
      <a class="w-full" href="/id/artikel/jual-beli-valas-dengan-mudah-untuk-transaksi-keuangan-yang-lebih-efisien?article_id=9646b0eb-dd3f-4672-bf3c-1fc2c918f679&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af&amp;source=landing">
       <div class="rounded-xl bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden transition-all duration-300 w-full">
        <div>
         <div class="relative overflow-hidden">
          <div class="absolute left-4 top-4 z-10">
           <div class="items-center px-[14px] py-[8px] text-xs md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border rounded-xl block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap">
            Umum
           </div>
          </div>
          <div class="relative h-[106px] min-w-[220px] sm:min-w-auto md:h-[248px] lg:h-[198px] lg:w-full xl:h-[212px] xl:w-full">
           <img alt="Jual Beli Valas Dengan Mudah untuk Transaksi Keuangan yang Lebih Efisien" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Jual_Beli_Valas_myBCA_Bisnis.jpg"/>
          </div>
         </div>
         <div class="flex flex-col space-y-1.5 p-6 pb-2 pt-4 transition-colors duration-300">
          <h3 class="line-clamp-3 text-base font-semibold leading-6 text-oceanV2-neutral-800 transition-colors duration-200 md:text-xl md:leading-7">
           Jual Beli Valas Dengan Mudah untuk Transaksi Keuangan yang Lebih Efisien
          </h3>
         </div>
         <div class="p-6 pt-0 pb-8 transition-colors duration-300">
          <p class="!line-clamp-3 text-sm text-oceanV2-neutral-700 !hidden md:block">
           Dalam era globalisasi, kebutuhan transaksi lintas mata uang (valuta asing/valas) menjadi semakin penting bagi pelaku usaha
          </p>
         </div>
        </div>
        <div class="p-6 !mt-auto flex items-center gap-[3px] px-4 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300 md:gap-2">
         <img alt="clock" class="h-4 w-4 transition-colors duration-200 md:h-5 md:w-5 md:-translate-y-[1px]" src="https://ocean.bca.co.id/icons/clock.svg"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.12em]">
          3 MIN READ
         </span>
         <img alt="" class="mx-1 md:-translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.16em]">
          11 Mei 2026
         </span>
        </div>
       </div>
      </a>
      <a class="w-full md:block" href="/id/artikel/pentingnya-verifikasi-berlapis-untuk-transaksi-korporasi?article_id=16c90baa-a526-4050-904f-66fcfd9019d0&amp;lob_id=5d1cedf0-a0ed-4112-a636-b70446c495af&amp;source=landing">
       <div class="rounded-xl bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden transition-all duration-300 w-full md:block">
        <div>
         <div class="relative overflow-hidden">
          <div class="absolute left-4 top-4 z-10">
           <div class="items-center px-[14px] py-[8px] text-xs md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border rounded-xl block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap">
            Umum
           </div>
          </div>
          <div class="relative h-[106px] min-w-[220px] sm:min-w-auto md:h-[248px] lg:h-[198px] lg:w-full xl:h-[212px] xl:w-full">
           <img alt="Pentingnya Verifikasi Berlapis untuk Transaksi Korporasi " class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Verifikasi_Login_myBCA_Bisnis_OTP_Email.jpg"/>
          </div>
         </div>
         <div class="flex flex-col space-y-1.5 p-6 pb-2 pt-4 transition-colors duration-300">
          <h3 class="line-clamp-3 text-base font-semibold leading-6 text-oceanV2-neutral-800 transition-colors duration-200 md:text-xl md:leading-7">
           Pentingnya Verifikasi Berlapis untuk Transaksi Korporasi
          </h3>
         </div>
         <div class="p-6 pt-0 pb-8 transition-colors duration-300">
          <p class="!line-clamp-3 text-sm text-oceanV2-neutral-700 !hidden md:block">
           Di era digital ini, kegiatan dan transaksi bisnis bertumbuh pesat dan menjadi salah satu penopang utama perekonomian Indonesia.
          </p>
         </div>
        </div>
        <div class="p-6 !mt-auto flex items-center gap-[3px] px-4 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300 md:gap-2">
         <img alt="clock" class="h-4 w-4 transition-colors duration-200 md:h-5 md:w-5 md:-translate-y-[1px]" src="https://ocean.bca.co.id/icons/clock.svg"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.12em]">
          2 MIN READ
         </span>
         <img alt="" class="mx-1 md:-translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
         <span class="whitespace-nowrap uppercase transition-all duration-200 md:tracking-[0.16em]">
          08 Mei 2026
         </span>
        </div>
       </div>
      </a>
     </div>
    </section>
   </section>
   <!--/$-->
   <!--$-->
   <section class="my-10">
   </section>
   <!--/$-->
   <!--$-->
   <section class="my-10">
    <div class="relative z-10 rounded-xl bg-oceanV2-neutral-100 shadow" id="articles">
     <div class="flex items-center gap-2 border-b p-4 pb-4">
      <img alt="" src="https://ocean.bca.co.id/images/icons/icon--semua-artikel.png"/>
      <h2 class="text-lg font-bold text-oceanV2-primary-700">
       Semua Artikel
      </h2>
     </div>
     <div class="grid grid-cols-1 md:grid-cols-2 md:gap-1 md:p-1 xl:grid-cols-3 xl:p-4 2xl:p-3" id="article-list">
      <div>
       <a class="" href="/id/artikel/kelola-dan-monitor-keuangan-jadi-lebih-mudah-dengan-business-sub-account?source=landing&amp;article_id=b396f079-6d5f-4729-90e7-91d86f049fe1&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Kelola dan Monitor Keuangan jadi Lebih Mudah dengan Business Sub Account  " class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Gambar%20Background%20Artikel%20BSA%20Rupiah_ENG.png"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Kelola dan Monitor Keuangan jadi Lebih Mudah dengan Business Sub Account
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            BCA hadirkan Business Sub Account Rupiah untuk kelola keuangan bisnis lebih efektif. Buat hingga 1000 sub account dari 1 rekening utama, personalisasi fungsi, atur limit &amp; akses user, serta monitor mutasi dalam 1 laporan konsolidasi via myBCA Bisnis.
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           3
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           22 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden">
      </div>
      <div>
       <a class="" href="/id/artikel/jual-beli-valas-dengan-mudah-untuk-transaksi-keuangan-yang-lebih-efisien?source=landing&amp;article_id=9646b0eb-dd3f-4672-bf3c-1fc2c918f679&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Jual Beli Valas Dengan Mudah untuk Transaksi Keuangan yang Lebih Efisien" class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Jual_Beli_Valas_myBCA_Bisnis.jpg"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Jual Beli Valas Dengan Mudah untuk Transaksi Keuangan yang Lebih Efisien
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            Dalam era globalisasi, kebutuhan transaksi lintas mata uang (valuta asing/valas) menjadi semakin penting bagi pelaku usaha
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           3
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           11 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden">
      </div>
      <div>
       <a class="" href="/id/artikel/pentingnya-verifikasi-berlapis-untuk-transaksi-korporasi?source=landing&amp;article_id=16c90baa-a526-4050-904f-66fcfd9019d0&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Pentingnya Verifikasi Berlapis untuk Transaksi Korporasi " class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Verifikasi_Login_myBCA_Bisnis_OTP_Email.jpg"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Pentingnya Verifikasi Berlapis untuk Transaksi Korporasi
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            Di era digital ini, kegiatan dan transaksi bisnis bertumbuh pesat dan menjadi salah satu penopang utama perekonomian Indonesia.
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           2
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           08 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden">
      </div>
      <div>
       <a class="" href="/id/artikel/Mengelola_AI_Secara_Bertanggung_Jawab_Langkah_BCA_Menuju_Keberlanjutan_Digital?source=landing&amp;article_id=3d81ab37-d991-4ded-ae2e-73a4975052c8&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Mengelola AI Secara Bertanggung Jawab: Langkah BCA Menuju Keberlanjutan Digital" class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Mengelola_AI_dengan_Tanggung_Jawab.jpeg"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Mengelola AI Secara Bertanggung Jawab: Langkah BCA Menuju Keberlanjutan Digital
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            Di tengah pesatnya perkembangan teknologi, kecerdasan buatan atau artificial intelligence (AI) kini bukan lagi sekadar alat inovasi, ia telah menjadi bagian dari infrastruktur bisnis yang menentukan arah masa depan.
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           3
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           07 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden">
      </div>
      <div>
       <a class="" href="/id/artikel/strategi-mencari-mitra-bisnis?source=landing&amp;article_id=2e111735-ae5b-4c00-bb32-eb2dbd4938c3&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Ini Strategi Jitu Mencari Mitra Bisnis yang Tepat untuk Usaha Anda" class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/September%202025/Mitra%20Bisnis%20Perusahaan.jpg"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Ini Strategi Jitu Mencari Mitra Bisnis yang Tepat untuk Usaha Anda
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            Dalam memilih mitra bisnis, ada beberapa hal yang perlu dipertimbangkan oleh Anda seperti reputasi dan kredibilitas mitra hingga track record-nya seperti apa
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           4
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           06 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden">
      </div>
      <div>
       <a class="" href="/id/artikel/definisi-omnichannel?source=landing&amp;article_id=a147b4d6-f762-42b8-89e2-b349a3cd30aa&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Mengenal Omnichannel: Definisi, Jenis, Cara Kerja, dan Contoh Penerapannya" class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/September%202025/Omnichannel%20Bisnis.jpg?v=1777972365953"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Mengenal Omnichannel: Definisi, Jenis, Cara Kerja, dan Contoh Penerapannya
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            Omnichannel adalah strategi marketing yang menghubungkan semua platform bisnis, baik itu online atau offline untuk mendapatkan perhatian lebih dari pelanggan
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           3
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           06 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden">
      </div>
      <div>
       <a class="" href="/id/artikel/pengertian-payment-gateway?source=landing&amp;article_id=70a9de84-649d-4505-868a-aeabc40ffaad&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Serba-Serbi tentang Payment Gateway yang Perlu Anda Pahami" class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/September%202025/Definisi%20Payment%20Gateway.jpg"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Serba-Serbi tentang Payment Gateway yang Perlu Anda Pahami
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            Payment gateway adalah layanan yang berfungsi sebagai perantara dalam proses pembayaran digital. Ada beragam jenis mulai dari hosted hingga self hosted.
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           4
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           06 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden">
      </div>
      <div>
       <a class="" href="/id/artikel/environmental-social-and-governance?source=landing&amp;article_id=4a9ae585-361d-4541-a69f-bedf1f91a720&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Mengenal ESG (Environmental, Social, and Governance): Pilar Pembangunan Berkelanjutan" class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/September%202025/Environmental,%20Social,%20and%20Governance%20(ESG).jpg"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Mengenal ESG (Environmental, Social, and Governance): Pilar Pembangunan Berkelanjutan
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            Pelajari apa itu ESG (Environmental, Social, dan Governance) dan perannya sebagai pilar penting dalam mewujudkan pembangunan berkelanjutan untuk ekosistem bisnis yang baik
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           3
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           06 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden">
      </div>
      <div>
       <a class="" href="/id/artikel/pentingnya-kredit-sepeda-motor-untuk-perkembangan-bisnis?source=landing&amp;article_id=0ada2dd8-e5fc-4c0f-9770-9fa262dc188d&amp;lob_id=d38fbdeb-7eb6-49c3-a4dc-f838c6d6d2fa">
        <div class="bg-card text-card-foreground group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-none p-4 transition-all duration-300 md:h-[440px] md:p-5 xl:h-[460px] 2xl:h-[440px]">
         <div>
          <div class="relative overflow-hidden">
           <div class="absolute left-4 top-4 z-10">
            <div class="items-center px-[14px] py-[8px] md:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-black/50 text-oceanV2-neutral-100 filter backdrop-blur-2xl border border-oceanV2-neutral-100/50 box-border block max-w-[160px] !overflow-hidden truncate !text-ellipsis !whitespace-nowrap rounded-[12px] text-xs">
             Umum
            </div>
           </div>
           <div class="relative overflow-hidden rounded-[8px]">
            <img alt="Pentingnya Kredit Sepeda Motor untuk Perkembangan Bisnis" class="h-[164px] w-full object-cover transition-transform duration-500 group-hover:scale-zoom-in-img sm:h-[281.2px] md:h-[199px] lg:h-[198.82px] xl:h-[212px]" sizes="(max-width: 768px) 100vw, 384px" src="https://pustaka.bca.co.id/Ocean/Business%20News/Juli%202025/Kredit%20Sepeda%20Motor.jpg"/>
           </div>
          </div>
          <div class="flex flex-col space-y-1.5 p-6 px-0 pb-2 pt-4 transition-colors duration-300">
           <h3 class="line-clamp-3 text-xl font-semibold leading-[27px] text-oceanV2-neutral-800 transition-colors duration-200">
            Pentingnya Kredit Sepeda Motor untuk Perkembangan Bisnis
           </h3>
          </div>
          <div class="p-6 pt-0 px-0 pb-5 transition-colors duration-300 md:pb-0">
           <p class="line-clamp-3 text-sm leading-5 text-oceanV2-neutral-700">
            Syarat mengajukan kredit sepeda motor untuk bisnis cukup mudah. Anda tinggal menyiapkan beberapa dokumen penunjang serta riwayat kredit. Simak selengkapnya!
           </p>
          </div>
         </div>
         <div class="p-6 !mt-auto flex items-center gap-2 px-0 pb-0 pt-0 text-xs text-oceanV2-neutral-600 transition-colors duration-300">
          <img alt="clock" class="-translate-y-[1px] transition-colors duration-200" height="20" src="https://ocean.bca.co.id/icons/clock.svg" width="20"/>
          <span class="font-semibold uppercase tracking-[0.12em] transition-all duration-200">
           4
           <!-- -->
           MIN READ
          </span>
          <img alt="" class="mx-1 -translate-y-[1px]" height="4" src="https://ocean.bca.co.id/icons/circle-divider.svg" width="4"/>
          <span class="font-semibold uppercase tracking-[0.16em] transition-all duration-200">
           05 Mei 2026
          </span>
         </div>
        </div>
       </a>
      </div>
      <div class="mx-auto my-1 h-[1px] w-[calc(100%-32px)] bg-oceanV2-neutral-300 md:hidden hidden">
      </div>
     </div>
     <div class="flex items-center px-3 py-8 md:justify-between md:gap-4 md:px-6">
      <div class="hidden break-words text-base font-semibold text-oceanV2-neutral-600 md:block">
       Menampilkan data
       <!-- -->
       <!-- -->
       1
       <!-- -->
       -
       <!-- -->
       <!-- -->
       9
       <!-- -->
       <!-- -->
       dari
       <!-- -->
       <!-- -->
       111
      </div>
      <div class="mx-auto flex items-center justify-center gap-1 sm:!ml-auto sm:!mr-0 md:mx-0 font-bold">
       <button aria-label="First page" class="flex h-6 w-6 items-center justify-center rounded-md text-sm text-oceanV2-primary-500 disabled:text-oceanV2-neutral-600 md:h-8 md:w-8 cursor-not-allowed opacity-50" disabled="">
        <svg class="lucide lucide-chevrons-left h-6 w-6 md:h-8 md:w-8" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
         <path d="m11 17-5-5 5-5">
         </path>
         <path d="m18 17-5-5 5-5">
         </path>
        </svg>
       </button>
       <button aria-label="Previous page" class="flex h-6 w-6 items-center justify-center rounded-md text-sm text-oceanV2-primary-500 disabled:text-oceanV2-neutral-600 md:h-8 md:w-8 cursor-not-allowed opacity-50" disabled="">
        <svg class="lucide lucide-chevron-left h-6 w-6 md:h-7 md:w-7" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
         <path d="m15 18-6-6 6-6">
         </path>
        </svg>
       </button>
       <div class="flex items-center gap-1">
        <button aria-current="page" aria-label="Page 1" class="flex h-6 w-6 items-center justify-center rounded-sm text-sm hover:text-oceanV2-primary-500 md:h-8 md:w-8 bg-oceanV2-secondary-100 text-oceanV2-primary-500">
         1
        </button>
        <button aria-label="Page 2" class="flex h-6 w-6 items-center justify-center rounded-sm text-sm text-oceanV2-neutral-600 hover:text-oceanV2-primary-500 md:h-8 md:w-8">
         2
        </button>
        <button aria-label="Page 3" class="flex h-6 w-6 items-center justify-center rounded-sm text-sm text-oceanV2-neutral-600 hover:text-oceanV2-primary-500 md:h-8 md:w-8">
         3
        </button>
        <button aria-label="Page 4" class="flex h-6 w-6 items-center justify-center rounded-sm text-sm text-oceanV2-neutral-600 hover:text-oceanV2-primary-500 md:h-8 md:w-8">
         4
        </button>
        <button aria-label="Page 5" class="flex h-6 w-6 items-center justify-center rounded-sm text-sm text-oceanV2-neutral-600 hover:text-oceanV2-primary-500 md:h-8 md:w-8">
         5
        </button>
        <span class="px-1 text-oceanV2-neutral-600">
         ...
        </span>
        <button aria-label="Page 13" class="flex h-6 w-6 items-center justify-center rounded-sm text-sm text-oceanV2-neutral-600 hover:text-oceanV2-primary-500 md:h-8 md:w-8">
         13
        </button>
       </div>
       <button aria-label="Next page" class="flex h-6 w-6 items-center justify-center rounded-md text-sm text-oceanV2-primary-500 disabled:text-oceanV2-neutral-600 md:h-8 md:w-8 hover:bg-gray-100">
        <svg class="lucide lucide-chevron-right h-6 w-6 md:h-7 md:w-7" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
         <path d="m9 18 6-6-6-6">
         </path>
        </svg>
       </button>
       <button aria-label="Last page" class="flex h-6 w-6 items-center justify-center rounded-md text-sm text-oceanV2-primary-500 disabled:text-oceanV2-neutral-600 md:h-8 md:w-8 hover:bg-gray-100">
        <svg class="lucide lucide-chevrons-right h-6 w-6 md:h-8 md:w-8" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
         <path d="m6 17 5-5-5-5">
         </path>
         <path d="m13 17 5-5-5-5">
         </path>
        </svg>
       </button>
      </div>
     </div>
    </div>
   </section>
   <!--/$-->
   <!--/$-->
   <!--$-->
   <!--/$-->
   <div class="relative z-20 mb-16 flex w-full flex-col overflow-hidden rounded-lg shadow-lg xl:flex-row">
    <div class="relative h-[150px] w-full shrink-0 overflow-hidden bg-[#0a1a3a] sm:h-[238px] md:h-[364px] xl:h-[300px] xl:w-[560px] 2xl:w-[750px]">
     <img alt="" class="h-full w-full object-cover" src="https://pustaka.bca.co.id/Ocean/Homepage/image-cta.svg"/>
    </div>
    <div class="flex w-full flex-col justify-between bg-oceanV2-neutral-100 p-6">
     <h2 class="mb-2 text-base font-semibold text-oceanV2-primary-700 md:text-2xl">
      Temukan rekomendasi produk yang sesuai untuk tingkatkan bisnis Anda
     </h2>
     <div class="mt-4">
      <a class="inline-flex items-center rounded-full bg-oceanV2-primary-500 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1179D1] focus:bg-[#144E83] active:bg-[#144E83] md:text-base" href="https://main.ocean.bca.co.id/visitor/product" target="_blank">
       Pelajari
       <svg class="lucide lucide-arrow-right ml-1" fill="none" height="12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24" width="12" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 12h14">
        </path>
        <path d="m12 5 7 7-7 7">
        </path>
       </svg>
      </a>
     </div>
    </div>
   </div>
  </div>
 </section>
 <div class="lui-h-1 lui-w-full lui-bg-gradient-to-r lui-from-cyan-500 lui-to-teal-300">
 </div>
 <footer class="lui-flex lui-w-full lui-flex-col lui-items-center lui-bg-oceanV2-primary-800 lui-bg-cover lui-bg-center lui-bg-no-repeat lui-p-4 md:!lui-p-8" style="background-image:url(data:image/jpeg;base64,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)">
  <div class="lui-flex lui-flex-col lui-items-center lui-gap-6 md:!lui-items-start">
   <div class="lui-bg-[linear-gradient(rgba(0, 44, 75, 0.7), rgba(0, 44, 75, 0.7))] lui-flex lui-w-full lui-max-w-[1200px] lui-flex-col lui-gap-[40px] lui-rounded-[10px] lui-border-2 lui-border-[#015C8F] lui-p-6 lui-shadow-lg lui-backdrop-blur-md md:!lui-flex-row">
    <div class="lui-mx-auto lui-grid lui-w-full lui-grid-cols-1 lui-gap-6 lui-text-center lui-text-white/80 md:!lui-grid-cols-3 md:!lui-gap-y-8 1280px:!lui-grid-cols-5">
     <div class="lui-flex lui-flex-col lui-items-center md:!lui-items-start">
      <img alt="Ocean by BCA" class="lui-w-[130px]" src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-Ocean-by-BCA-white.png"/>
     </div>
     <div class="lui-hidden 1280px:-lui-ml-14 1280px:!lui-grid 1280px:!lui-grid-cols-1 1280px:!lui-gap-6">
      <div class="lui-flex lui-flex-col lui-gap-2 lui-text-sm md:!lui-text-left">
       <p>
        Kantor Pusat
       </p>
       <div>
        Menara BCA, Grand Indonesia
        <!-- -->
        ,
        <span class="md:!lui-hidden">
         Jl. MH Thamrin No. 1
         <!-- -->
        </span>
        <span class="md:!lui-hidden">
         Jakarta 10310
        </span>
        <p class="lui-hidden md:!lui-block">
         Jl. MH Thamrin No. 1
        </p>
       </div>
       <p class="lui-hidden md:!lui-block">
        Jakarta 10310
       </p>
      </div>
      <div class="lui-flex lui-flex-col lui-items-center lui-gap-4 lui-text-white md:!lui-items-start">
       <a class="lui-flex lui-items-start lui-gap-2 lui-text-start lui-text-sm" href="tel:1500998">
        <svg class="lui-size-5 lui-flex-none" fill="none" height="24" viewbox="0 0 24 24" width="24">
         <path clip-rule="evenodd" d="M9.07237 10.9275C13.1886 15.0437 13.7261 9.69528 15.8383 11.806C17.8746 13.8417 18.6531 14.2835 16.2765 16.6601C13.8998 19.0368 10.1277 17.2752 6.42622 13.5736C2.72473 9.8721 0.963144 6.09992 3.33977 3.72327C5.7164 1.34661 6.15756 2.12574 8.19385 4.16148C10.306 6.27309 4.95614 6.81119 9.07237 10.9275Z" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">
         </path>
        </svg>
        <span>
         Halo BCA Bisnis | 1500998
        </span>
       </a>
       <a class="lui-flex lui-items-center lui-gap-2 lui-text-sm" href="mailto:halobca@bca.co.id">
        <svg class="lui-size-5 lui-flex-none" fill="none" height="24" viewbox="0 0 24 24" width="24">
         <path d="M10.2422 3.125C11.2003 3.125 12.0836 3.2706 12.8916 3.56152C13.6997 3.85252 14.3985 4.26108 14.9873 4.78711C15.5876 5.31313 16.0498 5.93412 16.373 6.65039C16.7078 7.36669 16.875 8.15038 16.875 9.00098C16.875 9.81803 16.7129 10.551 16.3896 11.2002C16.0664 11.8381 15.6222 12.3416 15.0566 12.7109C14.5025 13.0803 13.8672 13.2656 13.1514 13.2656C12.6782 13.2656 12.2681 13.1707 11.9219 12.9805C11.5872 12.7903 11.3394 12.5324 11.1777 12.208C10.9353 12.5214 10.606 12.779 10.1904 12.9805C9.77491 13.1707 9.3246 13.2656 8.83984 13.2656C8.30889 13.2656 7.83548 13.148 7.41992 12.9131C7.01585 12.6669 6.69264 12.3306 6.4502 11.9053C6.21933 11.4688 6.10352 10.9761 6.10352 10.4277C6.10357 9.67799 6.27072 9.00619 6.60547 8.41309C6.94026 7.81995 7.39643 7.35528 7.97363 7.01953C8.56242 6.67257 9.22696 6.5 9.96582 6.5C10.3697 6.50005 10.7275 6.56691 11.0391 6.70117C11.3507 6.83546 11.5814 7.0145 11.7314 7.23828L11.8184 6.65039H13.6709L12.9609 10.3613C12.9033 10.7081 12.9214 10.9876 13.0137 11.2002C13.1176 11.4016 13.2908 11.5029 13.5332 11.5029C13.9486 11.5028 14.2953 11.2614 14.5723 10.7803C14.8607 10.2991 15.0049 9.71127 15.0049 9.01758C15.0048 8.22302 14.7964 7.51786 14.3809 6.90234C13.9768 6.2757 13.4168 5.78291 12.7012 5.4248C11.997 5.06677 11.1832 4.8877 10.2598 4.8877C9.24381 4.8877 8.33762 5.11187 7.54102 5.55957C6.74443 6.00727 6.12115 6.62279 5.6709 7.40625C5.22065 8.18973 4.99512 9.08545 4.99512 10.0928C4.99518 11.0663 5.21476 11.9334 5.65332 12.6943C6.09196 13.4441 6.6923 14.0317 7.4541 14.457C8.22751 14.8935 9.11081 15.1122 10.1035 15.1123C11.027 15.1123 11.8699 14.983 12.6318 14.7256C13.0596 14.5874 13.4551 14.4286 13.8174 14.248C14.2646 14.0251 14.8284 14.1361 15.0967 14.5576C15.3393 14.9393 15.2564 15.4478 14.8652 15.6748C14.4099 15.9388 13.8732 16.176 13.2559 16.3877C12.3092 16.7123 11.258 16.875 10.1035 16.875C9.0878 16.875 8.15299 16.7068 7.29883 16.3711C6.45616 16.0354 5.72298 15.5598 5.09961 14.9443C4.47618 14.3399 3.99088 13.6232 3.64453 12.7949C3.29828 11.9668 3.125 11.06 3.125 10.0752C3.12504 9.0681 3.29828 8.14495 3.64453 7.30566C4.00239 6.45512 4.49891 5.72199 5.13379 5.10645C5.78029 4.47968 6.5365 3.99247 7.40234 3.64551C8.26814 3.29857 9.21479 3.12503 10.2422 3.125ZM9.91309 8.2627C9.42834 8.26278 9.00723 8.44172 8.64941 8.7998C8.29155 9.15795 8.11232 9.63341 8.1123 10.2266C8.1123 10.6183 8.22809 10.9319 8.45898 11.167C8.6898 11.4018 9.0013 11.5195 9.39355 11.5195C9.88999 11.5195 10.3179 11.3288 10.6758 10.9482C11.0449 10.5678 11.2295 10.0866 11.2295 9.50488C11.2295 9.11314 11.1087 8.81031 10.8662 8.59766C10.6353 8.37385 10.3171 8.2627 9.91309 8.2627Z" fill="currentColor">
         </path>
        </svg>
        <span>
         halobca@bca.co.id
        </span>
       </a>
       <a class="lui-flex lui-items-center lui-gap-2 lui-text-sm" href="https://wa.me/628111500998?text=%23HaloBCA" target="_blank">
        <svg class="lui-size-5" fill="none" height="24" viewbox="0 0 24 24" width="24">
         <path clip-rule="evenodd" d="M4.44023 9.69912C4.44023 6.19281 7.28266 3.35039 10.789 3.35039C14.2953 3.35039 17.1377 6.19281 17.1377 9.69912C17.1377 13.2054 14.2953 16.0479 10.789 16.0479C9.85009 16.0479 8.96099 15.8446 8.16135 15.4805C7.92319 15.3721 7.64791 15.3459 7.38363 15.4205L4.88797 16.1251L5.461 13.7995C5.53413 13.5027 5.48203 13.1974 5.33287 12.9474C4.7661 11.9978 4.44023 10.8878 4.44023 9.69912ZM10.789 1.65039C6.34377 1.65039 2.74023 5.25393 2.74023 9.69912C2.74023 11.1191 3.10868 12.4554 3.7556 13.6151L3.00208 16.6731C2.7952 17.5127 3.57131 18.2632 4.40351 18.0283L7.6489 17.1121C8.61474 17.5217 9.67645 17.7479 10.789 17.7479C15.2342 17.7479 18.8377 14.1443 18.8377 9.69912C18.8377 5.25393 15.2342 1.65039 10.789 1.65039ZM12.6805 10.4703C12.2021 10.7998 11.629 11.1946 10.4674 10.033C9.30584 8.87142 9.70067 8.29818 10.0302 7.81974C10.2663 7.47703 10.4688 7.18296 10.0419 6.75615C9.97765 6.69193 9.91669 6.63029 9.85853 6.57148C9.02389 5.72756 8.76707 5.46788 7.69104 6.54392C6.54002 7.69495 7.39317 9.52183 9.18582 11.3145C10.9785 13.1072 12.8053 13.9603 13.9563 12.8093C15.0327 11.733 14.7728 11.4761 13.9281 10.641C13.8695 10.5831 13.8081 10.5224 13.7441 10.4584C13.3172 10.0318 13.0232 10.2344 12.6805 10.4703Z" fill="currentColor" fill-rule="evenodd">
         </path>
        </svg>
        <span>
         62 811 1500 998
        </span>
       </a>
      </div>
     </div>
     <div class="lui-flex-col lui-gap-2 lui-text-sm md:!lui-text-left lui-flex 1280px:!lui-hidden">
      <p>
       Kantor Pusat
      </p>
      <div>
       Menara BCA, Grand Indonesia
       <!-- -->
       ,
       <span class="md:!lui-hidden">
        Jl. MH Thamrin No. 1
        <!-- -->
       </span>
       <span class="md:!lui-hidden">
        Jakarta 10310
       </span>
       <p class="lui-hidden md:!lui-block">
        Jl. MH Thamrin No. 1
       </p>
      </div>
      <p class="lui-hidden md:!lui-block">
       Jakarta 10310
      </p>
     </div>
     <div class="lui-flex-col lui-items-center lui-gap-4 lui-text-white md:!lui-items-start lui-flex 1280px:!lui-hidden">
      <a class="lui-flex lui-items-start lui-gap-2 lui-text-start lui-text-sm" href="tel:1500998">
       <svg class="lui-size-5 lui-flex-none" fill="none" height="24" viewbox="0 0 24 24" width="24">
        <path clip-rule="evenodd" d="M9.07237 10.9275C13.1886 15.0437 13.7261 9.69528 15.8383 11.806C17.8746 13.8417 18.6531 14.2835 16.2765 16.6601C13.8998 19.0368 10.1277 17.2752 6.42622 13.5736C2.72473 9.8721 0.963144 6.09992 3.33977 3.72327C5.7164 1.34661 6.15756 2.12574 8.19385 4.16148C10.306 6.27309 4.95614 6.81119 9.07237 10.9275Z" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">
        </path>
       </svg>
       <span>
        Halo BCA Bisnis | 1500998
       </span>
      </a>
      <a class="lui-flex lui-items-center lui-gap-2 lui-text-sm" href="mailto:halobca@bca.co.id">
       <svg class="lui-size-5 lui-flex-none" fill="none" height="24" viewbox="0 0 24 24" width="24">
        <path d="M10.2422 3.125C11.2003 3.125 12.0836 3.2706 12.8916 3.56152C13.6997 3.85252 14.3985 4.26108 14.9873 4.78711C15.5876 5.31313 16.0498 5.93412 16.373 6.65039C16.7078 7.36669 16.875 8.15038 16.875 9.00098C16.875 9.81803 16.7129 10.551 16.3896 11.2002C16.0664 11.8381 15.6222 12.3416 15.0566 12.7109C14.5025 13.0803 13.8672 13.2656 13.1514 13.2656C12.6782 13.2656 12.2681 13.1707 11.9219 12.9805C11.5872 12.7903 11.3394 12.5324 11.1777 12.208C10.9353 12.5214 10.606 12.779 10.1904 12.9805C9.77491 13.1707 9.3246 13.2656 8.83984 13.2656C8.30889 13.2656 7.83548 13.148 7.41992 12.9131C7.01585 12.6669 6.69264 12.3306 6.4502 11.9053C6.21933 11.4688 6.10352 10.9761 6.10352 10.4277C6.10357 9.67799 6.27072 9.00619 6.60547 8.41309C6.94026 7.81995 7.39643 7.35528 7.97363 7.01953C8.56242 6.67257 9.22696 6.5 9.96582 6.5C10.3697 6.50005 10.7275 6.56691 11.0391 6.70117C11.3507 6.83546 11.5814 7.0145 11.7314 7.23828L11.8184 6.65039H13.6709L12.9609 10.3613C12.9033 10.7081 12.9214 10.9876 13.0137 11.2002C13.1176 11.4016 13.2908 11.5029 13.5332 11.5029C13.9486 11.5028 14.2953 11.2614 14.5723 10.7803C14.8607 10.2991 15.0049 9.71127 15.0049 9.01758C15.0048 8.22302 14.7964 7.51786 14.3809 6.90234C13.9768 6.2757 13.4168 5.78291 12.7012 5.4248C11.997 5.06677 11.1832 4.8877 10.2598 4.8877C9.24381 4.8877 8.33762 5.11187 7.54102 5.55957C6.74443 6.00727 6.12115 6.62279 5.6709 7.40625C5.22065 8.18973 4.99512 9.08545 4.99512 10.0928C4.99518 11.0663 5.21476 11.9334 5.65332 12.6943C6.09196 13.4441 6.6923 14.0317 7.4541 14.457C8.22751 14.8935 9.11081 15.1122 10.1035 15.1123C11.027 15.1123 11.8699 14.983 12.6318 14.7256C13.0596 14.5874 13.4551 14.4286 13.8174 14.248C14.2646 14.0251 14.8284 14.1361 15.0967 14.5576C15.3393 14.9393 15.2564 15.4478 14.8652 15.6748C14.4099 15.9388 13.8732 16.176 13.2559 16.3877C12.3092 16.7123 11.258 16.875 10.1035 16.875C9.0878 16.875 8.15299 16.7068 7.29883 16.3711C6.45616 16.0354 5.72298 15.5598 5.09961 14.9443C4.47618 14.3399 3.99088 13.6232 3.64453 12.7949C3.29828 11.9668 3.125 11.06 3.125 10.0752C3.12504 9.0681 3.29828 8.14495 3.64453 7.30566C4.00239 6.45512 4.49891 5.72199 5.13379 5.10645C5.78029 4.47968 6.5365 3.99247 7.40234 3.64551C8.26814 3.29857 9.21479 3.12503 10.2422 3.125ZM9.91309 8.2627C9.42834 8.26278 9.00723 8.44172 8.64941 8.7998C8.29155 9.15795 8.11232 9.63341 8.1123 10.2266C8.1123 10.6183 8.22809 10.9319 8.45898 11.167C8.6898 11.4018 9.0013 11.5195 9.39355 11.5195C9.88999 11.5195 10.3179 11.3288 10.6758 10.9482C11.0449 10.5678 11.2295 10.0866 11.2295 9.50488C11.2295 9.11314 11.1087 8.81031 10.8662 8.59766C10.6353 8.37385 10.3171 8.2627 9.91309 8.2627Z" fill="currentColor">
        </path>
       </svg>
       <span>
        halobca@bca.co.id
       </span>
      </a>
      <a class="lui-flex lui-items-center lui-gap-2 lui-text-sm" href="https://wa.me/628111500998?text=%23HaloBCA" target="_blank">
       <svg class="lui-size-5" fill="none" height="24" viewbox="0 0 24 24" width="24">
        <path clip-rule="evenodd" d="M4.44023 9.69912C4.44023 6.19281 7.28266 3.35039 10.789 3.35039C14.2953 3.35039 17.1377 6.19281 17.1377 9.69912C17.1377 13.2054 14.2953 16.0479 10.789 16.0479C9.85009 16.0479 8.96099 15.8446 8.16135 15.4805C7.92319 15.3721 7.64791 15.3459 7.38363 15.4205L4.88797 16.1251L5.461 13.7995C5.53413 13.5027 5.48203 13.1974 5.33287 12.9474C4.7661 11.9978 4.44023 10.8878 4.44023 9.69912ZM10.789 1.65039C6.34377 1.65039 2.74023 5.25393 2.74023 9.69912C2.74023 11.1191 3.10868 12.4554 3.7556 13.6151L3.00208 16.6731C2.7952 17.5127 3.57131 18.2632 4.40351 18.0283L7.6489 17.1121C8.61474 17.5217 9.67645 17.7479 10.789 17.7479C15.2342 17.7479 18.8377 14.1443 18.8377 9.69912C18.8377 5.25393 15.2342 1.65039 10.789 1.65039ZM12.6805 10.4703C12.2021 10.7998 11.629 11.1946 10.4674 10.033C9.30584 8.87142 9.70067 8.29818 10.0302 7.81974C10.2663 7.47703 10.4688 7.18296 10.0419 6.75615C9.97765 6.69193 9.91669 6.63029 9.85853 6.57148C9.02389 5.72756 8.76707 5.46788 7.69104 6.54392C6.54002 7.69495 7.39317 9.52183 9.18582 11.3145C10.9785 13.1072 12.8053 13.9603 13.9563 12.8093C15.0327 11.733 14.7728 11.4761 13.9281 10.641C13.8695 10.5831 13.8081 10.5224 13.7441 10.4584C13.3172 10.0318 13.0232 10.2344 12.6805 10.4703Z" fill="currentColor" fill-rule="evenodd">
        </path>
       </svg>
       <span>
        62 811 1500 998
       </span>
      </a>
     </div>
     <div class="lui-flex-col lui-gap-6 lui-text-center md:!lui-text-left lui-hidden md:!lui-flex 1280px:lui-ml-16">
      <h3 class="lui-text-sm lui-font-semibold lui-tracking-wider lui-text-white">
       PERUSAHAAN
      </h3>
      <div class="lui-flex lui-flex-col lui-gap-5 lui-text-sm">
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://www.bca.co.id/id/tentang-bca" ocn-test-id="visitor-footer-company" target="_blank">
         Tentang Kami
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://main.ocean.bca.co.id/help-center" ocn-test-id="visitor-footer-company" target="_blank">
         Pusat Bantuan
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://www.bca.co.id/id/informasi/Kebijakan?utm_source=ocean" ocn-test-id="visitor-footer-company" target="_blank">
         Kebijakan
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://www.bca.co.id/id/Syarat-dan-Ketentuan/mybca-bisnis?utm_source=ocean" ocn-test-id="visitor-footer-company" target="_blank">
         Syarat &amp; Ketentuan
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://www.bca.co.id" ocn-test-id="visitor-footer-company" target="_blank">
         bca.co.id
        </a>
       </p>
      </div>
     </div>
     <div class="lui-flex-col lui-gap-6 lui-text-center md:!lui-text-left lui-hidden md:!lui-flex 1280px:lui-ml-16">
      <h3 class="lui-text-sm lui-font-semibold lui-tracking-wider lui-text-white">
       PRODUK
      </h3>
      <div class="lui-flex lui-flex-col lui-gap-5 lui-text-sm">
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/produk/transaksi/edc-bca" ocn-test-id="visitor-footer-product" target="_blank">
         EDC BCA
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/produk/transaksi/qris-bisnis" ocn-test-id="visitor-footer-product" target="_blank">
         QRIS
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis" ocn-test-id="visitor-footer-product" target="_blank">
         myBCA Bisnis
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/produk/transaksi/virtual-account" ocn-test-id="visitor-footer-product" target="_blank">
         Virtual Account
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://main.ocean.bca.co.id/visitor/product" ocn-test-id="visitor-footer-product" target="_blank">
         Lihat Semua..
        </a>
       </p>
      </div>
     </div>
     <div class="lui-flex-col lui-gap-6 lui-text-center md:!lui-text-left lui-hidden md:!lui-flex 1280px:lui-ml-16">
      <h3 class="lui-text-sm lui-font-semibold lui-tracking-wider lui-text-white">
       ARTIKEL
      </h3>
      <div class="lui-flex lui-flex-col lui-gap-5 lui-text-sm">
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article/c/e33d16d0-7883-44f5-8637-3a324026ced0?lobTitleID=Perdagangan&amp;lobTitleEN=Trade" ocn-test-id="visitor-footer-article" target="_blank">
         Trade
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article/c/5bcf60a5-2d54-4b1c-9d23-3071f14194a7?lobTitleID=Food%20&amp;%20Beverages&amp;lobTitleEN=Food%20&amp;%20Beverages" ocn-test-id="visitor-footer-article" target="_blank">
         Food &amp; Beverage
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article/c/c6511058-7194-4a04-8d9c-68856a06e846?lobTitleID=Manufaktur&amp;lobTitleEN=Manufacture" ocn-test-id="visitor-footer-article" target="_blank">
         Manufacture
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article/c/8145d4cc-f2de-436f-9c0b-ea5c95dcd06c?lobTitleID=Pariwisata%20dan%20Perhotelan&amp;lobTitleEN=Tourism%20and%20Hospitality" ocn-test-id="visitor-footer-article" target="_blank">
         Tourism &amp; Hospitality
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article" ocn-test-id="visitor-footer-article" target="_blank">
         Lihat Semua..
        </a>
       </p>
      </div>
     </div>
    </div>
    <div class="lui-grid lui-grid-cols-1 lui-gap-[40px] sm:!lui-grid-cols-3 md:!lui-hidden">
     <div class="lui-flex lui-flex-col lui-gap-6 lui-text-center md:!lui-text-left">
      <h3 class="lui-text-sm lui-font-semibold lui-tracking-wider lui-text-white">
       PERUSAHAAN
      </h3>
      <div class="lui-flex lui-flex-col lui-gap-5 lui-text-sm">
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://www.bca.co.id/id/tentang-bca" ocn-test-id="visitor-footer-company" target="_blank">
         Tentang Kami
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://main.ocean.bca.co.id/help-center" ocn-test-id="visitor-footer-company" target="_blank">
         Pusat Bantuan
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://www.bca.co.id/id/informasi/Kebijakan?utm_source=ocean" ocn-test-id="visitor-footer-company" target="_blank">
         Kebijakan
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://www.bca.co.id/id/Syarat-dan-Ketentuan/mybca-bisnis?utm_source=ocean" ocn-test-id="visitor-footer-company" target="_blank">
         Syarat &amp; Ketentuan
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://www.bca.co.id" ocn-test-id="visitor-footer-company" target="_blank">
         bca.co.id
        </a>
       </p>
      </div>
     </div>
     <div class="lui-flex lui-flex-col lui-gap-6 lui-text-center md:!lui-text-left">
      <h3 class="lui-text-sm lui-font-semibold lui-tracking-wider lui-text-white">
       PRODUK
      </h3>
      <div class="lui-flex lui-flex-col lui-gap-5 lui-text-sm">
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/produk/transaksi/edc-bca" ocn-test-id="visitor-footer-product" target="_blank">
         EDC BCA
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/produk/transaksi/qris-bisnis" ocn-test-id="visitor-footer-product" target="_blank">
         QRIS
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis" ocn-test-id="visitor-footer-product" target="_blank">
         myBCA Bisnis
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/produk/transaksi/virtual-account" ocn-test-id="visitor-footer-product" target="_blank">
         Virtual Account
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://main.ocean.bca.co.id/visitor/product" ocn-test-id="visitor-footer-product" target="_blank">
         Lihat Semua..
        </a>
       </p>
      </div>
     </div>
     <div class="lui-flex lui-flex-col lui-gap-6 lui-text-center md:!lui-text-left">
      <h3 class="lui-text-sm lui-font-semibold lui-tracking-wider lui-text-white">
       ARTIKEL
      </h3>
      <div class="lui-flex lui-flex-col lui-gap-5 lui-text-sm">
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article/c/e33d16d0-7883-44f5-8637-3a324026ced0?lobTitleID=Perdagangan&amp;lobTitleEN=Trade" ocn-test-id="visitor-footer-article" target="_blank">
         Trade
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article/c/5bcf60a5-2d54-4b1c-9d23-3071f14194a7?lobTitleID=Food%20&amp;%20Beverages&amp;lobTitleEN=Food%20&amp;%20Beverages" ocn-test-id="visitor-footer-article" target="_blank">
         Food &amp; Beverage
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article/c/c6511058-7194-4a04-8d9c-68856a06e846?lobTitleID=Manufaktur&amp;lobTitleEN=Manufacture" ocn-test-id="visitor-footer-article" target="_blank">
         Manufacture
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article/c/8145d4cc-f2de-436f-9c0b-ea5c95dcd06c?lobTitleID=Pariwisata%20dan%20Perhotelan&amp;lobTitleEN=Tourism%20and%20Hospitality" ocn-test-id="visitor-footer-article" target="_blank">
         Tourism &amp; Hospitality
        </a>
       </p>
       <p class="lui-text-white/70 hover:!lui-text-white">
        <a href="https://ocean.bca.co.id/id/article" ocn-test-id="visitor-footer-article" target="_blank">
         Lihat Semua..
        </a>
       </p>
      </div>
     </div>
    </div>
   </div>
   <div class="lui-flex lui-flex-col lui-items-center lui-gap-3 lui-text-xs md:!lui-items-start">
    <div class="lui-flex lui-flex-col lui-gap-2 lui-text-center md:!lui-text-left">
     <p class="lui-text-white/60">
      BCA berizin dan diawasi oleh Otoritas Jasa Keuangan &amp; Bank Indonesia
     </p>
     <p class="lui-text-white/60">
      BCA merupakan peserta penjaminan LPS. Maksimum nilai simpanan yang dijamin LPS per nasabah per bank adalah Rp2 miliar. Untuk cek Tingkat Bunga Penjaminan LPS, klik
      <a class="lui-underline hover:!lui-text-white" href="https://apps.lps.go.id/BankPesertaLPSRate" target="_blank">
       di sini
      </a>
     </p>
    </div>
    <p class="lui-text-white">
     © 2025 PT Bank Central Asia Tbk, All Rights Reserved.
    </p>
   </div>
  </div>
 </footer>
 <div aria-label="Notifications (F8)" role="region" style="pointer-events:none" tabindex="-1">
  <ol class="fixed right-1/2 top-0 z-[100] flex max-h-screen w-full translate-x-1/2 flex-col-reverse p-4 text-oceanV2-success-500 xs:max-w-[800px] xs:flex-col" tabindex="-1">
  </ol>
 </div>

        <div style="flex-grow: 1;"></div>
        <div style="height: 4px; width: 100%; background: linear-gradient(to right, #06b6d4, #5eead4);"></div>
        ${PublicFooter()}
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

    // Dynamically inject scraped Tailwind CSS only for the Article page
    let cssLink = document.getElementById('ocean-scraped-css');
    if (state.viewMode === 'public' && state.currentPage === 'article') {
        if (!cssLink) {
            cssLink = document.createElement('link');
            cssLink.id = 'ocean-scraped-css';
            cssLink.rel = 'stylesheet';
            cssLink.href = '/ocean-scraped.css';
            document.head.appendChild(cssLink);
        }
    } else {
        if (cssLink) {
            cssLink.remove();
        }
    }

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
            case 'article': content = ArticlePage(); break;
            case 'help': content = HelpCenterPage(); break;
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
            state.viewMode = 'public';
            state.currentPage = 'help';
            render();
        });
    }

    // Mobile myEcosystem Dropdown Toggle
    const mobileMyEcosystemBtn = document.getElementById('mobile-myecosystem-btn');
    const mobileMyEcosystemMenu = document.getElementById('mobile-myecosystem-menu');
    if (mobileMyEcosystemBtn && mobileMyEcosystemMenu) {
        mobileMyEcosystemBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = mobileMyEcosystemMenu.style.display === 'none';
            mobileMyEcosystemMenu.style.display = isHidden ? 'flex' : 'none';
            const chevron = mobileMyEcosystemBtn.querySelector('svg');
            if (chevron) {
                chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                chevron.style.transition = 'transform 0.3s ease';
            }
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
    if (directInternalBtn) directInternalBtn.addEventListener('click', () => { state.viewMode = 'public'; state.currentPage = 'help'; render(); });
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
