-- Migration 0002: Contract document fields for template engine
ALTER TABLE contracts ADD COLUMN client_signer_name TEXT;
ALTER TABLE contracts ADD COLUMN client_signer_document TEXT;
ALTER TABLE contracts ADD COLUMN signature_date INTEGER;
ALTER TABLE contracts ADD COLUMN document_status TEXT DEFAULT 'DRAFT';
ALTER TABLE contracts ADD COLUMN document_overrides TEXT; -- JSON
ALTER TABLE contracts ADD COLUMN final_pdf_url TEXT;
