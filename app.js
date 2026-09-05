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
  }

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
    const source = $('#propos').value;
    for (const it of items) {
      let u = L.createUnite({ texteSource: source, texte: it.texte, categorie: it.categorie, origine });
      if (campCourant) u = { ...u, camp: campCourant };
      state = L.addUnite(state, u);
    }
    saveState(); renderJournal();
  }

  async function classer() {
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

  function renderDebriefing() { /* implémenté au Task 11 */ }

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
    $('#ouvrir-projection').addEventListener('click', () => window.open('projection.html', 'argumentactif-projection', 'width=1280,height=720'));

    window.addEventListener('beforeunload', (e) => {
      if (state.unites.length > 0 && !exportFait) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  window.ArgumentActifApp = { init, showVue };
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
