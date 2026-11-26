/* Load after the existing catalog script. */
(() => {
  const button = document.getElementById('order');
  let busy = false;
  button.onclick = async () => {
    if (busy || !cart.size) return;
    const items = [], lines = ['Merhaba, YB Accessories sipariş talebim:', ''];
    let total = 0;
    for (const product of products) {
      const quantity = cart.get(product.id) || 0;
      if (!quantity) continue;
      const price = discountedPrice(product.price);
      const subtotal = Math.round(price * 100) * quantity;
      total += subtotal;
      items.push({id: product.id, quantity});
      lines.push(product.name + ' — ' + quantity + ' adet', 'Birim fiyat: ' + money(price), 'Tutar: ' + money(subtotal / 100));
      if (product.image) lines.push('Ürün fotoğrafı: ' + product.image);
      lines.push('');
    }
    if (!items.length) return;
    lines.push('Toplam: ' + money(total / 100));
    const fallbackLines = [...lines];
    busy = true; button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Sipariş hazırlanıyor…';
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const response = await fetch('/api/order-export', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({items}), signal:AbortSignal.timeout(12000)});
      if (!response.ok) throw Error('Sipariş kaydedilemedi');
      const data = await response.json();
      if (!Array.isArray(data.snapshot)) throw Error('Invalid snapshot');
      lines.length = 0;
      lines.push('Merhaba, YB Accessories sipariş talebim:', '');
      for (const r of data.snapshot) {
        lines.push(r.name + ' — ' + r.quantity + ' adet', 'Birim fiyat: ' + money(r.unitCents / 100), 'Tutar: ' + money(r.unitCents * r.quantity / 100));
        if (r.image) lines.push('Ürün fotoğrafı: ' + r.image);
        lines.push('');
      }
      lines.push('Toplam: ' + money(data.totalCents / 100));
      for (const [key, format, label] of [['pdfUrl','pdf','PDF Sipariş Listesi'],['excelUrl','excel','Excel Sipariş Listesi']]) {
        const url = new URL(data[key], location.origin);
        if (url.origin !== location.origin || !new RegExp('^/api/order-export/[a-f0-9]{64}/'+format+'$').test(url.pathname)) throw Error('Geçersiz bağlantı');
        lines.push('', label + ': ' + url.href);
      }
      const target = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(lines.join('\n'));
      if (tab && !tab.closed) tab.location.replace(target); else location.assign(target);
    } catch (error) {
      console.error('Order export failed');
      const target = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(fallbackLines.join('\n'));
      if (tab && !tab.closed) tab.location.replace(target); else location.assign(target);
    }
    finally { busy = false; button.textContent = original; updateCart(); }
  };
})();
