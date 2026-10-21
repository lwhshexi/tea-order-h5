const DEFAULT_MENU = window.TEA_MENU || [];
const KEYS = {
  menu: 'tea_h5_menu_v1', cart: 'tea_h5_cart_v1', orders: 'tea_h5_orders_v1',
  coupons: 'tea_h5_coupons_v1', addresses: 'tea_h5_addresses_v1',
  defaultAddress: 'tea_h5_default_address_v1', profile: 'tea_h5_profile_v1'
};
const DEFAULT_SPECS = { size: '中杯', sugar: '五分糖', ice: '正常冰', addon: '不加小料' };
const SIZES = [{ label: '中杯', value: '中杯', extra: 0 }, { label: '大杯 +¥2', value: '大杯', extra: 2 }];
const SUGARS = ['无糖', '三分糖', '五分糖', '七分糖'];
const ICES = ['去冰', '少冰', '正常冰', '热饮'];
const ADDONS = [{ label: '不加小料', value: '不加小料', extra: 0 }, { label: '珍珠 +¥2', value: '珍珠', extra: 2 }, { label: '椰果 +¥2', value: '椰果', extra: 2 }];
const COUPON_CENTER = [
  { id: 'NEW25', title: '满 ¥25 减 ¥4', description: '新品尝鲜券', minSpend: 25, amount: 4 },
  { id: 'NEW12', title: '满 ¥12 减 ¥2', description: '茶友专享券', minSpend: 12, amount: 2 }
];
const ORDER_STATUSES = ['待制作', '制作中', '待取餐', '配送中', '已完成', '已取消'];
const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#mainView');
const overlay = $('#overlayRoot');
const topbar = $('#topbar');
const toastNode = $('#toast');

function read(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; } catch { return fallback; } }
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getMenu() { return read(KEYS.menu, DEFAULT_MENU); }
function getCoupons() { let coupons = read(KEYS.coupons, null); if (!Array.isArray(coupons)) { coupons = [{ id: 'C5', title: '满 ¥30 减 ¥5', description: '茶饮满额立减', minSpend: 30, amount: 5, used: false }, { id: 'C3', title: '满 ¥20 减 ¥3', description: '茶饮满额立减', minSpend: 20, amount: 3, used: false }, { id: 'C2', title: '满 ¥15 减 ¥2', description: '茶饮满额立减', minSpend: 15, amount: 2, used: false }]; write(KEYS.coupons, coupons); } return coupons; }
function getOrders() { const value = read(KEYS.orders, []); return Array.isArray(value) ? value : []; }
function getAddresses() { const value = read(KEYS.addresses, []); return Array.isArray(value) ? value : []; }
function allGoods() { return getMenu().flatMap(category => category.goods.map(good => ({ ...good, categoryId: category.id, categoryName: category.name }))); }
function findGood(id) { return allGoods().find(good => good.id === id); }
function normalizeSpecs(specs = {}) { return { size: specs.size || DEFAULT_SPECS.size, sugar: specs.sugar || DEFAULT_SPECS.sugar, ice: specs.ice || DEFAULT_SPECS.ice, addon: specs.addon || DEFAULT_SPECS.addon }; }
function unitPrice(good, specs) { return Number(good?.price || 0) + (specs.size === '大杯' ? 2 : 0) + (['珍珠', '椰果'].includes(specs.addon) ? 2 : 0); }
function lineKey(id, specs) { return [id, specs.size, specs.sugar, specs.ice, specs.addon].join('|'); }
function specText(specs) { return [specs.size, specs.sugar, specs.ice, specs.addon].join(' / '); }
function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function fmt(value) { return Number(value || 0).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1'); }
function totals() { const lines = Object.entries(state.cart); return { lines, count: lines.reduce((sum, [, item]) => sum + Number(item.count || 0), 0), amount: lines.reduce((sum, [, item]) => sum + Number(item.price || 0) * Number(item.count || 0), 0) }; }
function refreshCart() {
  const menu = getMenu(); const cart = { ...state.cart }; const valid = new Set(); const counts = {}; let amount = 0; let count = 0;
  menu.forEach(category => category.goods.forEach(good => Object.entries(cart).forEach(([key, item]) => {
    if (item.goodId !== good.id || good.available === false || Number(item.count) <= 0) return;
    const specs = normalizeSpecs(item.specs); const price = unitPrice(good, specs);
    cart[key] = { ...item, goodId: good.id, name: good.name, basePrice: good.price, price, specs, specText: specText(specs) };
    amount += price * Number(item.count); count += Number(item.count); counts[good.id] = (counts[good.id] || 0) + Number(item.count); valid.add(key);
  })));
  Object.keys(cart).forEach(key => { if (!valid.has(key)) delete cart[key]; });
  state.cart = cart; write(KEYS.cart, cart); state.cartCount = counts; state.cartTotal = amount; state.totalCount = count;
}
function refreshOrders() {
  const orders = getOrders(); let changed = false; const now = Date.now();
  orders.forEach(order => {
    if (order.manualStatus || order.status === '已取消' || !order.createdAt) return;
    const elapsed = now - order.createdAt; const next = elapsed >= 55000 ? '已完成' : elapsed >= 35000 ? (order.deliveryType === '到店自取' ? '待取餐' : '配送中') : elapsed >= 15000 ? '制作中' : '待制作';
    if (order.status !== next) { order.status = next; changed = true; }
  });
  if (changed) write(KEYS.orders, orders); return orders;
}
function toast(message) { toastNode.textContent = message; toastNode.classList.add('show'); clearTimeout(toast._timer); toast._timer = setTimeout(() => toastNode.classList.remove('show'), 1900); }
function confirmAction(message) { return window.confirm(message); }
function scrollToTop() { app.scrollTop = 0; }
function transitionView(view, params = {}) { state.view = view; state.params = params; state.sheet = ''; state.detailZoomed = false; render(); scrollToTop(); }
function saveProfile(profile) { write(KEYS.profile, profile); state.profile = profile; }
function persistOrder(order) { const orders = getOrders(); orders.unshift(order); write(KEYS.orders, orders); }

let state = {
  view: 'menu', params: {}, query: '', category: '', cart: read(KEYS.cart, {}),
  sheet: '', selectedGood: null, selectedSpecs: { ...DEFAULT_SPECS }, editingLineKey: '',
  selectedCouponId: '', remark: '', deliveryType: '外卖配送', addressId: '', detailZoomed: false,
  manageTab: 'menu', manageForm: null, toastTimer: null,
  profile: read(KEYS.profile, { nickname: '茶友', avatarMark: '茶', avatarImage: '' })
};
refreshCart();
state.category = getMenu()[0]?.id || '';

function updateTopbar() {
  if (state.view === 'menu') {
    topbar.innerHTML = `<div class="shop-logo"><span>茶</span><i></i></div><div class="shop-info"><div class="shop-name-row"><strong class="shop-name">茶语</strong><small class="shop-tag">东方茶饮</small></div><div class="shop-meta"><span class="shop-score">★ 4.9</span><span>月售 2381</span><span>约 30 分钟</span></div></div><button class="icon-button" data-action="share" aria-label="分享">›</button>`;
  } else {
    const titles = { orders: '茶语 · 东方茶饮', mine: '茶语 · 东方茶饮', checkout: '确认订单', addresses: state.params.select ? '选择收货地址' : '收货地址', coupons: '优惠券', detail: '订单详情', manage: '店员管理' };
    topbar.innerHTML = `${['orders','mine'].includes(state.view) ? '' : '<button class="back-button" data-action="back">‹</button>'}<strong class="subpage-title">${titles[state.view] || '茶语'}</strong><span class="topbar-spacer"></span>`;
  }
}
function render() {
  refreshCart(); updateTopbar();
  document.querySelectorAll('.bottom-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === state.view || (state.view === 'checkout' && button.dataset.view === 'menu')));
  document.querySelector('.bottom-nav').hidden = !['menu', 'orders', 'mine'].includes(state.view);
  app.className = ['menu', 'orders', 'mine'].includes(state.view) ? `view-${state.view}` : 'view-subpage';
  if (state.view === 'menu') renderMenu();
  else if (state.view === 'orders') renderOrders();
  else if (state.view === 'mine') renderMine();
  else if (state.view === 'checkout') renderCheckout();
  else if (state.view === 'addresses') renderAddresses();
  else if (state.view === 'coupons') renderCoupons();
  else if (state.view === 'detail') renderOrderDetail();
  else if (state.view === 'manage') renderManage();
  renderOverlay();
}

function renderMenu() {
  const all = getMenu(); const keyword = state.query.trim().toLowerCase();
  const categories = all.map(category => ({ ...category, goods: category.goods.filter(good => good.available !== false && (!keyword || `${good.name} ${good.desc}`.toLowerCase().includes(keyword))) })).filter(category => category.goods.length);
  if (!categories.some(category => category.id === state.category)) state.category = categories[0]?.id || '';
  app.innerHTML = `<label class="search-wrap"><span class="search-icon">⌕</span><input id="searchInput" class="search-input" placeholder="搜茶名、口味" value="${esc(state.query)}">${state.query ? '<button class="search-clear" data-action="clear-search">×</button>' : ''}</label>
    <section class="welcome-card"><div class="welcome-copy"><span class="welcome-kicker">A CUP OF EAST</span><strong class="welcome-title">一盏好茶，慢慢喝</strong><span class="welcome-subtitle">当季鲜萃 · 现点现做</span></div><div class="welcome-art"><i class="art-sun"></i><i class="art-cup"><i class="art-tea"></i><i class="art-handle"></i></i><span class="art-leaf">✦</span></div><div class="welcome-stamp">今日<br>鲜制</div></section>
    <div class="service-row"><i class="service-dot"></i><span>精选原叶</span><i class="service-sep">·</i><span>下单后现制</span><i class="service-sep">·</i><span>满 ¥30 免配送费</span></div>
    ${keyword ? `<div class="search-count">找到 ${categories.reduce((n, c) => n + c.goods.length, 0)} 款茶饮</div>` : ''}
    <div class="menu-main"><aside class="category-list">${categories.map(category => `<button class="category-item ${category.id === state.category ? 'active' : ''}" data-category="${esc(category.id)}">${esc(category.name)}${category.id === state.category ? '<i>●</i>' : ''}</button>`).join('')}</aside><section class="goods-list" id="goodsScroll">${categories.length ? categories.map(category => `<section class="goods-section" id="category-${esc(category.id)}"><div class="section-title"><strong>${esc(category.name)}</strong><small>好茶慢制</small></div>${category.goods.map(renderGood).join('')}</section>`).join('') + '<div class="list-bottom">— 好茶不急，慢慢挑选 —</div>' : `<div class="search-empty"><span>茶</span><b>${keyword ? '没有找到相关茶饮' : '今日菜单暂时售罄'}</b><small>${keyword ? '试试商品名或口味关键词' : '请稍后再来看看'}</small></div>`}</section></div>
    <div class="cart-bar"><button class="cart-icon-wrap" data-action="cart">茶${state.totalCount ? `<i class="cart-badge">${state.totalCount}</i>` : ''}</button><div class="cart-info" data-action="cart">${state.cartTotal ? `<strong>¥${fmt(state.cartTotal)}</strong>` : '<small>未选购商品</small>'}</div><button class="cart-checkout ${state.totalCount ? '' : 'disabled'}" data-action="checkout">去结算</button></div>`;
}
function renderGood(good) {
  const count = state.cartCount[good.id] || 0; const firstLine = Object.entries(state.cart).reverse().find(([, line]) => line.goodId === good.id)?.[0] || '';
  const thumb = good.image ? `<img class="good-photo" src="${esc(good.image)}" alt="${esc(good.name)}">` : `<i class="thumb-glow"></i><span class="drink-cup"><i class="drink-lid"></i><i class="drink-body"></i></span><span class="thumb-label">${esc((good.name || '茶').slice(0, 1))}</span><span class="thumb-leaf">✦</span>`;
  return `<article class="goods-item"><button class="goods-thumb thumb-${esc(good.id)}" data-detail-good="${esc(good.id)}">${thumb}</button><div class="goods-body"><div class="goods-name-row"><button class="goods-name" data-detail-good="${esc(good.id)}">${esc(good.name)}</button>${Number(good.monthSale) > 200 ? '<span class="goods-hot">人气</span>' : ''}</div><div class="goods-desc">${esc(good.desc)}</div><div class="goods-note">当日鲜萃 · 甄选茶底</div><div class="goods-bottom"><span class="goods-price">¥${fmt(good.price)}</span><span class="goods-sale">月售${Number(good.monthSale || 0)}</span><span class="stepper">${Number(good.stock) === 0 ? '<span class="sold-out-tag">售罄</span>' : `${count ? `<button class="minus" data-minus="${esc(firstLine)}">−</button><b>${count}</b>` : ''}<button class="plus" data-plus="${esc(good.id)}">＋</button>`}</span></div></div></article>`;
}
function renderOrders() {
  const orders = refreshOrders();
  app.innerHTML = orders.length ? orders.map(order => `<article class="order-card"><button class="order-card-main" data-order-detail="${esc(order.id)}"><div class="order-head"><span>订单号 ${esc(order.id)}</span><b class="order-status">${esc(order.status)}</b></div>${order.address ? `<div class="history-address"><small>${order.deliveryType === '到店自取' ? '取餐人' : '配送至'}</small><span>${esc(order.address.recipient)}　${esc(order.address.phone)}</span><span>${esc(order.address.region || '')} ${esc(order.address.detail || '')}</span></div>` : ''}<div class="order-goods">${order.items.map(item => `<div class="order-good-info"><span>${esc(item.name)}</span><small>${esc(item.specText || '')}</small></div><span class="g-count">×${item.count}</span></div>`).join('')}${order.coupon || order.remark ? `<div class="history-extra">${order.coupon ? `<span>已用 ${esc(order.coupon.title)}，优惠 ¥${fmt(order.discountAmount)}</span>` : ''}${order.remark ? `<span>备注：${esc(order.remark)}</span>` : ''}</div>` : ''}<div class="order-foot"><span>${esc(order.createTime || order.time || '')}</span><strong>合计 ¥${fmt(order.totalPrice ?? order.total)}</strong></div></button><div class="order-actions"><span>查看详情 ›</span><i></i>${['待支付','待制作','制作中'].includes(order.status) ? `<button class="secondary-action" data-cancel-order="${esc(order.id)}">取消订单</button>` : ''}${['已完成','已取消'].includes(order.status) ? `<button class="secondary-action delete-action" data-delete-order="${esc(order.id)}">删除</button>` : ''}</div></article>`).join('') : `<div class="empty"><div class="empty-icon">茶</div><p>尚无订单 · 去寻一杯好茶</p><button class="primary-button" data-view="menu">去点餐</button></div>`;
}
function renderMine() {
  const orders = getOrders(); const coupons = getCoupons(); const profile = state.profile;
  const avatar = profile.avatarImage ? `<img src="${esc(profile.avatarImage)}" alt="头像">` : esc(profile.avatarMark || '茶');
  app.innerHTML = `<button class="profile-card" data-action="edit-profile"><span class="avatar">${avatar}</span><span class="profile-info"><b>${esc(profile.nickname || '茶友')}</b><small>ID: 10086</small></span><span class="profile-edit">编辑资料 ›</span></button><section class="card stat-row"><button data-view="orders"><b>${orders.length}</b><small>订单</small></button><button data-view="coupons"><b>${coupons.filter(item => !item.used).length}</b><small>优惠券</small></button><button><b>0</b><small>积分</small></button></section><section class="card mine-menu"><button data-view="orders"><span>我的订单</span><i>›</i></button><button data-view="menu"><span>去点餐</span><i>›</i></button><button data-view="coupons"><span>优惠券</span><small>${coupons.filter(item => !item.used).length} 张可用</small><i>›</i></button><button data-action="addresses"><span>收货地址</span><i>›</i></button><button data-action="about"><span>关于茶语</span><i>›</i></button><button data-action="manage"><span>店员管理</span><small>本地演示</small><i>›</i></button></section><div class="footer">茶语 · 东方茶饮 · 练手演示项目</div>`;
}

function renderCheckout() {
  const amount = state.cartTotal; const fee = state.deliveryType === '到店自取' || amount >= 30 ? 0 : 3;
  const coupons = getCoupons().filter(coupon => !coupon.used); const selected = coupons.find(c => c.id === state.selectedCouponId && amount >= c.minSpend); const discount = selected ? Math.min(selected.amount, amount) : 0;
  const addresses = getAddresses(); const address = addresses.find(item => item.id === (state.addressId || read(KEYS.defaultAddress, ''))) || addresses[0] || null;
  state.checkoutAddress = address; state.deliveryFee = fee; state.discount = discount; state.payable = Math.max(0, amount + fee - discount);
  app.innerHTML = `<div class="checkout-page"><button class="card address-card" data-action="choose-address"><span class="address-icon">⌂</span><span class="address-info">${address ? `<b>${esc(address.recipient)}　${esc(address.phone)}</b><small>${esc(address.region)} ${esc(address.detail)}</small>` : `<b>添加收货地址</b><small>请填写本次订单的配送地址</small>`}</span><i>›</i></button><section class="card"><h3>商品清单</h3>${totals().lines.map(([key, item]) => `<div class="checkout-item"><span><b>${esc(item.name)}</b><small>${esc(item.specText)}</small></span><i>×${item.count}</i><strong>¥${fmt(item.price * item.count)}</strong><button data-edit-line="${esc(key)}">改规格</button></div>`).join('')}</section><section class="card"><div class="price-row"><span>配送费</span><b class="${fee ? '' : 'free'}">${fee ? '¥'+fmt(fee) : '已免配送费'}</b></div><button class="price-row" data-action="coupon-picker"><span>优惠券</span><b>${selected ? esc(selected.title) : '选择优惠券'}　›</b></button><div class="price-row"><span>优惠金额</span><b class="discount">-¥${fmt(discount)}</b></div><div class="price-row total-row"><span>合计</span><b>¥${fmt(state.payable)}</b></div></section><section class="card"><label class="remark-row"><span>备注</span><input id="remarkInput" maxlength="100" placeholder="口味、份量等要求（可选）" value="${esc(state.remark)}"></label><small class="demo-note">本地演示订单，不会产生真实扣款</small></section></div><div class="submit-bar"><span>合计 <b>¥${fmt(state.payable)}</b></span><button data-action="submit-order">提交订单</button></div>`;
}
function renderAddresses() {
  const addresses = getAddresses(); const defaultId = read(KEYS.defaultAddress, ''); const selecting = Boolean(state.params.select);
  app.innerHTML = `<div class="address-page"><p class="subtle">${selecting ? '选择本次订单的收货地址' : '管理你的常用收货地址'}</p>${addresses.length ? addresses.map(item => `<article class="address-card"><button class="address-main" data-address-select="${esc(item.id)}"><div><b>${esc(item.recipient)}</b><span>${esc(item.phone)}</span>${defaultId === item.id ? '<i class="default-tag">默认</i>' : ''}</div><p>${esc(item.region)} ${esc(item.detail)}</p></button><div class="address-actions"><button data-edit-address="${esc(item.id)}">编辑</button><button data-delete-address="${esc(item.id)}">删除</button></div></article>`).join('') : '<div class="empty-address"><span>⌂</span><b>还没有收货地址</b><small>添加地址后即可提交订单</small></div>'}<button class="add-address" data-action="new-address">＋ 新增收货地址</button></div>`;
}
function renderCoupons() {
  const coupons = getCoupons(); const center = COUPON_CENTER.map(coupon => ({ ...coupon, claimed: coupons.some(item => item.id === coupon.id) }));
  app.innerHTML = `<div class="coupon-page"><div class="coupon-summary"><b>${coupons.filter(item => !item.used).length}<small>张可用</small></b><button data-action="coupon-rules">使用说明 ›</button></div>${coupons.map(coupon => `<article class="coupon-card ${coupon.used ? 'coupon-used' : ''}"><div class="coupon-amount"><small>¥</small><b>${fmt(coupon.amount)}</b><i>优惠</i></div><div class="coupon-info"><b>${esc(coupon.title)}</b><span>${esc(coupon.description)}</span><small>仅抵商品金额 · 不与其他券同享</small></div><span class="coupon-state">${coupon.used ? '已使用' : '可使用'}</span></article>`).join('') || '<div class="coupon-empty">暂无优惠券</div>'}<div class="center-heading"><b>领券中心</b><small>领取后可在结算时使用</small></div>${center.map(coupon => `<article class="center-coupon"><span><b>${esc(coupon.title)}</b><small>${esc(coupon.description)} · 满额可用</small></span><button class="claim-btn ${coupon.claimed ? 'claimed' : ''}" data-claim-coupon="${coupon.id}" ${coupon.claimed ? 'disabled' : ''}>${coupon.claimed ? '已领取' : '立即领取'}</button></article>`).join('')}<div class="coupon-foot">已使用 ${coupons.filter(item => item.used).length} 张 · 优惠券以本地演示数据为准</div></div>`;
}
function renderOrderDetail() {
  const order = refreshOrders().find(item => item.id === state.params.id);
  if (!order) { app.innerHTML = '<div class="missing">找不到这笔订单<button data-action="back">返回</button></div>'; return; }
  const stageByStatus = { '待制作': 0, '制作中': 1, '待取餐': 2, '配送中': 2, '已完成': 3 }; const stage = stageByStatus[order.status] ?? -1;
  const progress = ['待制作', '制作中', order.deliveryType === '到店自取' ? '待取餐' : '配送中', '已完成'];
  app.innerHTML = `<div class="detail-page"><section class="status-card"><h2>${esc(order.status)}</h2><p>${order.payStatus === 'unpaid' ? '待支付订单 · 当前未接入真实收款' : '订单状态实时更新'}</p>${stage >= 0 ? `<div class="timeline">${progress.map((label, index) => `${index ? `<i class="timeline-line ${stage >= index ? 'active' : ''}"></i>` : ''}<span class="timeline-step ${stage >= index ? 'active' : ''}"><i></i><small>${label}</small></span>`).join('')}</div>` : '<p class="cancelled-note">订单已取消，优惠券已恢复至可用状态。</p>'}</section>${order.address ? `<section class="card"><h3>配送信息</h3><p>${esc(order.address.recipient)}　${esc(order.address.phone)}</p><small>${esc(order.address.region || '')} ${esc(order.address.detail || '')}</small></section>` : ''}<section class="card"><h3>商品清单</h3>${order.items.map(item => `<div class="checkout-item"><span><b>${esc(item.name)}</b><small>${esc(item.specText)}</small></span><i>×${item.count}</i><strong>¥${fmt(item.total || item.price * item.count)}</strong></div>`).join('')}</section><section class="card detail-pricing"><div><span>商品金额</span><b>¥${fmt(order.goodsPrice ?? order.totalPrice ?? order.total)}</b></div><div><span>配送费</span><b>¥${fmt(order.deliveryFee)}</b></div>${order.discountAmount ? `<div><span>优惠</span><b class="discount">-¥${fmt(order.discountAmount)}</b></div>` : ''}${order.coupon ? `<div><span>优惠券</span><b>${esc(order.coupon.title)}</b></div>` : ''}${order.remark ? `<div><span>备注</span><b>${esc(order.remark)}</b></div>` : ''}<div><span>下单时间</span><b>${esc(order.createTime || order.time || '')}</b></div><div class="total-row"><span>${order.payStatus === 'unpaid' ? '应付金额' : '实付金额'}</span><b>¥${fmt(order.totalPrice ?? order.total)}</b></div></section><div class="order-id-line">订单号 ${esc(order.id)}</div></div><div class="action-bar">${['待支付','待制作','制作中'].includes(order.status) ? `<button class="secondary-action" data-cancel-order="${esc(order.id)}">取消订单</button>` : ''}${['已取消','已完成'].includes(order.status) ? `<button class="secondary-action" data-delete-order="${esc(order.id)}">删除订单</button>` : ''}<button class="primary-button" data-reorder="${esc(order.id)}">再来一单</button></div>`;
}

function renderManage() {
  const categories = getMenu(); const orders = refreshOrders();
  const menuContent = `<div class="manage-toolbar"><b>菜单商品</b><button data-action="new-good">＋ 新增商品</button></div>${categories.map(category => `<section class="category-block"><h3>${esc(category.name)} <small>(${category.goods.length})</small></h3>${category.goods.map(good => `<article class="manage-good">${good.image ? `<img src="${esc(good.image)}">` : '<span class="manage-good-placeholder">茶</span>'}<span class="manage-good-info"><b>${esc(good.name)} ${good.available === false ? '<i>已下架</i>' : ''}</b><small>¥${fmt(good.price)} · 月售 ${Number(good.monthSale || 0)} · 库存 ${good.stock == null ? '不限' : good.stock}</small><small>${esc(good.desc)}</small></span><span class="manage-good-actions"><button data-edit-good="${esc(good.id)}">编辑</button><button data-toggle-good="${esc(good.id)}">${good.available === false ? '上架' : '下架'}</button><button class="danger" data-delete-good="${esc(good.id)}">删除</button></span></article>`).join('')}</section>`).join('')}`;
  const orderContent = `<div class="manage-toolbar"><b>顾客订单</b><small>${orders.length} 笔</small></div>${orders.map(order => `<article class="manage-order"><div class="manage-order-head"><b>${esc(order.id)}</b><strong>${fmt(order.totalPrice)} 元</strong></div>${order.address ? `<small>${esc(order.address.recipient)} · ${esc(order.address.phone)}</small>` : ''}<div class="manage-order-items">${order.items.map(item => `<span>${esc(item.name)} ×${item.count}</span>`).join('')}</div><label>订单状态<select data-status-order="${esc(order.id)}">${ORDER_STATUSES.map(status => `<option ${order.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label></article>`).join('') || '<div class="manage-empty">暂无订单</div>'}`;
  app.innerHTML = `<div class="manage-page"><p class="manage-note">店员演示工作台 · 修改仅保存在当前设备</p><div class="manage-tabs"><button class="${state.manageTab === 'menu' ? 'active' : ''}" data-manage-tab="menu">商品管理</button><button class="${state.manageTab === 'orders' ? 'active' : ''}" data-manage-tab="orders">订单管理</button></div>${state.manageTab === 'menu' ? menuContent : orderContent}</div>`;
}

function goodArt(good, large = false) {
  if (good.image) return `<img class="${large ? 'detail-photo' : 'good-photo'}" src="${esc(good.image)}" alt="${esc(good.name)}">`;
  return `<div class="${large ? 'detail-cup-art' : 'product-art'} thumb-${esc(good.id)}"><i class="thumb-glow"></i><i class="cup-shape"></i><b>${esc((good.name || '茶').slice(0, 1))}</b></div>`;
}
function renderOverlay() {
  if (state.sheet === 'cart') overlay.innerHTML = renderCartSheet();
  else if (state.sheet === 'spec') overlay.innerHTML = renderSpecSheet();
  else if (state.sheet === 'good-detail') overlay.innerHTML = renderGoodDetail();
  else if (state.sheet === 'profile') overlay.innerHTML = renderProfileSheet();
  else if (state.sheet === 'address-form') overlay.innerHTML = renderAddressForm();
  else if (state.sheet === 'coupon-picker') overlay.innerHTML = renderCouponPicker();
  else if (state.sheet === 'good-form') overlay.innerHTML = renderGoodForm();
  else overlay.innerHTML = '';
}
function renderCartSheet() {
  const { lines, amount, count } = totals(); return `<div class="mask" data-overlay-close></div><section class="bottom-panel cart-panel"><header><b>已选商品</b><button data-action="clear-cart">清空</button></header><div class="cart-panel-list">${lines.map(([key, item]) => `<article class="cart-line"><span><b>${esc(item.name)}</b><small>${esc(item.specText)}</small><button data-edit-line="${esc(key)}">改规格</button></span><strong>¥${fmt(item.price)}</strong><div class="stepper"><button class="minus" data-minus="${esc(key)}">−</button><b>${item.count}</b><button class="plus" data-line-plus="${esc(key)}">＋</button></div></article>`).join('') || '<div class="cart-empty">购物车还是空的</div>'}</div><footer><span>合计　<b>¥${fmt(amount)}</b></span><button class="primary-button" data-action="checkout" ${count ? '' : 'disabled'}>去结算</button></footer></section>`;
}
function renderSpecSheet() {
  const good = state.selectedGood; if (!good) return '';
  const groups = [['size','杯型',SIZES.map(x=>x.value)],['sugar','糖度',SUGARS],['ice','冰量',ICES],['addon','加料',ADDONS.map(x=>x.value)]];
  return `<div class="mask" data-overlay-close></div><section class="bottom-panel spec-panel"><header><span><b>选择规格</b><small>${esc(good.name)}</small></span><button data-action="close-sheet">×</button></header><div class="spec-good-row">${goodArt(good)}<span><b>${esc(good.name)}</b><small>${esc(good.desc)}</small></span></div>${groups.map(([key,label,options]) => `<div class="spec-group"><b>${label}</b><div>${options.map(value => `<button class="spec-option ${state.selectedSpecs[key] === value ? 'selected' : ''}" data-spec-option="${key}" data-spec-value="${esc(value)}">${esc(value)}${(key === 'size' && value === '大杯') || (key === 'addon' && ['珍珠','椰果'].includes(value)) ? ' +¥2' : ''}</button>`).join('')}</div></div>`).join('')}<footer><strong>¥${fmt(unitPrice(good,state.selectedSpecs))}</strong><button class="primary-button" data-action="confirm-spec">加入购物车</button></footer></section>`;
}
function renderGoodDetail() {
  const good = state.selectedGood; if (!good) return '';
  return `<div class="mask" data-overlay-close></div><section class="bottom-panel good-detail-panel"><button class="detail-close" data-action="close-sheet">×</button><button class="detail-hero thumb-${esc(good.id)}" data-action="zoom-good">${goodArt(good,true)}<small>点击${good.image ? '查看大图' : '放大'}</small></button><h2>${esc(good.name)}</h2><p>${esc(good.desc)}</p><div class="detail-description"><div><small>主要原料</small><span>${esc(good.ingredients || '当季精选')}</span></div><div><small>口味特点</small><span>${esc(good.taste || '清香回甘')}</span></div></div><div class="detail-extra"><span>月售　${Number(good.monthSale || 0)} 份</span><span>品类　${esc(good.categoryName || '精选茶饮')}</span></div><div class="detail-flags"><span>当日鲜萃</span><span>甄选茶底</span><span>现点现制</span></div><footer><strong>¥${fmt(good.price)}<small> 起</small></strong><button class="primary-button" data-action="choose-detail">选规格</button></footer></section>${state.detailZoomed ? `<div class="zoom-mask" data-action="zoom-good">${goodArt(good,true)}<b>${esc(good.name)}</b></div>` : ''}`;
}
function renderProfileSheet() {
  const profile = state.profile;
  return `<div class="mask" data-overlay-close></div><section class="bottom-panel profile-editor"><header><b>编辑个人资料</b><button data-action="close-sheet">×</button></header><label>头像</label><div class="avatar-upload-row"><span class="avatar-upload-preview">${profile.avatarImage ? `<img src="${esc(profile.avatarImage)}">` : esc(profile.avatarMark || '茶')}</span><span><label class="upload-button">从相册/相机上传<input type="file" id="avatarFile" accept="image/*"></label>${profile.avatarImage ? '<button class="remove-image" data-action="remove-avatar">移除照片</button>' : ''}</span></div><label>或选择文字头像</label><div class="avatar-options">${['茶','叶','友','☕'].map(mark => `<button class="${profile.avatarMark === mark && !profile.avatarImage ? 'selected' : ''}" data-avatar-mark="${esc(mark)}">${mark}</button>`).join('')}</div><label for="nicknameInput">昵称</label><input id="nicknameInput" maxlength="12" value="${esc(profile.nickname || '')}" placeholder="输入昵称"><button class="primary-button" data-action="save-profile">保存资料</button></section>`;
}
function renderAddressForm(id = '') {
  const address = id ? getAddresses().find(item => item.id === id) : null; state.editingAddressId = id;
  return `<div class="mask" data-overlay-close></div><section class="bottom-panel form-panel"><header><b>${id ? '编辑地址' : '新增地址'}</b><button data-action="close-sheet">×</button></header><input data-address-field="recipient" placeholder="收货人姓名" value="${esc(address?.recipient || '')}"><input data-address-field="phone" placeholder="手机号码" maxlength="11" inputmode="numeric" value="${esc(address?.phone || '')}"><input data-address-field="region" placeholder="所在地区，如：上海市徐汇区" value="${esc(address?.region || '')}"><input data-address-field="detail" placeholder="街道、门牌号等详细地址" value="${esc(address?.detail || '')}"><button class="primary-button" data-action="save-address">保存地址</button></section>`;
}
function renderCouponPicker() {
  const coupons = getCoupons().filter(item => !item.used); return `<div class="mask" data-overlay-close></div><section class="bottom-panel coupon-panel"><header><b>选择优惠券</b><button data-action="close-sheet">×</button></header><button class="coupon-choice" data-select-coupon="none"><span><b>不使用优惠券</b><small>保留当前金额</small></span>${state.selectedCouponId ? '' : '<i>✓</i>'}</button>${coupons.map(item => { const eligible = state.cartTotal >= item.minSpend; return `<button class="coupon-choice ${eligible ? '' : 'disabled'}" data-select-coupon="${esc(item.id)}" ${eligible ? '' : 'disabled'}><span><b>${esc(item.title)}</b><small>${eligible ? '可用于本单' : `还差 ¥${fmt(item.minSpend - state.cartTotal)} 可用`}</small></span>${item.id === state.selectedCouponId ? '<i>✓</i>' : ''}</button>`; }).join('') || '<div class="coupon-empty">暂无可用优惠券</div>'}</section>`;
}
function renderGoodForm(id = '') {
  const categories = getMenu(); const good = id ? findGood(id) : null; state.editingGoodId = id; state.removeGoodImage = false;
  const fields = [['name','商品名称',good?.name || ''],['price','价格（元）',good?.price ?? ''],['desc','商品描述',good?.desc || ''],['ingredients','主要原料',good?.ingredients || ''],['taste','口味特点',good?.taste || ''],['monthSale','月售数量',good?.monthSale ?? '0'],['stock','库存数量',good?.stock ?? '100']];
  return `<div class="mask" data-overlay-close></div><section class="bottom-panel form-panel good-form"><header><b>${id ? '编辑商品' : '新增商品'}</b><button data-action="close-sheet">×</button></header><label>商品分类<select id="goodCategory">${categories.map(c => `<option value="${esc(c.id)}" ${c.id === (good?.categoryId || categories[0]?.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>${fields.map(([key,label,value]) => `<input data-good-field="${key}" placeholder="${label}" value="${esc(value)}">`).join('')}<label>商品照片<input type="file" id="goodImageFile" accept="image/*"></label>${good?.image ? `<div class="existing-good-image"><img class="form-good-image" src="${esc(good.image)}"><button data-action="remove-good-image">移除照片</button></div>` : ''}<button class="primary-button" data-action="save-good">保存商品</button></section>`;
}

function addGood(good, specs, count = 1) {
  if (!good || good.available === false || Number(good.stock) === 0) { toast('该商品暂时售罄'); return; }
  const key = lineKey(good.id, specs); const price = unitPrice(good, specs); const old = state.cart[key];
  state.cart[key] = { goodId: good.id, name: good.name, basePrice: good.price, price, count: (old?.count || 0) + count, specs: { ...specs }, specText: specText(specs) };
  write(KEYS.cart, state.cart); refreshCart(); render(); toast('已加入购物车');
}
function openSpec(good, lineKeyToEdit = '') { state.selectedGood = good; state.selectedSpecs = normalizeSpecs(lineKeyToEdit ? state.cart[lineKeyToEdit]?.specs : DEFAULT_SPECS); state.editingLineKey = lineKeyToEdit; state.sheet = 'spec'; renderOverlay(); }
function changeLineCount(key, delta) { const line = state.cart[key]; if (!line) return; line.count = Number(line.count) + delta; if (line.count <= 0) delete state.cart[key]; write(KEYS.cart, state.cart); refreshCart(); render(); if (state.sheet === 'cart') renderOverlay(); }
function minusGood(id) { const key = Object.keys(state.cart).reverse().find(item => state.cart[item].goodId === id); if (key) changeLineCount(key, -1); }
function getOrder(id) { return refreshOrders().find(order => order.id === id); }
function cancelOrder(id) {
  const orders = refreshOrders(); const order = orders.find(item => item.id === id); if (!order || !['待制作','制作中'].includes(order.status)) { toast('当前订单已无法取消'); return; }
  order.status = '已取消'; order.manualStatus = true; order.cancelledAt = Date.now(); write(KEYS.orders, orders);
  if (order.coupon?.id) { const coupons = getCoupons(); const coupon = coupons.find(item => item.id === order.coupon.id); if (coupon) { coupon.used = false; write(KEYS.coupons, coupons); } }
  toast('订单已取消，优惠券已退回'); render();
}
function deleteOrder(id) { write(KEYS.orders, getOrders().filter(order => order.id !== id)); toast('订单已删除'); if (state.view === 'detail') transitionView('orders'); else render(); }
function reorder(id) {
  const order = getOrder(id); if (!order) return; const cart = { ...read(KEYS.cart, {}) };
  order.items.forEach(item => { const good = findGood(item.goodId || String(item.id || '').split('|')[0]); if (!good || good.available === false) return; const specs = normalizeSpecs(item.specs); const key = lineKey(good.id, specs); cart[key] = { goodId: good.id, name: good.name, basePrice: good.price, price: unitPrice(good, specs), count: Number(cart[key]?.count || 0) + Number(item.count || 1), specs, specText: specText(specs) }; });
  state.cart = cart; write(KEYS.cart, cart); refreshCart(); transitionView('menu'); toast('可售商品已加入购物车');
}
function saveAddress() {
  const fields = Object.fromEntries([...overlay.querySelectorAll('[data-address-field]')].map(input => [input.dataset.addressField, input.value.trim()]));
  if (Object.values(fields).some(value => !value)) { toast('请完整填写地址信息'); return; }
  if (!/^1\d{10}$/.test(fields.phone)) { toast('请填写正确的手机号'); return; }
  const addresses = getAddresses(); const id = state.editingAddressId || `A${Date.now()}`; const value = { id, ...fields }; const index = addresses.findIndex(item => item.id === id); if (index >= 0) addresses[index] = value; else addresses.unshift(value);
  write(KEYS.addresses, addresses); if (!read(KEYS.defaultAddress, '') || !state.editingAddressId) write(KEYS.defaultAddress, id); state.addressId = id; state.sheet = ''; render(); toast('地址已保存');
}
function claimCoupon(id) {
  const offer = COUPON_CENTER.find(item => item.id === id); if (!offer) return; const coupons = getCoupons(); if (coupons.some(item => item.id === id)) { toast('这张券已经领过了'); return; }
  coupons.push({ ...offer, used: false }); write(KEYS.coupons, coupons); render(); toast('领取成功');
}
function imageToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { const scale = Math.min(1, 800 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', .78)); }; image.onerror = reject; image.src = reader.result; }; reader.onerror = reject; reader.readAsDataURL(file); }); }
function updateOrderStatus(id, status) {
  const orders = refreshOrders(); const order = orders.find(item => item.id === id); if (!order) return; const previous = order.status; order.status = status; order.manualStatus = true; write(KEYS.orders, orders);
  if (status === '已取消' && previous !== '已取消' && order.coupon?.id) { const coupons = getCoupons(); const coupon = coupons.find(item => item.id === order.coupon.id); if (coupon) { coupon.used = false; write(KEYS.coupons, coupons); } }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button,[data-action],[data-detail-good],[data-plus],[data-minus],[data-edit-line],[data-view],[data-category],[data-manage-tab],[data-status-order]'); if (!button) return;
  if (button.dataset.view) { transitionView(button.dataset.view); return; }
  if (button.dataset.category) { state.category = button.dataset.category; renderMenu(); document.querySelectorAll('.category-item').forEach(item => item.classList.toggle('active', item.dataset.category === state.category)); $(`#category-${CSS.escape(state.category)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (button.dataset.detailGood) { state.selectedGood = findGood(button.dataset.detailGood); state.sheet = 'good-detail'; renderOverlay(); return; }
  if (button.dataset.plus) { openSpec(findGood(button.dataset.plus)); return; }
  if (button.dataset.minus) { changeLineCount(button.dataset.minus, -1); return; }
  if (button.dataset.linePlus) { changeLineCount(button.dataset.linePlus, 1); return; }
  if (button.dataset.editLine) { const line = state.cart[button.dataset.editLine]; if (line) openSpec(findGood(line.goodId), button.dataset.editLine); return; }
  if (button.dataset.orderDetail) { transitionView('detail', { id: button.dataset.orderDetail }); return; }
  if (button.dataset.cancelOrder) { if (confirmAction('确认取消这笔订单吗？已使用的优惠券会退回。')) cancelOrder(button.dataset.cancelOrder); return; }
  if (button.dataset.deleteOrder) { if (confirmAction('删除后将从订单列表中移除，确认继续吗？')) deleteOrder(button.dataset.deleteOrder); return; }
  if (button.dataset.reorder) { reorder(button.dataset.reorder); return; }
  if (button.dataset.delivery) { state.deliveryType = button.dataset.delivery; renderCheckout(); return; }
  if (button.dataset.claimCoupon) { claimCoupon(button.dataset.claimCoupon); return; }
  if (button.dataset.selectCoupon) { const id = button.dataset.selectCoupon; if (id !== 'none') state.selectedCouponId = id; else state.selectedCouponId = ''; state.sheet = ''; render(); return; }
  if (button.dataset.addressSelect) { write(KEYS.defaultAddress, button.dataset.addressSelect); state.addressId = button.dataset.addressSelect; if (state.params.select) { state.params.select = false; transitionView('checkout'); } else { render(); toast('已设为默认地址'); } return; }
  if (button.dataset.editAddress) { state.sheet = 'address-form'; overlay.innerHTML = renderAddressForm(button.dataset.editAddress); return; }
  if (button.dataset.deleteAddress) { if (!confirmAction('确定删除这条收货地址吗？')) return; const addresses = getAddresses().filter(item => item.id !== button.dataset.deleteAddress); write(KEYS.addresses, addresses); if (read(KEYS.defaultAddress, '') === button.dataset.deleteAddress) write(KEYS.defaultAddress, addresses[0]?.id || ''); render(); return; }
  if (button.dataset.manageTab) { state.manageTab = button.dataset.manageTab; renderManage(); return; }
  if (button.dataset.editGood) { state.sheet = 'good-form'; overlay.innerHTML = renderGoodForm(button.dataset.editGood); return; }
  if (button.dataset.toggleGood) { const menu = getMenu().map(c => ({ ...c, goods: c.goods.map(g => g.id === button.dataset.toggleGood ? { ...g, available: g.available === false } : g) })); write(KEYS.menu, menu); renderManage(); return; }
  if (button.dataset.deleteGood) { if (!confirmAction('删除后商品将从点餐菜单中移除，确认继续吗？')) return; write(KEYS.menu, getMenu().map(c => ({ ...c, goods: c.goods.filter(g => g.id !== button.dataset.deleteGood) }))); renderManage(); return; }
  if (button.dataset.action) {
    const action = button.dataset.action;
    if (action === 'cart') { state.sheet = 'cart'; renderOverlay(); }
    else if (action === 'checkout') { if (!state.totalCount) { toast('请先选择商品'); return; } state.selectedCouponId = ''; state.remark = ''; transitionView('checkout'); }
    else if (action === 'clear-search') { state.query = ''; renderMenu(); }
    else if (action === 'close-sheet') { state.sheet = ''; state.detailZoomed = false; renderOverlay(); }
    else if (action === 'confirm-spec') { const good = state.selectedGood; const specs = state.selectedSpecs; const key = lineKey(good.id, specs); const existing = state.cart[key]; const oldLine = state.editingLineKey ? state.cart[state.editingLineKey] : null; if (state.editingLineKey && state.editingLineKey !== key) delete state.cart[state.editingLineKey]; state.cart[key] = { goodId: good.id, name: good.name, basePrice: good.price, price: unitPrice(good, specs), count: oldLine ? oldLine.count + (existing && key !== state.editingLineKey ? existing.count : 0) : (existing?.count || 0) + 1, specs: { ...specs }, specText: specText(specs) }; state.sheet = ''; state.editingLineKey = ''; write(KEYS.cart, state.cart); render(); toast('已加入购物车'); }
    else if (action === 'choose-detail') { state.sheet = 'spec'; state.selectedSpecs = { ...DEFAULT_SPECS }; renderOverlay(); }
    else if (action === 'zoom-good') { if (state.selectedGood?.image) window.open(state.selectedGood.image, '_blank'); else { state.detailZoomed = !state.detailZoomed; renderOverlay(); } }
    else if (action === 'choose-address') { transitionView('addresses', { select: true, returnTo: 'checkout' }); }
    else if (action === 'addresses') transitionView('addresses');
    else if (action === 'new-address') { state.sheet = 'address-form'; overlay.innerHTML = renderAddressForm(); }
    else if (action === 'save-address') saveAddress();
    else if (action === 'coupon-picker') { state.sheet = 'coupon-picker'; renderOverlay(); }
    else if (action === 'coupon-rules') window.alert('优惠券仅抵扣商品金额，不抵扣配送费。每笔订单限用一张，达到券面金额门槛即可使用。');
    else if (action === 'submit-order') {
      if (!totals().count) { toast('购物车为空'); return; }
      if (state.deliveryType !== '到店自取' && !state.checkoutAddress) { toast('请先添加收货地址'); state.params.select = true; transitionView('addresses', { select: true }); return; }
      if (!confirmAction(`确认支付，应付金额 ¥${fmt(state.payable)}（本地模拟支付）？`)) return;
      const selected = getCoupons().find(item => item.id === state.selectedCouponId && !item.used);
      const order = { id: 'O' + Date.now(), items: totals().lines.map(([key,item]) => ({ ...item, id:key, total:item.price*item.count })), totalPrice:state.payable, goodsPrice:state.cartTotal, deliveryFee:state.deliveryFee, discountAmount:state.discount, coupon:selected?{ id:selected.id,title:selected.title,amount:state.discount }:null, address:state.deliveryType === '到店自取'?null:{...state.checkoutAddress}, deliveryType:state.deliveryType, remark:$('#remarkInput')?.value.trim() || '', createTime:new Date().toLocaleString('zh-CN',{hour12:false}), createdAt:Date.now(), status:'待制作' };
      if (selected) { selected.used = true; write(KEYS.coupons, getCoupons().map(item => item.id === selected.id ? selected : item)); }
      persistOrder(order); state.cart = {}; write(KEYS.cart, {}); state.selectedCouponId = ''; transitionView('orders'); toast('支付成功（演示）');
    }
    else if (action === 'edit-profile') { state.sheet = 'profile'; renderOverlay(); }
    else if (action === 'save-profile') { const nickname = $('#nicknameInput')?.value.trim(); if (!nickname) { toast('昵称不能为空'); return; } saveProfile({ ...state.profile, nickname:nickname.slice(0,12) }); state.sheet=''; render(); toast('资料已保存'); }
    else if (action === 'remove-avatar') { state.profile.avatarImage=''; saveProfile(state.profile); renderOverlay(); }
    else if (action === 'clear-cart') { if (!confirmAction('确定清空购物车吗？')) return; state.cart={}; write(KEYS.cart,{}); state.sheet=''; render(); }
    else if (action === 'remove-good-image') { state.removeGoodImage=true; $('.existing-good-image',overlay)?.remove(); }
    else if (action === 'about') window.alert('茶语 · 东方茶饮\n本网页为本地演示版本，订单、资料和优惠券保存在当前浏览器，不会产生真实扣款。');
    else if (action === 'manage') transitionView('manage');
    else if (action === 'new-good') { state.sheet='good-form'; overlay.innerHTML=renderGoodForm(); }
    else if (action === 'save-good') await saveGoodFromForm();
    else if (action === 'back') { if (state.view === 'detail') transitionView('orders'); else if (state.view === 'addresses' && state.params.returnTo) transitionView(state.params.returnTo); else if (state.view === 'manage' || state.view === 'addresses' || state.view === 'coupons') transitionView('mine'); else transitionView('menu'); }
    else if (action === 'share') { const url=location.href; if(navigator.share){try{await navigator.share({title:'茶语 · 东方茶饮',text:'来茶语挑一杯喜欢的茶',url});}catch{}}else{try{await navigator.clipboard.writeText(url);toast('链接已复制，发给好友吧');}catch{toast('请复制浏览器地址栏链接分享');}} }
  }
  if (button.dataset.avatarMark) { state.profile={...state.profile,avatarMark:button.dataset.avatarMark,avatarImage:''}; saveProfile(state.profile); renderOverlay(); }
});

async function saveGoodFromForm() {
  const categoryId=$('#goodCategory')?.value; const category=getMenu().find(c=>c.id===categoryId); const fields=Object.fromEntries([...overlay.querySelectorAll('[data-good-field]')].map(input=>[input.dataset.goodField,input.value.trim()]));
  const price=Number(fields.price); if(!fields.name || !Number.isFinite(price) || price<=0){toast('请填写商品名和有效价格');return;}
  const categories=getMenu().map(c=>({...c,goods:[...c.goods]})); let old=null; categories.forEach(c=>{const index=c.goods.findIndex(g=>g.id===state.editingGoodId);if(index>=0)old=c.goods.splice(index,1)[0];}); const target=categories.find(c=>c.id===categoryId); if(!target)return;
  const file=$('#goodImageFile')?.files?.[0]; let image=state.removeGoodImage?'':old?.image||''; try{if(file) image=await imageToDataUrl(file);}catch{toast('图片读取失败');return;}
  target.goods.push({id:state.editingGoodId||`g${Date.now()}`,name:fields.name,price,desc:fields.desc,ingredients:fields.ingredients,taste:fields.taste,monthSale:Math.max(0,Number(fields.monthSale)||0),stock:Math.max(0,Math.floor(Number(fields.stock)||0)),available:old?.available!==false,image});
  write(KEYS.menu,categories);state.sheet='';renderManage();toast(state.editingGoodId?'商品已更新':'商品已添加');
}

document.addEventListener('input', event => {
  if(event.target.id==='searchInput'){const pos=event.target.selectionStart;state.query=event.target.value;renderMenu();const input=$('#searchInput');input?.focus();input?.setSelectionRange(pos,pos);}
  if(event.target.id==='remarkInput')state.remark=event.target.value;
});
document.addEventListener('change', async event => {
  if(event.target.dataset.statusOrder){updateOrderStatus(event.target.dataset.statusOrder,event.target.value);renderManage();toast('订单状态已更新');}
  if(event.target.id==='avatarFile'&&event.target.files?.[0]){try{state.profile.avatarImage=await imageToDataUrl(event.target.files[0]);saveProfile(state.profile);renderOverlay();}catch{toast('图片读取失败');}}
});
document.addEventListener('click', event => { if(event.target.matches('[data-overlay-close]')){state.sheet='';state.detailZoomed=false;renderOverlay();} });
document.addEventListener('scroll', event => {
  if(event.target.id!=='goodsScroll'||state.query)return;
  const sections=[...event.target.querySelectorAll('.goods-section')];const current=sections.find(section=>section.getBoundingClientRect().bottom>event.target.getBoundingClientRect().top+45);if(current){state.category=current.id.replace('category-','');document.querySelectorAll('.category-item').forEach(item=>item.classList.toggle('active',item.dataset.category===state.category));}
},{capture:true});
window.addEventListener('storage',()=>{state.cart=read(KEYS.cart,{});state.profile=read(KEYS.profile,state.profile);render();});
setInterval(()=>{if(state.view==='orders'||state.view==='detail'||(state.view==='manage'&&state.manageTab==='orders'))render();},3000);
render();
