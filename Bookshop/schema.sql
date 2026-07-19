-- Book Corner — Cấu trúc CSDL SQLite
-- Khớp theo sơ đồ ERD: category, book, customer, order, order_item

DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS "order";
DROP TABLE IF EXISTS customer;
DROP TABLE IF EXISTS book;
DROP TABLE IF EXISTS category;

-- Danh mục sách
CREATE TABLE category (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

-- Thông tin sách
CREATE TABLE book (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER NOT NULL,
  title         TEXT NOT NULL,
  author        TEXT NOT NULL,
  publish_year  INTEGER,
  price         INTEGER NOT NULL,
  image         TEXT,
  in_stock      INTEGER NOT NULL DEFAULT 1 CHECK (in_stock IN (0, 1)),
  FOREIGN KEY (category_id) REFERENCES category (id)
);

-- Thông tin khách hàng
CREATE TABLE customer (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  fullname   TEXT NOT NULL,
  email      TEXT UNIQUE,
  phone      TEXT,
  address    TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Đơn hàng của khách
CREATE TABLE "order" (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL,
  order_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  FOREIGN KEY (customer_id) REFERENCES customer (id)
);

-- Chi tiết từng cuốn trong đơn hàng
CREATE TABLE order_item (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  book_id    INTEGER NOT NULL,
  quantity   INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  subtotal   INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES "order" (id),
  FOREIGN KEY (book_id) REFERENCES book (id)
);

CREATE INDEX idx_book_category ON book (category_id);
CREATE INDEX idx_order_customer ON "order" (customer_id);
CREATE INDEX idx_order_item_order ON order_item (order_id);
CREATE INDEX idx_order_item_book ON order_item (book_id);
