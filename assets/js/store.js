(() => {
  const grid = document.querySelector("#product-grid");
  const message = document.querySelector("#product-message");
  const money = value => new Intl.NumberFormat("fa-IR").format(Number(value) || 0) + " تومان";
  document.querySelector("#year").textContent = new Date().getFullYear();

  function makeCard(product) {
    const article = document.createElement("article");
    article.className = "product-card";
    const imageWrap = document.createElement("div");
    imageWrap.className = "product-image";
    if (product.image) {
      const image = document.createElement("img");
      image.src = product.image;
      image.alt = product.name || "محصول گالری مس";
      image.loading = "lazy";
      image.onerror = () => {
        image.remove();
        const placeholder = document.createElement("span");
        placeholder.className = "product-placeholder";
        placeholder.textContent = "م";
        placeholder.setAttribute("aria-hidden", "true");
        imageWrap.append(placeholder);
      };
      imageWrap.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "product-placeholder";
      placeholder.textContent = "م";
      placeholder.setAttribute("aria-hidden", "true");
      imageWrap.append(placeholder);
    }
    const info = document.createElement("div");
    info.className = "product-info";
    const category = document.createElement("span");
    category.className = "product-category";
    category.textContent = product.category || "ظروف مسی";
    const title = document.createElement("h3");
    title.textContent = product.name || "محصول مسی";
    const description = document.createElement("p");
    description.textContent = product.description || "";
    const bottom = document.createElement("div");
    bottom.className = "product-bottom";
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = product.price ? money(product.price) : "برای قیمت تماس بگیرید";
    const order = document.createElement("a");
    order.className = "product-order";
    order.href = product.orderUrl || "#contact";
    order.textContent = "اطلاعات و سفارش ←";
    if (/^https?:/.test(order.href)) { order.target = "_blank"; order.rel = "noreferrer"; }
    bottom.append(price, order);
    info.append(category, title, description, bottom);
    article.append(imageWrap, info);
    return article;
  }

  fetch("./products.json", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("Products file not found");
      return response.json();
    })
    .then(data => {
      const products = Array.isArray(data) ? data : data.products;
      if (!Array.isArray(products) || products.length === 0) {
        grid.replaceChildren();
        message.hidden = false;
        message.textContent = "محصولی برای نمایش ثبت نشده است.";
        return;
      }
      grid.replaceChildren(...products.filter(p => p && p.active !== false).map(makeCard));
      if (!grid.children.length) {
        message.hidden = false;
        message.textContent = "در حال حاضر محصولی برای نمایش وجود ندارد.";
      }
    })
    .catch(() => {
      grid.replaceChildren();
      message.hidden = false;
      message.textContent = "بارگذاری محصولات انجام نشد. کمی بعد دوباره تلاش کنید.";
    });
})();