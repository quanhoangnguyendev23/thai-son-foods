/**
 * Tạo file Excel .xlsx (Office Open XML) không cần thư viện ngoài — chạy được cả trên máy chủ (Node) lẫn trình duyệt.
 * - Đóng gói ZIP kiểu "stored" (không nén) + CRC32.
 * - Dòng tiêu đề in đậm, cố định khi cuộn, có bộ lọc (AutoFilter).
 * - Kiểu cột: text | number | money (#,##0) | date (dd/mm/yyyy hh:mm, giờ Việt Nam) | percent (0,0%).
 * Chuỗi luôn ghi dạng inline string nên không bao giờ bị Excel hiểu là công thức.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type XlsxColumnType = 'text' | 'number' | 'money' | 'date' | 'percent';

export type XlsxColumn = {
  header: string;
  /** Độ rộng cột (số ký tự) */
  width?: number;
  type?: XlsxColumnType;
};

export type XlsxSheet = {
  name: string;
  columns: XlsxColumn[];
  rows: unknown[][];
};

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Bỏ ký tự điều khiển không hợp lệ trong XML và thoát & < > " */
function xmlText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'
  );
}

function colName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Tên sheet: tối đa 31 ký tự, không chứa : \ / ? * [ ] */
function safeSheetName(name: string, used: Set<string>): string {
  let base = (name || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  base = candidate;
  return base;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ngày → số serial của Excel, quy về giờ Việt Nam (UTC+7) */
function toExcelDate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return (t + VN_OFFSET_MS) / 86400000 + 25569;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Chỉ số style trong styles.xml (cellXfs)
const STYLE = { default: 0, header: 1, money: 2, date: 3, percent: 4, number: 5 } as const;

function cellXml(ref: string, value: unknown, type: XlsxColumnType): string {
  if (type !== 'text') {
    const n = type === 'date' ? toExcelDate(value) : toNumber(value);
    if (n !== null) {
      const s = type === 'money' ? STYLE.money : type === 'date' ? STYLE.date : type === 'percent' ? STYLE.percent : STYLE.number;
      return `<c r="${ref}" s="${s}"><v>${n}</v></c>`;
    }
    if (value === null || value === undefined || value === '') return '';
  }
  const text = value === null || value === undefined ? '' : String(value);
  if (!text) return '';
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.columns;
  const lastCol = colName(Math.max(cols.length, 1) - 1);
  const lastRow = sheet.rows.length + 1;

  const colsXml = cols
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(6, Math.min(80, c.width ?? 16))}" customWidth="1"/>`)
    .join('');

  const headerCells = cols
    .map((c, i) => `<c r="${colName(i)}1" t="inlineStr" s="${STYLE.header}"><is><t xml:space="preserve">${xmlText(c.header)}</t></is></c>`)
    .join('');

  const bodyRows = sheet.rows
    .map((row, r) => {
      const rowNum = r + 2;
      const cells = cols.map((c, i) => cellXml(`${colName(i)}${rowNum}`, row[i], c.type ?? 'text')).join('');
      return `<row r="${rowNum}">${cells}</row>`;
    })
    .join('');

  return (
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (colsXml ? `<cols>${colsXml}</cols>` : '') +
    `<sheetData><row r="1">${headerCells}</row>${bodyRows}</sheetData>` +
    (cols.length ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : '') +
    '</worksheet>'
  );
}

const STYLES_XML =
  XML_HEAD +
  `<styleSheet xmlns="${NS_MAIN}">` +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/></numFmts>' +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '</fonts>' +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  // Nền tiêu đề: forest-100 (màu pha trắng của #22544C)
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE0E7E6"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// ---------------------------------------------------------------------------
// ZIP (stored, không nén)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStored(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // tên file UTF-8
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, f.data);
    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Tạo nội dung file .xlsx từ một hoặc nhiều sheet */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const enc = new TextEncoder();
  const used = new Set<string>();
  const list = sheets.length ? sheets : [{ name: 'Sheet1', columns: [], rows: [] }];
  const names = list.map((s) => safeSheetName(s.name, used));

  const contentTypes =
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    list
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('') +
    '</Types>';

  const rootRels =
    XML_HEAD +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>';

  const workbook =
    XML_HEAD +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
    names.map((n, i) => `<sheet name="${xmlText(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>';

  const workbookRels =
    XML_HEAD +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${list.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
    '</Relationships>';

  return zipStored([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels) },
    { name: 'xl/styles.xml', data: enc.encode(STYLES_XML) },
    ...list.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s)) })),
  ]);
}

/** (Trình duyệt) Tạo và tải file .xlsx */
export function downloadXlsx(filename: string, sheets: XlsxSheet[]): void {
  const bytes = buildXlsx(sheets);
  const blob = new Blob([bytes as BlobPart], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
