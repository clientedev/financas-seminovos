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
  const scale = Math.min((vw - 32) / 1600, (vh - 20) / 900);
  stage.style.transform = `scale(${Math.max(scale, 0.25)})`;
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
    else if (key === 'cdiMil') {
      const critCdi = DADOS.veiculos.reduce((acc, c) => acc + (c.valorCompra * c.dias * DADOS.premissas.taxaCDIDiaria), 0);
      target = critCdi / 1e3;
      isDecimal = true;
    }

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
      targetUrl = window.location.href + (window.location.search ? '&' : '?') + 'mobile=1';
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
  if (s2title) s2title.innerHTML = `76 carros = ${pctCap}% do capital; o plano é tratá-los chassi a chassi`;

  const s2cdiSub = document.getElementById('s2cdiSub');
  if (s2cdiSub) s2cdiSub.innerText = `${critVeic} carros · média ${fmtMoeda(cdiTotal / critVeic)} / chassi`;

  const s2ppt = document.getElementById('s2ppt');
  if (s2ppt) s2ppt.innerText = `${fmtNum(DADOS.pptFinanceiro.veiculos)} veículos Liberado (${fmtMM(DADOS.pptFinanceiro.capital)}, CDI ${fmtMM(DADOS.pptFinanceiro.cdi)}, aging ${DADOS.pptFinanceiro.aging} d)`;

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
      seg.style.background = f.id === '0-30' ? 'var(--g)' : (f.id === '31-45' ? 'var(--y)' : (f.id === '46-60' ? 'var(--o)' : (f.id === '61-90' ? 'var(--r)' : 'var(--w)')));
      seg.style.cursor = 'pointer';
      seg.setAttribute('data-tip', '');
      seg.onmouseenter = (e) => showTip(e, `<b>${f.faixa} (${f.regua})</b><br>${fmtNum(f.veiculos)} carros · ${fmtMM(f.capital)} (${fmtPct(pct)})<br>Aging médio: ${f.aging} dias`);
      seg.onmousemove = moveTip;
      seg.onmouseleave = hideTip;
      seg.onclick = () => { selectFunnelStage(f.id); go(2); };
      s2bar.appendChild(seg);

      const leg = document.createElement('div');
      leg.style.display = 'flex';
      leg.style.alignItems = 'center';
      leg.style.gap = '6px';
      leg.style.fontSize = '12px';
      leg.style.color = 'var(--mut)';
      leg.style.cursor = 'pointer';
      leg.onclick = () => { selectFunnelStage(f.id); go(2); };
      leg.innerHTML = `<span class="dot" style="background:${seg.style.background}"></span> <b>${f.faixa}</b>: ${fmtMM(f.capital)} (${fmtPct(pct)})`;
      s2legend.appendChild(leg);
    });
  }

  // Callout da síntese
  const s2callout = document.getElementById('s2callout');
  if (s2callout) {
    const ate45Cap = DADOS.funil.filter(f => f.id === '0-30' || f.id === '31-45').reduce((acc, f) => acc + f.capital, 0);
    const ate45Pct = ((ate45Cap / DADOS.total.capital) * 100).toFixed(0);
    s2callout.innerHTML = `<b>Diagnóstico central:</b> <b>${ate45Pct}% do capital</b> está em até 45 dias de estoque (faixa normal e atenção). O risco não está no estoque como um todo, mas nos <b>76 veículos críticos acima de 90 dias (R$ 7,7 MM)</b> que consom R$ 2.810 de CDI por dia e devem ser desmobilizados de imediato.`;
  }

  // Marcas
  const s2brands = document.getElementById('s2brands');
  if (s2brands) {
    s2brands.innerHTML = '';
    const sorted = [...DADOS.marcas].sort((a, b) => b.capital - a.capital);
    sorted.forEach(m => {
      const pct = (m.capital / DADOS.total.capital) * 100;
      const bRow = document.createElement('div');
      bRow.className = 'brow';
      bRow.innerHTML = `
        <div class="bt"><span><b>${m.marca}</b> · ${fmtNum(m.veiculos)} veíc</span><b>${fmtMM(m.capital)} (${fmtPct(pct)})</b></div>
        <div class="btrack"><div style="width:${pct}%;background:var(--navy3)"></div></div>
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
  container.innerHTML = '';

  const maxCap = Math.max(...DADOS.funil.map(f => f.capital));

  DADOS.funil.forEach(f => {
    const cor = f.id === '0-30' ? 'var(--g)' : (f.id === '31-45' ? 'var(--y)' : (f.id === '46-60' ? 'var(--o)' : (f.id === '61-90' ? 'var(--r)' : 'var(--w)')));
    const pctL = Math.max((f.capital / maxCap) * 100, 32);

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
        <div class="fbar" style="width:${pctL}%;background:${cor};">
          <span class="fv">${fmtMM(f.capital)}</span>
          <span class="fq">${fmtNum(f.veiculos)} veículos<br><small style="font-weight:600;opacity:.9">${f.aging} d aging médio</small></span>
        </div>
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

  const cor = f.id === '0-30' ? 'var(--g)' : (f.id === '31-45' ? 'var(--y)' : (f.id === '46-60' ? 'var(--o)' : (f.id === '61-90' ? 'var(--r)' : 'var(--w)')));

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
    ${f.id === '>90' ? `<button class="btn" style="width:100%;margin-top:14px" onclick="go(7)">Ver lista nominal dos 76 chassis →</button>` : ''}
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

  const critCdi = DADOS.veiculos.reduce((acc, c) => acc + (c.valorCompra * c.dias * taxaDia), 0);
  const critCdiDia = DADOS.veiculos.reduce((acc, c) => acc + (c.valorCompra * taxaDia), 0);

  const s4crit = document.getElementById('s4crit');
  if (s4crit) {
    s4crit.innerHTML = `<b>Impacto real no estoque &gt;90 dias:</b> os 76 chassis já consumiram <b>${fmtMil(critCdi)}</b> em CDI acumulado e continuam custando <b>${fmtMoeda(critCdiDia)} por dia</b> de caixa da CAOA.`;
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
  const maxCdi = carroBase * 180 * taxa;

  let svg = `
    <svg viewBox="0 0 560 300" style="width:100%;height:100%;overflow:visible">
      <line x1="60" y1="240" x2="520" y2="240" stroke="var(--line)" stroke-width="2"/>
      <line x1="60" y1="170" x2="520" y2="170" stroke="var(--line)" stroke-dasharray="4,4"/>
      <line x1="60" y1="100" x2="520" y2="100" stroke="var(--line)" stroke-dasharray="4,4"/>
      <line x1="60" y1="30" x2="520" y2="30" stroke="var(--line)" stroke-dasharray="4,4"/>
      <text x="50" y="244" fill="var(--mut2)" font-size="11" text-anchor="end">R$ 0</text>
      <text x="50" y="174" fill="var(--mut2)" font-size="11" text-anchor="end">R$ 2.500</text>
      <text x="50" y="104" fill="var(--mut2)" font-size="11" text-anchor="end">R$ 5.000</text>
      <text x="50" y="34" fill="var(--mut2)" font-size="11" text-anchor="end">R$ 7.500</text>
  `;

  pontos.forEach((d, i) => {
    const cdi = carroBase * d * taxa;
    const h = (cdi / 7500) * 210;
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
  if (s5title) s5title.innerText = `Chery tem o maior volume (36 carros); HMB tem o maior aging médio (126 dias)`;

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
    s5calls.innerHTML = `
      <div class="callout bad"><b>Chery:</b> 36 veículos (R$ 3,66 MM) com aging médio de 116 dias. Representa <b>47% do capital crítico</b> — foco em volume e liberação de caixa.</div>
      <div class="callout warn"><b>Hyundai (HMB):</b> 18 veículos (R$ 1,70 MM) com <b>126 dias de aging médio</b> — o mais elevado da rede. Exige ação comercial urgente.</div>
      <div class="callout"><b>Changan:</b> 19 veículos (R$ 2,04 MM, 116 d). <b>Ford:</b> 3 veículos (R$ 0,27 MM, 122 d).</div>
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

  const marcas = ['Chery', 'Changan', 'HMB', 'Ford'];
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

  const maxVal = s5Modo === 'q' ? 40 : 4.0; // 40 veic ou R$ 4 MM

  let svg = `
    <svg viewBox="0 0 600 280" style="width:100%;height:100%;overflow:visible">
      <line x1="50" y1="230" x2="570" y2="230" stroke="var(--line)" stroke-width="2"/>
      <line x1="50" y1="165" x2="570" y2="165" stroke="var(--line)" stroke-dasharray="4,4"/>
      <line x1="50" y1="100" x2="570" y2="100" stroke="var(--line)" stroke-dasharray="4,4"/>
      <line x1="50" y1="35" x2="570" y2="35" stroke="var(--line)" stroke-dasharray="4,4"/>
      <text x="42" y="234" fill="var(--mut2)" font-size="11" text-anchor="end">0</text>
      <text x="42" y="169" fill="var(--mut2)" font-size="11" text-anchor="end">${s5Modo === 'q' ? '13 v' : 'R$ 1,3M'}</text>
      <text x="42" y="104" fill="var(--mut2)" font-size="11" text-anchor="end">${s5Modo === 'q' ? '26 v' : 'R$ 2,6M'}</text>
      <text x="42" y="39" fill="var(--mut2)" font-size="11" text-anchor="end">${s5Modo === 'q' ? '40 v' : 'R$ 4,0M'}</text>
  `;

  dadosM.forEach((dm, i) => {
    const x = 90 + i * 125;
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
  go(7);
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
      opt.innerText = `${c.modelo} (${c.placa}) · ${fmtMoeda(c.valorCompra)} · ${c.dias}d`;
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

  if (DADOS.veiculos.length > 0) carregarCarroSim(0);
}

function carregarCarroSim(idx) {
  const c = DADOS.veiculos[idx];
  if (!c) return;

  document.getElementById('mCompra').value = c.valorCompra;
  document.getElementById('mPreco').value = c.precoPublico;
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

  const allVals = [...valsV, margemR];
  const minM = Math.min(...allVals, -5000);
  const maxM = Math.max(...allVals, 10000);

  const scaleY = (v) => 170 - ((v - minM) / (maxM - minM)) * 140;

  let pathV = `M 60 ${scaleY(valsV[0])}`;
  for (let i = 1; i < diasArr.length; i++) {
    const x = 60 + i * 55;
    pathV += ` L ${x} ${scaleY(valsV[i])}`;
  }

  const yR = scaleY(margemR);

  let svg = `
    <svg viewBox="0 0 540 200" style="width:100%;height:100%;overflow:visible">
      <!-- Grid -->
      <line x1="60" y1="${scaleY(0)}" x2="500" y2="${scaleY(0)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3,3"/>
      <text x="50" y="${scaleY(0) + 4}" fill="var(--mut2)" font-size="10" text-anchor="end">0</text>

      <!-- Linha Revendedor (constante) -->
      <line x1="60" y1="${yR}" x2="500" y2="${yR}" stroke="var(--o)" stroke-width="2.5" stroke-dasharray="5,3"/>
      <text x="506" y="${yR + 4}" fill="var(--o)" font-size="11" font-weight="800">Revendedor: ${fmtMoeda(margemR)}</text>

      <!-- Curva Varejo -->
      <path d="${pathV}" fill="none" stroke="var(--blue)" stroke-width="3"/>
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
// SLIDE 7: PLANO DE REPRECIFICAÇÃO
// -------------------------------------------------------------
let curStep = 0;

const DEGRAUS = [
  { id: 'D0', when: 'D+0 a D+3', title: 'Reprecificar nos portais', cor: 'var(--g)', resp: 'Gestores de loja e pricing', metaMM: 2.5, desc: 'Ajustar para FIPE −2% a −4% nos portais (Webmotors) e atualizar fotos e descrição.' },
  { id: 'D7', when: 'D+7', title: 'Campanha e superbônus', cor: 'var(--y)', resp: 'Gerentes comerciais', metaMM: 2.0, desc: 'Supercomissão de R$ 600 a R$ 1.000 para vendedores. Custa menos que 15 dias de CDI parado.' },
  { id: 'D14', when: 'D+14', title: 'Oferta para revendedor', cor: 'var(--o)', resp: 'Mesa de repasse e B2B', metaMM: 2.0, desc: 'Ofertar lotes casados (1 filé + 2 críticos) a lojistas parceiros sem garantia de varejo.' },
  { id: 'D21', when: 'D+21', title: 'Leilão ou transferência', cor: 'var(--r)', resp: 'Diretoria de operações', metaMM: 1.2, desc: 'Despacho sumário para leilão ou redistribuição física entre filiais para estancar 100% do CDI.' }
];

function initSlide7() {
  const stepsContainer = document.getElementById('steps');
  if (!stepsContainer) return;

  stepsContainer.innerHTML = '';
  DEGRAUS.forEach((d, idx) => {
    const el = document.createElement('div');
    el.className = `step ${idx === curStep ? 'sel' : ''}`;
    el.style.setProperty('--c', d.cor);
    el.onclick = () => selectStep(idx);
    el.innerHTML = `
      <span class="when">${d.when}</span>
      <h4>${d.title}</h4>
      <p>${d.desc}</p>
      <div class="meta">
        <div>Meta de liberação<b>R$ ${d.metaMM.toFixed(1).replace('.', ',')} MM</b></div>
      </div>
      <div class="resp">👤 ${d.resp}</div>
    `;
    stepsContainer.appendChild(el);
  });

  // Barra de capital por degrau sugerido
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

  const critCap = DADOS.veiculos.reduce((a, c) => a + c.valorCompra, 0);
  if (stTotal) stTotal.innerText = `Total dos 76 críticos: ${fmtMM(critCap)}`;

  stBar.innerHTML = '';
  DEGRAUS.forEach(d => {
    const pct = (d.metaMM / 7.7) * 100;
    const seg = document.createElement('div');
    seg.style.width = pct + '%';
    seg.style.background = d.cor;
    seg.setAttribute('data-tip', '');
    seg.onmouseenter = (e) => showTip(e, `<b>${d.when}: ${d.title}</b><br>Meta de liberação: R$ ${d.metaMM.toFixed(1).replace('.', ',')} MM`);
    seg.onmousemove = moveTip;
    seg.onmouseleave = hideTip;
    stBar.appendChild(seg);
  });
}

function renderStepList(idx) {
  const d = DEGRAUS[idx];
  const list = document.getElementById('stList');
  const title = document.getElementById('stListT');
  const btnOpen = document.getElementById('stOpen');

  if (title) title.innerText = `Chassis prioritários para ${d.when} (${d.title})`;
  if (btnOpen) btnOpen.onclick = () => {
    const fAcao = document.getElementById('fAcao');
    if (fAcao) {
      if (idx === 0) fAcao.value = 'reprecificar';
      else if (idx === 1) fAcao.value = 'campanha';
      else fAcao.value = 'revendedor';
      aplicarFiltros();
    }
    go(7);
  };

  if (!list) return;
  list.innerHTML = '';

  // Seleciona amostra de carros compatíveis com a regra
  let filtroCarros = [];
  if (idx === 0) {
    filtroCarros = DADOS.veiculos.filter(c => ['A', 'B'].includes(c.mesa) && c.dias <= 120);
  } else if (idx === 1) {
    filtroCarros = DADOS.veiculos.filter(c => ['C'].includes(c.mesa) || (c.dias <= 120 && ['D', 'E'].includes(c.mesa)));
  } else {
    filtroCarros = DADOS.veiculos.filter(c => ['D', 'E'].includes(c.mesa) && c.dias > 120);
  }

  if (filtroCarros.length === 0) filtroCarros = DADOS.veiculos.slice(0, 6);

  filtroCarros.slice(0, 9).forEach(c => {
    const item = document.createElement('div');
    item.style.background = '#F4F6F9';
    item.style.border = '1px solid var(--line)';
    item.style.borderRadius = '8px';
    item.style.padding = '8px 10px';
    item.style.cursor = 'pointer';
    item.onclick = () => abrirModalCarro(DADOS.veiculos.indexOf(c));
    item.innerHTML = `
      <div style="font-weight:700;color:var(--navy);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.modelo}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--mut);margin-top:3px">
        <span>${c.placa} · ${c.marca}</span>
        <b style="color:var(--r)">${c.dias}d</b>
      </div>
    `;
    list.appendChild(item);
  });
}

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
    fAcao.innerHTML = `
      <option value="">Todas as ações</option>
      <option value="reprecificar">Reprecificar (−2% a −4%)</option>
      <option value="campanha">Campanha e bônus</option>
      <option value="revendedor">Revendedor / Leilão</option>
    `;
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
    { id: 'difFipe', label: '% vs FIPE', r: true },
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

    if (fAcao) {
      const isRev = (['D', 'E'].includes(c.mesa) && c.dias > 120) || c.tipoEstoque.includes('LEILAO');
      const isRep = ['A', 'B'].includes(c.mesa) && c.dias <= 120;
      if (fAcao === 'revendedor' && !isRev) return false;
      if (fAcao === 'reprecificar' && !isRep) return false;
      if (fAcao === 'campanha' && (isRev || isRep)) return false;
    }

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
    tTitle.innerText = `Mostrando ${tabFiltrados.length} de ${DADOS.veiculos.length} veículos críticos (${fmtMM(totCap)} em capital)`;
  }

  if (tabFiltrados.length === 0) {
    tBody.innerHTML = `<tr><td colspan="10" class="empty">Nenhum veículo encontrado com os filtros selecionados.</td></tr>`;
    if (tFoot) tFoot.innerHTML = '';
    return;
  }

  tBody.innerHTML = tabFiltrados.map(c => {
    const cdi = c.valorCompra * c.dias * taxa;
    const isRev = (['D', 'E'].includes(c.mesa) && c.dias > 120) || c.tipoEstoque.includes('LEILAO');
    const isRep = ['A', 'B'].includes(c.mesa) && c.dias <= 120;
    const acaoSug = isRev ? 'Revendedor / Leilão' : (isRep ? 'Reprecificar (−2% a −4%)' : 'Campanha e bônus');
    const acaoCor = isRev ? 'var(--r)' : (isRep ? 'var(--g)' : 'var(--o)');

    return `
      <tr onclick="abrirModalCarro(${DADOS.veiculos.indexOf(c)})">
        <td data-l="Marca"><b>${c.marca}</b><div class="sm">${c.empresa}</div></td>
        <td data-l="Modelo" class="wide"><div class="mod">${c.modelo}</div><div class="sm">${c.ano} · ${fmtNum(c.km)} km · ${c.tipoEstoque}</div></td>
        <td data-l="Placa"><span class="pl">${c.placa}</span></td>
        <td data-l="Dias" class="r"><b style="color:${c.dias > 150 ? 'var(--w)' : (c.dias > 120 ? 'var(--r)' : 'var(--o)')}">${c.dias} d</b></td>
        <td data-l="Compra" class="r">${fmtMoeda(c.valorCompra)}</td>
        <td data-l="CDI Est." class="r" style="color:var(--r);font-weight:700">${fmtMoeda(cdi)}</td>
        <td data-l="FIPE Atual" class="r">${fmtMoeda(c.fipe)}</td>
        <td data-l="% vs FIPE" class="r" style="color:${c.difFipe < 0 ? 'var(--g)' : 'var(--r)'};font-weight:700">${c.difFipe > 0 ? '+' : ''}${c.difFipe.toFixed(1).replace('.', ',')}%</td>
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

function limparFiltros() {
  ['fBusca', 'fMarca', 'fLoja', 'fTipo', 'fFaixa', 'fAcao'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  aplicarFiltros();
}

function abrirModalCarro(idx) {
  const c = DADOS.veiculos[idx];
  if (!c) return;

  const taxa = DADOS.premissas.taxaCDIDiaria;
  const cdi = c.valorCompra * c.dias * taxa;
  const custoDia = c.valorCompra * taxa;

  const isRev = (['D', 'E'].includes(c.mesa) && c.dias > 120) || c.tipoEstoque.includes('LEILAO');
  const isRep = ['A', 'B'].includes(c.mesa) && c.dias <= 120;
  const acaoSug = isRev ? 'Revendedor / Leilão (D+14)' : (isRep ? 'Reprecificar FIPE −3% no varejo' : 'Campanha de loja com superbônus');

  const mcTag = document.getElementById('mcTag');
  const mcTitle = document.getElementById('mcTitle');
  const mcBody = document.getElementById('mcBody');

  if (mcTag) mcTag.innerHTML = `<i></i>${c.marca} · ${c.placa} · ${c.dias} dias em estoque`;
  if (mcTitle) mcTitle.innerText = `${c.modelo} (${c.ano})`;

  if (mcBody) {
    mcBody.innerHTML = `
      <div class="kv">
        <div>Loja / Empresa<b>${c.empresa}</b></div>
        <div>Tipo de Estoque<b>${c.tipoEstoque}</b></div>
        <div>Quilometragem<b>${fmtNum(c.km)} km</b></div>
        <div>Classificação da Mesa<b>Classe ${c.mesa}</b></div>
      </div>
      <table class="wf">
        <tr><td>Valor de Compra Contábil</td><td>${fmtMoeda(c.valorCompra)}</td></tr>
        <tr><td>Preço Público Anunciado</td><td>${fmtMoeda(c.precoPublico)}</td></tr>
        <tr><td>Tabela FIPE Vigente</td><td>${fmtMoeda(c.fipe)} (${c.difFipe > 0 ? '+' : ''}${c.difFipe.toFixed(1).replace('.', ',')}% vs compra)</td></tr>
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
  go(5);
}

// -------------------------------------------------------------
// SLIDE 9: RESULTADOS DESDE 28/10
// -------------------------------------------------------------
function initSlide9() {
  const rRef = document.getElementById('rRef');
  if (rRef) {
    rRef.innerText = `${fmtNum(DADOS.pptFinanceiro.veiculos)} veíc Liberado · ${fmtMM(DADOS.pptFinanceiro.capital)} · CDI ${fmtMM(DADOS.pptFinanceiro.cdi)} (28/10)`;
  }

  // Carrega valores salvos do localStorage
  const savedCarros28 = localStorage.getItem('caoa_res_carros28') || '';
  const savedCap28 = localStorage.getItem('caoa_res_cap28') || '';
  const savedSaidas = localStorage.getItem('caoa_res_saidas') || '';
  const savedCapLib = localStorage.getItem('caoa_res_caplib') || '';

  renderResultsTable(savedCarros28, savedCap28, savedSaidas, savedCapLib);
  updateResultsChart();
}

function renderResultsTable(c28, cap28, saidas, capLib) {
  const table = document.getElementById('rTable');
  if (!table) return;

  const critVeic = DADOS.veiculos.length;
  const critCap = DADOS.veiculos.reduce((a, c) => a + c.valorCompra, 0);

  table.innerHTML = `
    <tr>
      <td style="font-weight:700">Métrica (&gt;90 dias)</td>
      <td style="text-align:right;font-weight:700">28/10</td>
      <td style="text-align:right;font-weight:700">05/11 (Hoje)</td>
      <td style="text-align:right;font-weight:700">Variação</td>
    </tr>
    <tr>
      <td>Veículos críticos</td>
      <td style="text-align:right"><input class="tx num" id="rCar28" style="width:85px;text-align:right" placeholder="ex: 88" value="${c28}" oninput="salvarResInputs()"></td>
      <td style="text-align:right"><b>${critVeic}</b></td>
      <td style="text-align:right" id="rVarCar">—</td>
    </tr>
    <tr>
      <td>Capital crítico (R$)</td>
      <td style="text-align:right"><input class="tx num" id="rCap28" style="width:115px;text-align:right" placeholder="ex: 8.900.000" value="${cap28}" oninput="salvarResInputs()"></td>
      <td style="text-align:right"><b>${fmtMM(critCap)}</b></td>
      <td style="text-align:right" id="rVarCap">—</td>
    </tr>
    <tr>
      <td>Saídas no período (chassis)</td>
      <td style="text-align:right"><input class="tx num" id="rSaidas" style="width:85px;text-align:right" placeholder="ex: 12" value="${saidas}" oninput="salvarResInputs()"></td>
      <td style="text-align:right;color:var(--g)"><b>Meta: 19 / sem</b></td>
      <td style="text-align:right" id="rPctMeta">—</td>
    </tr>
    <tr>
      <td>Capital liberado no período</td>
      <td style="text-align:right"><input class="tx num" id="rCapLib" style="width:115px;text-align:right" placeholder="ex: 1.250.000" value="${capLib}" oninput="salvarResInputs()"></td>
      <td style="text-align:right;color:var(--g)"><b>Meta: R$ 2,0 MM</b></td>
      <td style="text-align:right" id="rPctCapMeta">—</td>
    </tr>
  `;

  calcResVariacoes();
}

function salvarResInputs() {
  const c28 = document.getElementById('rCar28')?.value || '';
  const cap28 = document.getElementById('rCap28')?.value || '';
  const saidas = document.getElementById('rSaidas')?.value || '';
  const capLib = document.getElementById('rCapLib')?.value || '';

  localStorage.setItem('caoa_res_carros28', c28);
  localStorage.setItem('caoa_res_cap28', cap28);
  localStorage.setItem('caoa_res_saidas', saidas);
  localStorage.setItem('caoa_res_caplib', capLib);

  calcResVariacoes();
  updateResultsChart();
}

function calcResVariacoes() {
  const c28 = parseFloat(document.getElementById('rCar28')?.value) || 0;
  const cap28 = parseFloat(document.getElementById('rCap28')?.value) || 0;
  const saidas = parseFloat(document.getElementById('rSaidas')?.value) || 0;
  const capLib = parseFloat(document.getElementById('rCapLib')?.value) || 0;

  const critVeic = DADOS.veiculos.length;
  const critCap = DADOS.veiculos.reduce((a, c) => a + c.valorCompra, 0);

  const rVarCar = document.getElementById('rVarCar');
  if (rVarCar) {
    if (c28 > 0) {
      const dif = critVeic - c28;
      rVarCar.innerHTML = `<b style="color:${dif <= 0 ? 'var(--g)' : 'var(--r)'}">${dif > 0 ? '+' : ''}${dif}</b>`;
    } else rVarCar.innerText = '—';
  }

  const rVarCap = document.getElementById('rVarCap');
  if (rVarCap) {
    if (cap28 > 0) {
      const dif = critCap - cap28;
      rVarCap.innerHTML = `<b style="color:${dif <= 0 ? 'var(--g)' : 'var(--r)'}">${dif > 0 ? '+' : ''}${fmtMM(dif)}</b>`;
    } else rVarCap.innerText = '—';
  }

  const rPctMeta = document.getElementById('rPctMeta');
  if (rPctMeta) {
    if (saidas > 0) {
      const pct = (saidas / 19) * 100;
      rPctMeta.innerHTML = `<b>${pct.toFixed(0)}% da meta</b>`;
    } else rPctMeta.innerText = '—';
  }

  const rPctCapMeta = document.getElementById('rPctCapMeta');
  if (rPctCapMeta) {
    if (capLib > 0) {
      const pct = (capLib / 2000000) * 100;
      rPctCapMeta.innerHTML = `<b>${pct.toFixed(0)}% da meta</b>`;
    } else rPctCapMeta.innerText = '—';
  }
}

function updateResultsChart() {
  const container = document.getElementById('rChart');
  const kpis = document.getElementById('rKpis');
  if (!container) return;

  const c28 = parseFloat(document.getElementById('rCar28')?.value) || 0;
  const critVeic = DADOS.veiculos.length;

  if (c28 === 0) {
    container.innerHTML = `
      <div style="height:100%;display:flex;align-items:center;justify-content:center;background:#F4F6F9;border-radius:12px;color:var(--mut);font-size:14px;text-align:center;padding:20px">
        Preencha os valores da coluna 28/10 na tabela ao lado para visualizar a evolução gráfica do estoque crítico.
      </div>
    `;
    if (kpis) kpis.innerHTML = '';
    return;
  }

  const maxV = Math.max(c28, critVeic) * 1.25;
  const h1 = (c28 / maxV) * 170;
  const h2 = (critVeic / maxV) * 170;

  container.innerHTML = `
    <svg viewBox="0 0 460 220" style="width:100%;height:100%;overflow:visible">
      <line x1="60" y1="180" x2="400" y2="180" stroke="var(--line)" stroke-width="2"/>
      
      <!-- Barra 28/10 -->
      <rect x="120" y="${180 - h1}" width="70" height="${h1}" rx="8" fill="var(--blue)"/>
      <text x="155" y="${180 - h1 - 8}" fill="var(--navy)" font-size="14" font-weight="900" text-anchor="middle">${c28} v</text>
      <text x="155" y="200" fill="var(--mut)" font-size="12" font-weight="700" text-anchor="middle">28/10</text>

      <!-- Barra 05/11 -->
      <rect x="270" y="${180 - h2}" width="70" height="${h2}" rx="8" fill="${critVeic <= c28 ? 'var(--g)' : 'var(--r)'}"/>
      <text x="305" y="${180 - h2 - 8}" fill="var(--navy)" font-size="14" font-weight="900" text-anchor="middle">${critVeic} v</text>
      <text x="305" y="200" fill="var(--mut)" font-size="12" font-weight="700" text-anchor="middle">05/11 (Hoje)</text>
    </svg>
  `;

  if (kpis) {
    const dif = critVeic - c28;
    kpis.innerHTML = `
      <div>Variação líquida<b style="color:${dif<=0?'var(--g)':'var(--r)'}">${dif>0?'+':''}${dif} veículos</b></div>
      <div>Ritmo semanal<b>~${Math.abs(dif)} veíc / sem</b></div>
      <div>Semanas para zerar<b>~${dif < 0 ? Math.ceil(critVeic / Math.abs(dif)) : '—'} sem</b></div>
    `;
  }
}

// -------------------------------------------------------------
// SLIDE 10: PEDIDO DE DECISÃO
// -------------------------------------------------------------
const DECISOES = [
  { id: 'd1', title: 'Alçada comercial baseada em margem após CDI', desc: 'Autorizar gestores a conceder até 6% de desconto em veículos >90d sem necessidade de aval da diretoria, desde que a margem econômica seja superior a manter o carro por mais 30 dias.' },
  { id: 'd2', title: 'Meta semanal de liberação de caixa', desc: 'Aprovar meta obrigatória de desmobilização de <b>R$ 2,0 MM por semana</b> nos estoques críticos até que os >90 dias caiam para menos de 3% do capital total.' },
  { id: 'd3', title: 'Destravamento imediato do canal revendedor (B2B)', desc: 'Liberar 30 chassis do tipo Leilão / Repasse para venda em lotes a revendedores parceiros em até 14 dias úteis.' },
  { id: 'd4', title: 'Ritual semanal de comitê de aging', desc: 'Reunião executiva fixa às terças-feiras às 09:00 com Vendas, Pricing e Controladoria para acompanhamento chassi a chassi.' },
  { id: 'd5', title: 'Gatilho automático de reprecificação em D+45', desc: 'Veículos que completarem 45 dias sem proposta firme sofrem ajuste compulsório de preço para FIPE −2%, estancando a entrada de novos carros nos >90 dias.' }
];

function initSlide10() {
  const container = document.getElementById('resList');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem('caoa_decisoes') || '[true, true, true, true, true]');

  container.innerHTML = DECISOES.map((d, i) => {
    const isOk = saved[i] !== false;
    return `
      <div class="res ${isOk ? 'ok' : ''}" id="res-${d.id}">
        <div class="n">${i + 1}</div>
        <div style="flex:1">
          <h5>${d.title}</h5>
          <p>${d.desc}</p>
        </div>
        <button class="apr" onclick="toggleDecisao(${i})">${isOk ? '✓ Aprovado' : 'Homologar'}</button>
      </div>
    `;
  }).join('');

  updateDecisoesProgress();
}

function toggleDecisao(idx) {
  const saved = JSON.parse(localStorage.getItem('caoa_decisoes') || '[true, true, true, true, true]');
  saved[idx] = !saved[idx];
  localStorage.setItem('caoa_decisoes', JSON.stringify(saved));

  const el = document.getElementById(`res-${DECISOES[idx].id}`);
  const btn = el.querySelector('.apr');
  if (saved[idx]) {
    el.classList.add('ok');
    btn.innerText = '✓ Aprovado';
  } else {
    el.classList.remove('ok');
    btn.innerText = 'Homologar';
  }

  updateDecisoesProgress();
}

function updateDecisoesProgress() {
  const saved = JSON.parse(localStorage.getItem('caoa_decisoes') || '[true, true, true, true, true]');
  const count = saved.filter(Boolean).length;
  const pct = (count / DECISOES.length) * 100;

  const dCount = document.getElementById('dCount');
  const dBar = document.getElementById('dBar');
  const dSum = document.getElementById('dSum');

  if (dCount) dCount.innerText = `${count} de ${DECISOES.length} resoluções homologadas`;
  if (dBar) dBar.style.width = pct + '%';
  if (dSum) {
    dSum.innerHTML = `Com a aprovação das diretrizes, o estoque crítico de <b>R$ 7,68 MM</b> será desmobilizado em 4 semanas, liberando liquidez imediata para recomposição do giro de seminovos.`;
  }
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
  initSlide6();
  initSlide7();
  initSlide8();
  initSlide9();
  initSlide10();

  // Verifica URL param ?mobile=1
  const params = new URLSearchParams(window.location.search);
  if (params.get('mobile') === '1' || window.innerWidth <= 820) {
    toggleMobile();
  } else {
    setupScaling();
  }

  updateUI();
});

