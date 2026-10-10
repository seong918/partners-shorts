'use strict';
const search = document.querySelector('#search');
const category = document.querySelector('#category');
const list = document.querySelector('#products');
const state = document.querySelector('#state');
const count = document.querySelector('#count');
const clear = document.querySelector('#clear');
const retry = document.querySelector('#retry');
let products = [];
const initial = new URL(location.href).searchParams.get('q') || location.hash.match(/^#product-(\d+)$/)?.[1] || '';
search.value = initial;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function message(title, detail, error = false) {
  state.replaceChildren(element('h3', error ? 'error' : '', title), element('p', '', detail));
  state.hidden = false;
}
function safeLink(value, kind) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const hosts = kind === 'purchase' ? ['link.coupang.com'] : ['www.youtube.com', 'youtube.com', 'youtu.be', 'www.instagram.com', 'instagram.com'];
    return hosts.includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
function render() {
  const query = search.value.trim().toLocaleLowerCase('ko');
  const number = query.replace(/^#|번$/g, '').trim();
  const filtered = products.filter(p => (!category.value || p.category === category.value) && (!query || String(p.number) === number || `${p.name} ${p.category} ${p.summary}`.toLocaleLowerCase('ko').includes(query)));
  clear.hidden = !search.value;
  list.replaceChildren();
  count.textContent = `${filtered.length}개`;
  state.hidden = filtered.length > 0;
  if (!filtered.length) message(products.length ? '찾는 상품이 없어요.' : '상품을 준비하고 있어요.', products.length ? '영상 속 번호를 확인하거나 검색어를 지워 보세요.' : '소개할 상품의 정보와 링크를 확인한 뒤 이곳에 모아둘게요.');
  for (const p of filtered) {
    const card = element('article', 'product');
    card.id = `product-${p.number}`;
    const photo = element('div', 'photo');
    if (/^assets\/[a-f0-9]{64}\.jpg$/.test(p.image || '')) {
      const img = element('img'); img.src = p.image; img.alt = p.name; img.width = 640; img.height = 640; img.loading = 'lazy';
      img.addEventListener('error', () => photo.replaceChildren(element('span', '', '사진을 불러오지 못했어요.')));
      photo.append(img);
    } else photo.textContent = '사진 준비 중';
    const meta = element('div', 'product-meta'); meta.append(element('span', 'number', `${String(p.number).padStart(2, '0')}번`), element('span', '', p.category));
    card.append(photo, meta, element('h3', '', p.name), element('p', 'description', p.summary));
    const valid = p.status === 'approved' && Date.parse(p.valid_until) > Date.now();
    if (valid && Number.isInteger(p.price)) card.append(element('p', 'price', `${p.price.toLocaleString('ko-KR')}원`));
    if (p.checked_at) card.append(element('p', 'checked', `${new Date(p.checked_at).toLocaleDateString('ko-KR')} 확인 · 가격 변동 가능`));
    const url = valid && safeLink(p.affiliate_url, 'purchase');
    if (url) {
      const link = element('a', 'purchase', '쿠팡에서 확인'); link.href = url; link.target = '_blank'; link.rel = 'sponsored nofollow noopener noreferrer'; link.setAttribute('aria-label', `${p.number}번 ${p.name} 쿠팡에서 확인 (새 창)`); link.append(element('span', '', '↗')); card.append(link);
      link.dataset.validUntil = p.valid_until;
      link.addEventListener('click', event => { if (Date.parse(p.valid_until) <= Date.now()) { event.preventDefault(); render(); } });
    } else card.append(element('span', 'purchase unavailable', p.status === 'out_of_stock' ? '품절 · 링크 확인 중' : p.status === 'retired' ? '소개가 종료된 상품' : '상품 정보 확인 중'));
    const videos = element('div', 'video-links');
    (p.videos || []).slice(0, 2).forEach((value, i) => { const url = safeLink(value, 'video'); if (url) { const a = element('a', '', `소개 영상 ${i + 1} ↗`); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; videos.append(a); } });
    card.append(videos); list.append(card);
  }
}
async function load() {
  retry.hidden = true; retry.disabled = true; list.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('products.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('catalog');
    const data = await response.json();
    if (data.schema_version !== 1 || !Array.isArray(data.products)) throw new Error('schema');
    products = data.products;
    category.replaceChildren(new Option('전체', ''));
    [...new Set(products.map(p => p.category))].sort().forEach(name => category.append(new Option(name, name)));
    render();
  } catch {
    products = []; list.replaceChildren(); count.textContent = '목록 연결 대기';
    message('상품 목록을 불러오지 못했어요.', '연결 상태를 확인하고 다시 불러와 주세요.', true); retry.hidden = false;
  } finally { retry.disabled = false; list.setAttribute('aria-busy', 'false'); }
}
search.addEventListener('input', render);
category.addEventListener('change', render);
clear.addEventListener('click', () => { search.value = ''; render(); search.focus({preventScroll: true}); });
retry.addEventListener('click', load);
// Expired links are disabled even when the static site has not yet been redeployed.
setInterval(() => { if ([...list.querySelectorAll('a.purchase')].some(a => Date.parse(a.dataset.validUntil) <= Date.now())) render(); }, 10000);
load();
