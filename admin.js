const $ = id => document.getElementById(id);
const SESSION_KEY = "fs_admin_session";
let pendingImage = null; // base64 image from file upload

/* ================= LOGIN ================= */
$("loginForm").onsubmit = e => {
  e.preventDefault();
  if ($("adminPass").value === CONFIG.adminPassword) {
    sessionStorage.setItem(SESSION_KEY, "1");
    showApp();
  } else {
    $("loginError").textContent = "Wrong password.";
  }
};
$("logout").onclick = () => { sessionStorage.removeItem(SESSION_KEY); location.reload(); };

function showApp() {
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  renderAll();
}
if (sessionStorage.getItem(SESSION_KEY)) showApp();

/* ================= TABS ================= */
document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".panel").forEach(p =>
      p.classList.toggle("hidden", p.id !== "tab-" + btn.dataset.tab));
    renderAll();
  };
});

/* ================= RENDER ================= */
function renderAll() {
  fillCategories();
  renderCategories();
  renderMenuRows();
  renderOrders();
}

// Fills the bulk-discount dropdown and the item form dropdown from the category list
function fillCategories() {
  const cats = getCategories();

  const bulk = $("bulkCat");
  const prevBulk = bulk.value;
  bulk.innerHTML = `<option value="__all">All items</option>` +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if ([...bulk.options].some(o => o.value === prevBulk)) bulk.value = prevBulk;

  const sel = $("itemCategory");
  const prevSel = sel.value;
  sel.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (cats.includes(prevSel)) sel.value = prevSel;
}

function renderCategories() {
  const menu = getMenu();
  const rows = getCategories().map(c => {
    const count = menu.filter(i => i.category === c).length;
    return `
      <tr>
        <td><strong>${esc(c)}</strong></td>
        <td>${count}</td>
        <td><button class="btn small danger" data-delcat="${esc(c)}">Delete</button></td>
      </tr>`;
  }).join("");
  $("catRows").innerHTML = rows || `<tr><td colspan="3">No categories yet. Add one above.</td></tr>`;
}

function renderMenuRows() {
  const rows = getMenu().map(i => `
    <tr>
      <td><img class="thumb" src="${esc(i.image)}" alt=""></td>
      <td><strong>${esc(i.name)}</strong><br><small>${esc(i.description || "")}</small></td>
      <td>${esc(i.category)}</td>
      <td><input class="mini" type="number" step="0.01" min="0" value="${i.price}" data-price="${i.id}"></td>
      <td><input class="mini" type="number" min="0" max="100" value="${i.discount || 0}" data-disc="${i.id}">%</td>
      <td><strong>${money(finalPrice(i))}</strong></td>
      <td><input type="checkbox" data-avail="${i.id}" ${i.available ? "checked" : ""}></td>
      <td class="actions">
        <button class="btn small" data-edit="${i.id}">Edit</button>
        <button class="btn small danger" data-del="${i.id}">Delete</button>
      </td>
    </tr>`).join("");
  $("menuRows").innerHTML = rows || `<tr><td colspan="8">No menu items. Click "Add menu item".</td></tr>`;
}

function renderOrders() {
  const orders = getOrders().slice().reverse();
  const statuses = ["new", "preparing", "out for delivery", "delivered", "cancelled"];
  $("orderList").innerHTML = orders.length ? orders.map(o => `
    <div class="order">
      <div class="order-head">
        <strong>${esc(o.id)}</strong>
        <span>${new Date(o.createdAt).toLocaleString()}</span>
        <select data-status="${esc(o.id)}" style="width:auto">
          ${statuses.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div>${esc(o.customer.name)} · ${esc(o.customer.phone)}<br>${esc(o.customer.address)}</div>
      <ul>${o.items.map(i => `<li>${i.qty} × ${esc(i.name)} @ ${money(i.unitPrice)}</li>`).join("")}</ul>
      <div>Total <strong>${money(o.totals.total)}</strong> ·
        Payment: ${esc(o.payment.method)} (${esc(o.payment.status)}) · Ref ${esc(o.payment.ref)}
      </div>
    </div>`).join("") : `<p>No orders yet.</p>`;
}

/* ================= CATEGORY MANAGEMENT ================= */
$("catForm").onsubmit = e => {
  e.preventDefault();
  const name = $("newCatName").value.trim().replace(/\s+/g, " ");
  if (!name) return;

  const cats = getCategories();
  if (cats.some(c => c.toLowerCase() === name.toLowerCase())) {
    $("catError").textContent = "This category already exists.";
    return;
  }

  cats.push(name);
  saveCategories(cats);
  $("newCatName").value = "";
  $("catError").textContent = "";
  renderAll();
  toast(`Category "${name}" added. You can now add items to it.`);
};

$("catRows").onclick = e => {
  const name = e.target.dataset.delcat;
  if (name) deleteCategory(name);
};

function deleteCategory(name) {
  const count = getMenu().filter(i => i.category === name).length;
  if (count > 0) {
    toast(`Cannot delete "${name}": ${count} item(s) use it. Move or delete them first.`);
    return;
  }
  if (!confirm(`Delete the category "${name}"?`)) return;

  saveCategories(getCategories().filter(c => c !== name));
  renderAll();
  toast(`Category "${name}" deleted.`);
}

/* ================= MENU UPDATES (inline) ================= */
function updateItem(id, patch) {
  const menu = getMenu();
  const item = menu.find(i => i.id === id);
  if (!item) return;
  Object.assign(item, patch);
  saveMenu(menu);
  renderAll();
  toast("Saved. Website updated automatically.");
}

$("menuRows").onchange = e => {
  const t = e.target;
  if (t.dataset.price) updateItem(+t.dataset.price, { price: Math.max(0, parseFloat(t.value) || 0) });
  if (t.dataset.disc) updateItem(+t.dataset.disc, { discount: clamp(parseFloat(t.value) || 0, 0, 100) });
  if (t.dataset.avail) updateItem(+t.dataset.avail, { available: t.checked });
};

$("menuRows").onclick = e => {
  const t = e.target;
  if (t.dataset.edit) openItemModal(+t.dataset.edit);
  if (t.dataset.del) deleteItem(+t.dataset.del);
};

function deleteItem(id) {
  if (!confirm("Delete this menu item permanently?")) return;
  saveMenu(getMenu().filter(i => i.id !== id));
  renderAll();
  toast("Item deleted. Website updated.");
}

/* ================= ADD / EDIT MODAL ================= */
const field = name => document.querySelector(`#itemForm [name="${name}"]`);

function openItemModal(id) {
  if (!getCategories().length) {
    toast("Add a category first (Categories tab).");
    return;
  }

  const item = id ? getMenu().find(i => i.id === id) : null;
  $("itemForm").reset();
  pendingImage = null;
  $("imageFile").value = "";
  $("itemModalTitle").textContent = item ? "Edit menu item" : "Add new menu item";

  fillCategories(); // fill the dropdown BEFORE setting its value

  if (item) {
    field("itemId").value = item.id;
    field("name").value = item.name;
    field("category").value = item.category;
    field("price").value = item.price;
    field("discount").value = item.discount || 0;
    field("description").value = item.description || "";
    field("image").value = item.image || "";
    field("available").checked = item.available;
  } else {
    field("itemId").value = "";
    field("discount").value = 0;
    field("available").checked = true;
  }
  showPreview(field("image").value);
  $("itemModal").classList.remove("hidden");
}

function showPreview(src) {
  const img = $("imgPreview");
  img.src = src || "";
  img.classList.toggle("hidden", !src);
}

document.querySelector('#itemForm [name="image"]').oninput = e => {
  pendingImage = null;
  showPreview(e.target.value.trim());
};

// Resize uploaded images so they fit comfortably in localStorage
function resizeImage(file, maxSize = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$("imageFile").onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    pendingImage = await resizeImage(file);
    showPreview(pendingImage);
  } catch {
    toast("Could not read that image.");
  }
};

$("itemForm").onsubmit = e => {
  e.preventDefault();
  const itemId = +field("itemId").value;
  const menu = getMenu();

  const data = {
    name: field("name").value.trim(),
    category: field("category").value || getCategories()[0],
    price: Math.max(0, parseFloat(field("price").value) || 0),
    discount: clamp(parseFloat(field("discount").value) || 0, 0, 100),
    description: field("description").value.trim(),
    image: pendingImage || field("image").value.trim() || PLACEHOLDER_IMG,
    available: field("available").checked
  };

  if (itemId) {
    const existing = menu.find(i => i.id === itemId);
    if (existing) Object.assign(existing, data);
  } else {
    menu.push({ id: nextId(menu), ...data });
  }

  saveMenu(menu);
  $("itemModal").classList.add("hidden");
  renderAll();
  toast("Saved. Website updated automatically.");
};

$("addNew").onclick = () => openItemModal(null);
$("cancelItem").onclick = () => $("itemModal").classList.add("hidden");

/* ================= CATEGORY DISCOUNTS ================= */
function bulkDiscount(pct) {
  const cat = $("bulkCat").value;
  const menu = getMenu();
  menu.forEach(i => {
    if (cat === "__all" || i.category === cat) i.discount = pct;
  });
  saveMenu(menu);
  renderAll();
  toast(pct ? `${pct}% discount applied` : "Discounts removed");
}

$("applyBulk").onclick = () => {
  const pct = parseFloat($("bulkPct").value);
  if (isNaN(pct)) return toast("Enter a discount percentage.");
  bulkDiscount(clamp(pct, 0, 100));
};
$("clearBulk").onclick = () => bulkDiscount(0);

/* ================= ORDERS ================= */
$("orderList").onchange = e => {
  const id = e.target.dataset.status;
  if (!id) return;
  const orders = getOrders();
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = e.target.value;
    saveOrders(orders);
    toast("Order status updated");
  }
};

/* ================= SETTINGS ================= */
$("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(getMenu(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "menu-backup.json";
  a.click();
};

$("importFile").onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("Invalid");
    saveMenu(data);
    renderAll(); // getCategories() adds any new categories found in the imported menu
    toast("Menu imported.");
  } catch {
    toast("Invalid menu file.");
  }
};

$("resetBtn").onclick = () => {
  if (!confirm("Reset the whole menu and categories to the defaults?")) return;
  saveMenu(structuredClone(DEFAULT_MENU));
  saveCategories([...DEFAULT_CATEGORIES]);
  renderAll();
  toast("Menu reset to defaults.");
};

$("clearOrders").onclick = () => {
  if (!confirm("Delete ALL orders?")) return;
  saveOrders([]);
  renderAll();
  toast("All orders deleted.");
};

/* ================= LIVE UPDATES ================= */
window.addEventListener("storage", e => {
  if (e.key === KEYS.orders) renderOrders();
  if (e.key === KEYS.menu || e.key === KEYS.categories) renderAll();
});