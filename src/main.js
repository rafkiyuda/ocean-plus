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
    ragLoaded: false
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
                <a href="#" class="nav-link-p ${state.currentPage === 'roi' ? 'active' : ''}" data-page="roi">
                    Quick Access
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
                </a>
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
            <div class="mobile-menu-dropdown-trigger">
                <span>Quick Access</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
            </div>
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

const PRODUCTS = [
    {
        id: 'mybca-bisnis',
        name: 'myBCA Bisnis',
        subtitle: 'Kelola Keuangan Bisnis',
        category: 'Rekening',
        sectors: ['Umum', 'Logistik', 'Institusi Finansial', 'Kesehatan', 'Lainnya'],
        desc: 'Satu platform perbankan digital untuk memantau saldo, mutasi, dan transaksi bisnis Anda kapan saja secara real-time.',
        icon: '/images/mbb-icon-quick.svg',
        link: 'https://ocean.bca.co.id/id/produk/transaksi/ocean-by-bca/mybca-bisnis'
    },
    {
        id: 'edc-bca',
        name: 'EDC BCA',
        subtitle: 'Menerima Pembayaran Kartu',
        category: 'Transaksi',
        sectors: ['Umum', 'Fashion & Beauty', 'Food & Beverages', 'Lainnya'],
        desc: 'Satu mesin EDC untuk menerima pembayaran Kartu Debit, Kredit (BCA, Visa, Mastercard, JCB, Amex), Flazz, dan QRIS.',
        icon: '/images/e-commerce-merchant-portal.svg',
        link: 'https://ocean.bca.co.id/id/produk/transaksi/edc-bca'
    },
    {
        id: 'qris-bca',
        name: 'QRIS BCA',
        subtitle: 'Satu QR untuk Semua E-Wallet',
        category: 'Transaksi',
        sectors: ['Umum', 'Fashion & Beauty', 'Food & Beverages', 'Lainnya'],
        desc: 'Terima pembayaran digital secara praktis dan real-time menggunakan satu kode QR standar nasional untuk semua e-wallet.',
        icon: '/images/e-commerce-merchant-portal.svg',
        link: 'https://ocean.bca.co.id/id/produk/transaksi/qris-bisnis'
    },
    {
        id: 'virtual-account',
        name: 'Virtual Account',
        subtitle: 'Identifikasi Pembayaran Otomatis',
        category: 'Transaksi',
        sectors: ['Umum', 'Logistik', 'Kesehatan', 'Lainnya'],
        desc: 'Identifikasi pembayaran dari setiap pelanggan secara cepat dan akurat tanpa perlu konfirmasi pembayaran manual.',
        icon: '/images/klikbcabisnis.svg',
        link: 'https://ocean.bca.co.id/id/produk/transaksi/virtual-account'
    },
    {
        id: 'e-deposito',
        name: 'e-Deposito',
        subtitle: 'Investasi Dana Efisien',
        category: 'Investasi',
        sectors: ['Umum', 'Institusi Finansial'],
        desc: 'Penempatan deposito berjangka secara online di myBCA Bisnis dengan opsi perpanjangan otomatis dan bunga bersaing.',
        icon: '/images/mbb-icon-quick.svg',
        link: 'https://ocean.bca.co.id/id/produk/rekening/e-deposito'
    },
    {
        id: 'giro-bca',
        name: 'Giro BCA',
        subtitle: 'Transaksi Bisnis Fleksibel',
        category: 'Rekening',
        sectors: ['Umum', 'Institusi Finansial'],
        desc: 'Kemudahan transaksi pembayaran bisnis menggunakan Cek, Bilyet Giro, atau sarana perbankan elektronik lainnya.',
        icon: '/images/klikbcabisnis.svg',
        link: 'https://ocean.bca.co.id/id/produk/rekening/giro'
    },
    {
        id: 'tahapan-gold',
        name: 'Tahapan Gold',
        subtitle: 'Tabungan Bisnis Praktis',
        category: 'Rekening',
        sectors: ['Umum', 'Fashion & Beauty', 'Food & Beverages', 'Lainnya'],
        desc: 'Tabungan khusus bisnis dengan limit transaksi yang besar, informasi mutasi lebih detail, dan layanan autodebet.',
        icon: '/images/mbb-icon-quick.svg',
        link: 'https://ocean.bca.co.id/id/produk/rekening/tahapan-gold'
    },
    {
        id: 'bca-api',
        name: 'BCA API',
        subtitle: 'Integrasi Finansial Real-time',
        category: 'Solusi Digital',
        sectors: ['Logistik', 'Institusi Finansial', 'Kesehatan', 'Lainnya'],
        desc: 'Integrasikan sistem ERP atau aplikasi internal bisnis Anda langsung dengan sistem perbankan BCA untuk transaksi otomatis.',
        icon: '/images/developer-api-bca.svg',
        link: 'https://ocean.bca.co.id/id/produk/solusi-digital/bca-api'
    },
    {
        id: 'kur-bca',
        name: 'Kredit Usaha Rakyat (KUR)',
        subtitle: 'Pembiayaan Modal Kerja',
        category: 'Pinjaman',
        sectors: ['Umum', 'Fashion & Beauty', 'Food & Beverages', 'Lainnya'],
        desc: 'Pembiayaan modal kerja atau investasi untuk pelaku UMKM dengan bunga subsidi dan syarat yang mudah.',
        icon: '/images/client-trade.svg',
        link: 'https://ocean.bca.co.id/id/produk/pinjaman/kur'
    },
    {
        id: 'kredit-lokal',
        name: 'Kredit Lokal',
        subtitle: 'Kebutuhan Modal Kerja Dinamis',
        category: 'Pinjaman',
        sectors: ['Umum', 'Logistik', 'Lainnya'],
        desc: 'Fasilitas kredit modal kerja dengan penarikan fleksibel menggunakan Cek/Bilyet Giro sesuai kebutuhan bisnis Anda.',
        icon: '/images/client-trade.svg',
        link: 'https://ocean.bca.co.id/id/produk/pinjaman/kredit-lokal'
    },
    {
        id: 'asuransi-kebakaran',
        name: 'Asuransi Kebakaran Bisnis',
        subtitle: 'Proteksi Aset Fisik',
        category: 'Asuransi',
        sectors: ['Umum', 'Logistik', 'Kesehatan', 'Lainnya'],
        desc: 'Perlindungan tempat usaha, mesin, persediaan barang dagangan, dan aset fisik lainnya dari risiko kebakaran.',
        icon: '/images/bagio.svg',
        link: 'https://ocean.bca.co.id/id/produk/asuransi/kebakaran-bisnis'
    }
];

const getCategoryIcon = (category) => {
    switch(category) {
        case 'Rekening':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wallet"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9"></path><path d="M16 14h.01"></path></svg>`;
        case 'Transaksi':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-repeat"><path d="m17 2 4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="m7 22-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path></svg>`;
        case 'Pinjaman':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-helping-hand"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path><path d="M15 22v-4a2 2 0 0 0-2-2H9"></path><path d="M19 14h2a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 1-5 0v-2.5"></path></svg>`;
        case 'Investasi':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>`;
        case 'Asuransi':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 11 2 2 4-4"></path></svg>`;
        case 'Solusi Digital':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cpu"><rect width="16" height="16" x="4" y="4" rx="2"></rect><rect width="6" height="6" x="9" y="9" rx="1"></rect><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"></path></svg>`;
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

    const sectors = ['Semua', 'Umum', 'Fashion & Beauty', 'Food & Beverages', 'Logistik', 'Kesehatan', 'Institusi Finansial', 'Lainnya'];
    const categories = ['Rekening', 'Transaksi', 'Pinjaman', 'Investasi', 'Asuransi', 'Solusi Digital'];

    return `
        <div class="product-page-layout fade-in">
            <div id="product-big-header" class="product-hero-header">
                <div class="product-hero-content">
                    <h1>Produk BCA</h1>
                    <p>untuk Kemudahan Bisnis Anda</p>
                </div>
            </div>
            
            <div class="product-container-wrap">
                <div class="product-content-card-wrap">
                    <div class="product-card-title-row">
                        <div class="title-icon-container">
                            <img src="/images/checklist-icon.png" class="title-icon-img" alt="Checklist Icon">
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
                                                ${getCategoryIcon(cat)}
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
                        <div class="riwayat-icon-clock">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="clock-icon-svg">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <span class="riwayat-title-text">Riwayat Pengajuan</span>
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
                <div class="auth-logo">
                    <img src="https://pustaka.bca.co.id/Ocean/Assets/Icon/Logo-Ocean-by-BCA-white.png" alt="Ocean by BCA Logo" style="height: 36px; width: auto; object-fit: contain; filter: brightness(0) saturate(100%) invert(12%) sepia(87%) saturate(2222%) hue-rotate(198deg) brightness(92%) contrast(105%);">
                </div>
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
                state.viewMode = 'internal';
                state.currentPage = 'dashboard';
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
