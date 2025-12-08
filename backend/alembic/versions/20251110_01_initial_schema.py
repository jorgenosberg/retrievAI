"""initial schema with user settings tables"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import ProgrammingError


# revision identifiers, used by Alembic.
revision = "20251110_01"
down_revision = None
branch_labels = None
depends_on = None


def _create_enum_if_needed(name: str, values: list[str]) -> None:
    enum_values = ", ".join(f"'{value}'" for value in values)
    statement = sa.text(f"CREATE TYPE {name} AS ENUM ({enum_values})")

    try:
        op.execute(statement)
    except ProgrammingError as exc:  # Postgres duplicate enum type
        if getattr(exc.orig, "sqlstate", None) != "42710":
            raise


def upgrade() -> None:
    # Define Enums with create_type=False to prevent auto-creation in create_table
    # Note: Using uppercase enum values to match SQLAlchemy enum member names
    userrole = postgresql.ENUM("USER", "ADMIN", name="userrole", create_type=False)
    documentstatus = postgresql.ENUM(
        "PROCESSING", "COMPLETED", "FAILED", name="documentstatus", create_type=False
    )
    taskstatus = postgresql.ENUM(
        "PENDING", "RUNNING", "COMPLETED", "FAILED", name="taskstatus", create_type=False
    )

    _create_enum_if_needed("userrole", ["USER", "ADMIN"])
    _create_enum_if_needed("documentstatus", ["PROCESSING", "COMPLETED", "FAILED"])
    _create_enum_if_needed("taskstatus", ["PENDING", "RUNNING", "COMPLETED", "FAILED"])

    op.create_table(
        "users",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("role", userrole, nullable=False, server_default="USER"),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "authorized_emails",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_authorized_emails_email", "authorized_emails", ["email"], unique=True)

    op.create_table(
        "conversations",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"], unique=False)

    op.create_table(
        "app_settings",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_app_settings_key", "app_settings", ["key"], unique=True)

    op.create_table(
        "documents",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("file_hash", sa.String(length=255), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", documentstatus, nullable=False, server_default="PROCESSING"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("doc_metadata", sa.JSON(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_hash"),
    )
    op.create_index("ix_documents_file_hash", "documents", ["file_hash"], unique=True)

    op.create_table(
        "messages",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "api_keys",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("service", sa.String(length=100), nullable=False),
        sa.Column("encrypted_key", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_preferences",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("preferences", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "user_api_keys",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("service", sa.String(length=100), nullable=False, server_default="openai"),
        sa.Column("encrypted_key", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "background_tasks",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_type", sa.String(length=100), nullable=False),
        sa.Column("status", taskstatus, nullable=False, server_default="PENDING"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("background_tasks")
    op.drop_table("user_api_keys")
    op.drop_table("user_preferences")
    op.drop_table("api_keys")
    op.drop_table("messages")
    op.drop_index("ix_documents_file_hash", table_name="documents")
    op.drop_table("documents")
    op.drop_table("app_settings")
    op.drop_index("ix_conversations_user_id", table_name="conversations")
    op.drop_table("conversations")
    op.drop_index("ix_authorized_emails_email", table_name="authorized_emails")
    op.drop_table("authorized_emails")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    taskstatus = postgresql.ENUM("PENDING", "RUNNING", "COMPLETED", "FAILED", name="taskstatus")
    documentstatus = postgresql.ENUM("PROCESSING", "COMPLETED", "FAILED", name="documentstatus")
    userrole = postgresql.ENUM("USER", "ADMIN", name="userrole")

    taskstatus.drop(op.get_bind(), checkfirst=True)
    documentstatus.drop(op.get_bind(), checkfirst=True)
    userrole.drop(op.get_bind(), checkfirst=True)
