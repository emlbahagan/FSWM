BEGIN;

SET search_path TO fswm, public;

CREATE TABLE IF NOT EXISTS privacy_notices (
    privacy_notice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_version VARCHAR(40) NOT NULL UNIQUE,
    title VARCHAR(220) NOT NULL,
    content TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_privacy_notice_content CHECK (btrim(content) <> ''),
    CONSTRAINT chk_privacy_notice_publish_pair CHECK (
        is_published = FALSE
        OR (published_at IS NOT NULL AND published_by IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_privacy_notices_single_published
ON privacy_notices(is_published)
WHERE is_published = TRUE;

CREATE TABLE IF NOT EXISTS privacy_notice_acceptances (
    privacy_notice_acceptance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    privacy_notice_id UUID NOT NULL REFERENCES privacy_notices(privacy_notice_id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address INET,
    user_agent TEXT,
    UNIQUE (privacy_notice_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(80) NOT NULL,
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    source_table VARCHAR(80),
    source_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_notifications_read_pair CHECK (
        is_read = FALSE OR read_at IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action_code VARCHAR(120) NOT NULL,
    module_code VARCHAR(80) NOT NULL,
    target_table VARCHAR(80),
    target_id UUID,
    old_value_json JSONB,
    new_value_json JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_batches (
    import_batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_type VARCHAR(80) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    file_name VARCHAR(255) NOT NULL,
    total_rows INTEGER,
    successful_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    CONSTRAINT chk_import_batch_status CHECK (
        status IN ('PENDING', 'VALIDATING', 'FAILED', 'COMPLETED', 'ROLLED_BACK')
    ),
    CONSTRAINT chk_import_row_totals CHECK (
        total_rows IS NULL
        OR (
            total_rows >= 0
            AND successful_rows >= 0
            AND failed_rows >= 0
            AND successful_rows + failed_rows <= total_rows
        )
    )
);

CREATE TABLE IF NOT EXISTS import_rows (
    import_row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES import_batches(import_batch_id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    raw_data_json JSONB NOT NULL,
    is_successful BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    created_record_table VARCHAR(80),
    created_record_id UUID,
    CONSTRAINT chk_import_rows_row_number CHECK (row_number > 0),
    UNIQUE (import_batch_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_privacy_acceptances_user_id ON privacy_notice_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_batch_id ON import_rows(import_batch_id);

COMMIT;

