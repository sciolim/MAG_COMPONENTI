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
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
function ts(){ return new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') }

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

    // Fallback affidabile: doppio tap o long-press sulla riga = modifica
    let pressTimer;
    tr.addEventListener('touchstart', ()=>{ pressTimer = setTimeout(()=> openDialog(it), 500); }, {passive:true});
    tr.addEventListener('touchend', ()=> clearTimeout(pressTimer));
    tr.addEventListener('dblclick', ()=> openDialog(it));
  }
  totalQty.textContent = String(arr.reduce((s,i)=>s+(+i.quantity||0),0));
  totalItems.textContent = String(items.length);
}

// ====== Row menu (fixed) ======
function openRowMenu(anchorBtn, itemId){
  rowMenuItemId = itemId;
  const r = anchorBtn.getBoundingClientRect();
  rowMenu.style.left = Math.min(window.innerWidth - 180, r.left) + 'px';
  rowMenu.style.top = (r.bottom + 6 + window.scrollY) + 'px';
  rowMenu.classList.remove('hidden');
  rowMenu.setAttribute('aria-hidden','false');
}
function closeRowMenu(){ rowMenu.classList.add('hidden'); rowMenu.setAttribute('aria-hidden','true'); }

document.addEventListener('click', (e)=>{
  if (!rowMenu.contains(e.target) && !e.target.classList.contains('act')) closeRowMenu();
}, {passive:true});

// actions
rowMenu.querySelector('[data-edit]').addEventListener('click', () => {
  const id = rowMenuItemId; closeRowMenu();
  const it = items.find(x => x.id === id);
  if (it) openDialog(it);
});
rowMenu.querySelector('[data-del]').addEventListener('click', () => {
  const id = rowMenuItemId; closeRowMenu();
  if (confirm('Eliminare questo elemento?')) delItem(id);
});

// ====== CSV helpers (robust) ======
function detectDelimiter(headerLine){
  const candidates = [',',';','\t'];
  let best = ',', bestCount = 0;
  for (const d of candidates){
    const count = headerLine.split(d).length - 1;
    if (count > bestCount){ bestCount = count; best = d; }
  }
  return best;
}
function parseCSVSmart(text){
  // handle BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = detectDelimiter(firstLine);
  // Split rows by lines
  const rows = []; let i=0, cur='', inQ=false, row=[];
  while(i <= text.length){
    const ch = text[i] ?? '\n';
    if (inQ){
      if (ch === '"' && text[i+1] === '"'){ cur += '"'; i++; }
      else if (ch === '"'){ inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim){ row.push(cur); cur=''; }
      else if (ch === '\n' || i === text.length){ row.push(cur); rows.push(row); row=[]; cur=''; }
      else if (ch === '\r'){ /* ignore */ }
      else { cur += ch; }
    }
    i++;
  }
  return { rows, delim };
}

function exportCSV(){
  const headers = ['id','name','category','quantity','drawer','value','package','notes'];
  const lines = [headers.join(',')].concat(items.map(it => headers.map(h=>{
    const val = String(it[h] ?? '').replaceAll('"','""');
    return (val.includes(',')||val.includes('\n')||val.includes('"')) ? `"${val}"` : val;
  }).join(',')));
  download(lines.join('\n'), `archivio-componenti-${ts()}.csv`, 'text/csv;charset=utf-8;');
}
function exportJSON(){ download(JSON.stringify(items,null,2), 'archivio-componenti.json', 'application/json'); }
function download(text, name, type){
  try{
    const blob = new Blob([text],{type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel='noopener';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }catch(err){ alert('Impossibile scaricare: ' + (err?.message || err)); }
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
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open','');
}
document.getElementById('dlgClose').addEventListener('click', ()=> { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
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
  upsertItem(data);
  dlg.close ? dlg.close() : dlg.removeAttribute('open');
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

// ====== Import (robust headers & delimiters) ======
const fileImport = document.getElementById('fileImport');
fileImport.addEventListener('change', (e)=>{
  const file = e.target.files && e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    if (file.name.toLowerCase().endsWith('.json')){
      try{
        const data = JSON.parse(text);
        if(Array.isArray(data)) { items = data; saveItems(); render(); }
        else alert('JSON non valido: deve essere un array di oggetti');
      }catch(err){ alert('Errore JSON: ' + (err?.message || err)); }
    } else {
      const {rows} = parseCSVSmart(text);
      if (!rows.length) return;
      const headerRaw = rows[0].map(h => (h||'').trim());
      const headers = headerRaw.map(h => h.replace(/^\uFEFF/, '').toLowerCase());
      const H = new Map(headers.map((h,i)=>[h,i]));
      // mappa tollerante ai nomi
      const pick = (row, name, alts=[]) => {
        const n = [name, ...alts].map(s=>s.toLowerCase());
        for (const key of n){ if (H.has(key)) return row[H.get(key)] || ''; }
        return '';
      };
      const list = rows.slice(1).filter(r => r.some(x => (x||'').toString().trim() !== '')).map(r => ({
        id: pick(r,'id') || uid(),
        name: pick(r,'name',['nome']),
        category: pick(r,'category',['categoria']),
        quantity: Number(pick(r,'quantity',['qta','qty','quantita']).replace(',','.')) || 0,
        drawer: pick(r,'drawer',['cassetto','posizione','pos']),
        value: pick(r,'value',['valore']),
        package: pick(r,'package',['pkg','formato']),
        notes: pick(r,'notes',['note','descrizione']),
      }));
      items = list; saveItems(); render();
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ====== Filters ======
q.addEventListener('input', render);
onlyLow.addEventListener('change', render);

// ====== First render ======
render();
