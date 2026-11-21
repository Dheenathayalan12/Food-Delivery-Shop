const $ = id => document.getElementById(id);
let activeCategory = "All";
let searchTerm = "";

/* ================= MENU ================= */
function menuCard(item) {
  const fp = finalPrice(item);
  const hasDisc = (item.discount || 0) > 0;
  return `
    <article class="card">
      <div class="img-wrap">
        <img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy"
             onerror="this.src='${PLACEHOLDER_IMG}'">
        ${hasDisc ? `<span class="badge">-${item.discount}%</span>` : ""}
      </div>
      <div class="card-body">
        <h3>${esc(item.name)}</h3>
        <p class="desc">${esc(item.description || "")}</p>
        <div class="card-foot">
          <div class="price">
            ${hasDisc ? `<s>${money(item.price)}</s>` : ""}
            <strong>${money(fp)}</strong>
          </div>
          <button class="btn primary" data-add="${item.id}">Add</button>
        </div>
      </div>
    </article>`;
}

function renderMenu() {
  const menu = getMenu();
  const isOn = i => i.available !== false; // treat missing value as available
  const usedCats = new Set(menu.filter(isOn).map(i => i.category));
  const cats = ["All", ...getCategories().filter(c => usedCats.has(c))];
  if (!cats.includes(activeCategory)) activeCategory = "All";

  $("categories").innerHTML = cats.map(c =>
    `<button class="cat ${c === activeCategory ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`
  ).join("");

  const q = searchTerm.toLowerCase();
  const items = menu.filter(i =>
    isOn(i) &&
    (activeCategory === "All" || i.category === activeCategory) &&
    (String(i.name || "").toLowerCase().includes(q) ||
     String(i.description || "").toLowerCase().includes(q))
  );

  $("menuGrid").innerHTML = items.length
    ? items.map(menuCard).join("")
    : `<p class="empty">No items found.</p>`;
}

/* ================= CART ================= */
function addToCart(id) {
  const item = getMenu().find(i => i.id === id);
  if (!item || !item.available) return toast("Sorry, this item is unavailable.");
  const cart = getCart();
  const line = cart.find(l => l.id === id);
  if (line) line.qty++; else cart.push({ id, qty: 1 });
  saveCart(cart);
  renderCart();
  toast(`${item.name} added to cart`);
}

function changeQty(id, delta) {
  let cart = getCart();
  const line = cart.find(l => l.id === id);
  if (!line) return;
  line.qty += delta;
  saveCart(cart.filter(l => l.qty > 0));
  renderCart();
}

function removeLine(id) {
  saveCart(getCart().filter(l => l.id !== id));
  renderCart();
}

// Uses CURRENT menu prices, so admin price/discount changes apply instantly
function cartDetails() {
  const menu = getMenu();
  const lines = getCart()
    .map(l => {
      const item = menu.find(i => i.id === l.id);
      return item && item.available ? { item, qty: l.qty } : null;
    })
    .filter(Boolean);

  const subtotal = lines.reduce((s, l) => s + finalPrice(l.item) * l.qty, 0);
  const original = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const savings = original - subtotal;
  const tax = subtotal * CONFIG.taxRate;
  const delivery = lines.length ? CONFIG.deliveryFee : 0;
  const total = subtotal + tax + delivery;
  const count = lines.reduce((s, l) => s + l.qty, 0);
  return { lines, subtotal, savings, tax, delivery, total, count };
}

function renderCart() {
  const d = cartDetails();
  $("cartCount").textContent = d.count;

  $("cartItems").innerHTML = d.lines.length
    ? d.lines.map(l => `
      <div class="cart-line">
        <img src="${esc(l.item.image)}" alt="">
        <div class="grow">
          <strong>${esc(l.item.name)}</strong>
          <div>${money(finalPrice(l.item))} each</div>
          <div class="qty">
            <button data-dec="${l.item.id}">−</button>
            <span>${l.qty}</span>
            <button data-inc="${l.item.id}">+</button>
            <button class="link" data-rm="${l.item.id}">Remove</button>
          </div>
        </div>
        <div>${money(finalPrice(l.item) * l.qty)}</div>
      </div>`).join("")
    : `<p class="empty">Your cart is empty.</p>`;

  $("summary").innerHTML = `
    <div><span>Subtotal</span><span>${money(d.subtotal)}</span></div>
    ${d.savings > 0.005 ? `<div class="save"><span>You save</span><span>${money(d.savings)}</span></div>` : ""}
    <div><span>Tax (${CONFIG.taxRate * 100}%)</span><span>${money(d.tax)}</span></div>
    <div><span>Delivery</span><span>${money(d.delivery)}</span></div>
    <div class="total"><span>Total</span><span>${money(d.total)}</span></div>`;

  $("checkoutBtn").disabled = !d.lines.length;
}

function openCart() { $("cartDrawer").classList.add("open"); $("overlay").classList.add("show"); }
function closeCart() { $("cartDrawer").classList.remove("open"); $("overlay").classList.remove("show"); }

/* ================= PAYMENT ================= */
// DEMO gateway. Replace the body with a real provider (Stripe, Razorpay, PayPal...).
// Real card data must be handled by the gateway (hosted fields / checkout page),
// and the charge must be created on your server, never trusted from the browser.
const PaymentGateway = {
  async charge({ amount, method }) {
    await new Promise(r => setTimeout(r, 800)); // simulate network
    if (method === "cod") return { status: "pending", ref: "COD-" + Date.now() };
    return { status: "paid", ref: "TXN-" + Math.random().toString(36).slice(2, 10).toUpperCase() };
  }
};

function luhn(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = +num[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function validateCheckout(d) {
  if (!d.name?.trim()) return "Please enter your name.";
  if (!/^[0-9+\- ]{7,15}$/.test(d.phone || "")) return "Enter a valid phone number.";
  if (!d.address?.trim()) return "Please enter a delivery address.";
  if (d.method === "card") {
    const num = (d.cardNumber || "").replace(/\s/g, "");
    if (!/^\d{16}$/.test(num) || !luhn(num)) return "Enter a valid 16-digit card number.";
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(d.expiry || "")) return "Expiry must be in MM/YY format.";
    const [mm, yy] = d.expiry.split("/").map(Number);
    const lastDay = new Date(2000 + yy, mm, 0); // last day of that month
    if (lastDay < new Date()) return "This card has expired.";
    if (!/^\d{3,4}$/.test(d.cvv || "")) return "Enter a valid CVV.";
  }
  return "";
}

function openCheckout() {
  const d = cartDetails();
  if (!d.lines.length) return;
  $("payTotal").textContent = `Amount to pay: ${money(round2(d.total))}`;
  $("payError").textContent = "";
  $("checkoutModal").classList.remove("hidden");
  closeCart();
}

function closeCheckout() { $("checkoutModal").classList.add("hidden"); }

async function handleCheckout(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  const err = validateCheckout(data);
  $("payError").textContent = err;
  if (err) return;

  const d = cartDetails();
  if (!d.lines.length) { $("payError").textContent = "Your cart is empty."; return; }
  const amount = round2(d.total);

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";

  try {
    const payment = await PaymentGateway.charge({
      amount,
      method: data.method,
      card: data.method === "card"
        ? { number: data.cardNumber.replace(/\s/g, ""), expiry: data.expiry, cvv: data.cvv }
        : null
    });

    // Card details are NEVER saved; only a payment reference is stored
    const order = {
      id: "ORD-" + Date.now().toString(36).toUpperCase(),
      createdAt: new Date().toISOString(),
      customer: { name: data.name, phone: data.phone, address: data.address },
      items: d.lines.map(l => ({ name: l.item.name, qty: l.qty, unitPrice: finalPrice(l.item) })),
      totals: { subtotal: round2(d.subtotal), tax: round2(d.tax), delivery: d.delivery, total: amount },
      payment: { method: data.method, status: payment.status, ref: payment.ref },
      status: "new"
    };
    addOrder(order);
    saveCart([]);
    renderCart();

    form.reset();
    $("cardFields").classList.add("hidden");
    closeCheckout();
    alert(`Thank you, ${data.name}! Order ${order.id} placed. Total: ${money(amount)}`);
  } catch (ex) {
    $("payError").textContent = "Payment failed: " + ex.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Pay & Place Order";
  }
}

/* ================= EVENTS ================= */
$("categories").onclick = e => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  activeCategory = b.dataset.cat;
  renderMenu();
};
$("menuGrid").onclick = e => {
  const b = e.target.closest("[data-add]");
  if (b) addToCart(+b.dataset.add);
};
$("search").oninput = e => { searchTerm = e.target.value; renderMenu(); };

$("cartBtn").onclick = openCart;
$("closeCart").onclick = closeCart;
$("overlay").onclick = closeCart;
$("cartItems").onclick = e => {
  const t = e.target;
  if (t.dataset.inc) changeQty(+t.dataset.inc, 1);
  if (t.dataset.dec) changeQty(+t.dataset.dec, -1);
  if (t.dataset.rm) removeLine(+t.dataset.rm);
};

$("checkoutBtn").onclick = openCheckout;
$("cancelCheckout").onclick = closeCheckout;
$("payMethod").onchange = () =>
  $("cardFields").classList.toggle("hidden", $("payMethod").value !== "card");

const cardInput = document.querySelector('[name="cardNumber"]');
cardInput.addEventListener("input", e => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
});

$("checkoutForm").onsubmit = handleCheckout;

/* ================= AUTO-UPDATE =================
   When the admin saves changes in another tab (same browser),
   the storage event fires and the website refreshes automatically. */
window.addEventListener("storage", e => {
  if (e.key === KEYS.menu || e.key === KEYS.categories) {
    renderMenu();
    renderCart();
    toast("Menu updated");
  }
  if (e.key === KEYS.cart) renderCart();
});
/* ================= INIT ================= */
/* ================= INIT ================= */
function init() {
  try {
    $("brand").textContent = CONFIG.restaurantName;
    document.title = CONFIG.restaurantName;
    renderMenu();
    renderCart();
  } catch (err) {
    console.error("Menu failed to load:", err);
    $("menuGrid").innerHTML =
      `<p class="empty">Could not load the menu (${esc(err.message)}).
       Press F12 and check the Console, or see the reset step below.</p>`;
  }
}
init();