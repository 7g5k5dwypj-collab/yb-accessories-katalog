/* Order export integration, isolated from the live checkout.
 * The API must persist an immutable order snapshot and return two
 * unguessable HTTPS download URLs before this helper is wired into checkout.
 */
window.YBOrderExport = Object.freeze({
  async create(items) {
    const response = await fetch("/api/order-export", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({items: items.map(({id, quantity}) => ({id, quantity}))})
    });
    if (!response.ok) throw new Error("Sipariş dosyaları hazırlanamadı.");
    const result = await response.json();
    for (const key of ["pdfUrl", "excelUrl"]) {
      const url = new URL(result[key], location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith("/api/order-export/"))
        throw new Error("Geçersiz sipariş bağlantısı.");
      result[key] = url.href;
    }
    return result;
  },
  appendLinks(lines, result) {
    return [...lines, "", "PDF Sipariş Listesi: " + result.pdfUrl,
      "Excel Sipariş Listesi: " + result.excelUrl];
  }
});
