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
  #bandeau{font-size:1.4vw;line-height:1.4;text-align:center;opacity:.85;max-width:70ch;padding-bottom:1.2vh}
  #sujet{font-size:1.7vw;font-weight:600;text-align:center;max-width:70ch;margin-bottom:3vh;padding-bottom:1.5vh;border-bottom:1px solid #475569}
  #sujet:empty{display:none}
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
  #provenance{font-size:1.1vw;opacity:.7;text-align:center;margin-bottom:2vh}
  #lecture{flex:1;width:100%;max-width:80ch;overflow:auto;white-space:pre-wrap;font-size:1.5vw;line-height:1.5;background:#0f172a;border-radius:.6em;padding:2vh 2.5vw;box-sizing:border-box}
  #rappel-texte{font-size:1vw;opacity:.6;text-align:center;margin-bottom:1.5vh}
  [hidden]{display:none!important}
</style></head><body>
<div id="bandeau">Cet outil repère un type de mouvement de discours. Il ne juge ni la personne qui parle, ni la vérité de ce qui est dit.</div>
<div id="sujet"></div>
<div id="provenance"></div>
<div id="rappel-texte"></div>
<div id="lecture" hidden></div>
<div id="courante"><div id="vide">En attente du premier propos…</div></div>
<div id="historique"></div>
<div id="legende"></div>
<script>
  const TAX = ${JSON.stringify(L.TAXONOMY)};
  const leg = document.getElementById('legende');
  for (const k in TAX){ const s=document.createElement('span'); s.innerHTML='<i style="background:'+TAX[k].couleur+'"></i>'+TAX[k].libelle; leg.appendChild(s); }
  function render(state){
    const c = document.getElementById('courante');
    const h = document.getElementById('historique');
    const sujetEl = document.getElementById('sujet');
    const provEl = document.getElementById('provenance');
    const rappelEl = document.getElementById('rappel-texte');
    const lectureEl = document.getElementById('lecture');
    const legendeEl = document.getElementById('legende');
    sujetEl.textContent = (state && state.sujet) ? 'Débat : ' + state.sujet : '';
    const aTexte = !!(state && state.texteDepart);
    const enLecture = aTexte && state.phase === 'lecture';

    if (enLecture){
      provEl.textContent = state.sourceIA ? 'Texte proposé par : ' + state.sourceIA : '';
      lectureEl.textContent = state.texteDepart;
      lectureEl.hidden = false;
      rappelEl.textContent = '';
      c.hidden = true; h.hidden = true; legendeEl.hidden = true;
      return;
    }
    lectureEl.hidden = true; provEl.textContent = '';
    c.hidden = false; h.hidden = false; legendeEl.hidden = false;
    rappelEl.textContent = aTexte ? ('Texte de départ : ' + (state.sourceIA || 'réponse d\\'IA')) : '';

    const us = ((state && state.unites) || []).filter(function(u){ return u.origine !== 'texte-depart'; });
    if (!us.length){ c.innerHTML='<div id="vide">En attente du premier propos…</div>'; h.innerHTML=''; return; }
    const last = us[us.length-1];
    const t = last.categorie==='non-classe' ? {libelle:'Non classé',couleur:'#94a3b8'} : TAX[last.categorie];
    c.innerHTML =
      '<div class="pastille"><span class="dot" style="background:'+t.couleur+'"></span>'+t.libelle+'</div>'+
      '<div class="texte">« '+esc(last.texte)+' »</div>'+
      (last.camp ? '<div class="camp">position : '+esc(last.camp)+'</div>' : '')+
      (last.aVerifier ? '<div class="verif">⚑ à vérifier par la classe</div>' : '');
    h.innerHTML = us.slice(-4,-1).reverse().map(function(u){
      var tt = u.categorie==='non-classe'?'Non classé':TAX[u.categorie].libelle;
      return '<div>'+tt+' — « '+esc(u.texte)+' »</div>';
    }).join('');
  }
  function esc(s){ return String(s).replace(/[&<>]/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[m];}); }
  const ch = ('BroadcastChannel' in window) ? new BroadcastChannel('argumentactif') : null;
  if (ch) ch.onmessage = function(e){ if (e.data && e.data.type==='state') render(e.data.state); };
  // n'accepte l'état que de la fenêtre qui a ouvert la projection
  window.addEventListener('message', function(e){
    if (e.source && e.source !== window.opener) return;
    if (e.data && e.data.type==='state') render(e.data.state);
  });
  try { render(JSON.parse(sessionStorage.getItem('argumentactif.seance'))); } catch(_) {}
  if (window.opener) window.opener.postMessage({type:'projection-ready'}, '*');
</script></body></html>`;

  let projectionWin = null;
  function ouvrirProjection() {
    const blob = new Blob([PROJECTION_HTML], { type: 'text/html' });
    projectionWin = window.open(URL.createObjectURL(blob), 'argumentactif-projection', 'width=1280,height=720');
    if (!projectionWin) {
      alert('La fenêtre de projection a été bloquée par le navigateur. Autorise les pop-ups pour ce site, puis réessaie.');
    }
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
    for (const u of state.unites) {
      if (u.origine === 'texte-depart') continue;
      el.appendChild(renderUnite(u));
    }
  }

  function renderUnite(u) {
    const cat = u.categorie === 'non-classe' ? null : L.TAXONOMY[u.categorie];
    const li = document.createElement('li');
    li.style.borderColor = cat ? cat.couleur : '#999';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const selCat = document.createElement('select');
    selCat.setAttribute('aria-label', 'Catégorie de l’unité');
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
    selCamp.setAttribute('aria-label', 'Camp (position dans le débat, jamais un élève)');
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

    const retirer = document.createElement('button');
    retirer.className = 'retirer plai-btn';
    retirer.type = 'button';
    retirer.textContent = '✕';
    retirer.title = 'Retirer cette unité (mauvais clic, doublon…)';
    retirer.setAttribute('aria-label', 'Retirer cette unité');
    retirer.addEventListener('click', () => {
      state = L.removeUnite(state, u.id); saveState(); renderJournal();
    });

    meta.append(heure, selCat, selCamp, flag, retirer);
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
    if (origine !== 'texte-depart' && state.phase === 'lecture') {
      state = { ...state, phase: 'debat' };
    }
    const source = $('#propos').value;
    for (const it of items) {
      let u = L.createUnite({ texteSource: source, texte: it.texte, categorie: it.categorie, origine });
      if (campCourant) u = { ...u, camp: campCourant };
      state = L.addUnite(state, u);
    }
    saveState(); renderJournal(); majBoutonTexte();
  }

  async function classer() {
    stopEcoute();
    const err = $('#regie-erreur');
    err.hidden = true;
    const texte = $('#propos').value.trim();
    if (!texte) return;
    if (config.mode === 'manuel') { $('#choix-manuel').hidden = false; return; }
    $('#classer').disabled = true;
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), 20000);
    try {
      const req = L.buildClassifyRequest({ ...config, texte, sujet: state.sujet });
      const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: ctrl.signal });
      const data = await r.json();
      if (!r.ok) throw new Error('Le modèle a renvoyé une erreur.');
      // Le proxy relaie l'enveloppe Anthropic brute, comme le mode clé :
      // dans les deux cas le JSON du modèle est dans content[0].text.
      const payload = (data && data.content && data.content[0] && data.content[0].text) || data;
      const unites = L.parseModelResponse(payload);
      if (!unites.length) {
        err.textContent = 'Le modèle n\'a rien classé dans ce passage. Reformule, ou clique « Ajouter manuellement… ».';
        err.hidden = false;
        $('#choix-manuel').hidden = false;
        return; // on garde le texte saisi
      }
      addUnitesFromTexts(unites, 'ia');
      $('#propos').value = '';
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'délai dépassé (20 s)' : (e.message || e);
      err.textContent = 'Classification automatique indisponible (' + msg +
        '). Ton texte est conservé. Passe en mode manuel : clique « Ajouter manuellement… ».';
      err.hidden = false;
      $('#choix-manuel').hidden = false;
    } finally {
      clearTimeout(minuteur);
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
    const aTexteUnits = state.unites.some((u) => u.origine === 'texte-depart');
    const debatCommence = state.unites.some((u) => u.origine !== 'texte-depart');
    // ne pas écraser un texte de départ déjà annoté si le champ a été vidé
    const texteDepart = $('#texte-depart').value.trim() || (aTexteUnits ? state.texteDepart : '');
    const sourceIA = $('#source-ia').value.trim() || (aTexteUnits ? state.sourceIA : '');
    // rester en débat si des propos d'élèves ont déjà été classés (re-clic sur « Démarrer »)
    const phase = (texteDepart && !debatCommence) ? 'lecture' : 'debat';
    state = { ...state, sujet, texteDepart, sourceIA, phase };
    const modeInput = document.querySelector('input[name="mode"]:checked');
    config.mode = modeInput ? modeInput.value : 'manuel';
    config.proxyUrl = $('#proxyUrl').value.trim();
    config.apiKey = $('#apiKey').value.trim();
    if (config.mode !== 'manuel' && L.detectMode(config) === 'manuel') config.mode = 'manuel';
    // la clé ne reste pas dans le DOM : elle vit seulement dans `config` (mémoire de session)
    $('#apiKey').value = '';
    $('#config').open = false;
    $('#pendant').hidden = false;
    $('#mode-actif').textContent = 'Mode actif : ' + config.mode;
    saveState();
    majBoutonTexte();
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

  function ligneDebrief(u) {
    const tr = document.createElement('tr');
    const cat = u.categorie === 'non-classe' ? null : L.TAXONOMY[u.categorie];
    const pistes = (L.SOCRATIC_BANK[u.categorie] || []).map((p) => '• ' + escapeHtml(p)).join('<br>');
    const heure = u.origine === 'texte-depart' ? '—' : (u.timestamp || '').slice(11, 16);
    const camp = u.origine === 'texte-depart' ? '—' : escapeHtml(u.camp || '—');
    tr.innerHTML =
      `<td>${heure}</td>` +
      `<td>« ${escapeHtml(u.texte)} »</td>` +
      `<td class="etiquette-cell" style="border-left:6px solid ${cat ? cat.couleur : '#999'}">${cat ? escapeHtml(cat.libelle) : 'Non classé'}${u.aVerifier ? ' ⚑' : ''}</td>` +
      `<td>${camp}</td>` +
      `<td>${pistes}</td>`;
    return tr;
  }

  let grilleIaBuilt = false;
  function buildGrilleIa() {
    if (grilleIaBuilt) return;
    const g = $('#grille-categories-ia');
    if (!g) return;
    for (const [k, v] of Object.entries(L.TAXONOMY)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.borderColor = v.couleur;
      b.innerHTML = '<strong>' + v.libelle + '</strong><br><small>' + v.definition + '</small>';
      b.addEventListener('click', () => {
        const passage = $('#passage-ia').value.trim();
        if (!passage) return;
        const u = L.createUnite({ texteSource: state.texteDepart, texte: passage, categorie: k, origine: 'texte-depart' });
        state = L.addUnite(state, u);
        saveState();
        $('#passage-ia').value = '';
        renderDebriefing();
      });
      g.appendChild(b);
    }
    grilleIaBuilt = true;
  }

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

    const aTexte = !!(state.texteDepart && state.texteDepart.trim());
    $('#ref-texte-depart').hidden = !aTexte;
    $('#etiqueter-texte').hidden = !aTexte;
    if (aTexte) {
      buildGrilleIa();
      $('#ref-texte-titre').textContent = state.sourceIA
        ? 'Texte de départ (' + state.sourceIA + ')'
        : 'Texte de départ';
      $('#ref-texte-contenu').textContent = state.texteDepart;
    }

    // le filtre camp ne s'applique qu'au débat live (les unités du texte n'ont pas de camp)
    const passeCat = (u) => (!catF || u.categorie === catF);
    const duTexte = state.unites.filter((u) => u.origine === 'texte-depart' && passeCat(u));
    const duDebat = state.unites.filter((u) => u.origine !== 'texte-depart' && passeCat(u) && (!campF || u.camp === campF));

    const tbTexte = $('#debrief-texte');
    const tbDebat = $('#debrief-debat');
    tbTexte.innerHTML = '';
    tbDebat.innerHTML = '';

    if (aTexte) {
      const tr = document.createElement('tr');
      tr.className = 'section-titre';
      tr.innerHTML = '<th colspan="5">Mouvements repérés dans le texte de l\'IA (par la classe)</th>';
      tbTexte.appendChild(tr);
      if (!duTexte.length) {
        const vide = document.createElement('tr');
        vide.innerHTML = '<td colspan="5" class="aide">Aucun mouvement repéré dans le texte pour l\'instant.</td>';
        tbTexte.appendChild(vide);
      } else {
        for (const u of duTexte) tbTexte.appendChild(ligneDebrief(u));
      }
      const trD = document.createElement('tr');
      trD.className = 'section-titre';
      trD.innerHTML = '<th colspan="5">Mouvements des élèves pendant le débat</th>';
      tbDebat.appendChild(trD);
    }

    for (const u of duDebat) tbDebat.appendChild(ligneDebrief(u));

    const aVerif = state.unites.filter((u) => u.aVerifier).length;
    $('#debrief-compteur').textContent = aTexte
      ? `${duTexte.length} repéré(s) dans le texte · ${duDebat.length} mouvement(s) d'élèves affichés · ${aVerif} à vérifier`
      : `${duDebat.length} unité(s) affichée(s) · ${aVerif} à vérifier par les élèves · ${state.unites.length} au total.`;
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

  function majBoutonTexte() {
    const b = $('#remontrer-texte');
    if (!b) return;
    b.hidden = !state.texteDepart;
    b.textContent = state.phase === 'lecture' ? 'Reprendre le débat' : 'Remontrer le texte de départ';
  }
  function basculerPhase() {
    state = { ...state, phase: state.phase === 'lecture' ? 'debat' : 'lecture' };
    saveState(); majBoutonTexte();
  }

  function init() {
    buildGrille();
    renderJournal();
    if (state.sujet) $('#sujet').value = state.sujet;
    if (state.texteDepart) $('#texte-depart').value = state.texteDepart;
    if (state.sourceIA) $('#source-ia').value = state.sourceIA;
    if (state.texteDepart || state.unites.length) {
      $('#config').open = false;
      $('#pendant').hidden = false;
    }
    if (state.unites.length) {
      // Le mode d'accès n'est jamais persisté (clé en mémoire de session only).
      $('#mode-actif').textContent = 'Séance reprise — mode manuel. Rouvre « Avant le débat » pour re-choisir proxy/clé.';
    }
    majBoutonTexte();

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
    if ($('#remontrer-texte')) $('#remontrer-texte').addEventListener('click', basculerPhase);
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
