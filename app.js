/* =====================================================================
   CAOA Seminovos — Motor da Apresentação Executiva
   Compatível com Desktop 16:9, Mobile 100% responsivo e touch.
   ===================================================================== */

let curSlide = 0;
const slides = document.querySelectorAll('.slide');
const totalSlides = slides.length;
let isMobile = false;

// Estado da tabela
let tabSortCol = 'dias';
let tabSortAsc = false;
let tabFiltrados = [];

// Estado da simulação (Slide 6)
let simUnit = 'p'; // 'p' (%) ou 'r' (R$)

// Utilitários de formatação brasileira
function fmtMoeda(v) {
  if (v == null || isNaN(v)) return 'R$ 0';
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
}

function fmtMM(v) {
  if (v == null || isNaN(v)) return 'R$ 0 MM';
  return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' MM';
}

function fmtMil(v) {
  if (v == null || isNaN(v)) return 'R$ 0 mil';
  return 'R$ ' + (v / 1e3).toFixed(1).replace('.', ',') + ' mil';
}

function fmtNum(v) {
  if (v == null || isNaN(v)) return '0';
  return Number(v).toLocaleString('pt-BR');
}

function fmtPct(v) {
  if (v == null || isNaN(v)) return '0%';
  return Number(v).toFixed(1).replace('.', ',') + '%';
}

// Agregados do estoque crítico (>90 dias) — recalculados quando a taxa muda
function crit() {
  const t = DADOS.premissas.taxaCDIDiaria;
  const v = DADOS.veiculos;
  const cap = v.reduce((a, c) => a + c.valorCompra, 0);
  return {
    n: v.length, cap,
    cdi: v.reduce((a, c) => a + c.valorCompra * c.dias * t, 0),
    cdiDia: cap * t,
    pct: DADOS.total.capital ? cap / DADOS.total.capital * 100 : 0
  };
}
const COR_FAIXA = { '0-30': 'var(--g)', '31-45': 'var(--y)', '46-60': 'var(--o)', '61-90': 'var(--r)', '>90': 'var(--w)' };
function fmtMM2(v) { return 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + ' MM'; }
function niceMax(v, steps = 4) {
  if (v <= 0) return 1;
  const raw = v / steps, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = [1, 2, 2.5, 5, 10].find(k => k * mag >= raw) * mag;
  return n * steps;
}
function fmtEixo(v) {
  if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',') + ' MM';
  if (v >= 1e3) return 'R$ ' + (v / 1e3).toFixed(v % 1e3 ? 1 : 0).replace('.', ',') + ' mil';
  return 'R$ ' + Math.round(v);
}
// Degrau do plano para cada chassi crítico (única regra usada no plano, na tabela e no detalhe)
function degrauDe(c) {
  const leilao = (c.tipoEstoque || '').toUpperCase().includes('LEILAO');
  const rev = (['D', 'E'].includes(c.mesa) && c.dias > 120) || leilao;
  if (c.dias > 180) return 3;
  if (rev) return (c.dias > 150 || c.mesa === 'E') ? 3 : 2;
  if (['A', 'B'].includes(c.mesa) && c.dias <= 120) return 0;
  return 1;
}
const ACOES = [
  { k: 'reprecificar', label: 'Reprecificar (−2% a −4%)', cor: 'var(--g)', det: 'Reprecificar FIPE −2% a −4% nos portais' },
  { k: 'campanha', label: 'Campanha e bônus', cor: 'var(--y)', det: 'Campanha de loja com superbônus ao vendedor' },
  { k: 'revendedor', label: 'Oferta a revendedor', cor: 'var(--o)', det: 'Oferta em lote a revendedores parceiros (D+14)' },
  { k: 'leilao', label: 'Leilão / transferência', cor: 'var(--r)', det: 'Leilão ou transferência entre lojas (D+21)' }
];

// -------------------------------------------------------------
// NAVEGAÇÃO E ESCALA
// -------------------------------------------------------------
function updateUI() {
  slides.forEach((s, idx) => {
    s.classList.toggle('active', idx === curSlide);
    if (idx === curSlide) {
      s.classList.add('in');
      triggerCounters(s);
    }
  });

  const counter = document.getElementById('counter');
  if (counter) counter.innerText = `${curSlide + 1} / ${totalSlides}`;

  const prog = document.getElementById('progress');
  if (prog) {
    const pct = ((curSlide + 1) / totalSlides) * 100;
    prog.style.width = pct + '%';
  }

  const bPrev = document.getElementById('bPrev');
  const bNext = document.getElementById('bNext');
  if (bPrev) bPrev.disabled = curSlide === 0;
  if (bNext) bNext.disabled = curSlide === totalSlides - 1;

  // Atualiza números de página nos rodapés
  document.querySelectorAll('.sf .pg').forEach((el, idx) => {
    el.innerText = `Slide ${idx + 2} / ${totalSlides}`;
  });
}

function go(idx) {
  if (typeof idx === 'string') idx = [...slides].findIndex(s => s.dataset.id === idx);
  if (idx < 0) idx = 0;
  if (idx >= totalSlides) idx = totalSlides - 1;
  curSlide = idx;
  updateUI();
  if (isMobile) {
    slides[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function next() {
  if (curSlide < totalSlides - 1) go(curSlide + 1);
}

function prev() {
  if (curSlide > 0) go(curSlide - 1);
}

function setupScaling() {
  if (isMobile) return;
  const stage = document.getElementById('stage');
  const vp = document.getElementById('viewport');
  if (!stage || !vp) return;

  const vw = vp.clientWidth;
  const vh = vp.clientHeight;
  const mx = vw < 900 ? 6 : 32, my = vh < 520 ? 4 : 20;
  const scale = Math.min((vw - mx) / 1600, (vh - my) / 900);
  stage.style.transform = `scale(${Math.max(scale, 0.1)})`;
}

// Contadores animados nos slides
function triggerCounters(slideEl) {
  slideEl.querySelectorAll('[data-count]').forEach(el => {
    const key = el.getAttribute('data-count');
    let target = 0;
    let isDecimal = false;

    if (key === 'veic') target = DADOS.total.veiculos;
    else if (key === 'capMM') { target = DADOS.total.capital / 1e6; isDecimal = true; }
    else if (key === 'aging') { target = DADOS.total.agingPonderado; isDecimal = true; }
    else if (key === 'cdiMil') { target = crit().cdi / 1e3; isDecimal = true; }

    animateValue(el, 0, target, 800, isDecimal);
  });
}

function animateValue(obj, start, end, duration, isDecimal) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const val = start + (end - start) * ease;
    obj.innerText = isDecimal ? val.toFixed(1).replace('.', ',') : Math.round(val).toLocaleString('pt-BR');
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// -------------------------------------------------------------
// TOOLTIPS
// -------------------------------------------------------------
const tip = document.getElementById('tip');

function showTip(e, html) {
  if (!tip) return;
  tip.innerHTML = html;
  tip.classList.add('show');
  moveTip(e);
}

function moveTip(e) {
  if (!tip || !tip.classList.contains('show')) return;
  const x = e.clientX + 14;
  const y = e.clientY - 35;
  tip.style.left = Math.min(x, window.innerWidth - 320) + 'px';
  tip.style.top = Math.max(y, 10) + 'px';
}

function hideTip() {
  if (tip) tip.classList.remove('show');
}

// -------------------------------------------------------------
// QR CODE (Lib do app pai)
// -------------------------------------------------------------
function initQR() {
  const qrBox = document.getElementById('qrBox');
  const qrLink = document.getElementById('qrLink');
  if (!qrBox) return;

  let targetUrl = DADOS.config.urlPublicada;
  if (!targetUrl || targetUrl.trim() === '') {
    targetUrl = window.location.href;
    if (window.location.protocol === 'file:') {
      // Fallback para simulação local
      targetUrl = window.location.href.split('?')[0];
    }
  }

  if (qrLink) {
    const cleanDisplay = targetUrl.replace(/^https?:\/\//, '').split('?')[0];
    qrLink.innerText = cleanDisplay.length > 32 ? cleanDisplay.substring(0, 30) + '…' : cleanDisplay;
    qrLink.href = targetUrl;
  }

  qrBox.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(qrBox, {
        text: targetUrl,
        width: 200,
        height: 200,
        colorDark: '#1D184B',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
      return;
    } catch (e) {
      console.warn('Erro ao gerar QRCode dinâmico:', e);
    }
  }
  qrBox.innerHTML = '<div class="qr-empty">📱 Abra com ?mobile=1 para ver a versão celular</div>';
}

// -------------------------------------------------------------
// MODO MOBILE & FULLSCREEN
// -------------------------------------------------------------
function toggleMobile() {
  isMobile = !isMobile;
  document.body.classList.toggle('mobile', isMobile);
  const bMobile = document.getElementById('bMobile');
  if (bMobile) bMobile.classList.toggle('on', isMobile);

  if (isMobile) {
    // No modo mobile, garante que todos os contadores dos slides recebam seus valores reais imediatamente
    slides.forEach(s => {
      s.classList.add('in');
      triggerCounters(s);
    });
  } else {
    setupScaling();
    updateUI();
  }
}

function toggleFS() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

// -------------------------------------------------------------
// MODAIS
// -------------------------------------------------------------
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('show');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}

function initIndexModal() {
  const list = document.getElementById('idxList');
  if (!list) return;
  list.innerHTML = '';
  slides.forEach((s, idx) => {
    const tg = s.querySelector('.sh .tag');
    if (tg && idx > 0 && !tg.querySelector('.tn')) tg.querySelector('i').insertAdjacentHTML('afterend', `<span class="tn">${String(idx).padStart(2, '0')} ·</span>`);
    const title = s.getAttribute('data-title') || `Slide ${idx + 1}`;
    const btn = document.createElement('button');
    btn.innerHTML = `<span>${String(idx + 1).padStart(2, '0')}</span> ${title}`;
    btn.onclick = () => {
      closeModal('mIndex');
      go(idx);
    };
    list.appendChild(btn);
  });
}

// -------------------------------------------------------------
// SLIDE 1: CAPA
// -------------------------------------------------------------
function initSlide1() {
  const critVeic = DADOS.veiculos.length;
  const critCap = DADOS.veiculos.reduce((acc, c) => acc + c.valorCompra, 0);

  const elVeic = document.getElementById('cvVeic');
  if (elVeic) elVeic.innerText = fmtNum(DADOS.total.veiculos);

  const elCap = document.getElementById('cvCap');
  if (elCap) elCap.innerText = fmtMM(DADOS.total.capital);

  const elCrit = document.getElementById('cvCrit');
  if (elCrit) elCrit.innerText = `${critVeic} carros`;

  const elCritCap = document.getElementById('cvCritCap');
  if (elCritCap) elCritCap.innerText = fmtMM(critCap);

  const meta = document.getElementById('cvMeta');
  if (meta) {
    const entr = DADOS.entrantes.reduce((a, e) => a + e.veiculos, 0);
    meta.innerHTML = `<span><b>${DADOS.marcas.length}</b> marcas</span><span><b>${DADOS.regionais.length}</b> regionais</span><span><b>${DADOS.lojas.length}</b> lojas</span><span><b>${entr}</b> carros chegam aos 90 dias em 4 semanas</span>`;
  }
}

// -------------------------------------------------------------
// SLIDE 2: SÍNTESE
// -------------------------------------------------------------
function initSlide2() {
  const critVeic = DADOS.veiculos.length;
  const critCap = DADOS.veiculos.reduce((acc, c) => acc + c.valorCompra, 0);
  const pctCap = ((critCap / DADOS.total.capital) * 100).toFixed(1).replace('.', ',');
  const cdiTotal = DADOS.veiculos.reduce((acc, c) => acc + (c.valorCompra * c.dias * DADOS.premissas.taxaCDIDiaria), 0);

  const s2title = document.getElementById('s2title');
  if (s2title) s2title.innerHTML = `${critVeic} carros = <em>${pctCap}% do capital</em>; o plano é tratá-los chassi a chassi`;

  const s2cdiSub = document.getElementById('s2cdiSub');
  if (s2cdiSub) s2cdiSub.innerText = `${critVeic} carros · média ${fmtMoeda(cdiTotal / critVeic)} / chassi`;


  // Barra de capital por aging
  const s2bar = document.getElementById('s2bar');
  const s2legend = document.getElementById('s2legend');
  if (s2bar && s2legend) {
    s2bar.innerHTML = '';
    s2legend.innerHTML = '';
    DADOS.funil.forEach(f => {
      const pct = (f.capital / DADOS.total.capital) * 100;
      const seg = document.createElement('div');
      seg.style.width = Math.max(pct, 2) + '%';
      seg.style.background = COR_FAIXA[f.id];
      seg.style.cursor = 'pointer';
      seg.setAttribute('data-tip', '');
      seg.onmouseenter = (e) => showTip(e, `<b>${f.faixa} (${f.regua})</b><br>${fmtNum(f.veiculos)} carros · ${fmtMM(f.capital)} (${fmtPct(pct)})<br>Aging médio: ${f.aging} dias`);
      seg.onmousemove = moveTip;
      seg.onmouseleave = hideTip;
      seg.onclick = () => { selectFunnelStage(f.id); go('funil'); };
      s2bar.appendChild(seg);

      const leg = document.createElement('div');
      leg.style.display = 'flex';
      leg.style.alignItems = 'center';
      leg.style.gap = '6px';
      leg.style.fontSize = '12px';
      leg.style.color = 'var(--mut)';
      leg.style.cursor = 'pointer';
      leg.onclick = () => { selectFunnelStage(f.id); go('funil'); };
      leg.innerHTML = `<span class="dot" style="background:${seg.style.background}"></span> <b>${f.faixa}</b>: ${fmtMM(f.capital)} (${fmtPct(pct)})`;
      s2legend.appendChild(leg);
    });
  }

  // Callout da síntese
  const s2callout = document.getElementById('s2callout');
  if (s2callout) {
    const ate45Cap = DADOS.funil.filter(f => f.id === '0-30' || f.id === '31-45').reduce((acc, f) => acc + f.capital, 0);
    const ate45Pct = ((ate45Cap / DADOS.total.capital) * 100).toFixed(0);
    const k = crit();
    const entr = DADOS.entrantes.reduce((a, e) => a + e.veiculos, 0);
    s2callout.innerHTML = `<b>Diagnóstico central:</b> <b>${ate45Pct}% do capital</b> está em até 45 dias de estoque. O risco está concentrado nos <b>${k.n} veículos acima de 90 dias (${fmtMM(k.cap)})</b>, que consomem <b>${fmtMoeda(k.cdiDia)} de CDI por dia</b> — e outros <b>${entr} carros</b> chegam a essa faixa nas próximas 4 semanas.`;
  }

  // Marcas
  const s2brands = document.getElementById('s2brands');
  if (s2brands) {
    s2brands.innerHTML = '';
    const sorted = [...DADOS.marcas].sort((a, b) => b.capital - a.capital);
    const maxPct = Math.max(...sorted.map(m => m.capital)) / DADOS.total.capital * 100;
    sorted.forEach(m => {
      const pct = (m.capital / DADOS.total.capital) * 100;
      const nCrit = DADOS.veiculos.filter(c => c.marca === m.marca).length;
      const bRow = document.createElement('div');
      bRow.className = 'brow';
      bRow.innerHTML = `
        <div class="bt"><span><b>${m.marca}</b> · ${fmtNum(m.veiculos)} veíc</span><b>${fmtMM(m.capital)} (${fmtPct(pct)})</b></div>
        <div class="btrack"><div style="width:${pct / maxPct * 100}%;background:linear-gradient(90deg,var(--navy3),var(--blue))"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut2);margin-top:4px"><span>Aging médio ${String(m.aging).replace('.', ',')} d</span><span style="color:${nCrit ? 'var(--w)' : 'var(--mut2)'};font-weight:700">${nCrit} acima de 90 d</span></div>
      `;
      s2brands.appendChild(bRow);
    });
  }
}

// -------------------------------------------------------------
// SLIDE 3: FUNIL DE AGING
// -------------------------------------------------------------
let curFunnelStage = '0-30';

function initSlide3() {
  const container = document.getElementById('funnel');
  if (!container) return;
  const t3 = document.getElementById('s3title');
  if (t3) {
    const f0 = DADOS.funil[0], tot = DADOS.total.capital;
    const p0 = Math.round(f0.capital / tot * 100);
    const p60 = Math.round(DADOS.funil.filter(f => f.id === '61-90' || f.id === '>90').reduce((a, f) => a + f.capital, 0) / tot * 100);
    t3.innerHTML = `${p0}% do capital está em até 30 dias; <em>${p60}% já passou dos 60</em>`;
  }
  container.innerHTML = '';

  const maxCap = Math.max(...DADOS.funil.map(f => f.capital));

  DADOS.funil.forEach(f => {
    const cor = COR_FAIXA[f.id];
    const pctL = Math.max((f.capital / maxCap) * 100, 30);
    const narrow = pctL < 45;

    const st = document.createElement('div');
    st.className = `fstage ${f.id === curFunnelStage ? 'sel' : ''}`;
    st.id = `fstage-${f.id}`;
    st.onclick = () => selectFunnelStage(f.id);

    st.innerHTML = `
      <div class="fl">
        <div class="fx">${f.faixa}</div>
        <div class="rg" style="color:${cor}">${f.regua}</div>
      </div>
      <div class="ftrack">
        <div class="fbar ${narrow ? 'narrow' : ''}" style="width:${pctL}%;background:${cor};min-width:0">
          <span class="fv">${fmtMM(f.capital)}</span>
          <span class="fq">${fmtNum(f.veiculos)} veículos<br><small style="font-weight:600;opacity:.9">${String(f.aging).replace('.', ',')} d aging médio</small></span>
        </div>
        ${narrow ? `<span class="fout">${fmtNum(f.veiculos)} veíc · ${String(f.aging).replace('.', ',')} d</span>` : ''}
      </div>
    `;
    container.appendChild(st);
  });

  renderFunnelDrawer(curFunnelStage);
}

function selectFunnelStage(id) {
  curFunnelStage = id;
  document.querySelectorAll('.fstage').forEach(el => el.classList.remove('sel'));
  const target = document.getElementById(`fstage-${id}`);
  if (target) target.classList.add('sel');
  renderFunnelDrawer(id);
}

function renderFunnelDrawer(id) {
  const drawer = document.getElementById('drawer');
  if (!drawer) return;

  const f = DADOS.funil.find(x => x.id === id);
  if (!f) return;

  const cor = COR_FAIXA[f.id];

  let brandsHtml = '';
  const sorted = [...f.marcas].sort((a, b) => b.capitalMM - a.capitalMM);
  sorted.forEach(m => {
    const pct = f.capital > 0 ? ((m.capitalMM * 1e6) / f.capital) * 100 : 0;
    brandsHtml += `
      <div class="brow">
        <div class="bt"><span><b>${m.marca}</b> · ${m.veiculos} veíc</span><b>R$ ${m.capitalMM.toFixed(1).replace('.', ',')} MM (${fmtPct(pct)})</b></div>
        <div class="btrack"><div style="width:${pct}%;background:${cor}"></div></div>
        <div style="font-size:11px;color:var(--mut2);margin-top:2px">Aging médio na marca: ${m.aging} dias</div>
      </div>
    `;
  });

  drawer.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span class="badge" style="background:${cor}">${f.regua}</span>
      <span style="font-size:13px;font-weight:700;color:var(--mut)">${fmtPct((f.capital / DADOS.total.capital) * 100)} do capital</span>
    </div>
    <h4>${f.faixa}</h4>
    <div style="font-size:32px;font-weight:900;color:var(--navy);margin:6px 0">${fmtMM(f.capital)}</div>
    <div style="font-size:14px;color:var(--mut);margin-bottom:14px">${fmtNum(f.veiculos)} veículos · aging médio de <b>${f.aging} dias</b></div>
    <div class="callout" style="margin-bottom:16px;border-left:4px solid ${cor}">
      <b>Ação recomendada pelo financeiro:</b><br>${f.acao}
    </div>
    <h3 style="font-size:14px;margin-bottom:8px">Composição por marca</h3>
    ${brandsHtml}
    ${f.id === '>90' ? `<button class="btn" style="width:100%;margin-top:14px" onclick="go('tabela')">Ver lista nominal dos ${DADOS.veiculos.length} chassis →</button>` : ''}
  `;
}

// -------------------------------------------------------------
// SLIDE 4: VALOR DO DINHEIRO PARADO (CDI)
// -------------------------------------------------------------
function initSlide4() {
  const taxaDia = DADOS.premissas.taxaCDIDiaria;
  const taxaInput = document.getElementById('cTaxa');
  if (taxaInput) taxaInput.value = (taxaDia * 100).toFixed(4);

  const s4taxa = document.getElementById('s4taxa');
  if (s4taxa) s4taxa.innerText = `${(taxaDia * 100).toFixed(4).replace('.', ',')}%`;

  const s4title = document.getElementById('s4title');
  if (s4title) s4title.innerText = `Um carro de R$ 100 mil a 120 dias já perdeu R$ ${(100000 * 120 * taxaDia).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} só em CDI`;

  const k = crit();
  const s4crit = document.getElementById('s4crit');
  if (s4crit) {
    s4crit.innerHTML = `<b>Impacto real no estoque &gt;90 dias:</b> os ${k.n} chassis já consumiram <b>${fmtMil(k.cdi)}</b> em CDI acumulado e continuam custando <b>${fmtMoeda(k.cdiDia)} por dia</b> — cerca de <b>${fmtMil(k.cdiDia * 30)} por mês</b>.`;
  }

  renderCdiChart();
  updateCalculator();

  // Listeners
  const cVal = document.getElementById('cVal');
  const cDias = document.getElementById('cDias');
  if (cVal) cVal.oninput = updateCalculator;
  if (cDias) cDias.oninput = updateCalculator;
  if (taxaInput) taxaInput.oninput = () => {
    const nv = parseFloat(taxaInput.value) / 100;
    if (!isNaN(nv) && nv > 0) {
      DADOS.premissas.taxaCDIDiaria = nv;
      updateCalculator();
      renderCdiChart();
    }
  };
}

function renderCdiChart() {
  const container = document.getElementById('s4chart');
  if (!container) return;

  const pontos = [30, 60, 90, 120, 150, 180];
  const carroBase = 100000;
  const taxa = DADOS.premissas.taxaCDIDiaria;
  const maxCdi = niceMax(carroBase * 180 * taxa * 1.08, 3);

  let svg = `<svg viewBox="0 0 560 300" style="width:100%;height:100%;overflow:visible">`;
  for (let g = 0; g <= 3; g++) {
    const y = 240 - g * 70;
    svg += `<line x1="60" y1="${y}" x2="520" y2="${y}" stroke="var(--line)" ${g ? 'stroke-dasharray="4,4"' : 'stroke-width="2"'}/>
      <text x="50" y="${y + 4}" fill="var(--mut2)" font-size="11" text-anchor="end">${fmtMoeda(maxCdi / 3 * g)}</text>`;
  }

  pontos.forEach((d, i) => {
    const cdi = carroBase * d * taxa;
    const h = (cdi / maxCdi) * 210;
    const x = 90 + i * 72;
    const y = 240 - h;
    const cor = d <= 30 ? 'var(--g)' : (d <= 60 ? 'var(--y)' : (d <= 90 ? 'var(--o)' : 'var(--r)'));

    svg += `
      <g style="cursor:pointer" onclick="setCalcPreset(${d})"
         onmouseenter="showTip(event, '<b>${d} dias parado</b><br>CDI acumulado: <b>${fmtMoeda(cdi)}</b><br>${(cdi/carroBase*100).toFixed(1)}% do valor de compra<br><span style=\\\'color:var(--mintL)\\\'>Clique para carregar na calculadora</span>')"
         onmousemove="moveTip(event)" onmouseleave="hideTip()">
        <rect class="growy" style="--d:${0.1 + i * 0.08}s" x="${x - 22}" y="${y}" width="44" height="${h}" rx="6" fill="${cor}"/>
        <text x="${x}" y="${y - 8}" fill="var(--navy)" font-size="12" font-weight="800" text-anchor="middle">${fmtMoeda(cdi)}</text>
        <text x="${x}" y="258" fill="var(--mut)" font-size="12" font-weight="700" text-anchor="middle">${d}d</text>
      </g>
    `;
  });

  svg += `</svg>`;
  container.innerHTML = svg;
}

function setCalcPreset(dias) {
  const cDias = document.getElementById('cDias');
  if (cDias) {
    cDias.value = dias;
    updateCalculator();
  }
}

function updateCalculator() {
  const cVal = document.getElementById('cVal');
  const cDias = document.getElementById('cDias');
  const cDiasV = document.getElementById('cDiasV');
  const cRes = document.getElementById('cRes');
  const cDia = document.getElementById('cDia');
  const cPct = document.getElementById('cPct');

  if (!cVal || !cDias) return;

  const val = parseFloat(cVal.value) || 0;
  const dias = parseInt(cDias.value) || 0;
  const taxa = DADOS.premissas.taxaCDIDiaria;

  if (cDiasV) cDiasV.innerText = `${dias} dias`;

  const total = val * dias * taxa;
  const dia = val * taxa;
  const pct = val > 0 ? (total / val) * 100 : 0;

  if (cRes) cRes.innerText = fmtMoeda(total);
  if (cDia) cDia.innerText = `Custo: ${fmtMoeda(dia)} / dia`;
  if (cPct) cPct.innerText = `${pct.toFixed(2).replace('.', ',')}% do carro`;
}

// -------------------------------------------------------------
// SLIDE 5: ONDE ESTÁ O PROBLEMA
// -------------------------------------------------------------
let s5Modo = 'q'; // 'q' (qtd) ou 'v' (capital)

function initSlide5() {
  const s5title = document.getElementById('s5title');
  const porMarca = DADOS.marcas.map(m => {
    const cs = DADOS.veiculos.filter(c => c.marca === m.marca);
    return { marca: m.marca, n: cs.length, cap: cs.reduce((a, c) => a + c.valorCompra, 0), aging: cs.length ? cs.reduce((a, c) => a + c.dias, 0) / cs.length : 0, max: cs.length ? Math.max(...cs.map(c => c.dias)) : 0 };
  }).filter(x => x.n > 0);
  const kTot = crit();
  const byVol = [...porMarca].sort((a, b) => b.n - a.n);
  // aging médio sem distorção de um único outlier: usa mediana para o título
  const med = arr => { const v = [...arr].sort((a, b) => a - b); const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  porMarca.forEach(x => { x.med = med(DADOS.veiculos.filter(c => c.marca === x.marca).map(c => c.dias)); });
  const byMed = [...porMarca].sort((a, b) => b.med - a.med);
  if (s5title) s5title.innerHTML = `${byVol[0].marca} lidera em volume (${byVol[0].n} carros); <em>${byMed[0].marca}, em aging (mediana ${Math.round(byMed[0].med)} d)</em>`;

  const s5mb1 = document.getElementById('s5mb1');
  const s5mb2 = document.getElementById('s5mb2');
  const s5fipe = document.getElementById('s5fipe');
  if (s5mb1) s5mb1.innerText = `${DADOS.margemBruta.acima90}%`;
  if (s5mb2) s5mb2.innerText = `${DADOS.margemBruta.ate90}%`;
  if (s5fipe) s5fipe.innerText = `${Math.abs(DADOS.compraVsFipeCriticos)}% abaixo`;

  // Segmented control
  const segBtns = document.querySelectorAll('#s5seg button');
  segBtns.forEach(btn => {
    btn.onclick = () => {
      segBtns.forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      s5Modo = btn.getAttribute('data-m');
      renderSlide5Chart();
    };
  });

  // Destaques
  const s5calls = document.getElementById('s5calls');
  if (s5calls) {
    const a = byVol[0], b = byMed[0].marca === a.marca ? byMed[1] : byMed[0];
    const resto = porMarca.filter(x => x.marca !== a.marca && x.marca !== b.marca);
    const outlier = DADOS.veiculos.filter(c => c.dias > 365);
    s5calls.innerHTML = `
      <div class="callout bad"><b>${a.marca}:</b> ${a.n} veículos (${fmtMM2(a.cap)}), mediana de ${Math.round(a.med)} dias. Representa <b>${Math.round(a.cap / kTot.cap * 100)}% do capital crítico</b> — foco em volume e liberação de caixa.</div>
      <div class="callout warn"><b>${b.marca}:</b> ${b.n} veículos (${fmtMM2(b.cap)}) com <b>mediana de ${Math.round(b.med)} dias</b>. Exige ação comercial imediata.</div>
      <div class="callout">${resto.map(x => `<b>${x.marca}:</b> ${x.n} veículos (${fmtMM2(x.cap)}, mediana ${Math.round(x.med)} d).`).join(' ')}${outlier.length ? ` <br><b>Ponto fora da curva:</b> ${outlier.map(c => `${c.modelo.split(' ').slice(0, 2).join(' ')} (${c.placa}) com ${fmtNum(c.dias)} dias`).join(', ')} — tratar individualmente.` : ''}</div>
    `;
  }

  // Tipos de estoque
  const s5tipos = document.getElementById('s5tipos');
  if (s5tipos) {
    const tipos = {};
    DADOS.veiculos.forEach(c => {
      let t = c.tipoEstoque;
      if (t.includes('LEILAO') || t.includes('VUL')) t = 'Leilão / Repasse';
      else if (t.includes('DEMONST') || t.includes('UT')) t = 'Demonstração terceiros';
      else if (t.includes('RENAVE')) t = 'Renave';
      else t = 'VU (Varejo normal)';
      tipos[t] = (tipos[t] || 0) + 1;
    });

    s5tipos.innerHTML = '';
    Object.entries(tipos).sort((a, b) => b[1] - a[1]).forEach(([nome, qtd]) => {
      const pct = (qtd / DADOS.veiculos.length) * 100;
      const row = document.createElement('div');
      row.className = 'brow';
      row.innerHTML = `
        <div class="bt"><span><b>${nome}</b></span><b>${qtd} veíc (${fmtPct(pct)})</b></div>
        <div class="btrack"><div style="width:${pct}%;background:var(--navy3)"></div></div>
      `;
      s5tipos.appendChild(row);
    });
  }

  renderSlide5Chart();
}

function renderSlide5Chart() {
  const container = document.getElementById('s5chart');
  const legContainer = document.getElementById('s5legend');
  if (!container) return;

  const marcas = DADOS.marcas.map(m => m.marca);
  const faixas = [
    { id: '91-120', label: '91 a 120 dias', cor: 'var(--o)' },
    { id: '121-150', label: '121 a 150 dias', cor: 'var(--r)' },
    { id: '151-180', label: '151 a 180 dias', cor: 'var(--w)' },
    { id: '>180', label: '>180 dias', cor: '#4A0E14' }
  ];

  if (legContainer) {
    legContainer.innerHTML = faixas.map(f => `<span style="display:inline-flex;align-items:center;gap:6px"><span class="dot" style="background:${f.cor}"></span> ${f.label}</span>`).join('');
  }

  const dadosM = marcas.map(m => {
    const carros = DADOS.veiculos.filter(c => c.marca.toUpperCase() === m.toUpperCase());
    const fx = {
      '91-120': carros.filter(c => c.dias >= 91 && c.dias <= 120),
      '121-150': carros.filter(c => c.dias >= 121 && c.dias <= 150),
      '151-180': carros.filter(c => c.dias >= 151 && c.dias <= 180),
      '>180': carros.filter(c => c.dias > 180)
    };
    return { marca: m, total: carros.length, fx };
  });

  const topo = Math.max(...dadosM.map(dm => s5Modo === 'q' ? dm.total : DADOS.veiculos.filter(c => c.marca === dm.marca).reduce((a, c) => a + c.valorCompra, 0) / 1e6));
  const maxVal = s5Modo === 'q' ? niceMax(topo * 1.1, 3) : niceMax(topo * 1.1, 3);

  let svg = `<svg viewBox="0 0 600 280" style="width:100%;height:100%;overflow:visible">`;
  for (let g = 0; g <= 3; g++) {
    const y = 230 - g * 65, v = maxVal / 3 * g;
    svg += `<line x1="50" y1="${y}" x2="570" y2="${y}" stroke="var(--line)" ${g ? 'stroke-dasharray="4,4"' : 'stroke-width="2"'}/>
      <text x="42" y="${y + 4}" fill="var(--mut2)" font-size="11" text-anchor="end">${s5Modo === 'q' ? Math.round(v) + ' v' : 'R$ ' + v.toFixed(1).replace('.', ',') + 'M'}</text>`;
  }

  dadosM.forEach((dm, i) => {
    const x = 50 + (520 / marcas.length) * (i + 0.5);
    let yBase = 230;

    faixas.forEach(f => {
      const lista = dm.fx[f.id] || [];
      const val = s5Modo === 'q' ? lista.length : lista.reduce((a, c) => a + c.valorCompra, 0) / 1e6;
      if (val > 0) {
        const h = (val / maxVal) * 195;
        const y = yBase - h;

        svg += `
          <rect x="${x - 26}" y="${y}" width="52" height="${h}" rx="3" fill="${f.cor}" style="cursor:pointer"
            onmouseenter="showTip(event, '<b>${dm.marca} · ${f.label}</b><br>${lista.length} veículos · ${fmtMM(lista.reduce((a,c)=>a+c.valorCompra,0))}<br><span style=\\\'color:var(--mintL)\\\'>Clique para filtrar na tabela</span>')"
            onmousemove="moveTip(event)" onmouseleave="hideTip()"
            onclick="filtrarNaTabela('${dm.marca}', '${f.id}')"/>
        `;
        yBase = y;
      }
    });

    const totVal = s5Modo === 'q' ? dm.total : DADOS.veiculos.filter(c => c.marca.toUpperCase() === dm.marca.toUpperCase()).reduce((a, c) => a + c.valorCompra, 0) / 1e6;
    svg += `
      <text x="${x}" y="${yBase - 8}" fill="var(--navy)" font-size="12" font-weight="800" text-anchor="middle">${s5Modo === 'q' ? dm.total + ' v' : 'R$ ' + totVal.toFixed(1).replace('.', ',') + 'M'}</text>
      <text x="${x}" y="250" fill="var(--navy)" font-size="13" font-weight="800" text-anchor="middle">${dm.marca}</text>
    `;
  });

  svg += `</svg>`;
  container.innerHTML = svg;
}

function filtrarNaTabela(marca, faixa) {
  const fMarca = document.getElementById('fMarca');
  const fFaixa = document.getElementById('fFaixa');
  if (fMarca) fMarca.value = marca;
  if (fFaixa) fFaixa.value = faixa;
  aplicarFiltros();
  go('tabela');
}

// -------------------------------------------------------------
// SLIDE 6: DEFESA DA MARGEM (SIMULADOR)
// -------------------------------------------------------------
function initSlide6() {
  const mCar = document.getElementById('mCar');
  if (mCar) {
    mCar.innerHTML = '';
    DADOS.veiculos.forEach((c, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.innerText = `${c.modelo} (${c.placa}) · ${fmtMoeda(c.valorCompra)} · ${c.dias}d${c.precoPublico > 0 ? '' : ' · preço = FIPE'}`;
      mCar.appendChild(opt);
    });
    mCar.onchange = () => carregarCarroSim(mCar.value);
  }

  const unitBtns = document.querySelectorAll('#mUnit button');
  unitBtns.forEach(btn => {
    btn.onclick = () => {
      unitBtns.forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      simUnit = btn.getAttribute('data-u');
      ajustarControleDesconto();
      updateMarginSim();
    };
  });

  // Listeners de sliders
  ['mCompra', 'mPreco', 'mAging', 'mDesc', 'mDr', 'mDv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = updateMarginSim;
  });

  const ref = DADOS.veiculos.findIndex(c => c.dias <= 365 && c.precoPublico > 0);
  if (DADOS.veiculos.length > 0) { if (mCar) mCar.value = Math.max(ref, 0); carregarCarroSim(Math.max(ref, 0)); }
}

function carregarCarroSim(idx) {
  const c = DADOS.veiculos[idx];
  if (!c) return;

  document.getElementById('mCompra').value = c.valorCompra;
  document.getElementById('mPreco').value = c.precoPublico > 0 ? c.precoPublico : Math.round(c.fipe);
  document.getElementById('mAging').max = Math.max(240, c.dias);
  document.getElementById('mAging').value = c.dias;
  document.getElementById('mDesc').value = DADOS.premissas.descontoRevendedorPct;
  document.getElementById('mDr').value = DADOS.premissas.diasVendaRevendedor;
  document.getElementById('mDv').value = DADOS.premissas.diasAdicionaisVarejo;

  ajustarControleDesconto();
  updateMarginSim();
}

function ajustarControleDesconto() {
  const mDesc = document.getElementById('mDesc');
  const mPreco = parseFloat(document.getElementById('mPreco').value) || 100000;
  if (!mDesc) return;

  if (simUnit === 'p') {
    mDesc.min = 0;
    mDesc.max = 20;
    mDesc.step = 0.5;
    mDesc.value = Math.min(parseFloat(mDesc.value) || 5, 20);
  } else {
    mDesc.min = 0;
    mDesc.max = Math.round(mPreco * 0.2);
    mDesc.step = 500;
    mDesc.value = Math.round(mPreco * 0.05);
  }
}

function updateMarginSim() {
  const compra = parseFloat(document.getElementById('mCompra').value) || 0;
  const preco = parseFloat(document.getElementById('mPreco').value) || 0;
  const aging = parseInt(document.getElementById('mAging').value) || 0;
  const descVal = parseFloat(document.getElementById('mDesc').value) || 0;
  const dr = parseInt(document.getElementById('mDr').value) || 0;
  const dv = parseInt(document.getElementById('mDv').value) || 0;

  const taxa = DADOS.premissas.taxaCDIDiaria;
  const despV = DADOS.premissas.despesaVarejo;
  const despR = DADOS.premissas.despesaRevendedor;

  // Labels
  document.getElementById('mAgingV').innerText = `${aging} dias`;
  document.getElementById('mDrV').innerText = `${dr} dias`;
  document.getElementById('mDvV').innerText = `+${dv} dias (total ${aging + dv}d)`;

  const descontoR$ = simUnit === 'p' ? preco * (descVal / 100) : descVal;
  document.getElementById('mDescV').innerText = simUnit === 'p' ? `${descVal.toFixed(1).replace('.', ',')}% (${fmtMoeda(descontoR$)})` : fmtMoeda(descontoR$);

  // Cenário Revendedor (Vender agora em D+dr)
  const precoR = preco - descontoR$;
  const cdiR = compra * (aging + dr) * taxa;
  const margemEconR = precoR - compra - cdiR - despR;

  // Cenário Varejo (Esperar +dv dias)
  const precoV = preco;
  const cdiV = compra * (aging + dv) * taxa;
  const margemEconV = precoV - compra - cdiV - despV;

  // Render Cenário A (Revendedor)
  const scR = document.getElementById('scR');
  if (scR) {
    const isWinner = margemEconR >= margemEconV;
    scR.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="badge" style="background:var(--o)">Cenário A · Revendedor (D+${dr})</span>
        ${isWinner ? '<span class="chip" style="background:#E3F4EA;color:var(--g)">✓ Melhor retorno</span>' : ''}
      </div>
      <table class="wf">
        <tr><td>Preço de venda B2B</td><td>${fmtMoeda(precoR)}</td></tr>
        <tr><td>(−) Valor de compra</td><td style="color:var(--mut)">− ${fmtMoeda(compra)}</td></tr>
        <tr><td>(−) CDI acumulado (${aging + dr}d)</td><td style="color:var(--r)">− ${fmtMoeda(cdiR)}</td></tr>
        <tr><td>(−) Despesas B2B</td><td style="color:var(--mut)">− ${fmtMoeda(despR)}</td></tr>
        <tr class="t"><td>Margem Econômica</td><td style="color:${margemEconR >= 0 ? 'var(--g)' : 'var(--r)'}">${fmtMoeda(margemEconR)}</td></tr>
      </table>
      <div style="font-size:12px;color:var(--mut);line-height:1.4">Libera <b>${fmtMoeda(precoR)}</b> em caixa na primeira semana para girar em carros novos.</div>
    `;
  }

  // Render Cenário B (Varejo)
  const scV = document.getElementById('scV');
  if (scV) {
    const isWinner = margemEconV > margemEconR;
    scV.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="badge" style="background:var(--blue)">Cenário B · Manter no varejo (+${dv}d)</span>
        ${isWinner ? '<span class="chip" style="background:#E3F4EA;color:var(--g)">✓ Melhor retorno</span>' : ''}
      </div>
      <table class="wf">
        <tr><td>Preço de varejo cheio</td><td>${fmtMoeda(precoV)}</td></tr>
        <tr><td>(−) Valor de compra</td><td style="color:var(--mut)">− ${fmtMoeda(compra)}</td></tr>
        <tr><td>(−) CDI acumulado (${aging + dv}d)</td><td style="color:var(--r)">− ${fmtMoeda(cdiV)}</td></tr>
        <tr><td>(−) Despesas varejo</td><td style="color:var(--mut)">− ${fmtMoeda(despV)}</td></tr>
        <tr class="t"><td>Margem Econômica</td><td style="color:${margemEconV >= 0 ? 'var(--g)' : 'var(--r)'}">${fmtMoeda(margemEconV)}</td></tr>
      </table>
      <div style="font-size:12px;color:var(--mut);line-height:1.4">Capital continua retido por mais <b>${dv} dias</b> acumulando custo diário.</div>
    `;
  }

  // Ponto de equilíbrio
  const cdiDia = compra * taxa;
  const difMargemBruta = (precoV - despV) - (precoR - despR);
  const breakEvenDias = cdiDia > 0 ? Math.round(difMargemBruta / cdiDia + dr) : 0;

  const mVerdict = document.getElementById('mVerdict');
  if (mVerdict) {
    if (dv >= breakEvenDias) {
      mVerdict.className = 'chip';
      mVerdict.style.background = '#FCEFEF';
      mVerdict.style.color = 'var(--r)';
      mVerdict.innerHTML = `⚠️ Vender agora é melhor: a espera no varejo (+${dv}d) supera o break-even de <b>${breakEvenDias} dias</b>`;
    } else {
      mVerdict.className = 'chip';
      mVerdict.style.background = '#E3F4EA';
      mVerdict.style.color = 'var(--g)';
      mVerdict.innerHTML = `Varejo compensa se vender em até <b>${breakEvenDias} dias</b> adicionais`;
    }
  }

  renderMarginCurve(compra, preco, aging, dr, descontoR$, despR, despV, taxa);
}

function renderMarginCurve(compra, preco, aging, dr, descontoR$, despR, despV, taxa) {
  const container = document.getElementById('mChart');
  if (!container) return;

  const precoR = preco - descontoR$;
  const cdiR = compra * (aging + dr) * taxa;
  const margemR = precoR - compra - cdiR - despR;

  // Curva de 0 a 120 dias adicionais
  const diasArr = [0, 15, 30, 45, 60, 75, 90, 105, 120];
  const valsV = diasArr.map(d => {
    const cdiV = compra * (aging + d) * taxa;
    return preco - compra - cdiV - despV;
  });

  const allVals = [...valsV, margemR, 0];
  const pad = (Math.max(...allVals) - Math.min(...allVals)) * 0.15 || 2000;
  const minM = Math.min(...allVals) - pad;
  const maxM = Math.max(...allVals) + pad;

  const scaleY = (v) => 170 - ((v - minM) / (maxM - minM)) * 150;

  let pathV = `M 60 ${scaleY(valsV[0])}`;
  for (let i = 1; i < diasArr.length; i++) {
    const x = 60 + i * 55;
    pathV += ` L ${x} ${scaleY(valsV[i])}`;
  }
  const areaV = pathV + ` L ${60 + (diasArr.length - 1) * 55} 170 L 60 170 Z`;
  // ponto de cruzamento (varejo = revendedor)
  let cross = '';
  for (let i = 1; i < diasArr.length; i++) {
    if ((valsV[i - 1] - margemR) * (valsV[i] - margemR) <= 0 && valsV[i - 1] !== valsV[i]) {
      const t = (valsV[i - 1] - margemR) / (valsV[i - 1] - valsV[i]);
      const cx = 60 + (i - 1 + t) * 55;
      cross = `<line x1="${cx}" y1="18" x2="${cx}" y2="170" stroke="var(--navy)" stroke-width="1" stroke-dasharray="2,3"/>
        <circle cx="${cx}" cy="${scaleY(margemR)}" r="6" fill="#fff" stroke="var(--navy)" stroke-width="2.5"/>
        <text x="${cx}" y="12" fill="var(--navy)" font-size="10.5" font-weight="800" text-anchor="middle">Equilíbrio: +${Math.round(diasArr[i - 1] + t * 15)}d</text>`;
      break;
    }
  }

  const yR = scaleY(margemR);

  let svg = `
    <svg viewBox="0 0 540 200" style="width:100%;height:100%;overflow:visible">
      <!-- Grid -->
      <line x1="60" y1="${scaleY(0)}" x2="500" y2="${scaleY(0)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3,3"/>
      <text x="50" y="${scaleY(0) + 4}" fill="var(--mut2)" font-size="10" text-anchor="end">0</text>

      <defs><linearGradient id="gV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#154578" stop-opacity=".18"/><stop offset="1" stop-color="#154578" stop-opacity="0"/></linearGradient></defs>
      <path d="${areaV}" fill="url(#gV)"/>
      <!-- Linha Revendedor (constante) -->
      <line x1="60" y1="${yR}" x2="500" y2="${yR}" stroke="var(--o)" stroke-width="2.5" stroke-dasharray="5,3"/>
      <rect x="64" y="${yR - 22}" width="${24 + fmtMoeda(margemR).length * 6.2 + 70}" height="17" rx="5" fill="#FDEBDD"/>
      <text x="70" y="${yR - 10}" fill="#A4511A" font-size="10.5" font-weight="800">Revendedor: ${fmtMoeda(margemR)}</text>
      <text x="504" y="${scaleY(valsV[valsV.length - 1]) + 4}" fill="var(--blue)" font-size="10.5" font-weight="800">Varejo</text>

      <!-- Curva Varejo -->
      <path d="${pathV}" fill="none" stroke="var(--blue)" stroke-width="3"/>
      ${cross}
  `;

  diasArr.forEach((d, i) => {
    const x = 60 + i * 55;
    const y = scaleY(valsV[i]);
    svg += `
      <circle cx="${x}" cy="${y}" r="4.5" fill="var(--blue)"/>
      <text x="${x}" y="190" fill="var(--mut)" font-size="10" text-anchor="middle">+${d}d</text>
    `;
  });

  svg += `</svg>`;
  container.innerHTML = svg;
}

// -------------------------------------------------------------
// SLIDE: PLANO DE REPRECIFICAÇÃO
// -------------------------------------------------------------
let curStep = 0;

const DEGRAUS = [
  { id: 'D0', when: 'D+0 a D+3', title: 'Reprecificar nos portais', cor: 'var(--g)', resp: 'Gestores de loja e pricing', desc: 'Classe A/B até 120 dias: ajustar para FIPE −2% a −4% nos portais e atualizar fotos e descrição.' },
  { id: 'D7', when: 'D+7', title: 'Campanha e superbônus', cor: 'var(--y)', resp: 'Gerentes comerciais', desc: 'Supercomissão de R$ 600 a R$ 1.000 para vendedores. Custa menos que 15 dias de CDI parado.' },
  { id: 'D14', when: 'D+14', title: 'Oferta para revendedor', cor: 'var(--o)', resp: 'Mesa de repasse e B2B', desc: 'Classe D/E acima de 120 dias e origem leilão: lotes casados (1 carro de giro + 2 críticos) a lojistas parceiros.' },
  { id: 'D21', when: 'D+21', title: 'Leilão ou transferência', cor: 'var(--r)', resp: 'Diretoria de operações', desc: 'Acima de 150 dias ou classe E: leilão ou redistribuição entre lojas para estancar 100% do CDI.' }
];

function carrosDoDegrau(idx) { return DADOS.veiculos.filter(c => degrauDe(c) === idx); }

function initSlide7() {
  const stepsContainer = document.getElementById('steps');
  if (!stepsContainer) return;

  stepsContainer.innerHTML = '';
  DEGRAUS.forEach((d, idx) => {
    const cs = carrosDoDegrau(idx);
    const cap = cs.reduce((a, c) => a + c.valorCompra, 0);
    const el = document.createElement('div');
    el.className = `step ${idx === curStep ? 'sel' : ''}`;
    el.style.setProperty('--c', d.cor);
    el.onclick = () => selectStep(idx);
    el.innerHTML = `
      <span class="when">${d.when}</span>
      <h4>${d.title}</h4>
      <p>${d.desc}</p>
      <div class="meta">
        <div>Capital a liberar<b>${fmtMM(cap)}</b></div>
        <div style="text-align:right">Chassis<b>${cs.length}</b></div>
      </div>
      <div class="resp">👤 ${d.resp}</div>
    `;
    stepsContainer.appendChild(el);
  });

  renderStepCapitalBar();
  renderStepList(curStep);
}

function selectStep(idx) {
  curStep = idx;
  document.querySelectorAll('.step').forEach((el, i) => el.classList.toggle('sel', i === idx));
  renderStepList(idx);
}

function renderStepCapitalBar() {
  const stBar = document.getElementById('stBar');
  const stTotal = document.getElementById('stTotal');
  if (!stBar) return;

  const k = crit();
  if (stTotal) stTotal.innerHTML = `Total dos ${k.n} críticos: <b style="color:var(--navy)">${fmtMM(k.cap)}</b>`;

  stBar.innerHTML = '';
  DEGRAUS.forEach((d, idx) => {
    const cs = carrosDoDegrau(idx);
    const cap = cs.reduce((a, c) => a + c.valorCompra, 0);
    if (!cap) return;
    const pct = (cap / k.cap) * 100;
    const seg = document.createElement('div');
    seg.style.cssText = `width:${pct}%;background:${d.cor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;cursor:pointer`;
    seg.innerText = pct >= 9 ? `${fmtPct(pct)} · ${cs.length} carros` : '';
    seg.onmouseenter = (e) => showTip(e, `<b>${d.when}: ${d.title}</b><br>${cs.length} chassis · ${fmtMM(cap)} (${fmtPct(pct)})`);
    seg.onmousemove = moveTip;
    seg.onmouseleave = hideTip;
    seg.onclick = () => selectStep(idx);
    stBar.appendChild(seg);
  });
}

function renderStepList(idx) {
  const d = DEGRAUS[idx];
  const list = document.getElementById('stList');
  const title = document.getElementById('stListT');
  const btnOpen = document.getElementById('stOpen');
  const filtroCarros = carrosDoDegrau(idx).sort((a, b) => b.dias - a.dias);

  if (title) title.innerText = `${d.when} · ${d.title}: ${filtroCarros.length} chassis${filtroCarros.length > 6 ? ' · os 6 de maior aging' : ''}`;
  if (btnOpen) btnOpen.onclick = () => {
    const fAcao = document.getElementById('fAcao');
    if (fAcao) { fAcao.value = ACOES[idx].k; aplicarFiltros(); }
    go('tabela');
  };

  if (!list) return;
  list.innerHTML = '';
  filtroCarros.slice(0, 6).forEach(c => {
    const item = document.createElement('div');
    item.style.cssText = `background:#F7F9FC;border:1px solid var(--line);border-left:4px solid ${d.cor};border-radius:8px;padding:8px 10px;cursor:pointer`;
    item.onclick = () => abrirModalCarro(DADOS.veiculos.indexOf(c));
    item.innerHTML = `
      <div style="font-weight:700;color:var(--navy);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.modelo}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--mut);margin-top:3px">
        <span>${c.placa} · ${c.marca} · ${fmtMoeda(c.valorCompra)}</span>
        <b style="color:var(--r)">${fmtNum(c.dias)}d</b>
      </div>
    `;
    list.appendChild(item);
  });
}

// -------------------------------------------------------------
// SLIDE: RAIO-X DA REDE
// -------------------------------------------------------------
let curRegional = null;

function heatColor(v, max, rgb) {
  const t = max > 0 ? Math.min(v / max, 1) : 0;
  return `rgba(${rgb},${(0.08 + t * 0.85).toFixed(2)})`;
}

function initRede() {
  const tb = document.getElementById('rxHeat');
  if (!tb) return;
  const regs = [...DADOS.regionais].sort((a, b) => b.capitalCritico - a.capitalCritico || b.pct60 - a.pct60);
  const mx = { cc: Math.max(...regs.map(r => r.capitalCritico)), p: Math.max(...regs.map(r => r.pct60)), a: Math.max(...regs.map(r => r.aging)) };
  const top = regs[0];
  const top3 = regs.slice(0, 3).reduce((a, r) => a + r.capitalCritico, 0);
  const k = crit();
  const t = document.getElementById('rxTitle');
  if (t) t.innerHTML = `3 de ${regs.length} regionais concentram <em>${Math.round(top3 / k.cap * 100)}% do capital acima de 90 dias</em>`;

  tb.innerHTML = `<tr><th>Regional</th><th>Veículos</th><th>Capital</th><th>Aging pond.</th><th>% &gt;60 dias</th><th>&gt;90 dias</th><th>Capital &gt;90</th></tr>` +
    regs.map(r => {
      const txt = (v, m) => v / m > 0.55 ? 'hc' : '';
      return `<tr class="row" data-r="${r.regional}" onclick="selRegional('${r.regional}')">
        <td class="rg">${r.regional}<small>${r.marca} · ${r.lojas} lojas</small></td>
        <td>${fmtNum(r.veiculos)}</td>
        <td>${fmtMM(r.capital)}</td>
        <td class="${txt(r.aging, mx.a)}" style="background:${heatColor(r.aging, mx.a, '21,69,120')}">${String(r.aging).replace('.', ',')} d</td>
        <td class="${txt(r.pct60, mx.p)}" style="background:${heatColor(r.pct60, mx.p, '232,131,58')}">${fmtPct(r.pct60)}</td>
        <td class="${txt(r.criticos, Math.max(...regs.map(x => x.criticos)))}" style="background:${heatColor(r.criticos, Math.max(...regs.map(x => x.criticos)), '132,24,34')}">${r.criticos}</td>
        <td class="${txt(r.capitalCritico, mx.cc)}" style="background:${heatColor(r.capitalCritico, mx.cc, '132,24,34')}">${r.capitalCritico ? fmtMM2(r.capitalCritico) : '—'}</td>
      </tr>`;
    }).join('');
  selRegional(top.regional);
}

function selRegional(reg) {
  curRegional = reg;
  document.querySelectorAll('#rxHeat tr.row').forEach(tr => tr.classList.toggle('sel', tr.dataset.r === reg));
  const r = DADOS.regionais.find(x => x.regional === reg);
  const dr = document.getElementById('rxDrawer');
  if (!r || !dr) return;
  const lojas = DADOS.lojas.filter(l => l.regional === reg).sort((a, b) => b.capitalCritico - a.capitalCritico || b.acima60 - a.acima60);
  const maxL = Math.max(...lojas.map(l => l.capitalCritico), 1);
  dr.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span class="badge" style="background:var(--navy)">Regional ${r.regional} · ${r.marca}</span>
      <span style="font-size:13px;font-weight:700;color:var(--mut)">${r.lojas} lojas · ${fmtNum(r.veiculos)} veíc</span>
    </div>
    <div class="kv" style="grid-template-columns:repeat(3,1fr);margin-bottom:10px">
      <div>Capital<b>${fmtMM(r.capital)}</b></div>
      <div>Aging pond.<b>${String(r.aging).replace('.', ',')} d</b></div>
      <div>&gt;90 dias<b style="color:var(--w)">${r.criticos} · ${fmtMM2(r.capitalCritico)}</b></div>
    </div>
    <h3 style="font-size:14px;margin:4px 0 2px">Lojas por capital acima de 90 dias</h3>
    <div style="flex:1;min-height:0;overflow:auto">
      ${lojas.slice(0, 6).map(l => `<div class="lrow">
        <span class="ln">${l.loja}</span><span class="lv">${l.capitalCritico ? fmtMM2(l.capitalCritico) : '—'}</span>
        <span class="ls">${l.veiculos} veíc · ${fmtMM(l.capital)} · aging ${String(l.aging).replace('.', ',')} d · ${l.acima60} acima de 60 d</span><span class="ls" style="text-align:right">${l.criticos} &gt;90 d</span>
        <div class="btrack"><div style="width:${l.capitalCritico / maxL * 100}%;background:var(--w)"></div></div>
      </div>`).join('')}
      ${lojas.length > 6 ? `<div style="font-size:12px;color:var(--mut2);padding-top:8px">+ ${lojas.length - 6} lojas com menor capital acima de 90 dias</div>` : ''}
    </div>
    ${r.criticos ? `<button class="btn" style="width:100%;margin-top:12px" onclick="filtrarRegional('${reg}')">Ver os ${r.criticos} chassis críticos da regional →</button>` : ''}
  `;
}

function filtrarRegional(reg) {
  limparFiltros();
  tabRegional = reg;
  aplicarFiltros();
  go('tabela');
}
let tabRegional = '';

// -------------------------------------------------------------
// SLIDE 8: TABELA DE CHASSIS CRÍTICOS (>90 DIAS)
// -------------------------------------------------------------
function initSlide8() {
  const fMarca = document.getElementById('fMarca');
  const fLoja = document.getElementById('fLoja');
  const fTipo = document.getElementById('fTipo');
  const fFaixa = document.getElementById('fFaixa');
  const fAcao = document.getElementById('fAcao');

  // Popula marcas
  if (fMarca) {
    const marcas = [...new Set(DADOS.veiculos.map(c => c.marca))].sort();
    fMarca.innerHTML = '<option value="">Todas as marcas</option>' + marcas.map(m => `<option value="${m}">${m}</option>`).join('');
    fMarca.onchange = aplicarFiltros;
  }

  // Popula lojas
  if (fLoja) {
    const lojas = [...new Set(DADOS.veiculos.map(c => c.empresa))].sort();
    fLoja.innerHTML = '<option value="">Todas as lojas</option>' + lojas.map(l => `<option value="${l}">${l}</option>`).join('');
    fLoja.onchange = aplicarFiltros;
  }

  // Popula tipos
  if (fTipo) {
    const tipos = [...new Set(DADOS.veiculos.map(c => c.tipoEstoque))].sort();
    fTipo.innerHTML = '<option value="">Todos os tipos de estoque</option>' + tipos.map(t => `<option value="${t}">${t}</option>`).join('');
    fTipo.onchange = aplicarFiltros;
  }

  // Popula faixas
  if (fFaixa) {
    fFaixa.innerHTML = `
      <option value="">Todas as subfaixas</option>
      <option value="91-120">91 a 120 dias</option>
      <option value="121-150">121 a 150 dias</option>
      <option value="151-180">151 a 180 dias</option>
      <option value=">180">>180 dias</option>
    `;
    fFaixa.onchange = aplicarFiltros;
  }

  // Popula ações
  if (fAcao) {
    fAcao.innerHTML = '<option value="">Todas as ações</option>' + ACOES.map(a => `<option value="${a.k}">${a.label}</option>`).join('');
    fAcao.onchange = aplicarFiltros;
  }

  const fBusca = document.getElementById('fBusca');
  if (fBusca) fBusca.oninput = aplicarFiltros;

  renderTableHeader();
  aplicarFiltros();
}

function renderTableHeader() {
  const tHead = document.getElementById('tHead');
  if (!tHead) return;

  const cols = [
    { id: 'marca', label: 'Marca' },
    { id: 'modelo', label: 'Modelo / Versão' },
    { id: 'placa', label: 'Placa' },
    { id: 'dias', label: 'Dias', r: true },
    { id: 'valorCompra', label: 'Compra', r: true },
    { id: 'cdi', label: 'CDI Est.', r: true },
    { id: 'fipe', label: 'FIPE Atual', r: true },
    { id: 'difFipe', label: 'Var. FIPE', r: true },
    { id: 'mesa', label: 'Mesa', c: true },
    { id: 'acao', label: 'Ação sugerida' }
  ];

  tHead.innerHTML = cols.map(c => {
    const isSorted = tabSortCol === c.id;
    const arrow = isSorted ? (tabSortAsc ? '▲' : '▼') : '⬍';
    const cls = `${c.r ? 'r ' : ''}${c.c ? 'c ' : ''}${isSorted ? 'sorted' : ''}`;
    return `<th class="${cls}" onclick="sortTabela('${c.id}')">${c.label} <span class="ar">${arrow}</span></th>`;
  }).join('');
}

function sortTabela(col) {
  if (tabSortCol === col) {
    tabSortAsc = !tabSortAsc;
  } else {
    tabSortCol = col;
    tabSortAsc = false;
  }
  tabPagina = 0;
  renderTableHeader();
  ordenarEExibir();
}

function aplicarFiltros() {
  const busca = (document.getElementById('fBusca')?.value || '').toLowerCase().trim();
  const fMarca = document.getElementById('fMarca')?.value || '';
  const fLoja = document.getElementById('fLoja')?.value || '';
  const fTipo = document.getElementById('fTipo')?.value || '';
  const fFaixa = document.getElementById('fFaixa')?.value || '';
  const fAcao = document.getElementById('fAcao')?.value || '';

  tabPagina = 0;
  tabFiltrados = DADOS.veiculos.filter(c => {
    if (busca && !c.modelo.toLowerCase().includes(busca) && !c.placa.toLowerCase().includes(busca) && !c.empresa.toLowerCase().includes(busca)) {
      return false;
    }
    if (fMarca && c.marca !== fMarca) return false;
    if (fLoja && c.empresa !== fLoja) return false;
    if (fTipo && c.tipoEstoque !== fTipo) return false;

    if (fFaixa) {
      if (fFaixa === '91-120' && (c.dias < 91 || c.dias > 120)) return false;
      if (fFaixa === '121-150' && (c.dias < 121 || c.dias > 150)) return false;
      if (fFaixa === '151-180' && (c.dias < 151 || c.dias > 180)) return false;
      if (fFaixa === '>180' && c.dias <= 180) return false;
    }

    if (fAcao && ACOES[degrauDe(c)].k !== fAcao) return false;
    if (tabRegional && c.regional !== tabRegional) return false;

    return true;
  });

  ordenarEExibir();
}

function ordenarEExibir() {
  const taxa = DADOS.premissas.taxaCDIDiaria;

  tabFiltrados.sort((a, b) => {
    let va = a[tabSortCol];
    let vb = b[tabSortCol];

    if (tabSortCol === 'cdi') {
      va = a.valorCompra * a.dias * taxa;
      vb = b.valorCompra * b.dias * taxa;
    }

    if (typeof va === 'string') {
      va = va.toLowerCase();
      vb = vb.toLowerCase();
    }

    if (va < vb) return tabSortAsc ? -1 : 1;
    if (va > vb) return tabSortAsc ? 1 : -1;
    return 0;
  });

  renderTableBody();
}

function renderTableBody() {
  const tBody = document.getElementById('tBody');
  const tFoot = document.getElementById('tFoot');
  const tTitle = document.getElementById('tTitle');
  if (!tBody) return;

  const taxa = DADOS.premissas.taxaCDIDiaria;
  const totCap = tabFiltrados.reduce((a, c) => a + c.valorCompra, 0);
  const totCdi = tabFiltrados.reduce((a, c) => a + (c.valorCompra * c.dias * taxa), 0);

  if (tTitle) {
    tTitle.innerHTML = `Mostrando ${tabFiltrados.length} de ${DADOS.veiculos.length} veículos críticos <em>(${fmtMM(totCap)} em capital)</em>${tabRegional ? ` · regional ${tabRegional} <button class="btn ghost" style="padding:4px 10px;font-size:12px;vertical-align:middle" onclick="tabRegional='';aplicarFiltros()">✕ limpar regional</button>` : ''}`;
  }

  if (tabFiltrados.length === 0) {
    tBody.innerHTML = `<tr><td colspan="10" class="empty">Nenhum veículo encontrado com os filtros selecionados.</td></tr>`;
    const pg = document.getElementById('tPager'); if (pg) pg.innerHTML = '';
    if (tFoot) tFoot.innerHTML = '';
    return;
  }

  const POR_PAG = 10;
  const nPag = Math.max(1, Math.ceil(tabFiltrados.length / POR_PAG));
  if (tabPagina >= nPag) tabPagina = nPag - 1;
  const pager = document.getElementById('tPager');
  if (pager) pager.innerHTML = `<button onclick="mudarPagina(-1)" ${tabPagina === 0 ? 'disabled' : ''}>‹</button><span>Página ${tabPagina + 1} de ${nPag}</span><button onclick="mudarPagina(1)" ${tabPagina >= nPag - 1 ? 'disabled' : ''}>›</button>`;
  tBody.innerHTML = tabFiltrados.slice(tabPagina * POR_PAG, (tabPagina + 1) * POR_PAG).map(c => {
    const cdi = c.valorCompra * c.dias * taxa;
    const ac = ACOES[degrauDe(c)];
    const acaoSug = ac.label;
    const acaoCor = ac.cor === 'var(--y)' ? '#8A6510' : ac.cor;

    return `
      <tr onclick="abrirModalCarro(${DADOS.veiculos.indexOf(c)})">
        <td data-l="Marca"><b>${c.marca}</b><div class="sm">${c.empresa}</div></td>
        <td data-l="Modelo" class="wide"><div class="mod">${c.modelo}</div><div class="sm">${c.ano} · ${fmtNum(c.km)} km · ${c.tipoEstoque}</div></td>
        <td data-l="Placa"><span class="pl">${c.placa}</span></td>
        <td data-l="Dias" class="r"><b style="color:${c.dias > 150 ? 'var(--w)' : (c.dias > 120 ? 'var(--r)' : 'var(--o)')}">${c.dias} d</b></td>
        <td data-l="Compra" class="r">${fmtMoeda(c.valorCompra)}</td>
        <td data-l="CDI Est." class="r" style="color:var(--r);font-weight:700">${fmtMoeda(cdi)}</td>
        <td data-l="FIPE Atual" class="r">${fmtMoeda(c.fipe)}</td>
        <td data-l="% vs FIPE" class="r" style="color:${c.difFipe < 0 ? 'var(--r)' : 'var(--g)'};font-weight:700">${c.difFipe > 0 ? '+' : ''}${c.difFipe.toFixed(1).replace('.', ',')}%</td>
        <td data-l="Mesa" class="c"><span class="mesa m${c.mesa}">${c.mesa}</span></td>
        <td data-l="Ação"><span class="chip" style="color:${acaoCor};font-weight:700">${acaoSug}</span></td>
      </tr>
    `;
  }).join('');

  if (tFoot) {
    tFoot.innerHTML = `
      <tr>
        <td colspan="3">Total filtrado (${tabFiltrados.length} chassis)</td>
        <td class="r">${(tabFiltrados.reduce((a,c)=>a+c.dias,0)/tabFiltrados.length).toFixed(0)} d méd</td>
        <td class="r">${fmtMoeda(totCap)}</td>
        <td class="r" style="color:var(--r)">${fmtMoeda(totCdi)}</td>
        <td colspan="4" style="text-align:right">Custo parado: <b>${fmtMoeda(totCap * taxa)}/dia</b></td>
      </tr>
    `;
  }
}

let tabPagina = 0;
function mudarPagina(d) { tabPagina = Math.max(0, tabPagina + d); renderTableBody(); }

function limparFiltros() {
  ['fBusca', 'fMarca', 'fLoja', 'fTipo', 'fFaixa', 'fAcao'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  tabRegional = '';
  aplicarFiltros();
}

function abrirModalCarro(idx) {
  const c = DADOS.veiculos[idx];
  if (!c) return;

  const taxa = DADOS.premissas.taxaCDIDiaria;
  const cdi = c.valorCompra * c.dias * taxa;
  const custoDia = c.valorCompra * taxa;

  const acaoSug = ACOES[degrauDe(c)].det;

  const mcTag = document.getElementById('mcTag');
  const mcTitle = document.getElementById('mcTitle');
  const mcBody = document.getElementById('mcBody');

  if (mcTag) mcTag.innerHTML = `<i></i>${c.marca} · ${c.placa} · ${c.dias} dias em estoque`;
  if (mcTitle) mcTitle.innerText = `${c.modelo} (${c.ano})`;

  if (mcBody) {
    mcBody.innerHTML = `
      <div class="kv">
        <div>Loja / Regional<b>${c.empresa} · ${c.regional}</b></div>
        <div>Tipo de Estoque<b>${c.tipoEstoque}</b></div>
        <div>Quilometragem<b>${fmtNum(c.km)} km</b></div>
        <div>Classificação da Mesa<b>Classe ${c.mesa}</b></div>
      </div>
      <table class="wf">
        <tr><td>Valor de Compra Contábil</td><td>${fmtMoeda(c.valorCompra)}</td></tr>
        <tr><td>Preço Público Anunciado</td><td>${c.precoPublico > 0 ? fmtMoeda(c.precoPublico) : '<span style="color:var(--o)">sem preço na planilha</span>'}</td></tr>
        <tr><td>Tabela FIPE Vigente</td><td>${fmtMoeda(c.fipe)} (${c.difFipe > 0 ? '+' : ''}${c.difFipe.toFixed(1).replace('.', ',')}% vs FIPE de avaliação)</td></tr>
        <tr><td>(−) CDI Acumulado até Hoje (${c.dias}d)</td><td style="color:var(--r)">− ${fmtMoeda(cdi)}</td></tr>
        <tr class="t"><td>Custo de Carregamento Diário</td><td style="color:var(--o)">${fmtMoeda(custoDia)} / dia</td></tr>
      </table>
      <div class="callout" style="margin-top:14px;border-left:4px solid var(--mint)">
        <b>Ação tática recomendada:</b><br>${acaoSug}
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn ghost" onclick="closeModal('mCarro')">Fechar</button>
        <button class="btn" onclick="carregarNoSimulador(${idx});closeModal('mCarro')">Simular no comparador de margem →</button>
      </div>
    `;
  }

  openModal('mCarro');
}

function carregarNoSimulador(idx) {
  const mCar = document.getElementById('mCar');
  if (mCar) mCar.value = idx;
  carregarCarroSim(idx);
  go('margem');
}

// -------------------------------------------------------------
// SLIDE: META E RITMO SEMANAL
// -------------------------------------------------------------
function planoMeta() {
  const sem = Math.max(1, DADOS.premissas.semanasPlano);
  const k = crit();
  const entr = DADOS.entrantes.slice(0, Math.min(sem, DADOS.entrantes.length));
  const capEntr = entr.reduce((a, e) => a + e.capital, 0);
  const nEntr = entr.reduce((a, e) => a + e.veiculos, 0);
  return {
    sem, k, entr, capEntr, nEntr,
    metaCap: (k.cap + capEntr) / sem,
    metaN: Math.ceil((k.n + nEntr) / sem)
  };
}
function lerRealizado(i) {
  try { return localStorage.getItem('caoa_v2_real_' + i) || ''; } catch (e) { return ''; }
}
function salvarRealizado(i, v) {
  try { localStorage.setItem('caoa_v2_real_' + i, v); } catch (e) {}
  renderMetaChart();
}

function initMeta() {
  const P = planoMeta();
  const t = document.getElementById('mtTitle');
  if (t) t.innerHTML = `Para zerar os &gt;90 dias em ${P.sem} semanas: <em>${fmtMM(P.metaCap)} e ${P.metaN} chassis por semana</em>`;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  set('mtHoje', fmtMM(P.k.cap));
  set('mtHojeS', `${P.k.n} chassis · ${fmtMoeda(P.k.cdiDia)}/dia de CDI`);
  const e4 = DADOS.entrantes.reduce((a, e) => a + e.capital, 0), n4 = DADOS.entrantes.reduce((a, e) => a + e.veiculos, 0);
  set('mtEntr', fmtMM(e4));
  set('mtEntrS', `${n4} chassis hoje entre 63 e 90 dias`);

  const tb = document.getElementById('mtTable');
  if (tb) {
    let acum = P.k.cap;
    tb.innerHTML = `<tr><td style="font-weight:800;color:var(--navy)">Semana</td><td style="text-align:right;font-weight:800;color:var(--navy)">Entram nos &gt;90</td><td style="text-align:right;font-weight:800;color:var(--navy)">Meta de saída</td><td style="text-align:right;font-weight:800;color:var(--navy)">Crítico ao fim</td></tr>` +
      Array.from({ length: P.sem }, (_, i) => {
        const e = DADOS.entrantes[i] || { veiculos: 0, capital: 0 };
        acum = Math.max(acum + e.capital - P.metaCap, 0);
        return `<tr><td>Semana ${i + 1}</td><td style="text-align:right;color:var(--o);font-weight:700">+${e.veiculos} · ${fmtMM(e.capital)}</td><td style="text-align:right;color:var(--g)">−${P.metaN} · ${fmtMM(P.metaCap)}</td><td style="text-align:right">${fmtMM(acum)}</td></tr>`;
      }).join('');
  }

  const inp = document.getElementById('mtInputs');
  if (inp) {
    inp.style.setProperty('--n', P.sem);
    inp.innerHTML = Array.from({ length: P.sem }, (_, i) =>
      `<div><label>Crítico real · sem. ${i + 1} (R$)</label><input type="number" min="0" step="10000" placeholder="ex: ${Math.round(P.k.cap * 0.8 / 1e4) * 1e4}" value="${lerRealizado(i)}" oninput="salvarRealizado(${i}, this.value)"></div>`
    ).join('');
  }
  const lg = document.getElementById('mtLegend');
  if (lg) lg.innerHTML = `<span><i style="background:var(--g)"></i>Meta</span><span><i style="background:var(--r);height:0;border-top:2px dashed var(--r)"></i>Sem ação</span><span><i style="background:var(--navy)"></i>Realizado</span>`;
  renderMetaChart();
}

function renderMetaChart() {
  const el = document.getElementById('mtChart');
  if (!el) return;
  const P = planoMeta();
  const W = 640, H = 300, x0 = 70, x1 = 610, y0 = 250, y1 = 26;
  const semAcao = [P.k.cap], meta = [P.k.cap];
  for (let i = 0; i < P.sem; i++) {
    const e = (DADOS.entrantes[i] || { capital: 0 }).capital;
    semAcao.push(semAcao[i] + e);
    meta.push(Math.max(meta[i] + e - P.metaCap, 0));
  }
  const real = [P.k.cap, ...Array.from({ length: P.sem }, (_, i) => { const v = parseFloat(lerRealizado(i)); return isNaN(v) ? null : v; })];
  const max = niceMax(Math.max(...semAcao, ...real.filter(v => v != null)) * 1.05, 4);
  const X = i => x0 + (x1 - x0) * i / P.sem, Y = v => y0 - (y0 - y1) * v / max;
  const path = arr => arr.map((v, i) => v == null ? null : `${X(i)},${Y(v)}`).filter(Boolean).join(' L ');
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;overflow:visible">
    <defs><linearGradient id="gGap" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#D64545" stop-opacity=".16"/><stop offset="1" stop-color="#D64545" stop-opacity=".02"/></linearGradient></defs>`;
  for (let g = 0; g <= 4; g++) {
    const v = max / 4 * g, y = Y(v);
    svg += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="var(--line)" ${g ? 'stroke-dasharray="4,4"' : 'stroke-width="2"'}/><text x="${x0 - 10}" y="${y + 4}" font-size="11" fill="var(--mut2)" text-anchor="end">${fmtEixo(v)}</text>`;
  }
  for (let i = 0; i <= P.sem; i++) svg += `<text x="${X(i)}" y="${y0 + 20}" font-size="12" font-weight="700" fill="var(--mut)" text-anchor="middle">${i ? 'Sem. ' + i : 'Hoje'}</text>`;
  const gap = `M ${path(semAcao)} L ${[...meta].map((v, i) => [X(i), Y(v)]).reverse().map(p => p.join(',')).join(' L ')} Z`;
  svg += `<path d="${gap}" fill="url(#gGap)"/>
    <path d="M ${path(semAcao)}" fill="none" stroke="var(--r)" stroke-width="2.5" stroke-dasharray="7,5"/>
    <path d="M ${path(meta)}" fill="none" stroke="var(--g)" stroke-width="3.5"/>`;
  const rp = path(real);
  if (real.filter(v => v != null).length > 1) svg += `<path d="M ${rp}" fill="none" stroke="var(--navy)" stroke-width="3"/>`;
  semAcao.forEach((v, i) => { if (i) svg += `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="#fff" stroke="var(--r)" stroke-width="2"/>`; });
  meta.forEach((v, i) => svg += `<circle cx="${X(i)}" cy="${Y(v)}" r="5" fill="var(--g)"/>`);
  real.forEach((v, i) => { if (v != null && i) svg += `<circle cx="${X(i)}" cy="${Y(v)}" r="6" fill="var(--navy)" stroke="#fff" stroke-width="2"/><text x="${X(i)}" y="${Y(v) - 11}" font-size="11" font-weight="800" fill="var(--navy)" text-anchor="middle">${fmtMM(v)}</text>`; });
  const last = P.sem;
  svg += `<text x="${X(last) - 6}" y="${Y(semAcao[last]) - 10}" font-size="12" font-weight="900" fill="var(--r)" text-anchor="end">Sem ação: ${fmtMM(semAcao[last])}</text>
    <text x="${X(last) - 6}" y="${Y(meta[last]) - 10}" font-size="12" font-weight="900" fill="var(--g)" text-anchor="end">Meta: ${fmtMM(meta[last])}</text>
    <text x="${X(0) + 8}" y="${Y(P.k.cap) - 10}" font-size="12" font-weight="900" fill="var(--navy)">${fmtMM(P.k.cap)}</text></svg>`;
  el.innerHTML = svg;
}

// -------------------------------------------------------------
// SLIDE: DECISÕES PARA O COMITÊ
// -------------------------------------------------------------
function decisoes() {
  const P = planoMeta();
  const nRev = carrosDoDegrau(2).length + carrosDoDegrau(3).length;
  return [
    { id: 'd1', title: 'Alçada comercial baseada em margem após CDI', desc: 'Autorizar gestores a conceder até 6% de desconto em veículos >90 dias sem aval da diretoria, desde que a margem econômica supere a de manter o carro por mais 30 dias.' },
    { id: 'd2', title: 'Meta semanal de liberação de caixa', desc: `Aprovar meta de desmobilização de <b>${fmtMM(P.metaCap)} por semana</b> (≈ ${P.metaN} chassis) até que os >90 dias caiam para menos de 3% do capital total.` },
    { id: 'd3', title: 'Destravamento imediato do canal revendedor (B2B)', desc: `Liberar os <b>${nRev} chassis</b> classificados para revendedor ou leilão para venda em lotes a parceiros em até 14 dias úteis.` },
    { id: 'd4', title: 'Ritual semanal de comitê de aging', desc: 'Reunião executiva fixa às terças-feiras, 09:00, com Vendas, Pricing e Controladoria, acompanhando chassi a chassi e o placar do slide de metas.' },
    { id: 'd5', title: 'Gatilho automático de reprecificação em D+45', desc: `Veículos que completarem 45 dias sem venda sofrem ajuste de preço para FIPE −2% — ataca os <b>${P.nEntr} carros</b> que chegariam aos 90 dias nas próximas ${P.sem} semanas.` }
  ];
}
function lerDecisoes() {
  try { return JSON.parse(localStorage.getItem('caoa_v2_decisoes') || '[true,true,true,true,true]'); } catch (e) { return [true, true, true, true, true]; }
}

function initSlide10() {
  const container = document.getElementById('resList');
  if (!container) return;
  const saved = lerDecisoes();
  container.innerHTML = decisoes().map((d, i) => {
    const isOk = saved[i] !== false;
    return `
      <div class="res ${isOk ? 'ok' : ''}" id="res-${d.id}">
        <div class="n">${i + 1}</div>
        <div style="flex:1"><h5>${d.title}</h5><p>${d.desc}</p></div>
        <button class="apr" onclick="toggleDecisao(${i})">${isOk ? '✓ Aprovado' : 'Homologar'}</button>
      </div>`;
  }).join('');
  updateDecisoesProgress();
}

function toggleDecisao(idx) {
  const saved = lerDecisoes();
  saved[idx] = !(saved[idx] !== false);
  try { localStorage.setItem('caoa_v2_decisoes', JSON.stringify(saved)); } catch (e) {}
  initSlide10();
}

function updateDecisoesProgress() {
  const saved = lerDecisoes();
  const n = decisoes().length;
  const count = saved.slice(0, n).filter(v => v !== false).length;
  const P = planoMeta();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  set('dCount', `${count} de ${n} decisões homologadas`);
  const bar = document.getElementById('dBar'); if (bar) bar.style.width = (count / n * 100) + '%';
  set('dKpis', `<div>Capital a liberar<b>${fmtMM(P.k.cap + P.capEntr)}</b></div><div>CDI evitado por dia<b>${fmtMoeda(P.k.cdiDia)}</b></div><div>Meta semanal<b>${fmtMM(P.metaCap)}</b></div><div>Prazo<b>${P.sem} semanas</b></div>`);
  set('dSum', `Com as diretrizes aprovadas, os <b>${fmtMM(P.k.cap)}</b> acima de 90 dias e os <b>${fmtMM(P.capEntr)}</b> que chegariam lá são desmobilizados em ${P.sem} semanas, liberando liquidez para recompor o giro de seminovos.`);
}

// -------------------------------------------------------------
// PREMISSAS GLOBAIS
// -------------------------------------------------------------
function openPremissas() {
  document.getElementById('pTaxa').value = (DADOS.premissas.taxaCDIDiaria * 100).toFixed(4);
  document.getElementById('pSem').value = DADOS.premissas.semanasPlano;
  document.getElementById('pDv').value = DADOS.premissas.despesaVarejo;
  document.getElementById('pDr').value = DADOS.premissas.despesaRevendedor;
  openModal('mPrem');
}

function salvarPremissas() {
  const taxa = parseFloat(document.getElementById('pTaxa').value) / 100;
  const sem = parseInt(document.getElementById('pSem').value) || 4;
  const dv = parseFloat(document.getElementById('pDv').value) || 1500;
  const dr = parseFloat(document.getElementById('pDr').value) || 500;

  if (!isNaN(taxa) && taxa > 0) DADOS.premissas.taxaCDIDiaria = taxa;
  DADOS.premissas.semanasPlano = sem;
  DADOS.premissas.despesaVarejo = dv;
  DADOS.premissas.despesaRevendedor = dr;

  closeModal('mPrem');

  // Recalcula tudo
  initSlide2();
  initSlide4();
  initSlide6();
  initSlide7();
  initMeta();
  initSlide10();
  aplicarFiltros();
}

function resetPremissas() {
  DADOS.premissas.taxaCDIDiaria = 0.000366;
  DADOS.premissas.semanasPlano = 4;
  DADOS.premissas.despesaVarejo = 1500;
  DADOS.premissas.despesaRevendedor = 500;
  salvarPremissas();
}

// -------------------------------------------------------------
// ATALHOS DE TECLADO E GESTOS TOUCH
// -------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    next();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    prev();
  } else if (e.key === 'i' || e.key === 'I') {
    openModal('mIndex');
  } else if (e.key === 'p' || e.key === 'P') {
    openPremissas();
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMobile();
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFS();
  } else if (e.key === 'Escape') {
    closeModal('mIndex');
    closeModal('mCarro');
    closeModal('mPrem');
  }
});

// Touch swipe
let tStartX = 0;
let tStartY = 0;
document.addEventListener('touchstart', (e) => {
  tStartX = e.changedTouches[0].screenX;
  tStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].screenX - tStartX;
  const dy = e.changedTouches[0].screenY - tStartY;
  if (Math.abs(dx) > 60 && Math.abs(dy) < 80) {
    if (dx < 0) next();
    else prev();
  }
}, { passive: true });

window.addEventListener('resize', setupScaling);

// -------------------------------------------------------------
// INICIALIZAÇÃO GERAL
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initIndexModal();
  initQR();
  initSlide1();
  initSlide2();
  initSlide3();
  initSlide4();
  initSlide5();
  initRede();
  initSlide6();
  initSlide7();
  initSlide8();
  initMeta();
  initSlide10();

  // Verifica URL param ?mobile=1
  const params = new URLSearchParams(window.location.search);
  if (params.get('mobile') === '1') {
    toggleMobile();
  } else {
    setupScaling();
  }

  updateUI();
});

