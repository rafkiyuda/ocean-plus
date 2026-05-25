-- ============================================================
-- Ocean Mastery RAG — Supabase Schema Setup
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: knowledge_documents
-- Menyimpan metadata setiap file yang diingesti
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text        NOT NULL,
    file_type   text        NOT NULL,  -- 'pdf','docx','mp4','mp3','txt','csv','url','json'
    source      text        DEFAULT 'upload',  -- 'upload','pakar','mydevelopment'
    size_bytes  bigint,
    chunk_count int         DEFAULT 0,
    status      text        DEFAULT 'processing', -- 'processing','done','error'
    error_msg   text,
    created_at  timestamptz DEFAULT now()
);

-- Table: knowledge_chunks
-- Menyimpan potongan teks + embedding vektor dari setiap dokumen
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id  uuid        REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    content      text        NOT NULL,
    embedding    vector(768),   -- Gemini text-embedding-004 = 768 dims
    chunk_index  int,
    metadata     jsonb       DEFAULT '{}',
    created_at   timestamptz DEFAULT now()
);

-- Index untuk similarity search (ivfflat)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
    ON public.knowledge_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ============================================================
-- Fungsi semantic search — dipanggil dari frontend
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_chunks(
    query_embedding vector(768),
    match_count     int DEFAULT 5,
    min_similarity  float DEFAULT 0.5
)
RETURNS TABLE (
    id          uuid,
    content     text,
    similarity  float,
    document_id uuid,
    metadata    jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        1 - (kc.embedding <=> query_embedding) AS similarity,
        kc.document_id,
        kc.metadata
    FROM public.knowledge_chunks kc
    WHERE 1 - (kc.embedding <=> query_embedding) > min_similarity
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================
-- RLS Policies — Allow public read/write for internal tool
-- ============================================================
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks    ENABLE ROW LEVEL SECURITY;

-- Allow all operations (internal tool — adjust for production)
CREATE POLICY "allow_all_documents" ON public.knowledge_documents
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_chunks" ON public.knowledge_chunks
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Selesai! Cek tabel di Table Editor Supabase
-- ============================================================
SELECT 'Setup complete!' AS message;
