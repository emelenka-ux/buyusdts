/* ===========================================================
   MERIDIAN — interactions
   =========================================================== */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =========================================================
     TELEGRAM — заявки приходят в чат
     ВАЖНО: на статичном сайте токен виден в коде. Для боевого
     режима лучше прокинуть через мини-серверлесс (см. ответ).
     Заполните оба поля, чтобы включить реальную отправку:
     ========================================================= */
  const TG = {
    token: '',     // напр. '7654321:AAH...'
    chatId: '',    // напр. '123456789' (ваш chat id или id канала)
  };

  /* ---- hero particle network (transaction web) ---- */
  const canvas = document.getElementById('net');
  if (canvas && !reduce) {
    const ctx = canvas.getContext('2d');
    let w, h, dpr, nodes = [];
    const mouse = { x: -9999, y: -9999 };
    const COUNT = () => Math.min(72, Math.floor((w * h) / 16000));

    const seed = (i) => Math.abs((Math.sin(i * 127.1 + 3.7) * 43758.5453) % 1);

    const init = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = COUNT();
      nodes = [];
      for (let i = 0; i < n; i++) {
        nodes.push({
          x: seed(i) * w,
          y: seed(i + 99) * h,
          vx: (seed(i + 7) - 0.5) * 0.35,
          vy: (seed(i + 31) - 0.5) * 0.35,
          gold: seed(i + 50) > 0.72,
          r: 1.2 + seed(i + 12) * 1.8,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // connections
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 132) {
            const o = (1 - dist / 132) * 0.5;
            ctx.strokeStyle = `rgba(19,184,132,${o})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      // nodes
      for (const a of nodes) {
        // cursor interaction
        const mdx = a.x - mouse.x, mdy = a.y - mouse.y;
        const md = Math.hypot(mdx, mdy);
        if (md < 150) {
          const f = (1 - md / 150) * 1.6;
          a.x += (mdx / (md || 1)) * f;
          a.y += (mdy / (md || 1)) * f;
          ctx.strokeStyle = `rgba(233,200,120,${(1 - md / 150) * 0.5})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = a.gold ? 'rgba(233,200,120,.9)' : 'rgba(47,230,168,.85)';
        ctx.shadowColor = a.gold ? 'rgba(233,200,120,.6)' : 'rgba(47,230,168,.6)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };

    let raf;
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };

    init(); draw();
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); init(); draw(); });
    window.addEventListener('mousemove', onMove);
    canvas.parentElement.addEventListener('mouseleave', onLeave);
    // pause when offscreen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (e.isIntersecting) { if (!raf) draw(); }
          else { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0 }).observe(canvas);
    }
  }

  /* ---- split headline into words ---- */
  const splitTitle = document.querySelector('[data-split]');
  if (splitTitle) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (part.trim() === '') { frag.appendChild(document.createTextNode(part)); return; }
            const word = document.createElement('span');
            word.className = 'word';
            const inner = document.createElement('span');
            inner.textContent = part;
            word.appendChild(inner);
            frag.appendChild(word);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && !child.classList.contains('word')) {
          // wrap element (e.g. .ital) content as a single word
          const word = document.createElement('span');
          word.className = 'word';
          const inner = document.createElement('span');
          child.parentNode.insertBefore(word, child);
          inner.appendChild(child);
          word.appendChild(inner);
        }
      });
    };
    walk(splitTitle);
    // stagger
    splitTitle.querySelectorAll('.word>span').forEach((s, i) => { s.style.transitionDelay = 200 + i * 65 + 'ms'; });
    setTimeout(() => splitTitle.classList.add('shown'), 700);
  }

  /* ---- theme ---- */
  const root = document.documentElement;
  const saved = localStorage.getItem('mrd-theme');
  if (saved === 'light') root.setAttribute('data-theme', 'light');
  const themeBtn = document.getElementById('themeToggle');
  themeBtn && themeBtn.addEventListener('click', () => {
    const light = root.getAttribute('data-theme') === 'light';
    if (light) { root.removeAttribute('data-theme'); localStorage.setItem('mrd-theme', 'dark'); }
    else { root.setAttribute('data-theme', 'light'); localStorage.setItem('mrd-theme', 'light'); }
  });

  /* ---- scroll progress ---- */
  const prog = document.getElementById('scrollProgress');
  const updateProg = () => {
    if (!prog) return;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  };
  updateProg();
  window.addEventListener('scroll', updateProg, { passive: true });

  /* ---- preloader ---- */
  window.addEventListener('load', () => {
    const pre = document.getElementById('preloader');
    setTimeout(() => pre && pre.classList.add('done'), 650);
  });

  /* ---- nav shrink on scroll ---- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- starfield ---- */
  const stars = document.getElementById('stars');
  if (stars && !reduce) {
    const n = 46;
    let html = '';
    for (let i = 0; i < n; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 12345.678) % 1;
      const left = Math.abs(x) * 100;
      const top = Math.abs(y) * 62;
      const delay = (i % 7) * 0.4;
      const size = 1 + (i % 3) * 0.6;
      html += `<i style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;animation-delay:${delay}s"></i>`;
    }
    stars.innerHTML = html;
  }

  /* ---- reveal on scroll ---- */
  const revs = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          const el = e.target;
          const sibs = [...el.parentElement.querySelectorAll('.reveal')];
          const idx = sibs.indexOf(el);
          el.style.transitionDelay = Math.min(idx, 5) * 80 + 'ms';
          el.classList.add('in');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    revs.forEach((r) => io.observe(r));
  } else {
    revs.forEach((r) => r.classList.add('in'));
  }

  /* ---- count-up stats ---- */
  const counters = document.querySelectorAll('[data-count]');
  const runCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (target === 1) { el.textContent = '1' + suffix; return; }      // "1–3"
    const dur = 1500;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  }

  /* ---- steps progress fill ---- */
  const stepsProgress = document.getElementById('stepsProgress');
  if (stepsProgress && 'IntersectionObserver' in window) {
    const sio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { stepsProgress.style.width = '100%'; sio.disconnect(); }
      });
    }, { threshold: 0.4 });
    sio.observe(stepsProgress.parentElement);
  }

  /* ---- cursor glow + parallax (desktop only) ---- */
  const glow = document.querySelector('.cursor-glow');
  const skylines = document.querySelectorAll('.skyline[data-depth]');
  const scene = document.getElementById('scene');
  let mx = 0, my = 0, gx = 0, gy = 0;
  if (window.matchMedia('(hover:hover)').matches && !reduce) {
    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (scene) {
        const r = scene.getBoundingClientRect();
        const rx = (e.clientX - r.left - r.width / 2) / r.width;
        const ry = (e.clientY - r.top - r.height / 2) / r.height;
        if (rx > -0.6 && rx < 0.6) {
          skylines.forEach((s) => {
            const d = parseFloat(s.dataset.depth) * 60;
            s.style.transform = `translateX(${rx * d}px) translateY(${ry * d * 0.4}px)`;
          });
        }
      }
    });
    const raf = () => {
      gx += (mx - gx) * 0.12; gy += (my - gy) * 0.12;
      if (glow) glow.style.transform = `translate(${gx}px,${gy}px) translate(-50%,-50%)`;
      requestAnimationFrame(raf);
    };
    raf();
  }

  /* ---- magnetic buttons ---- */
  if (window.matchMedia('(hover:hover)').matches && !reduce) {
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.25}px,${y * 0.35}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---- card tilt ---- */
  if (window.matchMedia('(hover:hover)').matches && !reduce) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ---- calculator (реальный стакан USDT/RUB) ---- */
  // Снимок стакана. Чтобы курс стал live — впишите URL, отдающий такой же JSON:
  const RATES_ENDPOINT = '';
  const USDT_CNY = 7.20;   // ориентир USDT→CNY (вне стакана RUB)
  const EUR_USD  = 1.08;   // ориентир для EUR
  const FEE = 0.005;       // сервисная маржа

  // highestPrice — лучшая котировка стороны (как в JSON стакана). Именно её показываем как курс.
  let BOOK = {
    ask: { // продают USDT — клиент ПОКУПАЕТ; highestPrice = лучшая цена покупки
      highestPrice: 78.98,
      items: [
        [78.98,0.5],[79.00,121.226165],[79.01,0.5],[79.04,7.66],[79.07,9463.10462119],
        [79.08,16860.23182236],[79.09,29345.12],[79.10,10355.92927554],[79.11,13431.72],
        [79.12,6006.57],[79.14,4757.77],[79.17,6000],[79.18,7648.91],[79.19,10],[79.20,5018.61],
        [79.22,1262.2974981],[79.23,8000],[79.25,18.61],[79.26,10000],[79.29,4926.43],
        [79.30,6425.37],[79.33,5531.33],[79.39,8066.03],[79.44,13034.28],
      ],
    },
    bid: { // покупают USDT — клиент ПРОДАЁТ; highestPrice = лучшая цена продажи
      highestPrice: 78.97,
      items: [
        [78.97,166199.38676204],[78.95,108300.75758511],[78.92,198065.88950836],[78.88,63405.26039553],
        [78.87,6000],[78.85,298315.45542234],[78.81,628.15581778],[78.80,11430.98314719],[78.78,7986],
        [78.77,13.6],[78.72,13.61],[78.70,160],[78.68,1906.45653279],[78.67,20013.62],[78.66,12598.01004322],
        [78.61,3485.1881987],[78.60,29345.33651398],[78.58,13.63],[78.55,8035.58752387],[78.53,13.64],
        [78.50,5000],[78.48,2540.46228338],[78.46,24073.3858016],[78.45,133994.87788399],
      ],
    },
  };

  const SYM = { RUB: '₽', USD: '$', EUR: '€', CNY: '¥', USDT: '₮' };
  const DP  = { RUB: 0, USD: 2, EUR: 2, CNY: 0, USDT: 2 };
  const amountEl = document.getElementById('calcAmount');
  const resultEl = document.getElementById('calcResult');
  const rateEl = document.getElementById('calcRate');
  const fromBox = document.getElementById('fromCur');
  const toBox = document.getElementById('toCur');
  const swap = document.getElementById('calcSwap');

  const bestAsk = () => BOOK.ask.highestPrice;   // курс покупки USDT (из highestPrice)
  const bestBid = () => BOOK.bid.highestPrice;   // курс продажи USDT (из highestPrice)
  const fmt = (n) => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  const fmtCur = (n, c) => n.toLocaleString('ru-RU', { minimumFractionDigits: DP[c], maximumFractionDigits: DP[c] });
  const fmt2 = (n) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseAmt = (s) => parseFloat(String(s).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

  // объёмная средняя по глубине стакана — показываем ПАРАЛЛЕЛЬНО для крупных сумм
  const vwapBuy = (rub) => {
    let rem = rub, usdt = 0, cost = 0, last = bestAsk();
    for (const [p, a] of BOOK.ask.items) { last = p; const lr = p * a;
      if (rem >= lr) { usdt += a; cost += lr; rem -= lr; }
      else { usdt += rem / p; cost += rem; rem = 0; break; } }
    if (rem > 0) { usdt += rem / last; cost += rem; }
    return usdt ? cost / usdt : bestAsk();
  };
  const vwapSell = (u) => {
    let rem = u, rub = 0, last = bestBid();
    for (const [p, a] of BOOK.bid.items) { last = p;
      if (rem >= a) { rub += p * a; rem -= a; }
      else { rub += p * rem; rem = 0; break; } }
    if (rem > 0) { rub += last * rem; }
    return u ? rub / u : bestBid();
  };
  // кросс для валют вне стакана, привязка к mid USDT/RUB
  const crossRate = (from, to) => {
    const mid = (bestAsk() + bestBid()) / 2;
    const perRub = { RUB: 1, USDT: 1 / mid, USD: 1 / mid, CNY: USDT_CNY / mid, EUR: 1 / (mid * EUR_USD) };
    return perRub[from] / perRub[to];
  };

  const calc = () => {
    if (!amountEl) return;
    const from = fromBox.dataset.cur, to = toBox.dataset.cur;
    const amt = parseAmt(amountEl.value);
    if (!amt) { resultEl.textContent = '—'; rateEl.textContent = '—'; return; }
    if (from === to) { resultEl.textContent = fmtCur(amt, to) + ' ' + SYM[to]; rateEl.textContent = '1 : 1'; return; }
    if (from === 'RUB' && to === 'USDT') {                 // покупка USDT по highestPrice
      const rate = bestAsk(), out = amt / rate * (1 - FEE), vwap = vwapBuy(amt);
      resultEl.textContent = fmtCur(out, 'USDT') + ' ' + SYM.USDT;
      rateEl.textContent = '1 USDT = ' + fmt2(rate) + ' ₽'
        + (vwap > rate * 1.003 ? ' · средняя ' + fmt2(vwap) : '');
      return;
    }
    if (from === 'USDT' && to === 'RUB') {                 // продажа USDT по highestPrice
      const rate = bestBid(), out = amt * rate * (1 - FEE), vwap = vwapSell(amt);
      resultEl.textContent = fmtCur(out, 'RUB') + ' ' + SYM.RUB;
      rateEl.textContent = '1 USDT = ' + fmt2(rate) + ' ₽'
        + (vwap < rate * 0.997 ? ' · средняя ' + fmt2(vwap) : '');
      return;
    }
    const cross = crossRate(from, to), out = amt * cross * (1 - FEE);
    resultEl.textContent = fmtCur(out, to) + ' ' + SYM[to];
    rateEl.textContent = '1 ' + from + ' = ' + cross.toLocaleString('ru-RU', { maximumFractionDigits: 4 }) + ' ' + to;
  };

  const setActive = (box, v) => {
    box.dataset.cur = v;
    box.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  };
  [fromBox, toBox].forEach((box) => {
    box && box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      setActive(box, b.dataset.v); calc();
    });
  });
  if (amountEl) {
    amountEl.addEventListener('input', () => {
      const caretEnd = amountEl.selectionStart === amountEl.value.length;
      const n = parseAmt(amountEl.value);
      amountEl.value = n ? fmt(n) : '';
      if (caretEnd) amountEl.selectionStart = amountEl.selectionEnd = amountEl.value.length;
      calc();
    });
  }
  if (swap) {
    swap.addEventListener('click', () => {
      const a = fromBox.dataset.cur, b = toBox.dataset.cur;
      // переносим валюты, если они есть в обоих списках
      const fromHas = [...fromBox.querySelectorAll('button')].some((x) => x.dataset.v === b);
      const toHas = [...toBox.querySelectorAll('button')].some((x) => x.dataset.v === a);
      if (fromHas && toHas) { setActive(fromBox, b); setActive(toBox, a); calc(); }
    });
  }
  calc();

  /* ---- rate board (из стакана USDT/RUB) ---- */
  const rateList = document.getElementById('rateList');
  const renderBoard = () => {
    if (!rateList) return;
    const ask = bestAsk(), bid = bestBid(), spread = ask - bid;
    const rows = [
      { p: 'Купить USDT', v: ask, dp: 2, tag: 'ask', t: 'up' },
      { p: 'Продать USDT', v: bid, dp: 2, tag: 'bid', t: 'down' },
      { p: 'Спред', v: spread, dp: 2, tag: 'тонкий', t: 'up' },
      { p: 'USDT / CNY', v: USDT_CNY, dp: 2, tag: '≈', t: 'up' },
    ];
    rateList.innerHTML = rows.map((r) => `<li>
        <span class="rateboard__pair">${r.p}</span>
        <span class="rateboard__val">
          <span class="rateboard__num">${r.v.toLocaleString('ru-RU',{minimumFractionDigits:r.dp,maximumFractionDigits:r.dp})}</span>
          <span class="rateboard__delta ${r.t}">${r.tag}</span>
        </span></li>`).join('');
  };
  renderBoard();

  // live: если задан RATES_ENDPOINT, тянем свежий стакан и обновляем всё
  const applyBook = (json) => {
    if (!json || !json.ask || !json.bid) return;
    const side = (s) => {
      const items = (s.items || s).map((x) => Array.isArray(x) ? [+x[0], +x[1]] : [+x.price, +x.amount]);
      const hp = s.highestPrice != null ? +s.highestPrice : (items[0] ? items[0][0] : 0);
      return { highestPrice: hp, items };
    };
    BOOK = { ask: side(json.ask), bid: side(json.bid) };
    renderBoard(); calc();
    rateList && rateList.querySelectorAll('.rateboard__num').forEach((n) => {
      n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash');
    });
  };
  if (RATES_ENDPOINT) {
    const poll = () => fetch(RATES_ENDPOINT).then((r) => r.json()).then(applyBook).catch(() => {});
    poll();
    if (!reduce) setInterval(poll, 8000);
  }

  /* ---- form → Telegram ---- */
  const form = document.getElementById('leadForm');
  const note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get('name') || '').toString().trim();
      const contact = (data.get('contact') || '').toString().trim();
      const task = (data.get('task') || '').toString();
      if (!name || !contact) {
        note.textContent = 'Заполните имя и контакт для связи.';
        note.classList.remove('ok');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      const calcLine = amountEl ? `\nКалькулятор: ${amountEl.value} ${fromBox.dataset.cur} → ${resultEl.textContent}` : '';
      const text =
        `🟢 Новая заявка — Buy_USDTs\n\n` +
        `👤 Имя: ${name}\n` +
        `📞 Контакт: ${contact}\n` +
        `🎯 Задача: ${task}${calcLine}`;

      if (TG.token && TG.chatId) {
        btn && (btn.style.opacity = '.6', btn.style.pointerEvents = 'none');
        note.classList.remove('ok');
        note.textContent = 'Отправляем…';
        try {
          const res = await fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG.chatId, text, parse_mode: 'HTML' }),
          });
          if (!res.ok) throw new Error('tg');
          note.textContent = '✓ Заявка отправлена. Менеджер свяжется с вами в ближайшее время.';
          note.classList.add('ok');
          form.reset(); calc();
        } catch (err) {
          note.textContent = 'Не удалось отправить. Напишите нам в Telegram напрямую.';
          note.classList.remove('ok');
        } finally {
          btn && (btn.style.opacity = '', btn.style.pointerEvents = '');
        }
      } else {
        // демо-режим: токен не задан
        note.textContent = '✓ Заявка принята (демо). Подключите Telegram-бота в script.js.';
        note.classList.add('ok');
        form.reset(); calc();
      }
    });
  }
})();
