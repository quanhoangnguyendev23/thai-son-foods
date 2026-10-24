/**
 * Bộ phân tích tab INPUT DATA của Google Sheet tồn kho (thuần hàm, không phụ thuộc CSDL).
 *
 * Bố cục sheet:
 *  - Hàng tiêu đề: cột A "CH" (mã cửa hàng), B "SP" (mã sản phẩm), C "NH" (cờ nhập hàng trong ngày),
 *    các cột lô (hàng 1 = HSD màu cam, hàng 2 = NSX màu xanh), kế tiếp là Tổng Tồn và Last - update.
 *  - Các ngày ở hai hàng tiêu đề dịch dần theo thời gian => nhận biết lô theo NGÀY, không theo vị trí cột.
 */

export interface SheetWarning {
  code:
    | 'LOT_DATE_MISMATCH'
    | 'LOT_COLUMN_INCOMPLETE'
    | 'INVALID_CELL'
    | 'TOTAL_MISMATCH'
    | 'DUPLICATE_ROW'
    | 'INVALID_ROW';
  message: string;
  row?: number;
  col?: number;
}

export interface SheetLotColumn {
  col: number;
  nsx: string; // YYYY-MM-DD
  hsd: string; // YYYY-MM-DD
  valid: boolean;
}

export interface SheetLot {
  nsx: string;
  hsd: string;
  qty: number;
}

export interface SheetRow {
  rowNumber: number; // số hàng trên sheet (bắt đầu từ 1)
  ch: string;
  sp: string;
  nh: 0 | 1 | null;
  lots: SheetLot[]; // chỉ các lô có số lượng > 0
  sheetTotal: number | null; // số ở cột Tổng Tồn
  lastUpdate: string | null; // ISO có múi giờ +07:00
}

export interface ParsedSheet {
  ok: boolean;
  fatal?: string;
  lotColumns: SheetLotColumn[];
  rows: SheetRow[];
  warnings: SheetWarning[];
}

const MAX_QTY = 1_000_000;

export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') {
      cur += c;
    }
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "01/11/26" hoặc "01/11/2026" -> "2026-11-01"; sai định dạng hoặc ngày không tồn tại -> null */
export function parseSheetDate(raw: string | undefined): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/.exec(raw ?? '');
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += 2000;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** "24/10/26 13:42:34" -> "2026-10-24T13:42:34+07:00" (giờ Việt Nam) */
export function parseSheetDateTime(raw: string | undefined): string | null {
  const m = /^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(raw ?? '');
  if (!m) return null;
  const date = parseSheetDate(m[1]);
  if (!date) return null;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  const ss = Number(m[4] ?? 0);
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${date}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}+07:00`;
}

export function addDaysIso(iso: string, days: number): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Ngày hôm nay theo giờ Việt Nam dạng YYYY-MM-DD */
export function todayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Ô số lượng: rỗng = 0; số nguyên không âm (cho phép dấu chấm/phẩy ngăn cách nghìn); còn lại là ô sai */
function parseQty(raw: string | undefined): { value: number; bad: boolean } {
  const s = (raw ?? '').trim();
  if (s === '') return { value: 0, bad: false };
  let t: string | null = null;
  if (/^\d+$/.test(s)) t = s;
  else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) t = s.replace(/[.,]/g, '');
  if (t === null) return { value: 0, bad: true };
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n > MAX_QTY) return { value: 0, bad: true };
  return { value: n, bad: false };
}

function parseTotal(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (s === '') return null;
  const q = parseQty(s);
  return q.bad ? null : q.value;
}

export function parseSheetInventory(csv: string, opts: { shelfLifeDays: number }): ParsedSheet {
  const warnings: SheetWarning[] = [];
  const empty = (fatal: string): ParsedSheet => ({ ok: false, fatal, lotColumns: [], rows: [], warnings });

  const grid = parseCsv(csv);
  if (grid.length < 3) return empty('Sheet có quá ít dòng (cần hai hàng tiêu đề và ít nhất một dòng dữ liệu).');

  // Tìm hàng tiêu đề: ô đầu tiên là "CH"
  let hdr = -1;
  for (let i = 0; i < Math.min(grid.length, 6); i++) {
    if ((grid[i][0] ?? '').trim().toUpperCase() === 'CH') {
      hdr = i;
      break;
    }
  }
  if (hdr < 0 || hdr + 1 >= grid.length) return empty('Không tìm thấy hàng tiêu đề (ô "CH" ở cột A).');

  const hsdRow = grid[hdr];
  const nsxRow = grid[hdr + 1];
  const width = Math.max(hsdRow.length, nsxRow.length);

  // Cột lô = cột (từ cột D trở đi) có ngày ở CẢ hai hàng tiêu đề
  const lotColumns: SheetLotColumn[] = [];
  for (let c = 2; c < width; c++) {
    const hsd = parseSheetDate(hsdRow[c]);
    const nsx = parseSheetDate(nsxRow[c]);
    if (hsd && nsx) {
      const ok = daysBetweenIso(nsx, hsd) === opts.shelfLifeDays;
      if (!ok) {
        warnings.push({
          code: 'LOT_DATE_MISMATCH',
          col: c + 1,
          message: `Cột ${c + 1}: HSD ${hsd} không bằng NSX ${nsx} + ${opts.shelfLifeDays} ngày, bỏ qua lô này.`,
        });
      }
      lotColumns.push({ col: c, nsx, hsd, valid: ok });
    } else if (hsd || nsx) {
      warnings.push({
        code: 'LOT_COLUMN_INCOMPLETE',
        col: c + 1,
        message: `Cột ${c + 1}: chỉ có một trong hai ngày (HSD/NSX), bỏ qua cột này.`,
      });
    }
  }
  if (lotColumns.length === 0) return empty('Không tìm thấy cột lô nào (cần ngày HSD ở hàng 1 và NSX ở hàng 2).');

  const lastLotCol = Math.max(...lotColumns.map((l) => l.col));
  const totalCol = lastLotCol + 1;
  const updatedCol = lastLotCol + 2;

  const byKey = new Map<string, SheetRow>();
  for (let r = hdr + 2; r < grid.length; r++) {
    const line = grid[r];
    const ch = (line[0] ?? '').trim().toUpperCase();
    const sp = (line[1] ?? '').trim().toUpperCase();
    if (!ch && !sp) continue; // dòng trống
    if (!ch || !sp) {
      warnings.push({ code: 'INVALID_ROW', row: r + 1, message: `Dòng ${r + 1}: thiếu mã cửa hàng (CH) hoặc mã sản phẩm (SP).` });
      continue;
    }

    const nhRaw = (line[2] ?? '').trim();
    const nh: 0 | 1 | null = nhRaw === '1' ? 1 : nhRaw === '0' ? 0 : null;

    const lots: SheetLot[] = [];
    let sum = 0;
    for (const lc of lotColumns) {
      const q = parseQty(line[lc.col]);
      if (q.bad) {
        warnings.push({
          code: 'INVALID_CELL',
          row: r + 1,
          col: lc.col + 1,
          message: `Dòng ${r + 1} (${ch}/${sp}), cột ${lc.col + 1}: giá trị "${(line[lc.col] ?? '').trim()}" không hợp lệ, coi như 0.`,
        });
        continue;
      }
      if (q.value <= 0 || !lc.valid) continue;
      lots.push({ nsx: lc.nsx, hsd: lc.hsd, qty: q.value });
      sum += q.value;
    }

    const sheetTotal = parseTotal(line[totalCol]);
    const allLotsValid = lotColumns.every((l) => l.valid);
    if (sheetTotal !== null && allLotsValid && sheetTotal !== sum) {
      warnings.push({
        code: 'TOTAL_MISMATCH',
        row: r + 1,
        message: `Dòng ${r + 1} (${ch}/${sp}): Tổng Tồn trên sheet là ${sheetTotal} nhưng tổng các lô là ${sum}; hệ thống dùng tổng các lô.`,
      });
    }

    const key = `${ch}|${sp}`;
    if (byKey.has(key)) {
      warnings.push({
        code: 'DUPLICATE_ROW',
        row: r + 1,
        message: `Dòng ${r + 1}: trùng cặp ${ch}/${sp}, dùng dòng cuối cùng.`,
      });
    }
    byKey.set(key, {
      rowNumber: r + 1,
      ch,
      sp,
      nh,
      lots,
      sheetTotal,
      lastUpdate: parseSheetDateTime(line[updatedCol]),
    });
  }

  const rows = Array.from(byKey.values());
  if (rows.length === 0) return { ok: false, fatal: 'Sheet không có dòng dữ liệu hợp lệ nào.', lotColumns, rows, warnings };
  return { ok: true, lotColumns, rows, warnings };
}

/** Tách tồn bán được (lô còn hạn) và tồn đã quá hạn của một dòng. Lô hết hạn khi HSD < hôm nay. */
export function splitSellable(lots: SheetLot[], today: string): { sellable: number; expired: number } {
  let sellable = 0;
  let expired = 0;
  for (const l of lots) {
    if (l.hsd < today) expired += l.qty;
    else sellable += l.qty;
  }
  return { sellable, expired };
}
