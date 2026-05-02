import './style.css'

// --- State Management ---
const state = {
    currentPage: 'dashboard',
    user: {
        name: 'RO Senior',
        branch: 'KCU Jakarta',
        points: 1250,
        level: 'Expert'
    },
    chatHistory: [
        { role: 'ai', content: 'Halo! Saya Ocean AI. Ada yang bisa saya bantu terkait produk Ocean hari ini?' }
    ]
};

// --- Components ---

const Sidebar = () => `
    <aside class="sidebar">
        <div class="sidebar-logo">
            <div style="background: white; color: var(--bca-blue-deep); padding: 4px 10px; border-radius: 8px;">O</div>
            <span>OCEAN AI</span>
        </div>
        <nav class="nav-links">
            <li class="nav-item">
                <a href="#" class="nav-link ${state.currentPage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
                    <span>📊</span> Dashboard
                </a>
            </li>
            <li class="nav-item">
                <a href="#" class="nav-link ${state.currentPage === 'learning' ? 'active' : ''}" data-page="learning">
                    <span>🎓</span> Learning
                </a>
            </li>
            <li class="nav-item">
                <a href="#" class="nav-link ${state.currentPage === 'ai' ? 'active' : ''}" data-page="ai">
                    <span>🤖</span> Ocean AI Assistant
                </a>
            </li>
            <li class="nav-item">
                <a href="#" class="nav-link ${state.currentPage === 'kb' ? 'active' : ''}" data-page="kb">
                    <span>📚</span> Knowledge Base
                </a>
            </li>
        </nav>
        <div class="sidebar-footer">
            <div class="user-profile">
                <div class="avatar">${state.user.name.charAt(0)}</div>
                <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${state.user.name}</div>
                    <div style="font-size: 0.75rem; opacity: 0.7;">${state.user.branch}</div>
                </div>
            </div>
        </div>
    </aside>
`;

const DashboardPage = () => `
    <div class="fade-in">
        <header>
            <h1>Selamat Datang, ${state.user.name}!</h1>
            <p class="subtitle">Pantau progres pembelajaran dan capaian Ocean Anda hari ini.</p>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Level Anda</div>
                <div class="stat-val">${state.user.level}</div>
                <div class="progress-bar"><div class="progress-fill" style="width: 75%"></div></div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">250 XP lagi ke Master</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Points</div>
                <div class="stat-val">${state.user.points}</div>
                <div style="font-size: 0.8rem; color: var(--ocean-teal); font-weight: 600;">+120 minggu ini</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Modul Selesai</div>
                <div class="stat-val">8 / 12</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">67% dari kurikulum</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Peringkat Cabang</div>
                <div class="stat-val">#3</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">KCU Jakarta Area</div>
            </div>
        </div>

        <section>
            <h2 style="margin-bottom: 1.5rem; color: var(--bca-blue-deep);">Rekomendasi Pembelajaran</h2>
            <div class="learning-grid">
                <div class="course-card">
                    <div class="course-img">📈</div>
                    <div class="course-body">
                        <span class="course-badge">HOT TOPIC</span>
                        <h3 class="course-title">Mastering Business Dashboard</h3>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Pelajari cara menjelaskan visualisasi data arus kas ke nasabah korporasi.</p>
                        <div class="progress-bar"><div class="progress-fill" style="width: 40%"></div></div>
                        <button class="btn-send" style="width: 100%; padding: 10px;">Lanjutkan Belajar</button>
                    </div>
                </div>
                <div class="course-card">
                    <div class="course-img">🛡️</div>
                    <div class="course-body">
                        <span class="course-badge">COMPLIANCE</span>
                        <h3 class="course-title">Security & API Integration</h3>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Memahami standar keamanan berlapis Ocean untuk integrasi ERP.</p>
                        <div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div>
                        <button class="btn-send" style="width: 100%; padding: 10px; background: var(--bg-main); color: var(--bca-blue);">Mulai Modul</button>
                    </div>
                </div>
            </div>
        </section>
    </div>
`;

const LearningPage = () => `
    <div class="fade-in">
        <header>
            <h1>Ocean Mastery Modules</h1>
            <p class="subtitle">Modul pembelajaran bite-sized yang dirancang untuk kebutuhan RO di lapangan.</p>
        </header>

        <div class="learning-grid">
            ${[
                { icon: '🚀', title: 'Intro to Ocean Ecosystem', cat: 'Basic', progress: 100 },
                { icon: '📊', title: 'Business Dashboard Deep Dive', cat: 'Technical', progress: 40 },
                { icon: '🤝', title: 'Pitching for UMKM', cat: 'Soft Skill', progress: 85 },
                { icon: '🔗', title: 'API & ERP Connectivity', cat: 'Technical', progress: 0 },
                { icon: '💰', title: 'Cash Management Optimization', cat: 'Advanced', progress: 0 },
                { icon: '📜', title: 'Ocean Champion Certification', cat: 'Final', progress: 0 }
            ].map(course => `
                <div class="course-card">
                    <div class="course-img">${course.icon}</div>
                    <div class="course-body">
                        <span class="course-badge">${course.cat}</span>
                        <h3 class="course-title">${course.title}</h3>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${course.progress}%"></div></div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; font-weight: 600;">${course.progress}% Selesai</span>
                            <button style="border: none; background: none; color: var(--bca-blue); font-weight: 700; cursor: pointer;">
                                ${course.progress === 100 ? 'Review' : 'Buka'} →
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
`;

const AIPage = () => `
    <div class="fade-in">
        <header>
            <h1>Ocean AI Assistant</h1>
            <p class="subtitle">Tanyakan apa saja tentang produk Ocean. Saya mengambil data dari PAKAR & Knowledge Base BCA.</p>
        </header>

        <div class="chat-container">
            <div class="chat-messages" id="chat-messages">
                ${state.chatHistory.map(msg => `
                    <div class="message ${msg.role}">
                        ${msg.content}
                    </div>
                `).join('')}
            </div>
            <div class="chat-input-area">
                <input type="text" class="chat-input" id="chat-input" placeholder="Tanyakan: Bagaimana cara menjelaskan benefit Business Dashboard?">
                <button class="btn-send" id="btn-send">Tanya AI</button>
            </div>
        </div>
        
        <div style="margin-top: 1.5rem; display: flex; gap: 0.8rem; flex-wrap: wrap;">
            <span style="font-size: 0.85rem; color: var(--text-secondary);">Saran Pertanyaan:</span>
            <button class="suggest-btn" data-q="Apa keunggulan Ocean API dibandingkan kompetitor?">Keunggulan API</button>
            <button class="suggest-btn" data-q="Script untuk tawarkan Ocean ke CFO Manufaktur">Script CFO</button>
            <button class="suggest-btn" data-q="Cara integrasi dengan ERP SAP">Integrasi SAP</button>
        </div>
    </div>
`;

const KBPage = () => `
    <div class="fade-in">
        <header>
            <h1>Knowledge Base</h1>
            <p class="subtitle">Pusat dokumentasi resmi, FAQ, dan Best Practices dari seluruh cabang.</p>
        </header>

        <div class="kb-search">
            <input type="text" class="chat-input" style="width: 100%; max-width: 600px;" placeholder="Cari dokumen, use case, atau panduan teknis...">
        </div>

        <div class="kb-grid">
            <div class="kb-categories">
                <h3 style="font-size: 1rem; margin-bottom: 1rem;">Kategori</h3>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <button style="text-align: left; background: var(--bca-blue-light); border: none; padding: 10px; border-radius: 8px; font-weight: 600; color: var(--bca-blue);">Semua Dokumen</button>
                    <button style="text-align: left; background: none; border: none; padding: 10px; border-radius: 8px;">Panduan Produk</button>
                    <button style="text-align: left; background: none; border: none; padding: 10px; border-radius: 8px;">Use Case Industri</button>
                    <button style="text-align: left; background: none; border: none; padding: 10px; border-radius: 8px;">FAQ Teknis</button>
                    <button style="text-align: left; background: none; border: none; padding: 10px; border-radius: 8px;">Best Practice Cabang</button>
                </div>
            </div>
            <div class="kb-content">
                <div class="kb-card">
                    <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">[Use Case] Efisiensi Cash Management di Sektor Retail</h3>
                    <p style="font-size: 0.9rem; color: var(--text-secondary);">Mempelajari bagaimana Ocean membantu PT Maju Jaya dalam mengkonsolidasi 200 rekening cabang.</p>
                    <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--bca-blue); font-weight: 600;">#Retail #CaseStudy #Consolidation</div>
                </div>
                <div class="kb-card">
                    <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Panduan Integrasi API Ocean ke Microsoft Dynamics 365</h3>
                    <p style="font-size: 0.9rem; color: var(--text-secondary);">Langkah demi langkah teknis untuk developer nasabah dalam menghubungkan ERP dengan BCA.</p>
                    <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--bca-blue); font-weight: 600;">#Technical #API #MicrosoftDynamics</div>
                </div>
                <div class="kb-card">
                    <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">FAQ: Batasan Transaksi Harian via Ocean</h3>
                    <p style="font-size: 0.9rem; color: var(--text-secondary);">Informasi lengkap mengenai limitasi dan parameter keamanan transaksi.</p>
                    <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--bca-blue); font-weight: 600;">#FAQ #Limits #Security</div>
                </div>
            </div>
        </div>
    </div>
`;

// --- Router & Rendering ---

const render = () => {
    const app = document.getElementById('app');
    
    let content = '';
    switch(state.currentPage) {
        case 'dashboard': content = DashboardPage(); break;
        case 'learning': content = LearningPage(); break;
        case 'ai': content = AIPage(); break;
        case 'kb': content = KBPage(); break;
    }

    app.innerHTML = `
        <div class="layout">
            ${Sidebar()}
            <main class="main-content">
                ${content}
            </main>
        </div>
    `;

    attachEventListeners();
};

const attachEventListeners = () => {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.getAttribute('data-page');
            state.currentPage = page;
            render();
        });
    });

    // Chat Logic
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send');
    if (chatInput && sendBtn) {
        const sendMessage = () => {
            const text = chatInput.value.trim();
            if (!text) return;

            state.chatHistory.push({ role: 'user', content: text });
            chatInput.value = '';
            
            // Dummy AI Response
            setTimeout(() => {
                let aiResponse = "Saya sedang menganalisis pertanyaan Anda berdasarkan database Ocean...";
                
                if (text.toLowerCase().includes('benefit')) {
                    aiResponse = "Benefit utama Ocean Business Dashboard untuk nasabah adalah: <br>1. <b>Visibilitas Real-time:</b> Pantau arus kas dari semua rekening dalam satu layar.<br>2. <b>Efisiensi Operasional:</b> Mengurangi waktu rekonsiliasi manual hingga 70%.<br>3. <b>Decision Making:</b> Laporan otomatis yang siap dipresentasikan ke direksi.";
                } else if (text.toLowerCase().includes('api')) {
                    aiResponse = "Ocean API mendukung integrasi dengan berbagai ERP (SAP, Oracle, Microsoft Dynamics). Keunggulannya adalah keamanan dengan enkripsi standar enterprise dan dokumentasi API yang lengkap di portal developer BCA.";
                } else {
                    aiResponse = "Berdasarkan knowledge base, ini adalah ringkasan yang bisa Anda gunakan: Ocean memberikan solusi end-to-end yang mengintegrasikan perbankan langsung ke alur kerja bisnis nasabah.";
                }

                state.chatHistory.push({ role: 'ai', content: aiResponse });
                render();
                // Scroll to bottom
                const msgContainer = document.getElementById('chat-messages');
                if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
            }, 800);
            
            render();
        };

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    }

    // Suggestion Buttons
    document.querySelectorAll('.suggest-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const q = e.target.getAttribute('data-q');
            if (chatInput) {
                chatInput.value = q;
                sendBtn.click();
            }
        });
    });
};

// Initial Render
render();

console.log('Ocean AI Knowledge Platform Initialized');
