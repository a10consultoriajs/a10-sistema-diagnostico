// Exportação para Excel (SheetJS) e PDF (jsPDF + AutoTable). Bibliotecas locais, carregadas sob demanda.
import { farm } from './config.js';
import { fmtDateTime, nowISO, fmtNum } from './util.js';
import { toast } from './ui.js';

const loaded = {};
function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Não foi possível carregar ' + src)); document.head.appendChild(s); });
  return loaded[src];
}
const fileName = (title, ext) => `${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${nowISO().slice(0, 10)}.${ext}`;
let logoData = null;
async function logo() {
  if (logoData) return logoData;
  try {
    const blob = await (await fetch('assets/logo-pdf.jpg')).blob();
    logoData = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  } catch { logoData = null; }
  return logoData;
}
const cellText = (v) => v == null ? '' : typeof v === 'number' ? fmtNum(v, 2) : String(v);

export async function exportTable(kind, { title, subtitle = '', columns, rows, summary = [] }) {
  try {
    if (kind === 'xlsx') {
      await loadScript('vendor/xlsx.full.min.js');
      const aoa = [[`${farm().name} — ${title}`], subtitle ? [subtitle] : [], [`Gerado em ${fmtDateTime(nowISO())}`], [],
        ...(summary.length ? [...summary.map(([l, v]) => [l, v]), []] : []), columns, ...rows.map(r => r.map(v => v == null ? '' : v))].filter(r => r.length || true);
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = columns.map((c, i) => ({ wch: Math.min(40, Math.max(String(c).length, ...rows.slice(0, 200).map(r => String(r[i] ?? '').length)) + 2) }));
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30).replace(/[\\/?*[\]:]/g, ''));
      window.XLSX.writeFile(wb, fileName(title, 'xlsx'));
    } else if (kind === 'pdf') {
      await loadScript('vendor/jspdf.umd.min.js');
      await loadScript('vendor/jspdf.plugin.autotable.min.js');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const img = await logo();
      if (img) { doc.setFillColor(22, 20, 20); doc.rect(36, 24, 110, 74, 'F'); doc.addImage(img, 'JPEG', 40, 28, 102, 66); }
      doc.setFontSize(15); doc.setTextColor(18, 48, 29); doc.text(title, img ? 160 : 40, 48);
      doc.setFontSize(9.5); doc.setTextColor(90);
      doc.text(`${farm().name} · ${farm().city}`, img ? 160 : 40, 64);
      if (subtitle) doc.text(subtitle, img ? 160 : 40, 78);
      doc.text(`Gerado em ${fmtDateTime(nowISO())}`, W - 40, 48, { align: 'right' });
      let y = 110;
      if (summary.length) { doc.setTextColor(30); doc.setFontSize(10); doc.text(summary.map(([l, v]) => `${l}: ${cellText(v)}`).join('   ·   '), 40, y, { maxWidth: W - 80 }); y += 22; }
      doc.autoTable({
        head: [columns], body: rows.map(r => r.map(cellText)), startY: y, margin: { left: 36, right: 36 },
        styles: { fontSize: 8.5, cellPadding: 4 }, headStyles: { fillColor: [36, 85, 53] }, alternateRowStyles: { fillColor: [246, 243, 236] },
        didDrawPage: () => { doc.setFontSize(8); doc.setTextColor(140); doc.text(`Página ${doc.internal.getNumberOfPages()}`, W - 40, doc.internal.pageSize.getHeight() - 16, { align: 'right' }); },
      });
      doc.save(fileName(title, 'pdf'));
    }
  } catch (e) { console.error(e); toast('Falha ao exportar: ' + e.message, 'err'); }
}

export function downloadJSON(obj, name) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
