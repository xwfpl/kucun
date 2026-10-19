/* ========== 数据层 ========== */
const DB = {
  KEY_P: 'inv_products', KEY_R: 'inv_records',
  getProducts() { return JSON.parse(localStorage.getItem(this.KEY_P) || '{}'); },
  saveProducts(p) { localStorage.setItem(this.KEY_P, JSON.stringify(p)); },
  getRecords() { return JSON.parse(localStorage.getItem(this.KEY_R) || '[]'); },
  saveRecords(r) { localStorage.setItem(this.KEY_R, JSON.stringify(r)); }
};

/* ========== 工具 ========== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fm = (n) => '¥' + (Number(n) || 0).toFixed(2);
const fn = (n) => (Number(n) || 0).toLocaleString();
const ft = (ts) => {
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtDate = (ts) => {
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
};
function todayStr() { return fmtDate(Date.now()); }

let toastTimer;
function toast(msg, type = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ========== Tab ========== */
$$('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    $$('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('#' + btn.dataset.tab).classList.add('active');
    refreshAll();
  });
});

/* ========== 入库单 批量行 ========== */
const SI_ROWS = $('#si-rows');
let siRowCount = 0;
function siAddRow() {
  siRowCount++;
  const row = document.createElement('div');
  row.className = 'batch-row';
  row.dataset.idx = siRowCount;
  row.innerHTML = `
    <div class="c-wrap" data-label="商品名称">
      <input class="c-name" autocomplete="off" placeholder="商品名称">
      <div class="suggest"></div>
    </div>
    <div class="f" data-label="数量"><input class="c-qty" type="number" min="1" step="1" placeholder="请输入"></div>
    <div class="f" data-label="单价"><input class="c-price" type="number" min="0" step="0.01" placeholder="请输入"></div>
    <div class="f" data-label="返利"><input class="c-rebate" type="number" step="0.01" placeholder="0"></div>
    <div class="f" data-label="金币"><input class="c-gift" type="number" step="0.01" placeholder="0"></div>
    <div class="f" data-label="入库人员 *">
      <div class="c-wrap">
        <input class="c-operator" autocomplete="off" placeholder="必填">
        <div class="suggest"></div>
      </div>
    </div>
    <div class="c-sub" data-label="小计">-</div>
    <button type="button" class="c-del" title="删除这一行">×</button>
  `;
  SI_ROWS.appendChild(row);
  row.querySelectorAll('input').forEach((i, idx) => {
    i.addEventListener('input', siRecalc);
    i.addEventListener('blur', () => maybeCollapseOnBlur(row, SI_ROWS));
  });
  row.querySelector('.c-del').addEventListener('click', () => {
    if (!confirm('确定删除这一行吗？')) return;
    if (SI_ROWS.children.length <= 1) { toast('至少保留一行', 'error'); return; }
    row.remove(); siRecalc();
  });
  bindSuggest(row, '.c-name');
  bindTextSuggestForRow(row, '.c-operator', 'in');
  refreshDatalist();
  return row;
}

// 给每行的入库人员/出库客户加历史候选
function bindTextSuggestForRow(row, sel, type) {
  const input = $(sel, row);
  const box = $('.suggest', row);
  if (!input || !box) return;
  const update = () => {
    const kw = input.value.trim().toLowerCase();
    const all = DB.getRecords();
    const map = new Map();
    for (const r of all) {
      const v = (type === 'in' ? (r.operator || '') : (r.operator || '')).trim();
      if (!v) continue;
      map.set(v, Math.max(map.get(v) || 0, r.time || 0));
    }
    const list = [...map.keys()].sort((a, b) => map.get(b) - map.get(a));
    const filtered = kw ? list.filter(x => x.toLowerCase().includes(kw)) : list;
    box.innerHTML = filtered.slice(0, 8).map((v, i) =>
      `<div class="suggest-item" data-v="${escapeHtml(v)}">${escapeHtml(v)}</div>`
    ).join('');
    box.classList.toggle('show', !!filtered.length);
    box.querySelectorAll('.suggest-item').forEach(item => {
      item.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        input.value = item.dataset.v;
        box.classList.remove('show');
      });
    });
  };
  input.addEventListener('focus', update);
  input.addEventListener('input', update);
  input.addEventListener('blur', () => setTimeout(() => box.classList.remove('show'), 150));
}
function siRecalc() {
  const rows = $$('.batch-row', SI_ROWS);
  let totQty = 0, totAmt = 0, totReb = 0, totGift = 0;
  rows.forEach(row => {
    const qty = +$('.c-qty', row).value || 0;
    const price = +$('.c-price', row).value || 0;
    const reb = +$('.c-rebate', row).value || 0;
    const gift = +$('.c-gift', row).value || 0;
    $('.c-sub', row).textContent = (qty && price) ? fm(qty * price) : '-';
    totQty += qty; totAmt += qty * price; totReb += reb; totGift += gift;
  });
  $('#si-sum-qty').textContent = totQty;
  $('#si-sum-amount').textContent = fm(totAmt);
  $('#si-sum-rebate').textContent = fm(totReb);
  $('#si-sum-gift').textContent = fm(totGift);
}

/* ========== 出库单 批量行 ========== */
const SO_ROWS = $('#so-rows');
function soAddRow() {
  const row = document.createElement('div');
  row.className = 'batch-row';
  row.innerHTML = `
    <div class="c-wrap" data-label="商品名称">
      <input class="c-name" autocomplete="off" placeholder="输入商品名">
      <div class="suggest"></div>
    </div>
    <div class="c-stock" data-label="库存">-</div>
    <div class="f" data-label="数量"><input class="c-qty" type="number" min="1" step="1" placeholder="请输入"></div>
    <div class="f" data-label="单价"><input class="c-price" type="number" min="0" step="0.01" placeholder="请输入"></div>
    <div class="c-sub" data-label="小计">-</div>
    <div class="c-profit" data-label="预估利润">-</div>
    <button type="button" class="c-del" title="删除这一行">×</button>
  `;
  SO_ROWS.appendChild(row);
  bindSuggest(row, '.c-name', true); // 出库只显示有库存的
  $('.c-name', row).addEventListener('input', () => soRecalcRow(row));
  $('.c-name', row).addEventListener('change', () => soRecalcRow(row));
  row.querySelectorAll('input').forEach(i => {
    i.addEventListener('input', () => soRecalcRow(row));
    i.addEventListener('blur', () => maybeCollapseOnBlur(row, SO_ROWS));
  });
  row.querySelector('.c-del').addEventListener('click', () => {
    if (!confirm('确定删除这一行吗？')) return;
    if (SO_ROWS.children.length <= 1) { toast('至少保留一行', 'error'); return; }
    row.remove(); soRecalc();
  });
  return row;
}
function soRecalcRow(row) {
  const all = Object.values(DB.getProducts());
  const name = $('.c-name', row).value.trim();
  const p = all.find(x => x.name === name);
  if (p) {
    $('.c-stock', row).textContent = p.qty;
    $('.c-stock', row).style.color = p.qty > 0 ? '#525252' : '#dc2626';
  } else {
    $('.c-stock', row).textContent = '-';
    $('.c-stock', row).style.color = '';
  }
  const qty = +$('.c-qty', row).value || 0;
  const price = +$('.c-price', row).value || 0;
  const hasVal = qty && price;
  if (hasVal) {
    $('.c-sub', row).textContent = fm(qty * price);
    let profit = 0;
    if (p) profit = (price - p.avgCost) * qty;
    $('.c-profit', row).textContent = fm(profit);
  } else {
    $('.c-sub', row).textContent = '-';
    $('.c-profit', row).textContent = '-';
  }
  soRecalc();
}
function soRecalc() {
  let totQty = 0, totAmt = 0, totProfit = 0;
  $$('.batch-row', SO_ROWS).forEach(row => {
    const name = $('.c-name', row).value.trim();
    const p = Object.values(DB.getProducts()).find(x => x.name === name);
    const qty = +$('.c-qty', row).value || 0;
    const price = +$('.c-price', row).value || 0;
    totQty += qty; totAmt += qty * price;
    let profit = 0;
    if (p) profit = (price - p.avgCost) * qty;
    totProfit += profit;
    $('.c-sub', row).textContent = fm(qty * price);
    $('.c-profit', row).textContent = fm(profit);
  });
  $('#so-sum-qty').textContent = totQty;
  $('#so-sum-amount').textContent = fm(totAmt);
  $('#so-sum-profit').textContent = fm(totProfit);
}

/* ========== 自定义候选框 ========== */
function bindSuggest(row, selName, onlyStock = false) {
  const input = $(selName, row);
  const box = $('.suggest', row);
  let highlight = -1;
  let filteredList = [];

  const updateList = () => {
    const kw = input.value.trim().toLowerCase();
    const all = Object.values(DB.getProducts());
    let list = onlyStock ? all.filter(p => p.qty > 0) : all;
    if (kw) list = list.filter(p => p.name.toLowerCase().includes(kw));
    filteredList = list.slice(0, 12);

    box.innerHTML = filteredList.map((p, i) =>
      `<div class="suggest-item${i === highlight ? ' on' : ''}" data-name="${escapeHtml(p.name)}">
        <span class="s-name">${escapeHtml(p.name)}</span>
        <span class="s-meta">存 ${p.qty} · ¥${p.avgCost.toFixed(2)}</span>
      </div>`
    ).join('');
    highlight = -1;
    if (!filteredList.length) box.classList.remove('show');
    else box.classList.add('show');

    box.querySelectorAll('.suggest-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = el.dataset.name;
        input.dispatchEvent(new Event('input'));
        box.classList.remove('show');
      });
      el.addEventListener('mouseenter', () => {
        highlight = [...box.querySelectorAll('.suggest-item')].indexOf(el);
        box.querySelectorAll('.suggest-item').forEach((x, i) => x.classList.toggle('on', i === highlight));
      });
    });
  };

  input.addEventListener('focus', updateList);
  input.addEventListener('input', updateList);
  input.addEventListener('blur', () => setTimeout(() => box.classList.remove('show'), 150));
  input.addEventListener('keydown', (e) => {
    const items = box.querySelectorAll('.suggest-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); highlight = (highlight + 1) % items.length;
      items.forEach((x, i) => x.classList.toggle('on', i === highlight));
      items[highlight].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); highlight = (highlight - 1 + items.length) % items.length;
      items.forEach((x, i) => x.classList.toggle('on', i === highlight));
      items[highlight].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && highlight >= 0) {
      input.value = items[highlight].dataset.name;
      box.classList.remove('show');
      input.dispatchEvent(new Event('input'));
      e.preventDefault();
    } else if (e.key === 'Escape') {
      box.classList.remove('show');
    }
  });
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function refreshDatalist() { /* 保留接口兼容 */ }

/* ========== 供应商/客户历史候选 ========== */
function bindTextSuggest(inputSel, extractor) {
  const input = $(inputSel);
  if (!input) return;
  const wrap = input.parentElement; // .c-wrap
  const box = wrap.querySelector('.suggest');
  let highlight = -1;

  const updateList = () => {
    const kw = input.value.trim().toLowerCase();
    const records = DB.getRecords();
    const map = new Map(); // value → 最近时间
    records.forEach(r => {
      const v = extractor(r);
      if (!v) return;
      if (!map.has(v) || map.get(v) < r.time) map.set(v, r.time);
    });
    let list = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);
    if (kw) list = list.filter(v => v.toLowerCase().includes(kw));
    list = list.slice(0, 12);

    box.innerHTML = list.map((v, i) =>
      `<div class="suggest-item${i === highlight ? ' on' : ''}" data-name="${escapeHtml(v)}">
        <span class="s-name">${escapeHtml(v)}</span>
      </div>`
    ).join('');
    highlight = -1;
    if (!list.length) box.classList.remove('show');
    else box.classList.add('show');

    box.querySelectorAll('.suggest-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = el.dataset.name;
        box.classList.remove('show');
        input.focus();
      });
      el.addEventListener('mouseenter', () => {
        highlight = [...box.querySelectorAll('.suggest-item')].indexOf(el);
        box.querySelectorAll('.suggest-item').forEach((x, i) => x.classList.toggle('on', i === highlight));
      });
    });
  };

  input.addEventListener('focus', updateList);
  input.addEventListener('input', updateList);
  input.addEventListener('blur', () => setTimeout(() => box.classList.remove('show'), 150));
  input.addEventListener('keydown', (e) => {
    const items = box.querySelectorAll('.suggest-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); highlight = (highlight + 1) % items.length;
      items.forEach((x, i) => x.classList.toggle('on', i === highlight));
      items[highlight].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); highlight = (highlight - 1 + items.length) % items.length;
      items.forEach((x, i) => x.classList.toggle('on', i === highlight));
      items[highlight].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && highlight >= 0) {
      input.value = items[highlight].dataset.name;
      box.classList.remove('show');
      e.preventDefault();
    } else if (e.key === 'Escape') {
      box.classList.remove('show');
    }
  });
}

/* ========== 禁止表单 Enter 原生提交（只在 batch-row 内跳格） ========== */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const target = e.target;
  if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
  const row = target.closest('.batch-row');
  if (!row) { e.preventDefault(); return; } // row 外一律拦住 Enter，不提交
  e.preventDefault();
  const inputs = [...row.querySelectorAll('input, select')].filter(el => !el.disabled);
  const idx = inputs.indexOf(target);
  if (idx >= 0 && idx < inputs.length - 1) {
    inputs[idx + 1].focus();
    if (inputs[idx + 1].select) inputs[idx + 1].select();
    return;
  }
  // 到一行最后一格 → 折叠当前行并跳到下一行第一格（如果有）
  tryCollapseRow(row);
  const nextRow = row.nextElementSibling;
  if (nextRow) {
    nextRow.classList.remove('collapsed'); // 新行展开
    const first = nextRow.querySelector('input, select');
    if (first) { first.focus(); if (first.select) first.select(); return; }
  }
  // 否则新增一行并聚焦
  const body = row.parentElement;
  const isIn = body === SI_ROWS;
  if (isIn) { siAddRow(); } else { soAddRow(); }
  const newRow = body.lastElementChild;
  const first = newRow.querySelector('input, select');
  if (first) first.focus();
});

// 折叠行：有商品名时才折叠；展开按钮点击恢复；支持反复折叠/展开
function tryCollapseRow(row) {
  if (row.classList.contains('collapsed')) return; // 已折叠跳过
  const name = $('.c-name', row).value.trim();
  if (!name) return; // 空行不折叠
  row.classList.remove('collapsed');
  row.querySelectorAll('.row-summary').forEach(s => s.remove());
  const qty = +$('.c-qty', row).value || 0;
  const summary = document.createElement('div');
  summary.className = 'row-summary';
  summary.innerHTML = `<span class="rs-name">${escapeHtml(name)}</span><span class="rs-qty">× ${qty}</span><span class="rs-expand">展开 ▾</span>`;
  summary.addEventListener('click', (ev) => {
    ev.stopPropagation();
    row.classList.remove('collapsed');
    summary.remove();
  });
  row.appendChild(summary);
  row.classList.add('collapsed');
}

// blur 时自动折叠 + 手机端软键盘"完成"后自动跳行
function maybeCollapseOnBlur(row, body) {
  setTimeout(() => {
    // 已经折叠或商品名为空，跳过
    if (row.classList.contains('collapsed')) return;
    if (!$('.c-name', row).value.trim()) return;
    // 当前焦点是否已在 batch-body 的某个 input 上？
    const fe = document.activeElement;
    const feInBody = fe && body.contains(fe) && (fe.tagName === 'INPUT' || fe.tagName === 'SELECT');
    if (feInBody) {
      // 用户自己跳到了 batch-body 内的另一个 field（比如 Enter 跳格、或点了其他 field）
      // 这种情况如果 fe 不在当前 row 里，就折叠当前 row
      if (!row.contains(fe)) {
        tryCollapseRow(row);
      }
      return;
    }
    // 焦点不在 batch-body 内（软键盘"完成"、或点了导航/空白区）
    // → 折叠 + 自动跳到下一行第一格（如果有），否则新建一行
    tryCollapseRow(row);
    const nextRow = row.nextElementSibling;
    let target = null;
    if (nextRow) {
      nextRow.classList.remove('collapsed');
      nextRow.querySelectorAll('.row-summary').forEach(s => s.remove());
      target = nextRow.querySelector('input, select');
    } else {
      // 新建一行
      if (body === SI_ROWS) { siAddRow(); } else { soAddRow(); }
      const newRow = body.lastElementChild;
      target = newRow.querySelector('input, select');
    }
    if (target) { target.focus(); if (target.select) target.select(); }
  }, 0);
}

/* ========== 初始化 ========== */
function initBatchForms() {
  $('#si-date').value = todayStr();
  $('#so-date').value = todayStr();
  siAddRow();
  soAddRow();

  // 供应商 / 客户历史候选
  bindTextSuggest('#supplier-input', (r) => r.supplier || '');
  bindTextSuggest('#customer-input',  (r) => r.customer  || '');

  $('#si-add-row').addEventListener('click', () => siAddRow());
  $('#so-add-row').addEventListener('click', () => soAddRow());
  $('#si-clear').addEventListener('click', () => {
    SI_ROWS.innerHTML = ''; siRowCount = 0; siAddRow();
    $('#si-date').value = todayStr();
    $('#si-sum-qty').textContent = '0';
    $('#si-sum-amount').textContent = fm(0);
    $('#si-sum-rebate').textContent = fm(0);
    $('#si-sum-gift').textContent = fm(0);
  });
  $('#so-clear').addEventListener('click', () => {
    SO_ROWS.innerHTML = ''; soAddRow();
    $('#so-date').value = todayStr();
  });
  $('#so-draft').addEventListener('click', saveSODraft);

  // 启动时自动恢复出库草稿
  renderDraftBar();
  setTimeout(() => {
    if (loadSODraft()) toast('已自动恢复上次的出库草稿', 'success');
  }, 100);

  // 入库：商品名自动回填最近的单价/返利/金币
  SI_ROWS.addEventListener('change', (e) => {
    const name = e.target.closest('.c-name');
    if (!name) return;
    const row = name.closest('.batch-row');
    const n = name.value.trim();
    if (!n) return;
    const records = DB.getRecords().filter(r => r.type === 'in' && r.name === n);
    if (!records.length) return;
    const last = records[0];
    $('.c-price', row).value = last.price || 0;
    $('.c-rebate', row).value = last.rebate || 0;
    $('.c-gift', row).value = last.giftAmount || 0;
    siRecalc();
  });
}

/* ========== 入库提交 ========== */
$('#stockin-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const date = $('#si-date').value || todayStr();
  const supplier = $('#stockin-form').supplier.value.trim();
  const remark = ($('#stockin-form').remark?.value || '').trim();

  const rows = $$('.batch-row', SI_ROWS);
  const products = DB.getProducts();
  const records = DB.getRecords();
  let ok = 0, fail = 0;

  for (const row of rows) {
    const name = $('.c-name', row).value.trim();
    const qty = +$('.c-qty', row).value || 0;
    const price = +$('.c-price', row).value || 0;
    const rebate = +$('.c-rebate', row).value || 0;
    const gift = +$('.c-gift', row).value || 0;
    const operator = ($('.c-operator', row)?.value || '').trim();
    if (!name || qty <= 0) { fail++; continue; }
    if (!operator) { toast('请填写每行的入库人员', 'error'); fail++; continue; }

    const totalCost = price * qty - rebate - gift;
    const avgCost = qty > 0 ? totalCost / qty : 0;

    let product = Object.values(products).find(p => p.name === name);
    if (!product) {
      product = {
        id: uid(), name, unit: '',
        qty, avgCost, totalIn: qty, totalOut: 0,
        totalRebate: rebate, totalGiftAmount: gift,
        totalInAmount: price * qty, createdAt: Date.now()
      };
      products[product.id] = product;
    } else {
      const newQty = product.qty + qty;
      product.avgCost = (product.avgCost * product.qty + totalCost) / newQty;
      product.qty = newQty;
      product.totalIn += qty;
      product.totalRebate += rebate;
      product.totalGiftAmount += gift;
      product.totalInAmount += price * qty;
    }
    records.unshift({
      id: uid(), type: 'in', time: Date.now(), date,
      productId: product.id, name: product.name, unit: product.unit,
      qty, giftAmount: gift, price, rebate,
      amount: price * qty, actualCost: totalCost,
      supplier, operator, remark
    });
    ok++;
  }

  // 合并：同一天同商品同价格 → 数量/返利/金币累加
  const merged = [];
  for (const r of records) {
    if (r.type === 'in') {
      const last = merged[merged.length - 1];
      if (last && last.type === 'in' && last.date === r.date
          && last.productId === r.productId && last.price === r.price
          && (last.operator || '') === (r.operator || '')) {
        last.qty += r.qty;
        last.rebate += r.rebate;
        last.giftAmount += (r.giftAmount || 0);
        last.amount += r.amount;
        last.actualCost += r.actualCost;
        last.time = r.time; // 用最新时间
        continue;
      }
    }
    merged.push(r);
  }

  DB.saveProducts(products);
  DB.saveRecords(merged);
  toast(`入库 ${ok} 种商品${fail ? `（${fail} 行已跳过）` : ''}`, 'success');

  // 已填行保留商品名，清空数量/单价/返利/金币/人员；再加一行新空白
  const filledRows = $$('.batch-row', SI_ROWS).filter(r => $('.c-name', r).value.trim());
  SI_ROWS.innerHTML = ''; siRowCount = 0;
  filledRows.forEach(r => {
    const row = siAddRow();
    $('.c-name', row).value = $('.c-name', r).value.trim();
    $('.c-qty', row).value = '';
    $('.c-price', row).value = '';
    $('.c-rebate', row).value = '';
    $('.c-gift', row).value = '';
    if ($('.c-operator', row)) $('.c-operator', row).value = '';
    // 触发候选历史回填单价等（如果有）
    const evt = new Event('input');
    $('.c-name', row).dispatchEvent(evt);
  });
  siAddRow(); // 再加一行空的
  $('#si-date').value = todayStr();
  siRecalc();
  refreshAll();
});

/* ========== 出库草稿 ========== */
const DRAFT_KEY = 'inv_so_draft';
function saveSODraft() {
  const form = $('#stockout-form');
  const rows = $$('.batch-row', SO_ROWS).map(r => ({
    name: $('.c-name', r).value,
    qty: $('.c-qty', r).value,
    price: $('.c-price', r).value
  }));
  const data = {
    date: $('#so-date').value,
    customer: form.customer.value,
    remark: form.remark?.value || '',
    rows, savedAt: Date.now()
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  toast('草稿已保存', 'success');
  renderDraftBar();
}
function loadSODraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (!d || !d.rows || !d.rows.length) return false;
    $('#so-date').value = d.date || todayStr();
    $('#stockout-form').customer.value = d.customer || '';
    $('#stockout-form').remark && ($('#stockout-form').remark.value = d.remark || '');
    SO_ROWS.innerHTML = '';
    d.rows.forEach(r => {
      const row = soAddRow();
      $('.c-name', row).value = r.name || '';
      $('.c-qty', row).value = r.qty || 1;
      $('.c-price', row).value = r.price || 0;
      soRecalcRow(row);
    });
    return true;
  } catch { return false; }
}
function clearSODraft() {
  localStorage.removeItem(DRAFT_KEY);
  renderDraftBar();
}
function renderDraftBar() {
  const bar = $('#so-draft-bar');
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  try {
    const d = JSON.parse(raw);
    const saved = ft(d.savedAt).slice(5);
    const n = (d.rows || []).length;
    bar.classList.remove('hidden');
    bar.innerHTML = `📋 存在草稿：${n} 行 · 保存于 ${saved}
      <button class="link-btn" id="so-draft-load">恢复</button>
      <button class="link-btn" id="so-draft-del">删除草稿</button>`;
    $('#so-draft-load').onclick = () => { loadSODraft(); toast('草稿已恢复', 'success'); };
    $('#so-draft-del').onclick = () => { clearSODraft(); toast('草稿已删除', 'success'); };
  } catch { bar.classList.add('hidden'); bar.innerHTML = ''; }
}

/* ========== 出库提交 ========== */
$('#stockout-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const date = $('#so-date').value || todayStr();
  const customer = $('#stockout-form').customer.value.trim();
  const remark = ($('#stockout-form').remark?.value || '').trim();

  const rows = $$('.batch-row', SO_ROWS);
  const products = DB.getProducts();
  const records = DB.getRecords();
  let ok = 0, fail = 0, shortages = [];

  for (const row of rows) {
    const name = $('.c-name', row).value.trim();
    const qty = +$('.c-qty', row).value || 0;
    const price = +$('.c-price', row).value || 0;
    if (!name || qty <= 0) { fail++; continue; }
    const p = Object.values(products).find(x => x.name === name);
    if (!p) { fail++; continue; }
    if (p.qty < qty) { shortages.push(`${p.name}(剩${p.qty})`); fail++; continue; }

    p.qty -= qty;
    p.totalOut += qty;
    records.unshift({
      id: uid(), type: 'out', time: Date.now(), date,
      productId: p.id, name: p.name, unit: p.unit,
      qty, price, costAtOut: p.avgCost,
      amount: price * qty,
      profit: (price - p.avgCost) * qty,
      customer, remark
    });
    ok++;
  }

  if (shortages.length) {
    toast(`库存不足：${shortages.join('、')}`, 'error');
  }

  DB.saveProducts(products);
  DB.saveRecords(records);
  toast(`出库 ${ok} 种商品${fail ? `（${fail} 行已跳过）` : ''}`, 'success');

  SO_ROWS.innerHTML = ''; soAddRow();
  $('#so-date').value = todayStr();
  $('#stockout-form').customer.value = '';
  $('#stockout-form').remark && ($('#stockout-form').remark.value = '');
  clearSODraft();
  refreshAll();
});

/* ========== 渲染 ========== */
function refreshAll() {
  renderDashboard();
  renderInventory();
  renderRecords();
  renderGift();
  refreshDatalist();
  siRecalc(); soRecalc();
}

/* —— 月份切换（纯自然月） —— */
const DASH_MONTH = 'inv_dash_month';
let dashYM = '';        // 'YYYY-MM'

function ymOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function initDashMonth() {
  const saved = localStorage.getItem(DASH_MONTH);
  dashYM = saved && saved !== 'all' ? saved : ymOf(Date.now());
  localStorage.setItem(DASH_MONTH, dashYM);
  $('#m-picker').value = dashYM;
}
function setDashMonth(ym) {
  dashYM = ym; localStorage.setItem(DASH_MONTH, ym);
  $('#m-picker').value = ym;
  renderDashboard();
}
function shiftMonth(delta) {
  const [y, m] = dashYM.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  setDashMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
}

function renderDashboard() {
  const products = Object.values(DB.getProducts());
  const allRecords = DB.getRecords();
  const records = allRecords.filter(r => ymOf(r.time) === dashYM);

  // 月度经营
  const inRs = records.filter(r => r.type === 'in');
  const outRs = records.filter(r => r.type === 'out');
  $('#d-in-amount').textContent = fm(inRs.reduce((s, r) => s + (r.amount || 0), 0));
  $('#d-rebate').textContent = fm(inRs.reduce((s, r) => s + (r.rebate || 0), 0));
  $('#d-gift').textContent = fm(inRs.reduce((s, r) => s + (r.giftAmount || 0), 0));
  $('#d-profit').textContent = fm(outRs.reduce((s, r) => s + (r.profit || 0), 0));
  $('#dash-empty').classList.toggle('hidden', records.length > 0);

  // 实时库存
  $('#d-types').textContent = products.length;
  $('#d-total-qty').textContent = fn(products.reduce((s, p) => s + p.qty, 0));
  $('#d-total-value').textContent = fm(products.reduce((s, p) => s + p.qty * p.avgCost, 0));
}

function renderInventory() {
  const products = Object.values(DB.getProducts());
  const records = DB.getRecords();
  const kw = $('#inv-search').value.trim().toLowerCase();
  const list = kw ? products.filter(p => p.name.toLowerCase().includes(kw)) : products;
  const host = $('#inv-list');
  $('#inv-empty').classList.toggle('hidden', list.length > 0);
  host.innerHTML = list.map(p => {
    const allOps = [...new Set(records
      .filter(r => r.type === 'in' && r.productId === p.id && r.operator)
      .map(r => r.operator))];
    const opHtml = allOps.length ? allOps.map(o => `<span class="op-tag">${escapeHtml(o)}</span>`).join(' ') : '-';
    return `<div class="inv-card">
      <div class="inv-card-head">
        <span class="inv-name">${escapeHtml(p.name)}</span>
        <button class="link-btn inv-del" data-del="${p.id}">删除</button>
      </div>
      <div class="inv-card-body">
        <div class="inv-field">
          <div class="inv-f-label">库存</div>
          <div class="inv-f-value inv-qty">${p.qty}</div>
        </div>
        <div class="inv-field inv-field-wide">
          <div class="inv-f-label">全部入库人员</div>
          <div class="inv-f-value inv-op">${opHtml}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = () => {
      if (!confirm('确定删除？历史记录保留。')) return;
      const ps = DB.getProducts(); delete ps[btn.dataset.del]; DB.saveProducts(ps);
      toast('已删除', 'success'); refreshAll();
    };
  });
}

let recFilter = { type: 'all', kw: '' };
function renderRecords() {
  let list = DB.getRecords();
  if (recFilter.type !== 'all') list = list.filter(r => r.type === recFilter.type);
  if (recFilter.kw) {
    const kw = recFilter.kw.toLowerCase();
    list = list.filter(r =>
      (r.name || '').toLowerCase().includes(kw) ||
      (r.supplier || '').toLowerCase().includes(kw) ||
      (r.customer || '').toLowerCase().includes(kw) ||
      (r.remark || '').toLowerCase().includes(kw)
    );
  }
  $('#rec-table tbody').innerHTML = list.length ? list.map(r => {
    const extras = r.type === 'in'
      ? `返利 ${fm(r.rebate || 0)} / 金币 ${fm(r.giftAmount || 0)}`
      : `利润 ${fm(r.profit || 0)}`;
    return `<tr>
      <td data-label="日期">${r.date || fmtDate(r.time)}</td>
      <td data-label="时间">${ft(r.time).slice(11)}</td>
      <td data-label="类型"><span class="tag ${r.type === 'in' ? 'tag-in' : 'tag-out'}">${r.type === 'in' ? '入库' : '出库'}</span></td>
      <td data-label="商品">${r.name}</td>
      <td data-label="数量">${r.qty}${r.unit ? ' ' + r.unit : ''}</td>
      <td data-label="单价">${fm(r.price)}</td>
      <td data-label="金额"><b>${fm(r.amount)}</b></td>
      <td data-label="备注">${extras}</td>
      <td data-label="附加">${[r.supplier, r.customer, r.operator, r.remark].filter(Boolean).join(' · ') || '-'}</td>
    </tr>`;
  }).join('') : '<tr><td data-label="提示" colspan="9" style="text-align:center;color:#999;padding:24px">暂无记录</td></tr>';
}

/* ========== 金币统计 ========== */
let giftFilter = { kw: '' };
function renderGift() {
  const kw = giftFilter.kw.toLowerCase();
  const records = DB.getRecords();
  // 只取入库记录，按 operator 分组，正负数都算
  const groups = {};
  let grandTotal = 0;
  for (const r of records) {
    if (r.type !== 'in') continue;
    const op = (r.operator || '').trim() || '(未填写)';
    if (kw && !op.toLowerCase().includes(kw)) continue;
    const gift = +(r.giftAmount || 0);
    if (gift === 0) continue;
    if (!groups[op]) groups[op] = { operator: op, total: 0, items: [] };
    groups[op].total += gift;
    groups[op].items.push(r);
    grandTotal += gift;
  }
  const list = Object.values(groups).sort((a, b) => b.total - a.total);
  $('#gift-grand-total').textContent = fm(grandTotal);
  $('#gift-empty').classList.toggle('hidden', list.length > 0);
  $('#gift-groups').innerHTML = list.map(g => {
    g.items.sort((a, b) => (b.time || 0) - (a.time || 0));
    return `<div class="gift-group">
      <div class="gift-group-head${g.total < 0 ? ' neg' : ''}">
        <div class="gg-left">
          <span class="gg-avatar">${escapeHtml(g.operator.slice(0, 1))}</span>
          <span class="gg-name">${escapeHtml(g.operator)}</span>
        </div>
        <div class="gg-right">
          <span class="gg-count">${g.items.length} 笔</span>
          <span class="gg-total${g.total < 0 ? ' neg' : ''}">${fm(g.total)}</span>
          <button class="gg-toggle" data-op="${escapeHtml(g.operator)}">▾</button>
        </div>
      </div>
      <div class="gift-group-body hidden" data-op="${escapeHtml(g.operator)}">
        <table>
          <thead><tr><th>日期</th><th>商品</th><th>数量</th><th>单价</th><th>返利</th><th>金币</th><th>供应商</th></tr></thead>
          <tbody>${g.items.map(r => {
            const gv = +(r.giftAmount || 0);
            return `<tr>
              <td data-label="日期">${r.date || fmtDate(r.time)}</td>
              <td data-label="商品">${r.name}</td>
              <td data-label="数量">${r.qty}</td>
              <td data-label="单价">${fm(r.price)}</td>
              <td data-label="返利">${fm(r.rebate || 0)}</td>
              <td data-label="金币"><b class="gg-coin${gv < 0 ? ' neg' : ''}">${gv < 0 ? fm(gv) : '+' + fm(gv)}</b></td>
              <td data-label="供应商">${r.supplier || '-'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
  // 展开折叠
  $$('.gg-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const op = btn.dataset.op;
      const body = $(`.gift-group-body[data-op="${op}"]`);
      const hidden = body.classList.toggle('hidden');
      btn.textContent = hidden ? '▾' : '▴';
    });
  });
}

/* ========== 搜索/过滤 ========== */
$('#inv-search').addEventListener('input', renderInventory);
$('#rec-type').addEventListener('change', (e) => { recFilter.type = e.target.value; renderRecords(); });
$('#rec-search').addEventListener('input', (e) => { recFilter.kw = e.target.value.trim(); renderRecords(); });
$('#gift-search').addEventListener('input', (e) => { giftFilter.kw = e.target.value.trim(); renderGift(); });

/* ========== 导入导出 ========== */
$('#export-btn').addEventListener('click', () => {
  const data = { products: DB.getProducts(), records: DB.getRecords(), exportedAt: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inventory_backup_${ft(Date.now()).replace(/[: ]/g, '-')}.json`;
  a.click(); toast('导出成功', 'success');
});
$('#import-btn').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('导入将覆盖当前数据，确定？')) return;
      if (data.products) DB.saveProducts(data.products);
      if (data.records) DB.saveRecords(data.records);
      toast('导入成功', 'success'); refreshAll();
    } catch { toast('文件格式错误', 'error'); }
  };
  reader.readAsText(f); e.target.value = '';
});
$('#clear-all').addEventListener('click', () => {
  if (!confirm('⚠️ 确定清空所有数据？不可恢复！')) return;
  localStorage.removeItem(DB.KEY_P); localStorage.removeItem(DB.KEY_R);
  toast('已清空', 'success'); refreshAll();
});

/* ========== 总览：月份切换器 ========== */
$('#m-picker').addEventListener('change', (e) => setDashMonth(e.target.value));
$('#m-prev').addEventListener('click', () => shiftMonth(-1));
$('#m-next').addEventListener('click', () => shiftMonth(+1));

initBatchForms();
initDashMonth();
refreshAll();
