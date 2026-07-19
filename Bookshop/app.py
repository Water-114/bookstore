"""Book Corner — Flask app."""

import os

from flask import Flask, jsonify, render_template

import admin
import database


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "dev"
    app.config["DATABASE"] = os.path.join(app.root_path, "bookshop.db")

    database.init_app(app)

    with app.app_context():
        database.init_and_seed()

    register_routes(app)
    app.register_blueprint(admin.bp, url_prefix="/admin")

    @app.template_filter("vnd")
    def vnd_filter(value):
        try:
            value = int(value)
        except (TypeError, ValueError):
            return value
        return f"{value:,}".replace(",", ".") + "₫"

    return app


def register_routes(app):
    @app.route("/")
    def index():
        return render_template("index.html", active_page="home")

    @app.route("/products")
    def products():
        return render_template("products.html", active_page="products")

    @app.route("/contact")
    def contact():
        return render_template("contact.html", active_page="contact")

    @app.route("/api/books")
    def api_books():
        db = database.get_db()

        categories = db.execute("SELECT id, name FROM category ORDER BY id").fetchall()
        books = db.execute(
            """
            SELECT id, category_id, title, author, publish_year, price, image, in_stock
            FROM book
            ORDER BY id
            """
        ).fetchall()

        return jsonify(
            {
                "categories": [{"id": c["id"], "name": c["name"]} for c in categories],
                "books": [
                    {
                        "id": b["id"],
                        "categoryId": b["category_id"],
                        "title": b["title"],
                        "author": b["author"],
                        "year": b["publish_year"],
                        "price": b["price"],
                        "image": b["image"],
                        "inStock": bool(b["in_stock"]),
                    }
                    for b in books
                ],
            }
        )


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
