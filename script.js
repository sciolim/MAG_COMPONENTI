// ====== Storage & Data ======
const LS_KEY = 'electro-inventory:v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

const SAMPLE = [
  { id: uid(), name: 'Resistenza 10kΩ', category: 'Resistenze', quantity: 120, drawer: 'A1', value: '10kΩ', package: '0805', notes: 'Pacco nuovo JLC' },
  { id: uid(), name: 'Condensatore 100nF', category: 'Condensatori', quantity: 85, drawer: 'A2', value: '0.1µF', package: '0603', notes: 'Ceramico X7R' },
  { id: uid(), name: 'ESP32-WROOM-32', category: 'MCU/Module', quantity: 6, drawer: 'B3', package: 'Module', notes: 'DevKit V1' },
  { id: uid(), name: 'LED 5mm Rosso', category: 'LED', quantity: 150, drawer: 'C1', value: '2.0V', package: 'THT', notes: 'Diffusi' },
];

let items = loadItems();

// ====== Elements ======
const tbody = document.getElementById('tbody');
const q = document.getElementById('q');
const onlyLow = document.getElementById('onlyLow');
const totalQty = document.getElementById('totalQty');
const totalItems = document.getElementById('totalItems');

// floating actions menu
const rowMenu = document.getElementById('rowMenu');
let rowMenuItemId = null;

// ====== Utils ======
function loadItems(){
  try{ const raw = localStorage.getItem(LS_KEY); if(!raw) return SAMPLE; const parsed = JSON.parse(raw); return Array.isArray(parsed)?parsed:SAMPLE; }catch{ return SAMPLE }
}
function saveItems(){ localStorage.setItem(LS_KEY, JSON.stringify(items)); }
function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
function ts(){ return new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') }

// ====== Helper IT ======
function _stripAcc(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function _lc(s){ return (s==null?'':String(s)).toLowerCase(); }
function _lcna(s){ return _stripAcc(_lc(s)); } // lower case no accent

// Mappa da JSON italiano -> oggetto interno
function normalizeItemFromItalianJSON(o){
  if (!o || typeof o !== 'object') return { id: uid(), name: '', category: '', quantity: 0, drawer: '', value: '', package: '', notes: '' };
  const map = {}; Object.keys(o).forEach(k => map[_lcna(k)] = k);
  const pick = (arr, def='') => {
    for (const key of arr){
      const kk = map[_lcna(key)];
      if (kk!=null && o[kk]!=null && o[kk] !== '') return String(o[kk]);
    }
    return def;
  };
  const qtyStr = pick(['quantità','quantita','qta','qtà','pezzi','quantity','qty'], '0').replace(',','.');
  return {
    id: pick(['id']) || uid(),
    name: pick(['nome','name']),
    category: pick(['categoria','category']),
    quantity: Number(qtyStr) || 0,
    drawer: pick(['cassetto','posizione','pos','drawer']),
    value: pick(['valore','value']),
    package: pick(['package','pkg','formato']),
    notes: pick(['note','descrizione','notes']),
  };
}

// Esporta in JSON IT (chiavi italiane)
function toItalianJSON(item){
  return {
    id: item.id,
    nome: item.name || '',
    categoria: item.category || '',
    'quantità': Number(item.quantity||0),
    cassetto: item.drawer || '',
    valore: item.value || '',
    package: item.package || '',
    note: item.notes || ''
  };
}


// ====== Render ======
function render(){
  const term = (q.value||'').trim().toLowerCase();
  let arr = items.slice();
  if (term) arr = arr.filter(it => [it.name,it.category,it.drawer,it.value,it.package,it.notes].some(v => (v||'').toLowerCase().includes(term)));
  if (onlyLow.checked) arr = arr.filter(it => (it.quantity||0) <= 5);
  arr.sort((a,b)=> (a.drawer||'').localeCompare(b.drawer||'') || (a.name||'').localeCompare(b.name||''));

  tbody.innerHTML = '';
  for (const it of arr){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-medium">${escapeHtml(it.name||'')}</td>
      <td>${escapeHtml(it.category||'')}</td>
      <td class="text-right"><span class="qty ${(+it.quantity||0) <= 5 ? 'low':''}">${it.quantity||0}</span></td>
      <td><span class="chip">${escapeHtml(it.drawer||'')}</span></td>
      <td>${escapeHtml(it.value||'')}</td>
      <td>${escapeHtml(it.package||'')}</td>
      <td style="max-width:28rem;white-space:pre-wrap">${escapeHtml(it.notes||'')}</td>
      <td class="actions"><button class="act btn ghost" aria-label="Azioni riga">⋮</button></td>`;
    tbody.appendChild(tr);

    const actBtn = tr.querySelector('.act');
    actBtn.addEventListener('click', (ev) => openRowMenu(ev.currentTarget, it.id));
    actBtn.addEventListener('touchend', (ev) => { ev.preventDefault(); ev.stopPropagation(); openRowMenu(ev.currentTarget, it.id); }, { passive: false });
  }
  totalQty.textContent = String(arr.reduce((s,i)=>s+(+i.quantity||0),0));
  totalItems.textContent = String(items.length);
}

// ====== Row menu (fixed) ======
function openRowMenu(anchorBtn, itemId){
  rowMenuItemId = itemId;

  // Mostra per misurare dimensioni
  rowMenu.classList.remove('hidden');
  rowMenu.style.visibility = 'hidden';
  rowMenu.style.left = '0px';
  rowMenu.style.top = '0px';

  const r = anchorBtn.getBoundingClientRect();
  const menuW = rowMenu.offsetWidth || 180;
  const menuH = rowMenu.offsetHeight || 100;
  const margin = 10;
  const vw = (window.innerWidth || document.documentElement.clientWidth);
  const vh = (window.innerHeight || document.documentElement.clientHeight);
  const sy = (window.scrollY || window.pageYOffset || 0);

  // Centro orizzontalmente rispetto al bottone ⋮
  let left = r.left + (r.width/2) - (menuW/2);
  // Clamp orizzontale
  left = Math.max(margin, Math.min(vw - menuW - margin, left));

  // Preferisci aprire sotto, ma se sfora, apri sopra
  let top = r.bottom + 8 + sy;
  if (top + menuH > sy + vh - margin) {
    top = r.top + sy - menuH - 8;
  }
  // Clamp verticale
  if (top < sy + margin) top = sy + margin;

  rowMenu.style.left = left + 'px';
  rowMenu.style.top = top + 'px';
  rowMenu.style.visibility = 'visible';
}
function closeRowMenu(){ rowMenu.classList.add('hidden'); rowMenuItemId = null }
document.addEventListener('click', (e)=>{ if (!rowMenu.contains(e.target) && !e.target.classList.contains('act')) closeRowMenu() }, {passive:true});
document.addEventListener('touchstart', (e)=>{ if (!rowMenu.contains(e.target) && !e.target.classList.contains('act')) closeRowMenu() }, {passive:true});

// actions
rowMenu.querySelector('[data-edit]').addEventListener('click', () => {
  closeRowMenu();
  const it = items.find(x => x.id === rowMenuItemId);
  if (it) openDialog(it);
});
rowMenu.querySelector('[data-del]').addEventListener('click', () => {
  closeRowMenu();
  if (confirm('Eliminare questo elemento?')) {
    delItem(rowMenuItemId);
  }
});

// ====== CSV helpers ======
function exportCSV(){
  const headers = ['id','name','category','quantity','drawer','value','package','notes'];
  const lines = [headers.join(',')].concat(items.map(it => headers.map(h=>{
    const val = String(it[h] ?? '').replaceAll('"','""');
    return (val.includes(',')||val.includes('\n')||val.includes('"')) ? `"${val}"` : val;
  }).join(',')));
  download(lines.join('\n'), `archivio-componenti-${ts()}.csv`, 'text/csv;charset=utf-8;');
}
function exportJSON(){ const itList = items.map(toItalianJSON); download(JSON.stringify(itList,null,2), 'archivio-componenti.json', 'application/json'); }
function download(text, name, type){
  try{
    const blob = new Blob([text],{type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.click();           // gesture dell'utente (funziona su Android)
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }catch(err){
    alert('Impossibile scaricare: ' + err?.message);
  }
}
function parseCSV(text){
  const rows=[]; let i=0, cur='', inQ=false, row=[]; while(i<=text.length){
    const ch = text[i] ?? '\n';
    if (inQ){ if (ch==='"' && text[i+1]==='"'){ cur+='"'; i++; } else if (ch === '"'){ inQ=false; } else { cur+=ch } }
    else { if (ch === '"') inQ=true; else if (ch===','){ row.push(cur); cur=''; } else if (ch === '\n' || i === text.length){ row.push(cur); rows.push(row); row=[]; cur=''; } else { cur+=ch } }
    i++;
  } return rows;
}

// ====== CRUD ======
function delItem(id){ items = items.filter(x => x.id !== id); saveItems(); render(); }
function upsertItem(data){
  const idx = items.findIndex(x => x.id === data.id);
  if (idx === -1) items.push(data); else items[idx] = data;
  saveItems(); render();
}

// ====== Dialog ======
const dlg = document.getElementById('dlg');
const dlgTitle = document.getElementById('dlgTitle');
const frm = document.getElementById('frm');
const f = id => document.getElementById(id);

function openDialog(initial){
  dlgTitle.textContent = initial ? 'Modifica componente' : 'Nuovo componente';
  f('f_id').value = initial?.id || uid();
  f('f_name').value = initial?.name || '';
  f('f_category').value = initial?.category || '';
  f('f_quantity').value = initial?.quantity ?? 0;
  f('f_drawer').value = initial?.drawer || '';
  f('f_value').value = initial?.value || '';
  f('f_package').value = initial?.package || '';
  f('f_notes').value = initial?.notes || '';
  dlg.showModal();
}
document.getElementById('dlgClose').addEventListener('click', ()=> dlg.close());
document.getElementById('dlgSave').addEventListener('click', (e)=>{
  e.preventDefault();
  if (!f('f_name').value.trim()) { alert('Inserisci un nome'); return; }
  const data = {
    id: f('f_id').value,
    name: f('f_name').value,
    category: f('f_category').value,
    quantity: Number(f('f_quantity').value||0),
    drawer: f('f_drawer').value,
    value: f('f_value').value,
    package: f('f_package').value,
    notes: f('f_notes').value,
  };
  upsertItem(data); dlg.close();
});

// ====== Topbar actions ======
document.getElementById('btnNew').addEventListener('click', ()=> openDialog(null));
document.getElementById('btnImport').addEventListener('click', ()=> document.getElementById('fileImport').click());
document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
document.getElementById('btnExportJSON').addEventListener('click', exportJSON);
document.getElementById('btnPrint').addEventListener('click', ()=> window.print());

// Reset & Clear
document.getElementById('btnReset').addEventListener('click', ()=> { q.value=''; onlyLow.checked=false; render(); });
document.getElementById('btnClear').addEventListener('click', ()=> { if (confirm("Svuotare completamente l'archivio?")) { items=[]; saveItems(); render(); } });

// ====== Import (ITALIANO priorità) ======
const fileImport = document.getElementById('fileImport');
fileImport.addEventListener('change', (e)=>{
  const file = e.target.files && e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const raw = String(reader.result || '').trim();

    // JSON (preferito)
    const looksJson = file.name.toLowerCase().endsWith('.json') || raw.startsWith('{') || raw.startsWith('[');
    if (looksJson){
      try{
        const data = JSON.parse(raw);
        if (Array.isArray(data)){
          items = data.map(normalizeItemFromItalianJSON);
          saveItems(); render();
        } else {
          alert('JSON non valido: deve essere un array');
        }
      }catch(err){
        alert('Errore JSON: ' + (err?.message || err));
      }
      e.target.value=''; return;
    }

    // CSV (fallback) - mappo intestazioni italiane -> interne
    const rows = parseCSV(raw);
    if (!rows.length){ e.target.value=''; return; }
    const headers = (rows[0]||[]).map(h => (h||'').toString().trim().toLowerCase());
    const H = new Map(headers.map((h,i)=>[h,i]));
    const pick = (row, it, alts=[]) => {
      const names = [it, ...alts].map(s=>s.toLowerCase());
      for (const nm of names){ if (H.has(nm)) return row[H.get(nm)] ?? ''; }
      return '';
    };
    const list = rows.slice(1).filter(r => r.some(x => (x||'').toString().trim() !== '')).map(r => ({
      id: pick(r,'id') || uid(),
      name: pick(r,'nome',['name']),
      category: pick(r,'categoria',['category']),
      quantity: Number((pick(r,'quantità',['quantita','qtà','qta','qty','quantity','pezzi'])||'').toString().replace(',','.')) || 0,
      drawer: pick(r,'cassetto',['posizione','pos','drawer']),
      value: pick(r,'valore',['value']),
      package: pick(r,'package',['pkg','formato']),
      notes: pick(r,'note',['descrizione','notes']),
    }));
    items = list; saveItems(); render();
  };
  reader.readAsText(file);
  e.target.value = '';
});
// ====== Filters ======
q.addEventListener('input', render);
onlyLow.addEventListener('change', render);

// ====== First render ======
render();

