import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase, type DocumentoEmesso } from './supabase';

function loadImage(src: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; resolve(null); }, timeoutMs);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = src;
  });
}

let _logoDataUrl: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl;
  const img = await loadImage('/IlGirasole-1.png', 5000);
  if (!img) return null;
  try {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = Math.round((img.height / img.width) * 200) || 64;
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    _logoDataUrl = c.toDataURL('image/png');
    return _logoDataUrl;
  } catch { return null; }
}

export async function generateInvoicePdf(doc: {
  docNumber: string;
  companyName: string;
  customerName: string;
  pivaCf: string;
  customerAddress: string;
  codiceUnivoco: string;
  description: string;
  total: number;
  paymentMethod: string;
  docDate: string;
  createdAt: string;
}): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = 190;
  const m = 10;

  // --- Extract sequential number ---
  const seq = doc.docNumber.split('-').pop() || '000';
  const seqNum = parseInt(seq, 10).toString();

  // --- Header: Logo left, Title right ---
  const logo = await getLogoDataUrl();
  if (logo) {
    try { pdf.addImage(logo, 'PNG', m, 8, 50, 16); } catch { /* logo skipped */ }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.text(`FATTURA n. ${seqNum}`, pw + m, 22, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text(new Date(doc.docDate).toLocaleDateString('it-IT'), pw + m, 30, { align: 'right' });

  // --- Gold separator ---
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.8);
  pdf.line(m, 36, pw + m, 36);

  // --- Customer info box ---
  const boxY = 44;
  const boxH = doc.codiceUnivoco ? 48 : 40;
  pdf.setFillColor(248, 245, 235);
  pdf.setDrawColor(212, 175, 55);
  pdf.roundedRect(m, boxY, pw, boxH, 3, 3, 'FD');

  pdf.setTextColor(80);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CLIENTE', m + 4, boxY + 5);

  pdf.setTextColor(30);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  let cy = boxY + 13;
  if (doc.companyName) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(doc.companyName, m + 4, cy);
    cy += 8;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.text(doc.customerName || '(non specificato)', m + 4, cy);
  cy += 8;

  // Right column inside box
  const rx = m + pw / 2;
  pdf.setFontSize(9);
  if (doc.pivaCf) {
    pdf.text(`P.IVA / C.F.:`, rx, boxY + 13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(doc.pivaCf, rx + 28, boxY + 13);
    pdf.setFont('helvetica', 'normal');
  }
  if (doc.codiceUnivoco) {
    pdf.text(`Cod. Univoco / PEC:`, rx, boxY + 23);
    pdf.setFont('helvetica', 'bold');
    pdf.text(doc.codiceUnivoco, rx + 34, boxY + 23);
    pdf.setFont('helvetica', 'normal');
  }
  if (doc.customerAddress) {
    pdf.text(`Indirizzo:`, rx, boxY + 33);
    pdf.setFont('helvetica', 'bold');
    pdf.text(doc.customerAddress, rx + 16, boxY + 33);
    pdf.setFont('helvetica', 'normal');
  }

  // Footer of info box
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.3);
  pdf.line(m + 4, boxY + boxH - 11, pw + m - 4, boxY + boxH - 11);
  pdf.setTextColor(80);
  pdf.setFontSize(9);
  pdf.text('Metodo di pagamento:', m + 4, boxY + boxH - 4);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30);
  pdf.text(doc.paymentMethod === 'contanti' ? 'Contanti' : 'Carta', m + 36, boxY + boxH - 4);

  // --- Description & Amount table ---
  let y = boxY + boxH + 12;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(80);
  pdf.text('DESCRIZIONE', m, y);

  const tableData = [[doc.description, `€ ${doc.total.toFixed(2)}`]];
  const tableResult = autoTable(pdf, {
    startY: y + 4,
    margin: { left: m, right: m },
    tableWidth: pw,
    head: [['Descrizione', 'Importo']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [212, 175, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
    },
    bodyStyles: { fontSize: 10, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: pw * 0.7, halign: 'left' },
      1: { cellWidth: pw * 0.3, halign: 'right' },
    },
  });

  const fy = (tableResult as any)?.lastFinalY || y + 16;

  // --- Total line ---
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.8);
  pdf.line(m, fy + 6, pw + m, fy + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(30);
  pdf.text('Totale', m, fy + 18);
  pdf.text(`€ ${doc.total.toFixed(2)}`, pw + m, fy + 18, { align: 'right' });

  // --- Footer ---
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(180);
  pdf.text('Documento generato da Risto POS', m, 285);

  return pdf.output('blob');
}

export async function uploadPdfToStorage(
  blob: Blob,
  docNumber: string
): Promise<string | null> {
  if (!supabase) return null;
  const fileName = `${docNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const { error } = await supabase.storage
    .from('archivio_documenti')
    .upload(fileName, blob, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (error) {
    console.error('Upload PDF error:', error);
    return null;
  }
  const { data: urlData } = supabase.storage
    .from('archivio_documenti')
    .getPublicUrl(fileName);
  return urlData?.publicUrl || null;
}

export async function saveDocumentMetadata(
  doc: Omit<DocumentoEmesso, 'id' | 'created_at'>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('documenti_emessi').insert([doc]);
  if (error) {
    if (import.meta.env.DEV) console.error('Save document error:', error);
    return false;
  }
  return true;
}

export async function deleteDocument(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('documenti_emessi').delete().eq('id', id);
  if (error) {
    if (import.meta.env.DEV) console.error('Delete document error:', error);
    return false;
  }
  return true;
}

export async function fetchDocuments(): Promise<DocumentoEmesso[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('documenti_emessi')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    if (import.meta.env.DEV) console.error('Fetch documents error:', error);
    return [];
  }
  return data as DocumentoEmesso[];
}

export async function fetchCompletedOrders(): Promise<{ id: string; nome_cliente: string; totale: number; created_at: string }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ordini')
    .select('id, nome_cliente, totale, created_at')
    .eq('status', 'COMPLETATO')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    if (import.meta.env.DEV) console.error('Fetch completed orders error:', error);
    return [];
  }
  return data;
}

export function generateDocNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const seq = localStorage.getItem('doc_number_seq') || '0';
  const next = parseInt(seq, 10) + 1;
  localStorage.setItem('doc_number_seq', String(next));
  return `Doc-${year}-${String(next).padStart(3, '0')}`;
}

export async function fetchUniqueCustomers(): Promise<{ customer_name: string; piva_cf: string; customer_address: string; company_name: string }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('documenti_emessi')
    .select('customer_name, piva_cf, customer_address, company_name')
    .order('customer_name', { ascending: true });
  if (error) {
    if (import.meta.env.DEV) console.error('Fetch customers error:', error);
    return [];
  }
  const seen = new Set<string>();
  return data.filter((r: { customer_name: string; piva_cf: string; customer_address: string; company_name: string }) => {
    const key = `${r.customer_name}|${r.piva_cf}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
