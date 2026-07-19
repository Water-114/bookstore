"""Kết nối SQLite và khởi tạo/seed dữ liệu cho Book Corner."""

import json
import sqlite3
from pathlib import Path

import click
from flask import current_app, g


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Xóa và tạo lại toàn bộ bảng theo schema.sql."""
    db = get_db()
    schema_path = Path(current_app.root_path) / "schema.sql"
    with open(schema_path, encoding="utf-8") as f:
        db.executescript(f.read())


def seed_db():
    """Nạp dữ liệu category/book từ Data/books.json nếu bảng category đang trống."""
    db = get_db()
    already_seeded = db.execute("SELECT COUNT(*) FROM category").fetchone()[0]
    if already_seeded:
        return

    data_path = Path(current_app.root_path) / "Data" / "books.json"
    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)

    for cat in data.get("categories", []):
        db.execute(
            "INSERT INTO category (id, name) VALUES (?, ?)",
            (cat["id"], cat["name"]),
        )

    for b in data.get("books", []):
        db.execute(
            """
            INSERT INTO book (id, category_id, title, author, publish_year, price, image, in_stock)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                b["id"],
                b["categoryId"],
                b["title"],
                b["author"],
                b.get("year"),
                b["price"],
                b.get("image"),
                1 if b.get("inStock", True) else 0,
            ),
        )

    db.commit()


def init_and_seed():
    """Tạo bảng (nếu chưa có) rồi seed dữ liệu mẫu — dùng khi khởi động app."""
    db = get_db()
    tables = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='category'"
    ).fetchone()
    if not tables:
        init_db()
    seed_db()


@click.command("init-db")
def init_db_command():
    """Lệnh CLI: flask --app app init-db (xóa toàn bộ dữ liệu và tạo lại bảng)."""
    init_db()
    click.echo("Đã khởi tạo lại cấu trúc CSDL.")


@click.command("seed-db")
def seed_db_command():
    """Lệnh CLI: flask --app app seed-db (nạp dữ liệu mẫu nếu bảng đang trống)."""
    seed_db()
    click.echo("Đã nạp dữ liệu mẫu (nếu cần).")


def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(seed_db_command)
