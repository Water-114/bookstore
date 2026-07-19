"""Blueprint quản trị — CRUD cho Sách (book) và Danh mục (category)."""

import sqlite3

from flask import Blueprint, flash, redirect, render_template, request, url_for

import database

bp = Blueprint("admin", __name__)


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

def _book_view(source=None):
    """Chuẩn hóa dữ liệu sách (sqlite3.Row / form POST / None) về 1 dict thống nhất cho template."""
    if source is None:
        return {
            "title": "", "author": "", "category_id": "", "publish_year": "",
            "price": "", "image": "", "in_stock": True,
        }
    if isinstance(source, sqlite3.Row):
        return {
            "title": source["title"], "author": source["author"],
            "category_id": source["category_id"], "publish_year": source["publish_year"],
            "price": source["price"], "image": source["image"],
            "in_stock": bool(source["in_stock"]),
        }
    return {
        "title": source.get("title", ""), "author": source.get("author", ""),
        "category_id": source.get("category_id", ""), "publish_year": source.get("publish_year", ""),
        "price": source.get("price", ""), "image": source.get("image", ""),
        "in_stock": source.get("in_stock") == "on",
    }


def _validate_book_form(form, category_ids):
    errors = []
    if not form.get("title", "").strip():
        errors.append("Tên sách không được để trống.")
    if not form.get("author", "").strip():
        errors.append("Tác giả không được để trống.")

    category_id = form.get("category_id", "")
    if not category_id.isdigit() or int(category_id) not in category_ids:
        errors.append("Vui lòng chọn một danh mục hợp lệ.")

    price = form.get("price", "")
    if not price.isdigit():
        errors.append("Giá sách phải là số nguyên không âm.")

    year = form.get("publish_year", "").strip()
    if year and not year.isdigit():
        errors.append("Năm xuất bản phải là số.")

    return errors


# ---------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------

@bp.route("/")
def dashboard():
    db = database.get_db()
    book_count = db.execute("SELECT COUNT(*) FROM book").fetchone()[0]
    category_count = db.execute("SELECT COUNT(*) FROM category").fetchone()[0]
    return render_template(
        "admin/dashboard.html",
        active="dashboard",
        book_count=book_count,
        category_count=category_count,
    )


# ---------------------------------------------------------------
# Categories CRUD
# ---------------------------------------------------------------

@bp.route("/categories")
def categories_list():
    db = database.get_db()
    categories = db.execute(
        """
        SELECT c.id, c.name, COUNT(b.id) AS book_count
        FROM category c
        LEFT JOIN book b ON b.category_id = c.id
        GROUP BY c.id
        ORDER BY c.id
        """
    ).fetchall()
    return render_template("admin/categories_list.html", active="categories", categories=categories)


@bp.route("/categories/new", methods=["GET", "POST"])
def category_new():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        if not name:
            flash("Tên danh mục không được để trống.", "error")
            return render_template("admin/category_form.html", active="categories", category={"name": name}, is_new=True)

        db = database.get_db()
        db.execute("INSERT INTO category (name) VALUES (?)", (name,))
        db.commit()
        flash(f'Đã thêm danh mục "{name}".', "success")
        return redirect(url_for("admin.categories_list"))

    return render_template("admin/category_form.html", active="categories", category=None, is_new=True)


@bp.route("/categories/<int:category_id>/edit", methods=["GET", "POST"])
def category_edit(category_id):
    db = database.get_db()
    category = db.execute("SELECT * FROM category WHERE id = ?", (category_id,)).fetchone()
    if category is None:
        flash("Không tìm thấy danh mục.", "error")
        return redirect(url_for("admin.categories_list"))

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        if not name:
            flash("Tên danh mục không được để trống.", "error")
            return render_template(
                "admin/category_form.html", active="categories",
                category={"name": name}, is_new=False, category_id=category_id,
            )

        db.execute("UPDATE category SET name = ? WHERE id = ?", (name, category_id))
        db.commit()
        flash(f'Đã cập nhật danh mục "{name}".', "success")
        return redirect(url_for("admin.categories_list"))

    return render_template(
        "admin/category_form.html", active="categories",
        category=category, is_new=False, category_id=category_id,
    )


@bp.route("/categories/<int:category_id>/delete", methods=["POST"])
def category_delete(category_id):
    db = database.get_db()
    book_count = db.execute("SELECT COUNT(*) FROM book WHERE category_id = ?", (category_id,)).fetchone()[0]
    if book_count > 0:
        flash(f"Không thể xóa: còn {book_count} sách thuộc danh mục này.", "error")
    else:
        db.execute("DELETE FROM category WHERE id = ?", (category_id,))
        db.commit()
        flash("Đã xóa danh mục.", "success")
    return redirect(url_for("admin.categories_list"))


# ---------------------------------------------------------------
# Books CRUD
# ---------------------------------------------------------------

@bp.route("/books")
def books_list():
    db = database.get_db()
    q = request.args.get("q", "").strip()
    category_id = request.args.get("category", type=int)

    query = """
        SELECT b.id, b.title, b.author, b.publish_year, b.price, b.image, b.in_stock,
               b.category_id, c.name AS category_name
        FROM book b
        JOIN category c ON c.id = b.category_id
        WHERE 1 = 1
    """
    params = []
    if q:
        query += " AND (b.title LIKE ? OR b.author LIKE ?)"
        params += [f"%{q}%", f"%{q}%"]
    if category_id:
        query += " AND b.category_id = ?"
        params.append(category_id)
    query += " ORDER BY b.id DESC"

    books = db.execute(query, params).fetchall()
    categories = db.execute("SELECT id, name FROM category ORDER BY name").fetchall()

    return render_template(
        "admin/books_list.html", active="books",
        books=books, categories=categories, q=q, selected_category=category_id,
    )


@bp.route("/books/new", methods=["GET", "POST"])
def book_new():
    db = database.get_db()
    categories = db.execute("SELECT id, name FROM category ORDER BY name").fetchall()
    category_ids = [c["id"] for c in categories]

    if request.method == "POST":
        errors = _validate_book_form(request.form, category_ids)
        if errors:
            for e in errors:
                flash(e, "error")
            return render_template(
                "admin/book_form.html", active="books",
                book=_book_view(request.form), categories=categories, is_new=True,
            )

        db.execute(
            """
            INSERT INTO book (category_id, title, author, publish_year, price, image, in_stock)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(request.form["category_id"]),
                request.form["title"].strip(),
                request.form["author"].strip(),
                int(request.form["publish_year"]) if request.form.get("publish_year", "").strip() else None,
                int(request.form["price"]),
                request.form.get("image", "").strip() or None,
                1 if request.form.get("in_stock") == "on" else 0,
            ),
        )
        db.commit()
        flash(f'Đã thêm sách "{request.form["title"].strip()}".', "success")
        return redirect(url_for("admin.books_list"))

    return render_template(
        "admin/book_form.html", active="books",
        book=_book_view(None), categories=categories, is_new=True,
    )


@bp.route("/books/<int:book_id>/edit", methods=["GET", "POST"])
def book_edit(book_id):
    db = database.get_db()
    book_row = db.execute("SELECT * FROM book WHERE id = ?", (book_id,)).fetchone()
    categories = db.execute("SELECT id, name FROM category ORDER BY name").fetchall()
    category_ids = [c["id"] for c in categories]

    if book_row is None:
        flash("Không tìm thấy sách.", "error")
        return redirect(url_for("admin.books_list"))

    if request.method == "POST":
        errors = _validate_book_form(request.form, category_ids)
        if errors:
            for e in errors:
                flash(e, "error")
            return render_template(
                "admin/book_form.html", active="books",
                book=_book_view(request.form), categories=categories, is_new=False, book_id=book_id,
            )

        db.execute(
            """
            UPDATE book
            SET category_id = ?, title = ?, author = ?, publish_year = ?, price = ?, image = ?, in_stock = ?
            WHERE id = ?
            """,
            (
                int(request.form["category_id"]),
                request.form["title"].strip(),
                request.form["author"].strip(),
                int(request.form["publish_year"]) if request.form.get("publish_year", "").strip() else None,
                int(request.form["price"]),
                request.form.get("image", "").strip() or None,
                1 if request.form.get("in_stock") == "on" else 0,
                book_id,
            ),
        )
        db.commit()
        flash(f'Đã cập nhật sách "{request.form["title"].strip()}".', "success")
        return redirect(url_for("admin.books_list"))

    return render_template(
        "admin/book_form.html", active="books",
        book=_book_view(book_row), categories=categories, is_new=False, book_id=book_id,
    )


@bp.route("/books/<int:book_id>/delete", methods=["POST"])
def book_delete(book_id):
    db = database.get_db()
    used = db.execute("SELECT COUNT(*) FROM order_item WHERE book_id = ?", (book_id,)).fetchone()[0]
    if used > 0:
        flash("Không thể xóa: sách này đã xuất hiện trong đơn hàng.", "error")
    else:
        db.execute("DELETE FROM book WHERE id = ?", (book_id,))
        db.commit()
        flash("Đã xóa sách.", "success")
    return redirect(url_for("admin.books_list"))
