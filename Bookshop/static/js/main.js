/* =========================================================
   Book Corner — main.js
   Tải dữ liệu sách, dựng giao diện và xử lý tương tác người dùng
   ========================================================= */

const DATA_URL = "/api/books";
const IMAGE_PATH = "/static/images/products/";
const CART_KEY = "bookcorner_cart";

const CATEGORY_ICONS = {
  1: "🧸",
  2: "📖",
  3: "🎓",
  4: "🔬",
};

let STATE = {
  books: [],
  categories: [],
};

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

function formatVND(value) {
  if (!value || value <= 0) return "Liên hệ";
  return value.toLocaleString("vi-VN") + "₫";
}

function formatPriceStrict(value) {
  return (value || 0).toLocaleString("vi-VN") + "₫";
}

function categoryName(id) {
  const cat = STATE.categories.find((c) => c.id === id);
  return cat ? cat.name : "";
}

function bookImage(book) {
  return IMAGE_PATH + book.image;
}

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

async function loadBooks() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("Không thể tải dữ liệu sách");
    const data = await res.json();
    STATE.books = data.books || [];
    STATE.categories = data.categories || [];
  } catch (err) {
    console.error(err);
    STATE.books = [];
    STATE.categories = [];
  }
}

/* ---------------------------------------------------------
   Cart (localStorage)
   --------------------------------------------------------- */

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(bookId) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === bookId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: bookId, qty: 1 });
  }
  saveCart(cart);
  const book = STATE.books.find((b) => b.id === bookId);
  showToast(book ? `Đã thêm "${truncate(book.title, 40)}" vào giỏ` : "Đã thêm vào giỏ hàng");
  renderCartDrawer();
}

function updateQty(bookId, delta) {
  let cart = getCart();
  const item = cart.find((i) => i.id === bookId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((i) => i.id !== bookId);
  }
  saveCart(cart);
  renderCartDrawer();
}

function removeFromCart(bookId) {
  const cart = getCart().filter((i) => i.id !== bookId);
  saveCart(cart);
  renderCartDrawer();
}

function clearCart() {
  saveCart([]);
  renderCartDrawer();
}

function cartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
  const badge = qs("#cartCount");
  if (badge) badge.textContent = cartCount();
}

function renderCartDrawer() {
  const container = qs("#cartItems");
  const totalEl = qs("#cartTotal");
  if (!container || !totalEl) return;

  const cart = getCart();
  if (cart.length === 0) {
    container.innerHTML = `<p class="cart-empty">Giỏ hàng của bạn đang trống.</p>`;
    totalEl.textContent = formatPriceStrict(0);
    return;
  }

  let total = 0;
  container.innerHTML = cart
    .map((item) => {
      const book = STATE.books.find((b) => b.id === item.id);
      if (!book) return "";
      const lineTotal = book.price * item.qty;
      total += lineTotal;
      return `
        <div class="cart-item">
          <img src="${bookImage(book)}" alt="${escapeHtml(book.title)}">
          <div class="cart-item-info">
            <div class="cart-item-title">${escapeHtml(book.title)}</div>
            <div class="cart-item-meta">
              <div class="qty-control">
                <button data-qty-minus="${book.id}" aria-label="Giảm số lượng">−</button>
                <span>${item.qty}</span>
                <button data-qty-plus="${book.id}" aria-label="Tăng số lượng">+</button>
              </div>
              <span class="cart-item-price">${formatPriceStrict(lineTotal)}</span>
            </div>
            <button class="cart-item-remove" data-remove="${book.id}">Xóa</button>
          </div>
        </div>
      `;
    })
    .join("");

  totalEl.textContent = formatPriceStrict(total);

  qsa("[data-qty-plus]", container).forEach((btn) =>
    btn.addEventListener("click", () => updateQty(Number(btn.dataset.qtyPlus), 1))
  );
  qsa("[data-qty-minus]", container).forEach((btn) =>
    btn.addEventListener("click", () => updateQty(Number(btn.dataset.qtyMinus), -1))
  );
  qsa("[data-remove]", container).forEach((btn) =>
    btn.addEventListener("click", () => removeFromCart(Number(btn.dataset.remove)))
  );
}

function setupCartDrawer() {
  const drawer = qs("#cartDrawer");
  const overlay = qs("#overlay");
  const openBtn = qs("#cartBtn");
  const closeBtn = qs("#cartCloseBtn");
  const clearBtn = qs("#cartClearBtn");

  function open() {
    renderCartDrawer();
    drawer.classList.add("open");
    overlay.classList.add("show");
  }
  function close() {
    drawer.classList.remove("open");
    overlay.classList.remove("show");
  }

  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  clearBtn?.addEventListener("click", clearCart);

  updateCartBadge();
}

/* ---------------------------------------------------------
   Toast
   --------------------------------------------------------- */

let toastTimer = null;
function showToast(message) {
  let toast = qs("#toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ---------------------------------------------------------
   Small utils
   --------------------------------------------------------- */

function truncate(str, len) {
  return str.length > len ? str.slice(0, len).trim() + "…" : str;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------
   Product Card
   --------------------------------------------------------- */

function productCardHtml(book) {
  const badge = book.year >= 2025 ? `<span class="product-badge">Mới</span>` : "";
  return `
    <article class="product-card" data-id="${book.id}">
      <a href="#" class="product-thumb" data-view="${book.id}">
        ${badge}
        <img src="${bookImage(book)}" alt="${escapeHtml(book.title)}" loading="lazy">
      </a>
      <div class="product-info">
        <span class="product-category">${escapeHtml(categoryName(book.categoryId))}</span>
        <h3 class="product-title">${escapeHtml(book.title)}</h3>
        <span class="product-author">${escapeHtml(book.author)}</span>
        <div class="product-bottom">
          <span class="product-price">${formatVND(book.price)}</span>
          <button class="add-cart-btn" data-add="${book.id}" aria-label="Thêm vào giỏ" title="Thêm vào giỏ">🛒</button>
        </div>
      </div>
    </article>
  `;
}

function bindProductCardEvents(container) {
  qsa("[data-add]", container).forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      addToCart(Number(btn.dataset.add));
    })
  );
}

/* ---------------------------------------------------------
   Home page: Carousel
   --------------------------------------------------------- */

const SLIDE_THEMES = [
  { eyebrow: "Book Corner", gradient: "linear-gradient(120deg, #fdf1cf, #ffffff)" },
  { eyebrow: "Thiếu Nhi", gradient: "linear-gradient(120deg, #fff3d6, #ffe9b8)" },
  { eyebrow: "Văn Học", gradient: "linear-gradient(120deg, #eef1fb, #dfe4f8)" },
  { eyebrow: "Giáo Trình", gradient: "linear-gradient(120deg, #fdf1cf, #f7e4ac)" },
  { eyebrow: "Khoa Học Kỹ Thuật", gradient: "linear-gradient(120deg, #eef1fb, #e5eaf9)" },
];

function buildHeroSlides() {
  const slides = [];

  slides.push({
    eyebrow: "Chào mừng đến Book Corner",
    title: "Góc sách của bạn — nơi tri thức được lan tỏa",
    desc: "Hàng ngàn đầu sách thiếu nhi, văn học, giáo trình và khoa học kỹ thuật với giá tốt mỗi ngày.",
    cta: { label: "Khám phá ngay", href: "/products" },
    image: STATE.books[0] ? bookImage(STATE.books[0]) : "",
    gradient: SLIDE_THEMES[0].gradient,
  });

  STATE.categories.forEach((cat, idx) => {
    const sample = STATE.books.find((b) => b.categoryId === cat.id);
    const theme = SLIDE_THEMES[(idx + 1) % SLIDE_THEMES.length];
    slides.push({
      eyebrow: `Danh mục ${cat.name}`,
      title: `Sách ${cat.name} đang chờ bạn khám phá`,
      desc: `Chọn lọc những đầu sách ${cat.name.toLowerCase()} chất lượng, cập nhật liên tục tại Book Corner.`,
      cta: { label: "Xem danh mục", href: `/products?cat=${cat.id}` },
      image: sample ? bookImage(sample) : "",
      gradient: theme.gradient,
    });
  });

  return slides;
}

function initCarousel() {
  const track = qs("#carouselTrack");
  const dotsWrap = qs("#carouselDots");
  if (!track) return;

  const slides = buildHeroSlides();
  if (slides.length === 0) return;

  track.innerHTML = slides
    .map(
      (s) => `
      <div class="carousel-slide" style="--slide-bg:${s.gradient}">
        <div class="slide-inner">
          <div class="slide-text">
            <span class="slide-eyebrow">${escapeHtml(s.eyebrow)}</span>
            <h2>${escapeHtml(s.title)}</h2>
            <p>${escapeHtml(s.desc)}</p>
            <a class="btn btn-primary" href="${s.cta.href}">${s.cta.label}</a>
          </div>
          ${s.image ? `<div class="slide-visual"><img src="${s.image}" alt=""></div>` : ""}
        </div>
      </div>
    `
    )
    .join("");

  dotsWrap.innerHTML = slides
    .map((_, i) => `<button data-dot="${i}" class="${i === 0 ? "active" : ""}" aria-label="Slide ${i + 1}"></button>`)
    .join("");

  let current = 0;
  const total = slides.length;

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    qsa("[data-dot]", dotsWrap).forEach((dot, i) => dot.classList.toggle("active", i === current));
  }

  qs("#carouselPrev")?.addEventListener("click", () => goTo(current - 1));
  qs("#carouselNext")?.addEventListener("click", () => goTo(current + 1));
  qsa("[data-dot]", dotsWrap).forEach((dot) =>
    dot.addEventListener("click", () => goTo(Number(dot.dataset.dot)))
  );

  let autoplay = setInterval(() => goTo(current + 1), 5500);
  const carousel = qs("#heroCarousel");
  carousel?.addEventListener("mouseenter", () => clearInterval(autoplay));
  carousel?.addEventListener("mouseleave", () => {
    autoplay = setInterval(() => goTo(current + 1), 5500);
  });

  goTo(0);
}

function initLatestProducts() {
  const grid = qs("#latestProducts");
  if (!grid) return;

  const latest = [...STATE.books]
    .sort((a, b) => b.year - a.year || b.id - a.id)
    .slice(0, 8);

  grid.innerHTML = latest.map(productCardHtml).join("");
  bindProductCardEvents(grid);
}

function initCategoryHighlight() {
  const grid = qs("#categoryHighlight");
  if (!grid) return;

  grid.innerHTML = STATE.categories
    .map((cat) => {
      const count = STATE.books.filter((b) => b.categoryId === cat.id).length;
      return `
        <a class="category-card" href="/products?cat=${cat.id}">
          <div class="icon">${CATEGORY_ICONS[cat.id] || "📚"}</div>
          <h3>${escapeHtml(cat.name)}</h3>
          <span>${count} đầu sách</span>
        </a>
      `;
    })
    .join("");
}

/* ---------------------------------------------------------
   Products page
   --------------------------------------------------------- */

function initProductsPage() {
  const grid = qs("#productsGrid");
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  let activeCategory = params.get("cat") ? Number(params.get("cat")) : "all";
  let searchTerm = "";
  let sortMode = "default";

  const filterList = qs("#categoryFilters");
  const searchInput = qs("#searchInput");
  const sortSelect = qs("#sortSelect");
  const resultCount = qs("#resultCount");
  const emptyState = qs("#emptyState");

  function renderFilters() {
    const all = `
      <li>
        <button data-cat="all" class="${activeCategory === "all" ? "active" : ""}">
          <span>Tất cả</span><span class="count">${STATE.books.length}</span>
        </button>
      </li>`;
    const items = STATE.categories
      .map((cat) => {
        const count = STATE.books.filter((b) => b.categoryId === cat.id).length;
        return `
          <li>
            <button data-cat="${cat.id}" class="${activeCategory === cat.id ? "active" : ""}">
              <span>${escapeHtml(cat.name)}</span><span class="count">${count}</span>
            </button>
          </li>`;
      })
      .join("");
    filterList.innerHTML = all + items;

    qsa("[data-cat]", filterList).forEach((btn) =>
      btn.addEventListener("click", () => {
        const val = btn.dataset.cat;
        activeCategory = val === "all" ? "all" : Number(val);
        render();
      })
    );
  }

  function getFilteredBooks() {
    let result = [...STATE.books];

    if (activeCategory !== "all") {
      result = result.filter((b) => b.categoryId === activeCategory);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (b) => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term)
      );
    }

    switch (sortMode) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        result.sort((a, b) => b.year - a.year || b.id - a.id);
        break;
    }

    return result;
  }

  function render() {
    renderFilters();
    const books = getFilteredBooks();

    resultCount.textContent = `${books.length} sản phẩm`;

    if (books.length === 0) {
      grid.innerHTML = "";
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      grid.innerHTML = books.map(productCardHtml).join("");
      bindProductCardEvents(grid);
    }
  }

  searchInput?.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    render();
  });

  sortSelect?.addEventListener("change", (e) => {
    sortMode = e.target.value;
    render();
  });

  render();
}

/* ---------------------------------------------------------
   Footer category links (shared)
   --------------------------------------------------------- */

function initFooterCategories() {
  const el = qs("#footerCategories");
  if (!el) return;
  el.innerHTML = STATE.categories
    .map((cat) => `<li><a href="/products?cat=${cat.id}">${escapeHtml(cat.name)}</a></li>`)
    .join("");
}

/* ---------------------------------------------------------
   Mobile nav toggle (shared)
   --------------------------------------------------------- */

function initNavToggle() {
  const toggle = qs("#navToggle");
  const nav = qs("#mainNav");
  toggle?.addEventListener("click", () => {
    toggle.classList.toggle("open");
    nav.classList.toggle("open");
  });
}

/* ---------------------------------------------------------
   Contact form validation
   --------------------------------------------------------- */

function initContactForm() {
  const form = qs("#feedbackForm");
  if (!form) return;

  const fields = {
    fbName: { required: true, minLength: 2 },
    fbEmail: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    fbMessage: { required: true, minLength: 10 },
  };

  function showError(input, message) {
    input.classList.add("invalid");
    const err = qs(`#${input.id}-error`);
    if (err) {
      err.textContent = message;
      err.classList.add("show");
    }
  }

  function clearError(input) {
    input.classList.remove("invalid");
    const err = qs(`#${input.id}-error`);
    if (err) {
      err.classList.remove("show");
    }
  }

  function validateField(input) {
    const rule = fields[input.id];
    if (!rule) return true;
    const value = input.value.trim();

    if (rule.required && !value) {
      showError(input, "Trường này không được để trống.");
      return false;
    }
    if (rule.minLength && value.length < rule.minLength) {
      showError(input, `Vui lòng nhập tối thiểu ${rule.minLength} ký tự.`);
      return false;
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      showError(input, "Định dạng không hợp lệ.");
      return false;
    }
    clearError(input);
    return true;
  }

  Object.keys(fields).forEach((id) => {
    const input = qs(`#${id}`);
    input?.addEventListener("blur", () => validateField(input));
    input?.addEventListener("input", () => {
      if (input.classList.contains("invalid")) validateField(input);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const messageEl = qs("#formMessage");
    let valid = true;

    Object.keys(fields).forEach((id) => {
      const input = qs(`#${id}`);
      if (input && !validateField(input)) valid = false;
    });

    messageEl.hidden = false;
    if (!valid) {
      messageEl.textContent = "Vui lòng kiểm tra lại các trường được đánh dấu đỏ.";
      messageEl.className = "form-message error";
      return;
    }

    messageEl.textContent = "Cảm ơn bạn đã gửi phản hồi! Book Corner sẽ liên hệ lại sớm nhất.";
    messageEl.className = "form-message success";
    form.reset();
    Object.keys(fields).forEach((id) => {
      const input = qs(`#${id}`);
      if (input) clearError(input);
    });
  });
}

/* ---------------------------------------------------------
   Init
   --------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  await loadBooks();

  initNavToggle();
  setupCartDrawer();
  initFooterCategories();

  initCarousel();
  initLatestProducts();
  initCategoryHighlight();

  initProductsPage();
  initContactForm();
});
