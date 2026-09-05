'use strict';
(function () {
  const L = window.ArgumentActifLogic;
  const STORAGE_KEY = 'argumentactif.seance';
  const channel = ('BroadcastChannel' in window) ? new BroadcastChannel('argumentactif') : null;

  let state = loadState() || L.clearSeance({ sujet: '' });
  let config = { mode: 'manuel', proxyUrl: '', apiKey: '' };
  let campCourant = null;
  let exportFait = false;

  function loadState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    broadcast();
  }
  function broadcast() {
    const payload = { type: 'state', state };
    if (channel) channel.postMessage(payload);
    try { localStorage.setItem('argumentactif.ping', String(Date.now())); localStorage.removeItem('argumentactif.ping'); } catch {}
    pushToProjection();
  }

  // ── Vue Projection (fenêtre séparée, alimentée par postMessage) ──
  const PROJECTION_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>ArgumentActif — Projection</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#1e293b;color:#f8fafc;font-family:'Inter',system-ui,sans-serif;
       min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:2vh 4vw;box-sizing:border-box}
  #bandeau{font-size:1.4vw;line-height:1.4;text-align:center;opacity:.85;max-width:70ch;margin-bottom:3vh;border-bottom:1px solid #475569;padding-bottom:1.5vh}
  #courante{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:2vh}
  #courante .pastille{display:inline-flex;align-items:center;gap:1vw;font-size:2.6vw;font-weight:700;padding:.4em .8em;border-radius:.5em;background:#0f172a}
  #courante .dot{width:1.1em;height:1.1em;border-radius:50%}
  #courante .texte{font-size:2.2vw;max-width:40ch}
  #courante .camp{font-size:1.3vw;opacity:.75}
  #courante .verif{font-size:1.4vw;color:#fbbf24}
  #historique{display:flex;flex-direction:column;gap:1vh;opacity:.4;font-size:1.2vw;margin-top:2vh;max-width:50ch;text-align:center}
  #legende{margin-top:auto;display:flex;flex-wrap:wrap;gap:.6vw 1.4vw;justify-content:center;font-size:1vw;opacity:.7;padding-top:2vh}
  #legende span{display:inline-flex;align-items:center;gap:.4em}
  #legende i{width:.9em;height:.9em;border-radius:2px;display:inline-block}
  #vide{opacity:.5;font-size:1.6vw}
</style></head><body>
<div id="bandeau">Cet outil repère un type de mouvement de discours. Il ne juge ni la personne qui parle, ni la vérité de ce qui est dit.</div>
<div id="courante"><div id="vide">En attente du premier propos…</div></div>
<div id="historique"></div>
<div id="legende"></div>
<script>
  const TAX = ${JSON.stringify(L.TAXONOMY)};
  const leg = document.getElementById('legende');
  for (const k in TAX){ const s=document.createElement('span'); s.innerHTML='<i style="background:'+TAX[k].couleur+'"></i>'+TAX[k].libelle; leg.appendChild(s); }
  function render(state){
    const c = document.getElementById('courante'); const h = document.getElementById('historique');
    const us = (state && state.unites) || [];
    if (!us.length){ c.innerHTML='<div id="vide">En attente du premier propos…</div>'; h.innerHTML=''; return; }
    const last = us[us.length-1];
    const t = last.categorie==='non-classe' ? {libelle:'Non classé',couleur:'#94a3b8'} : TAX[last.categorie];
    c.innerHTML =
      '<div class="pastille"><span class="dot" style="background:'+t.couleur+'"></span>'+t.libelle+'</div>'+
      '<div class="texte">« '+esc(last.texte)+' »</div>'+
      (last.camp ? '<div class="camp">position : '+last.camp+'</div>' : '')+
      (last.aVerifier ? '<div class="verif">⚑ à vérifier par la classe</div>' : '');
    h.innerHTML = us.slice(-4,-1).reverse().map(function(u){
      var tt = u.categorie==='non-classe'?'Non classé':TAX[u.categorie].libelle;
      return '<div>'+tt+' — « '+esc(u.texte)+' »</div>';
    }).join('');
  }
  function esc(s){ return String(s).replace(/[&<>]/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[m];}); }
  const ch = ('BroadcastChannel' in window) ? new BroadcastChannel('argumentactif') : null;
  if (ch) ch.onmessage = function(e){ if (e.data && e.data.type==='state') render(e.data.state); };
  window.addEventListener('message', function(e){ if (e.data && e.data.type==='state') render(e.data.state); });
  try { render(JSON.parse(sessionStorage.getItem('argumentactif.seance'))); } catch(_) {}
  if (window.opener) window.opener.postMessage({type:'projection-ready'}, '*');
</script></body></html>`;

  let projectionWin = null;
  function ouvrirProjection() {
    const blob = new Blob([PROJECTION_HTML], { type: 'text/html' });
    projectionWin = window.open(URL.createObjectURL(blob), 'argumentactif-projection', 'width=1280,height=720');
  }
  function pushToProjection() {
    if (projectionWin && !projectionWin.closed) projectionWin.postMessage({ type: 'state', state }, '*');
  }
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'projection-ready') pushToProjection();
  });

  const $ = (s) => document.querySelector(s);
  const journalEl = () => $('#journal');

  function renderJournal() {
    const el = journalEl();
    el.innerHTML = '';
    for (const u of state.unites) el.appendChild(renderUnite(u));
  }

  function renderUnite(u) {
    const cat = u.categorie === 'non-classe' ? null : L.TAXONOMY[u.categorie];
    const li = document.createElement('li');
    li.style.borderColor = cat ? cat.couleur : '#999';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const selCat = document.createElement('select');
    for (const [k, v] of Object.entries(L.TAXONOMY)) {
      const o = document.createElement('option');
      o.value = k; o.textContent = v.libelle; selCat.appendChild(o);
    }
    const oNon = document.createElement('option');
    oNon.value = 'non-classe'; oNon.textContent = 'Non classé';
    selCat.appendChild(oNon);
    selCat.value = u.categorie;
    selCat.addEventListener('change', () => {
      state = L.reclassifyUnite(state, u.id, selCat.value);
      saveState(); renderJournal();
    });

    const selCamp = document.createElement('select');
    for (const [val, lab] of [['', '—'], ['pour', 'Pour'], ['contre', 'Contre'], ['autre', 'Autre']]) {
      const o = document.createElement('option'); o.value = val; o.textContent = lab; selCamp.appendChild(o);
    }
    selCamp.value = u.camp || '';
    selCamp.addEventListener('change', () => {
      state = L.setCamp(state, u.id, selCamp.value || null);
      saveState(); renderJournal();
    });

    const flag = document.createElement('button');
    flag.className = 'flag plai-btn';
    flag.textContent = u.aVerifier ? '⚑ marqué' : '⚑ à vérifier';
    flag.setAttribute('aria-pressed', String(u.aVerifier));
    flag.addEventListener('click', () => {
      state = L.toggleFlag(state, u.id); saveState(); renderJournal();
    });

    const heure = document.createElement('span');
    heure.textContent = (u.timestamp || '').slice(11, 16);

    meta.append(heure, selCat, selCamp, flag);
    if (u.editee) { const e = document.createElement('span'); e.textContent = '✎'; meta.appendChild(e); }

    const texte = document.createElement('div');
    texte.textContent = '« ' + u.texte + ' »';

    li.append(meta, texte);
    return li;
  }

  function buildGrille() {
    const g = $('#grille-categories');
    g.innerHTML = '';
    for (const [k, v] of Object.entries(L.TAXONOMY)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.borderColor = v.couleur;
      b.innerHTML = '<strong>' + v.libelle + '</strong><br><small>' + v.definition + '</small>';
      b.addEventListener('click', () => {
        const texte = $('#propos').value.trim();
        if (!texte) return;
        addUnitesFromTexts([{ texte, categorie: k }], 'manuel');
        $('#propos').value = '';
        $('#choix-manuel').hidden = true;
      });
      g.appendChild(b);
    }
  }

  function addUnitesFromTexts(items, origine) {
    stopEcoute();
    const source = $('#propos').value;
    for (const it of items) {
      let u = L.createUnite({ texteSource: source, texte: it.texte, categorie: it.categorie, origine });
      if (campCourant) u = { ...u, camp: campCourant };
      state = L.addUnite(state, u);
    }
    saveState(); renderJournal();
  }

  async function classer() {
    stopEcoute();
    const err = $('#regie-erreur');
    err.hidden = true;
    const texte = $('#propos').value.trim();
    if (!texte) return;
    if (config.mode === 'manuel') { $('#choix-manuel').hidden = false; return; }
    $('#classer').disabled = true;
    try {
      const req = L.buildClassifyRequest({ ...config, texte, sujet: state.sujet });
      const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
      const data = await r.json();
      if (!r.ok) throw new Error('Le modèle a renvoyé une erreur.');
      const payload = config.mode === 'cle'
        ? ((data.content && data.content[0] && data.content[0].text) || data)
        : data;
      const unites = L.parseModelResponse(payload);
      addUnitesFromTexts(unites, 'ia');
      $('#propos').value = '';
    } catch (e) {
      err.textContent = 'Classification automatique indisponible (' + (e.message || e) +
        '). Passe en mode manuel : clique « Ajouter manuellement… ».';
      err.hidden = false;
      $('#choix-manuel').hidden = false;
    } finally {
      $('#classer').disabled = false;
    }
  }

  function showVue(nom) {
    $('#vue-regie').hidden = nom !== 'regie';
    $('#vue-debriefing').hidden = nom !== 'debriefing';
    document.querySelectorAll('[data-vue]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vue === nom)));
    if (nom === 'debriefing') renderDebriefing();
  }

  function demarrer() {
    const sujet = $('#sujet').value.trim();
    state = { ...state, sujet };
    const modeInput = document.querySelector('input[name="mode"]:checked');
    config.mode = modeInput ? modeInput.value : 'manuel';
    config.proxyUrl = $('#proxyUrl').value.trim();
    config.apiKey = $('#apiKey').value.trim();
    if (config.mode !== 'manuel' && L.detectMode(config) === 'manuel') config.mode = 'manuel';
    $('#config').open = false;
    $('#pendant').hidden = false;
    $('#mode-actif').textContent = 'Mode actif : ' + config.mode;
    saveState();
  }

  function exporter() {
    const blob = new Blob([L.formatExport(state)], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'argumentactif-debriefing.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    exportFait = true;
  }

  function escapeHtml(s) { return String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

  function renderDebriefing() {
    const fCat = $('#f-categorie');
    if (fCat && fCat.options.length <= 1) {
      for (const [k, v] of Object.entries(L.TAXONOMY)) {
        const o = document.createElement('option'); o.value = k; o.textContent = v.libelle; fCat.appendChild(o);
      }
    }
    const catF = fCat ? fCat.value : '';
    const campF = $('#f-camp') ? $('#f-camp').value : '';
    const masque = $('#masquer-etiquettes').checked;
    $('.debrief').classList.toggle('masque', masque);

    const corps = $('#debrief-corps');
    corps.innerHTML = '';
    const filtrees = state.unites.filter((u) =>
      (!catF || u.categorie === catF) && (!campF || u.camp === campF));
    for (const u of filtrees) {
      const tr = document.createElement('tr');
      const cat = u.categorie === 'non-classe' ? null : L.TAXONOMY[u.categorie];
      const pistes = (L.SOCRATIC_BANK[u.categorie] || []).map((p) => '• ' + p).join('<br>');
      tr.innerHTML =
        `<td>${(u.timestamp || '').slice(11, 16)}</td>` +
        `<td>« ${escapeHtml(u.texte)} »</td>` +
        `<td class="etiquette-cell" style="border-left:6px solid ${cat ? cat.couleur : '#999'}">${cat ? cat.libelle : 'Non classé'}${u.aVerifier ? ' ⚑' : ''}</td>` +
        `<td>${u.camp || '—'}</td>` +
        `<td>${pistes}</td>`;
      corps.appendChild(tr);
    }
    const aVerif = state.unites.filter((u) => u.aVerifier).length;
    $('#debrief-compteur').textContent =
      `${filtrees.length} unité(s) affichée(s) · ${aVerif} à vérifier par les élèves · ${state.unites.length} au total.`;
  }

  // ── Reconnaissance vocale (optionnelle) ─────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null, ecoute = false;

  function initSpeech() {
    const btn = $('#micro'); const stat = $('#micro-status');
    if (!SR) {
      btn.hidden = true;
      stat.textContent = "Reconnaissance vocale non disponible sur ce navigateur — utilise la saisie clavier (Chrome/Edge la supportent).";
      return;
    }
    stat.textContent = "Dictée disponible. En classe bruyante, la saisie clavier reste plus fiable.";
    recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    let baseText = '';
    recognition.onresult = (e) => {
      let interim = '', fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (fin) baseText = (baseText + ' ' + fin).trim();
      $('#propos').value = (baseText + ' ' + interim).trim();
    };
    recognition.onerror = (e) => { stat.textContent = 'Erreur micro : ' + e.error + '. Passe au clavier.'; stopEcoute(); };
    recognition.onend = () => { if (ecoute) recognition.start(); };

    btn.addEventListener('click', () => {
      if (ecoute) { stopEcoute(); }
      else { baseText = $('#propos').value.trim(); ecoute = true; btn.textContent = '⏹ Arrêter'; recognition.start(); }
    });
  }
  function stopEcoute() {
    ecoute = false;
    const btn = $('#micro'); if (btn) btn.textContent = '🎤 Dicter';
    if (recognition) { try { recognition.stop(); } catch {} }
  }

  function init() {
    buildGrille();
    renderJournal();
    if (state.sujet) $('#sujet').value = state.sujet;
    if (state.unites.length) { $('#config').open = false; $('#pendant').hidden = false; }

    $('#demarrer').addEventListener('click', demarrer);
    $('#classer').addEventListener('click', classer);
    $('#ajouter-manuel').addEventListener('click', () => { $('#choix-manuel').hidden = !$('#choix-manuel').hidden; });
    $('#exporter').addEventListener('click', exporter);
    if ($('#exporter-2')) $('#exporter-2').addEventListener('click', exporter);
    $('#effacer').addEventListener('click', () => {
      if (!confirm('Effacer toute la séance ? Cette action est irréversible.')) return;
      state = L.clearSeance({ sujet: state.sujet });
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      renderJournal(); broadcast();
    });
    document.querySelectorAll('[data-vue]').forEach((b) => b.addEventListener('click', () => showVue(b.dataset.vue)));
    document.querySelectorAll('input[name="camp"]').forEach((rd) => rd.addEventListener('change', () => {
      campCourant = rd.value || null;
    }));
    $('#ouvrir-projection').addEventListener('click', ouvrirProjection);
    ['#f-categorie', '#f-camp', '#masquer-etiquettes'].forEach((s) => {
      const el = $(s); if (el) el.addEventListener('change', renderDebriefing);
    });

    window.addEventListener('beforeunload', (e) => {
      if (state.unites.length > 0 && !exportFait) { e.preventDefault(); e.returnValue = ''; }
    });

    initSpeech();
  }

  window.ArgumentActifApp = { init, showVue };
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
