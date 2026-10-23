(() => {
  const $ = id => document.getElementById(id);
  const form = $("product-form");
  const list = $("product-list");
  const status = $("status");
  let products = [];
  let selectedId = null;

  function say(text) { status.textContent = text; }
  function emptyProduct() {
    return { id: "", name: "", category: "ظروف مسی", description: "", price: 0, image: "", orderUrl: "#contact", active: true };
  }
  function normalize(data) {
    const items = Array.isArray(data) ? data : data.products;
    return Array.isArray(items) ? items.filter(item => item && typeof item === "object").map(item => ({ ...emptyProduct(), ...item })) : [];
  }
  async function load() {
    say("در حال خواندن products.json…");
    try {
      const response = await fetch("./products.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      products = normalize(await response.json());
      selectedId = products[0]?.id ?? null;
      renderList();
      showSelected();
      say("فهرست از مخزن خوانده شد. ویرایش‌ها تا زمان دریافت خروجی فقط در همین نشست هستند.");
    } catch {
      products = [];
      selectedId = null;
      renderList();
      showSelected();
      say("خواندن فایل ممکن نشد؛ اگر پروژه را محلی باز کرده‌ای، از یک وب‌سرور محلی استفاده کن.");
    }
  }
  function renderList() {
    $("count").textContent = new Intl.NumberFormat("fa-IR").format(products.length) + " محصول";
    list.replaceChildren();
    products.forEach(product => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "product-item" + (product.id === selectedId ? " selected" : "");
      const name = document.createElement("strong");
      name.textContent = product.name || "محصول بدون نام";
      const meta = document.createElement("small");
      meta.textContent = product.active ? "فعال در فروشگاه" : "پنهان";
      button.append(name, meta);
      button.addEventListener("click", () => { selectedId = product.id; renderList(); showSelected(); });
      list.append(button);
    });
  }
  function showSelected() {
    const product = products.find(item => item.id === selectedId) || emptyProduct();
    $("editor-title").textContent = product.name || "محصول جدید";
    $("id").value = product.id;
    $("name").value = product.name;
    $("category").value = product.category;
    $("price").value = product.price || "";
    $("image").value = product.image || "";
    $("description").value = product.description || "";
    $("orderUrl").value = product.orderUrl || "#contact";
    $("active").checked = product.active !== false;
    $("delete-product").disabled = !products.some(item => item.id === selectedId);
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const product = {
      id: $("id").value.trim(),
      name: $("name").value.trim(),
      category: $("category").value.trim(),
      description: $("description").value.trim(),
      price: Number($("price").value) || 0,
      image: $("image").value.trim(),
      orderUrl: $("orderUrl").value.trim() || "#contact",
      active: $("active").checked
    };
    if (!/^[a-zA-Z0-9_-]+$/.test(product.id)) return say("شناسه فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و زیرخط باشد.");
    if (product.image && !/^https?:\/\//i.test(product.image)) return say("آدرس تصویر باید با http:// یا https:// شروع شود.");
    if (product.orderUrl && !/^(#|https?:\/\/)/i.test(product.orderUrl)) return say("لینک سفارش باید با # یا آدرس http(s) شروع شود.");
    const duplicate = products.some(item => item.id === product.id && item.id !== selectedId);
    if (duplicate) return say("این شناسه قبلاً استفاده شده است.");
    const index = products.findIndex(item => item.id === selectedId);
    if (index >= 0) products[index] = product;
    else products.push(product);
    selectedId = product.id;
    renderList();
    showSelected();
    say("در فهرست فعلی ذخیره شد. برای نگهداری تغییرات، خروجی JSON بگیر؛ انتشار خودکار هنوز فعال نیست.");
  });
  $("add-product").addEventListener("click", () => {
    selectedId = null;
    renderList();
    form.reset();
    $("editor-title").textContent = "محصول جدید";
    $("category").value = "ظروف مسی";
    $("orderUrl").value = "#contact";
    $("active").checked = true;
    $("delete-product").disabled = true;
    say("اطلاعات محصول جدید را وارد کن.");
  });
  $("delete-product").addEventListener("click", () => {
    if (!selectedId || !products.some(item => item.id === selectedId)) return;
    products = products.filter(item => item.id !== selectedId);
    selectedId = products[0]?.id ?? null;
    renderList();
    showSelected();
    say("از فهرست فعلی حذف شد؛ برای نگهداری تغییرات خروجی JSON بگیر.");
  });
  $("download").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ products }, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "products.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    say("فایل پشتیبان products.json آماده شد. این کار به‌تنهایی فایل آنلاین مخزن را تغییر نمی‌دهد.");
  });
  $("reload").addEventListener("click", load);
  load();
})();