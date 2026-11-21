// ================= CONFIG =================
const CONFIG = {
  restaurantName: "Tasty Bites",
  currency: "$",
  taxRate: 0.05,            // 5% tax
  deliveryFee: 2.5,
  adminPassword: "admin123" // CHANGE THIS
};

const KEYS = {
  menu: "fs_menu",
  orders: "fs_orders",
  cart: "fs_cart",
  categories: "fs_categories"
};

const PLACEHOLDER_IMG = "https://placehold.co/600x400?text=No+Image";

const DEFAULT_CATEGORIES = ["Burgers", "Pizza", "Wraps", "Sides", "Drinks"];

const DEFAULT_MENU = [
  { id: 1, name: "Classic Burger", category: "Burgers", price: 8.99, discount: 0,
    image: "https://placehold.co/600x400?text=Burger",
    description: "Beef patty, cheese, lettuce, tomato, special sauce.", available: true },
  { id: 2, name: "Margherita Pizza", category: "Pizza", price: 12.5, discount: 10,
    image: "https://placehold.co/600x400?text=Pizza",
    description: "Tomato sauce, fresh mozzarella and basil.", available: true },
  { id: 3, name: "Veggie Wrap", category: "Wraps", price: 6.75, discount: 0,
    image: "https://placehold.co/600x400?text=Wrap",
    description: "Grilled vegetables with hummus in a soft tortilla.", available: true },
  { id: 4, name: "French Fries", category: "Sides", price: 3.25, discount: 0,
    image: "https://placehold.co/600x400?text=Fries",
    description: "Crispy golden fries with sea salt.", available: true },
  { id: 5, name: "Chocolate Shake", category: "Drinks", price: 4.5, discount: 15,
    image: "https://placehold.co/600x400?text=Shake",
    description: "Thick chocolate milkshake with whipped cream.", available: true }
];

// ================= HELPERS =================
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const round2 = n => Math.round(n * 100) / 100;
const money = n => CONFIG.currency + round2(n).toFixed(2);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ----- Menu -----
function getMenu() {
  const menu = readJSON(KEYS.menu, null);
  if (Array.isArray(menu)) return menu;
  const def = structuredClone(DEFAULT_MENU);
  writeJSON(KEYS.menu, def);
  return def;
}
function saveMenu(menu) { writeJSON(KEYS.menu, menu); }
function nextId(menu) { return menu.reduce((m, i) => Math.max(m, i.id), 0) + 1; }
function finalPrice(item) {
  return round2(item.price * (100 - (item.discount || 0)) / 100);
}

// ----- Categories -----
function getCategories() {
  let cats = readJSON(KEYS.categories, null);
  if (!Array.isArray(cats)) cats = [...DEFAULT_CATEGORIES];

  // Add any category used by a menu item but missing from the list (e.g. after an import)
  getMenu().forEach(item => {
    if (item.category && !cats.some(c => c.toLowerCase() === item.category.toLowerCase())) {
      cats.push(item.category);
    }
  });

  writeJSON(KEYS.categories, cats);
  return cats;
}
function saveCategories(cats) { writeJSON(KEYS.categories, cats); }

// ----- Cart -----
function getCart() { return readJSON(KEYS.cart, []); }
function saveCart(cart) { writeJSON(KEYS.cart, cart); }

// ----- Orders -----
function getOrders() { return readJSON(KEYS.orders, []); }
function saveOrders(orders) { writeJSON(KEYS.orders, orders); }
function addOrder(order) {
  const list = getOrders();
  list.push(order);
  saveOrders(list);
}

// ----- Toast notification -----
function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add("hidden"), 2500);
}