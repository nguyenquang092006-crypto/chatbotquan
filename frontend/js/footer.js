async function initFooter() {
  const footerWebsite = document.getElementById('footerWebsite');
  const footerFacebook = document.getElementById('footerFacebook');
  const footerAddress = document.getElementById('footerAddress');
  const footerPhone = document.getElementById('footerPhone');
  const footerEmail = document.getElementById('footerEmail');

  try {
    const res = await fetch('/api/library');
    if (!res.ok) return;
    const lib = await res.json();

    if (footerAddress) footerAddress.textContent = lib.address;
    if (footerPhone) footerPhone.textContent = lib.phone;
    if (footerEmail) footerEmail.textContent = lib.email;
    if (footerWebsite) footerWebsite.href = lib.website;
    if (footerFacebook) footerFacebook.href = lib.facebook;
  } catch {
    /* giữ nội dung mặc định */
  }
}

initFooter();
