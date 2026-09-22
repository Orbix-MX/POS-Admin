-- Project Brain — esquema del índice (proyección desechable del vault).
-- Sin migraciones: si SCHEMA_VERSION o la huella de la taxonomía cambian, el índice
-- se reconstruye. Esa es la política, y es válida porque nada de aquí es fuente de verdad.

CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE documents (
    id               INTEGER PRIMARY KEY,
    path             TEXT NOT NULL UNIQUE,     -- identidad del documento
    path_fold        TEXT NOT NULL,            -- comparación sin acentos ni mayúsculas
    slug             TEXT NOT NULL,
    title            TEXT NOT NULL,
    title_fold       TEXT NOT NULL,
    type             TEXT NOT NULL,
    owner            TEXT,
    updated          TEXT,
    area             TEXT NOT NULL,
    scope            TEXT,
    content_hash     TEXT NOT NULL,
    size_bytes       INTEGER NOT NULL,
    mtime_ns         INTEGER NOT NULL,
    frontmatter_json TEXT NOT NULL DEFAULT '{}',
    heading_count    INTEGER NOT NULL DEFAULT 0,
    word_count       INTEGER NOT NULL DEFAULT 0,
    has_frontmatter  INTEGER NOT NULL DEFAULT 0,
    needs_validation INTEGER NOT NULL DEFAULT 0,
    indexed_at       TEXT NOT NULL
);

CREATE INDEX idx_documents_path_fold ON documents(path_fold);
CREATE INDEX idx_documents_slug      ON documents(slug);
CREATE INDEX idx_documents_title     ON documents(title_fold);
CREATE INDEX idx_documents_type      ON documents(type);
CREATE INDEX idx_documents_area      ON documents(area, scope);
CREATE INDEX idx_documents_updated   ON documents(updated);

CREATE TABLE tags (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE document_tags (
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX idx_document_tags_tag ON document_tags(tag_id);

-- Los enlaces son el grafo. `status` distingue lo que falta (pendiente, normal en un
-- vault vivo) de lo que está mal (ambiguo, defecto de nomenclatura).
CREATE TABLE links (
    id              INTEGER PRIMARY KEY,
    source_id       INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    raw_target      TEXT NOT NULL,
    target_key      TEXT NOT NULL,
    label           TEXT,
    anchor          TEXT,
    kind            TEXT NOT NULL,
    status          TEXT NOT NULL,
    -- SET NULL, no CASCADE: borrar un documento no destruye los enlaces que lo
    -- apuntaban; los deja pendientes, que es la verdad.
    target_id       INTEGER REFERENCES documents(id) ON DELETE SET NULL,
    candidate_count INTEGER NOT NULL DEFAULT 0,
    occurrences     INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_links_source ON links(source_id);
CREATE INDEX idx_links_target ON links(target_id);
CREATE INDEX idx_links_key    ON links(target_key);
CREATE INDEX idx_links_status ON links(status);

-- Búsqueda. `remove_diacritics 2` es obligatorio: el vault está en español y nadie
-- escribe las tildes al buscar.
CREATE VIRTUAL TABLE documents_fts USING fts5(
    title,
    headings,
    tags,
    body,
    tokenize = 'unicode61 remove_diacritics 2',
    prefix = '2 3'
);
