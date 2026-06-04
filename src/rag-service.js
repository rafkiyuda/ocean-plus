/**
 * rag-service.js
 * Ocean Mastery — Real RAG (Retrieval Augmented Generation) Service
 * 
 * Handles: file upload → text extraction → chunking → embedding → Supabase storage
 * Uses: Gemini API (text extraction + embedding) + Supabase (pgvector storage)
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
// Supabase anon key is safe to expose in frontend (it's public by design)
const SUPABASE_URL = 'https://lypocldjhixbgazuewqu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_3muKJv8Ib-_1OVITZJ5BSg_84uGD5K5';
// Gemini key: load from .env file (VITE_GEMINI_KEY=...)
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const EMBED_MODEL = 'gemini-embedding-2';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Text Extraction via Gemini ───────────────────────────────────────────────

async function extractTextFromFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    // Plain text — read directly
    if (['txt', 'html', 'md', 'csv', 'json'].includes(ext)) {
        return await file.text();
    }

    // Convert file to base64 using FileReader
    const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    const mime = file.type || guessMime(ext);

    const prompt = ext === 'mp4' || ext === 'mov' || ext === 'avi'
        ? 'Transkrip seluruh percakapan dan narasi dari video ini secara lengkap dalam Bahasa Indonesia.'
        : ext === 'mp3' || ext === 'wav' || ext === 'm4a'
            ? 'Transkrip seluruh percakapan dan narasi dari audio ini secara lengkap dalam Bahasa Indonesia.'
            : 'Ekstrak seluruh teks, tabel, dan konten penting dari dokumen ini. Pertahankan struktur dan konteks aslinya.';

    const body = {
        contents: [{
            parts: [
                { inline_data: { mime_type: mime, data: b64 } },
                { text: prompt }
            ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
    };

    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini extraction failed: ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function guessMime(ext) {
    const map = {
        pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
        mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
        txt: 'text/plain', html: 'text/html', csv: 'text/csv', json: 'application/json'
    };
    return map[ext] || 'application/octet-stream';
}

// ── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text, chunkSize = 800, overlap = 100) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
        if ((current + ' ' + sentence).length > chunkSize && current.length > 0) {
            chunks.push(current.trim());
            // Overlap: carry last N chars
            const words = current.split(' ');
            current = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence;
        } else {
            current += (current ? ' ' : '') + sentence;
        }
    }
    if (current.trim()) chunks.push(current.trim());

    return chunks.filter(c => c.length > 50); // drop tiny chunks
}

// ── Embedding via Gemini ─────────────────────────────────────────────────────

async function generateEmbedding(text) {
    const res = await fetch(`${GEMINI_BASE}/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_DOCUMENT',
            outputDimensionality: 768
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embedding failed: ${err}`);
    }

    const data = await res.json();
    return data.embedding?.values || [];
}

// ── Main Upload Pipeline ─────────────────────────────────────────────────────
/**
 * Full pipeline: file → extract → chunk → embed → save to Supabase
 * @param {File} file
 * @param {string} source - 'upload' | 'pakar' | 'mydevelopment'
 * @param {function} onProgress - callback(step: 1-5, message: string)
 */
export async function uploadDocument(file, source = 'upload', onProgress = () => { }) {
    const ext = file.name.split('.').pop().toLowerCase();

    // Step 1: Create document record
    onProgress(1, 'Memvalidasi file dan membuat record...');
    const { data: doc, error: docErr } = await supabase
        .from('knowledge_documents')
        .insert({
            name: file.name,
            file_type: ext,
            source: source,
            size_bytes: file.size,
            status: 'processing'
        })
        .select()
        .single();

    if (docErr) throw new Error(`Gagal membuat record: ${docErr.message}`);
    const docId = doc.id;

    try {
        // Step 2: Extract text with Gemini
        onProgress(2, 'Gemini AI mengekstrak konten...');
        const rawText = await extractTextFromFile(file);
        if (!rawText || rawText.length < 20) throw new Error('Tidak ada teks yang dapat diekstrak dari file ini.');

        // Step 3: Chunk text
        onProgress(3, 'Memotong teks menjadi chunks...');
        const chunks = chunkText(rawText);
        if (chunks.length === 0) throw new Error('Chunking gagal — teks terlalu pendek.');

        // Step 4: Generate embeddings + insert to Supabase (batch)
        onProgress(4, `Generating embeddings untuk ${chunks.length} chunks...`);
        const chunkRows = [];

        for (let i = 0; i < chunks.length; i++) {
            onProgress(4, `Embedding chunk ${i + 1}/${chunks.length}...`);
            const embedding = await generateEmbedding(chunks[i]);
            chunkRows.push({
                document_id: docId,
                content: chunks[i],
                embedding: JSON.stringify(embedding),
                chunk_index: i,
                metadata: { source, file_name: file.name, file_type: ext }
            });
            // Small delay to avoid rate limiting
            if (i % 5 === 4) await new Promise(r => setTimeout(r, 500));
        }

        // Step 5: Save to Supabase
        onProgress(5, 'Menyimpan ke Supabase pgvector...');
        const { error: chunkErr } = await supabase.from('knowledge_chunks').insert(chunkRows);
        if (chunkErr) throw new Error(`Gagal menyimpan chunks: ${chunkErr.message}`);

        // Update document status
        await supabase.from('knowledge_documents').update({
            status: 'done',
            chunk_count: chunks.length
        }).eq('id', docId);

        return { success: true, docId, chunkCount: chunks.length };

    } catch (err) {
        // Mark document as error
        await supabase.from('knowledge_documents').update({
            status: 'error',
            error_msg: err.message
        }).eq('id', docId);
        throw err;
    }
}

// ── URL Import ───────────────────────────────────────────────────────────────

export async function importFromUrl(url, onProgress = () => { }) {
    onProgress(1, 'Mengakses URL...');

    // Use Gemini to extract from URL by fetching content
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    let htmlText = '';
    try {
        const res = await fetch(proxyUrl);
        htmlText = await res.text();
        // Strip HTML tags
        const tmp = document.createElement('div');
        tmp.innerHTML = htmlText;
        htmlText = tmp.innerText || tmp.textContent || '';
    } catch {
        throw new Error('Tidak bisa mengakses URL tersebut. Pastikan URL publik dan dapat diakses.');
    }

    if (!htmlText || htmlText.length < 50) throw new Error('Tidak ada konten yang bisa diambil dari URL ini.');

    const fakeFile = new File([htmlText], new URL(url).hostname + '_content.txt', { type: 'text/plain' });
    return uploadDocument(fakeFile, 'pakar', onProgress);
}

// ── Fetch Documents from Supabase ────────────────────────────────────────────

export async function fetchDocuments() {
    const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function fetchStats() {
    const [docsRes, chunksRes] = await Promise.all([
        supabase.from('knowledge_documents').select('id', { count: 'exact', head: true }).eq('status', 'done'),
        supabase.from('knowledge_chunks').select('id', { count: 'exact', head: true })
    ]);

    return {
        docs: docsRes.count || 0,
        chunks: chunksRes.count || 0
    };
}

export async function deleteDocument(id) {
    const { error } = await supabase.from('knowledge_documents').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

// ── Semantic Search (for chatbot) ────────────────────────────────────────────

export async function semanticSearch(query, topK = 10) {
    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_chunks', {
        query_embedding: queryEmbedding,
        match_count: topK,
        min_similarity: 0.25
    });

    if (error) {
        console.warn('Semantic search error:', error.message);
        return [];
    }

    return data || [];
}

// ── Chat with RAG context ─────────────────────────────────────────────────────

export async function chatWithRAG(userMessage, benefitMode = false) {
    // 1. Semantic search — retrieve up to 10 most relevant chunks
    const chunks = await semanticSearch(userMessage, 10);

    if (chunks.length === 0) {
        return {
            reply: 'Belum ada dokumen dalam knowledge base. Silakan hubungi admin untuk mengupload dokumen.',
            sources: []
        };
    }

    // 2. Merge all retrieved chunks into one raw context block
    const rawContext = chunks.map(c => c.content).join('\n\n');

    // 3. System prompt: focused on question, but covers ALL sub-features of the asked topic
    const systemPrompt = `Anda adalah Ocean AI Assistant — asisten internal BCA untuk platform Ocean by BCA.

TUGAS: Jawab pertanyaan pengguna berdasarkan KONTEKS di bawah ini.

ATURAN JAWABAN:
1. Gunakan HANYA informasi dari KONTEKS. Dilarang menambah dari luar.
2. Jika pertanyaan tentang sebuah fitur atau halaman (misal: "Business Dashboard"), tampilkan SEMUA sub-fitur dari fitur tersebut yang disebutkan dalam konteks — termasuk sub-fitur seperti "Informasi Rekening", "History Rekening", "e-Rate", dll. — meski tidak secara eksplisit disebut dalam pertanyaan.
3. Jangan tampilkan konten dari topik/fitur LAIN yang tidak ditanyakan (misal: jangan masukkan "Tata Cara Pendaftaran" atau "Leave Contact" jika tidak ditanya).
4. Format jawaban: gunakan ### untuk heading, **bold** untuk istilah penting, dan * untuk bullet list.
5. Bahasa Indonesia yang profesional dan mudah dipahami.
${benefitMode ? '6. JALANKAN MODE BENEFIT TRANSLATOR: Ubah semua penjelasan teknis menjadi bahasa benefit bisnis secara otomatis. Jelaskan apa keuntungan nyata bagi bisnis nasabah (misal efisiensi waktu, hemat biaya, kontrol yang lebih baik, kemudahan rekonsiliasi).' : ''}

KONTEKS:
${rawContext}`;

    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
    };

    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error('Gemini API error');

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, terjadi kesalahan.';

    return { reply, sources: chunks };
}

// ── Chat Simulation (Role-play) ──────────────────────────────────────────────

export async function chatSimulation(userMessage, simId, history = []) {
    let persona = '';
    if (simId === 'umkm') {
        persona = `Anda adalah seorang pengusaha UMKM Retail yang sedang ditawari produk BCA. 
Sifat Anda: Agak santai, tapi kritis mengenai biaya admin, sangat peduli pada kelancaran operasional harian, dan mencari fitur yang benar-benar praktis tanpa ribet.
Jangan bertindak seperti AI atau asisten. Bertindaklah murni sebagai nasabah yang merespons tawaran (pitching) dari staf BCA (user).`;
    } else {
        persona = `Anda adalah seorang CFO (Direktur Keuangan) dari sebuah perusahaan Korporasi Premier yang sedang ditawari solusi cash management BCA. 
Sifat Anda: Sangat formal, to-the-point, kritis, dan berfokus pada likuiditas, efisiensi B2B, rekonsiliasi data, serta keamanan (security) tingkat tinggi.
Jangan bertindak seperti AI atau asisten. Bertindaklah murni sebagai eksekutif yang menantang dan merespons pitching dari staf BCA (user).`;
    }

    const systemPrompt = `PERAN ANDA:
${persona}

ATURAN JAWABAN:
1. Jawab seolah-olah Anda sedang bercakap-cakap tatap muka atau via telepon.
2. Jangan menggunakan format yang terlalu rapi atau terstruktur seperti AI (hindari bullet points jika tidak perlu).
3. Berikan respons yang singkat namun berbobot, lemparkan pertanyaan atau keraguan jika penjelasan staf belum meyakinkan.
4. Gunakan Bahasa Indonesia sesuai persona.`;

    const contents = history.map(h => ({
        role: h.role === 'ai' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
    
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    };

    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        console.error('Simulation error:', await res.text());
        return 'Maaf, terjadi kesalahan pada simulasi.';
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Ecosystem Optimizer AI ───────────────────────────────────────────────────
export async function generateEcosystemOptimizer(networkParams) {
    const prompt = `Anda adalah "Ocean Predictive Intelligence Layer" - sistem konsultan manajemen tingkat tinggi (Ocean-Class).
Hasilkan *Corporate Strategic Blueprint* (Value Network Simulation) berdasarkan topologi bisnis B2B nasabah berikut:
- Model Bisnis Utama: ${networkParams.bizModel}
- Ketergantungan Tier-1 Suppliers: ${networkParams.suppliers}
- Tingkat Eksposur Valas (FX): ${networkParams.fxExposure}
- Metode Koleksi Dominan: ${networkParams.collectionMethod}

Keluarkan HTML murni (tanpa tag markdown \`\`\`html) berbentuk Blueprint Strategis super elegan:
1. <h3 style="color:#1e3a8a; font-weight:900; border-bottom:2px solid #cbd5e1; padding-bottom:8px; margin-bottom:1rem;">B2B Supply Chain & Value Network Blueprint</h3>
2. <b>Upstream Optimization (Supplier Side)</b>: Analisis mendalam SCF (Supply Chain Finance) dan mitigasi risiko pasokan.
3. <b>Treasury & FX Hedging</b>: Rekomendasi spesifik mitigasi fluktuasi nilai tukar menggunakan instrumen derivatif BCA (Forward/Swap).
4. <b>Downstream Automation</b>: Solusi digitalisasi piutang dengan API BCA & Virtual Account.
5. <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:15px; margin-top:20px; border-radius:8px;"><b>Estimated Annual Efficiency Gain:</b> [Hitung nilai nominal rupiah/persen secara fiktif namun terlihat dihitung presisi, misal: Cost Reduction Rp 1.25M atau Cash Conversion cycle -8 days]</div>`;

    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
    };

    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error('Gemini API error');

    const data = await res.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Gagal menghasilkan rekomendasi.';
    // Clean up markdown code blocks if AI still output them
    reply = reply.replace(/```html/g, '').replace(/```/g, '');
    return reply;
}

// ── Predictive Intelligence Layer ────────────────────────────────────────────

export async function generateCashFlowForecast(sandboxData, macroParams = {}) {
    const prompt = `Anda adalah "Ocean Predictive Intelligence Layer" - sistem AI Enterprise dari BCA.
Buatkan Laporan Proyeksi Cash Flow Tingkat Eksekutif (Corporate-Grade) berdasarkan data berikut:
- Saldo: Rp ${sandboxData.totalBalance.toLocaleString('id-ID')}
- Pemasukan/Pengeluaran Harian: Rp ${sandboxData.incomingToday.toLocaleString('id-ID')} / Rp ${sandboxData.outgoingToday.toLocaleString('id-ID')}
- Tagihan: ${JSON.stringify(sandboxData.invoices)}
- Kondisi Makro: ${JSON.stringify(macroParams)}

Keluarkan output dalam HTML murni (tanpa tag \`\`\`html) dengan gaya enterprise dashboard yang mewah:
1. <h3 style="color:#1e3a8a; font-weight:800; border-bottom:1px solid #cbd5e1; padding-bottom:8px;">Executive Brief: 30-Day Liquidity Forecast</h3>
2. Paragraf ringkasan eksekutif (Executive Summary).
3. <b>Key Risk Drivers</b> (Gunakan list <ul> dengan persentase probabilitas, misal "Keterlambatan Piutang: 65%").
4. <div style="background:#f8fafc; border-left:4px solid #2563eb; padding:12px; margin-top:12px;"> <b>3-Tier Mitigation Strategy:</b><br>- Short-term (1-7 Hari): ...<br>- Mid-term (15-30 Hari): ...<br>- Long-term: ... </div>`;

    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500 }
    };
    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini API error');
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```html/g, '').replace(/```/g, '');
}

export async function generateEarlyAlerts(sandboxData, filters = {}) {
    const prompt = `Anda adalah "Ocean Predictive Intelligence Layer". 
Hasilkan Laporan Anomali Operasional (Early Warning System) level Enterprise.
Data:
- Tagihan: ${JSON.stringify(sandboxData.invoices)}
- Transaksi: ${JSON.stringify(sandboxData.transactions)}

Berikan output HTML murni (tanpa \`\`\`html) yang berisi tabel laporan anomali tingkat tinggi.
Gunakan format tabel HTML yang rapi:
<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
<thead style="background:#f1f5f9; text-align:left;"><tr><th style="padding:10px;">Risk Identifier</th><th style="padding:10px;">Severity</th><th style="padding:10px;">Impact Analysis</th><th style="padding:10px;">BCA Action Plan</th></tr></thead>
<tbody>
... (berikan 3-4 baris anomali yang mendalam, Severity gunakan badge warna: High=Merah, Medium=Kuning)
</tbody>
</table>`;

    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1200 } };
    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini API error');
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```html/g, '').replace(/```/g, '');
}

export async function runScenarioSimulation(scenarioParams, sandboxData) {
    const prompt = `Anda adalah "Ocean Predictive Intelligence Layer".
Jalankan Financial Stress Test (Corporate Simulation) dengan parameter makro kompleks berikut:
- Variabel Skenario Utama: ${JSON.stringify(scenarioParams)}
- Data Saldo Saat Ini: Rp ${sandboxData.totalBalance.toLocaleString('id-ID')}

Tuliskan laporan Simulasi Dampak (Impact Analysis Report) dalam HTML murni. 
Harus memuat:
1. <h4 style="color:#991b1b; border-bottom:1px solid #fecaca; padding-bottom:8px;">Financial Impact Simulation</h4>
2. <div style="display:flex; gap:20px; margin-top:12px;">... [Kotak berisi Angka Nominal Dampak (Impact Amount) yang sangat besar, warna merah/hijau] ...</div>
3. Daftar poin-poin "Cascading Effects" (Efek domino pada operasional).
4. Rekomendasi Restrukturisasi atau Solusi Hedging BCA (misal: "FX Forward", "Trade Finance Line").`;

    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 1500 } };
    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini API error');
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```html/g, '').replace(/```/g, '');
}

export async function calculateBusinessHealthScore(params, sandboxData) {
    const prompt = `Anda adalah "Ocean Predictive Intelligence Layer" - platform intelijen sekelas terminal finansial papan atas (Ocean-Class).
Berdasarkan parameter industri:
- Sektor/Sub-Sektor: ${params.sector}
- Skala Pendapatan (Revenue): ${params.revenue}
- Regional Coverage: ${params.region}
Data Saldo Saat Ini: Rp ${sandboxData.totalBalance.toLocaleString('id-ID')}

Tugas Anda adalah menghasilkan HTML Laporan "Deep Industry Benchmark & Peer-to-Peer Gap Analysis" (tanpa \`\`\`html).
Keluarkan Laporan HTML Murni yang berisi:
1. Header <h3 style="color:#0f172a; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">Corporate Peer Matrix vs Top 10% Industry Leaders</h3>
2. Tabel Gap Analysis 7-Point KPIs (DSO, DPO, Inventory Turnover, Quick Ratio, Debt-to-Equity, EBITDA Margin, Cost of Fund). Tabel ini harus sangat detail, memiliki kolom (Metric, Perusahaan Anda, Industry Median, Top 10% Leaders, Gap). Styling tabel harus rapi dan profesional.
3. <b>Opportunity Loss Calculation</b>: Paragraf tebal dengan background merah muda transparan yang menghitung kerugian potensial akibat tertinggal dari rata-rata industri.
4. Strategi penutupan gap (Gap Closure Strategy) spesifik via ekosistem BCA.`;

    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1800 } };
    const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini API error');
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```html/g, '').replace(/```/g, '');
}
