const { TYPE_TO_SUB, SUB_TO_FS, VALID_SUB_ACCOUNTS } = require('./accountTypeMap');

const HEADER_ALIASES = {
  accounttitle: 'accountTitle',
  title: 'accountTitle',
  name: 'accountTitle',
  accountno: 'accountNo',
  accountnumber: 'accountNo',
  accounttype: 'accountType',
  type: 'accountType',
  subaccount: 'subAccount',
  category: 'subAccount',
  financialstatement: 'financialStatement',
  statement: 'financialStatement',
  balance: 'balance',
  openingbalance: 'balance',
  currentbalance: 'balance',
  presentbalance: 'balance',
  amount: 'balance',
  debit: 'debit',
  credit: 'credit',
  iscashaccount: 'isCashAccount',
  cashaccount: 'isCashAccount',
  cash: 'isCashAccount',
};

function parseBool(val) {
  if (val === true || val === false) return val;
  const s = String(val ?? '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(s)) return true;
  if (['false', 'no', 'n', '0', ''].includes(s)) return false;
  return null;
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/[৳$]/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[normalizeHeader(h)];
    if (key) map[key] = i;
  });
  return map;
}

/** Minimal RFC-style CSV row parser (handles quoted fields). */
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field);
      if (row.some(c => String(c).trim() !== '')) rows.push(row);
      row = [];
      field = '';
      if (ch === '\r') i++;
      continue;
    }
    if (ch === '\r') continue;
    field += ch;
  }

  row.push(field);
  if (row.some(c => String(c).trim() !== '')) rows.push(row);
  return rows;
}

function parseCsvText(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('CSV file is empty');

  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error('CSV must include a header row and at least one data row');

  const headerMap = mapHeaders(rows[0]);
  if (headerMap.accountTitle === undefined) {
    throw new Error('CSV must include an "accountTitle" column (or "Account Title")');
  }

  const parsed = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (key) => {
      const idx = headerMap[key];
      return idx === undefined ? '' : (cells[idx] ?? '');
    };

    const accountTitle = String(get('accountTitle')).trim();
    if (!accountTitle) continue;

    parsed.push({
      rowNumber: r + 1,
      accountTitle,
      accountNo: String(get('accountNo')).trim(),
      accountType: String(get('accountType')).trim(),
      subAccount: String(get('subAccount')).trim(),
      financialStatement: String(get('financialStatement')).trim(),
      balance: get('balance'),
      debit: get('debit'),
      credit: get('credit'),
      isCashAccount: get('isCashAccount'),
    });
  }

  if (!parsed.length) throw new Error('No account rows found in CSV');
  return parsed;
}

function normalizeAccountRow(raw) {
  const errors = [];
  const accountTitle = String(raw.accountTitle || '').trim();
  if (!accountTitle) errors.push('Account title is required');

  let accountType = String(raw.accountType || '').trim();
  let subAccount = String(raw.subAccount || '').trim();
  let financialStatement = String(raw.financialStatement || '').trim();

  if (accountType && TYPE_TO_SUB[accountType]) {
    if (!subAccount) subAccount = TYPE_TO_SUB[accountType];
    if (!financialStatement) financialStatement = SUB_TO_FS[subAccount] || '';
  }

  if (!subAccount && accountType) {
    errors.push(`Unknown account type "${accountType}" — provide subAccount or use a known type`);
  }
  if (!subAccount) errors.push('Sub-account is required (or provide a valid accountType)');
  else if (!VALID_SUB_ACCOUNTS.includes(subAccount)) {
    errors.push(`Invalid sub-account "${subAccount}"`);
  }

  if (!financialStatement && subAccount) {
    financialStatement = SUB_TO_FS[subAccount] || '';
  }
  if (financialStatement && !['Balance Sheet', 'Income Statement'].includes(financialStatement)) {
    errors.push(`Invalid financial statement "${financialStatement}"`);
  }

  let balance = parseNumber(raw.balance);
  const debit = parseNumber(raw.debit);
  const credit = parseNumber(raw.credit);

  if (Number.isNaN(balance)) errors.push('Balance must be a number');
  if (Number.isNaN(debit)) errors.push('Debit must be a number');
  if (Number.isNaN(credit)) errors.push('Credit must be a number');

  if ((raw.balance === '' || raw.balance === undefined || raw.balance === null)
      && (debit !== 0 || credit !== 0)) {
    balance = Math.round((debit - credit) * 100) / 100;
  }

  const cashParsed = parseBool(raw.isCashAccount);
  if (cashParsed === null) errors.push('isCashAccount must be true/false, yes/no, or 1/0');

  return {
    rowNumber: raw.rowNumber,
    accountTitle,
    accountNo: String(raw.accountNo || '').trim(),
    accountType: accountType || subAccount,
    subAccount,
    financialStatement,
    balance: Math.round((balance || 0) * 100) / 100,
    isCashAccount: cashParsed === true,
    errors,
  };
}

function validateImportRows(rawRows) {
  const normalized = rawRows.map(normalizeAccountRow);
  const titles = new Map();

  for (const row of normalized) {
    const key = row.accountTitle.toLowerCase();
    if (titles.has(key)) {
      row.errors.push(`Duplicate account title (also on row ${titles.get(key)})`);
    } else {
      titles.set(key, row.rowNumber);
    }
  }

  const cashCount = normalized.filter(r => r.isCashAccount && !r.errors.length).length;
  if (cashCount > 1) {
    normalized.filter(r => r.isCashAccount).forEach(r => {
      if (!r.errors.length) r.errors.push('Only one account can be marked as Cash Account');
    });
  }

  const validRows = normalized.filter(r => !r.errors.length);
  const grandTotal = validRows.reduce((s, r) => s + r.balance, 0);
  const balanced = Math.abs(grandTotal) < 1;

  return {
    rows: normalized,
    validRows,
    invalidCount: normalized.length - validRows.length,
    grandTotal: Math.round(grandTotal * 100) / 100,
    balanced,
    cashCount,
  };
}

function accountsToCsv(accounts) {
  const header = 'accountTitle,accountNo,accountType,subAccount,financialStatement,balance,isCashAccount';
  const lines = accounts.map(a => {
    const esc = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      esc(a.accountTitle),
      esc(a.accountNo || ''),
      esc(a.accountType || ''),
      esc(a.subAccount || ''),
      esc(a.financialStatement || ''),
      a.currentBalance ?? a.balance ?? 0,
      a.isCashAccount ? 'true' : 'false',
    ].join(',');
  });
  return [header, ...lines].join('\n');
}

const TEMPLATE_CSV = `accountTitle,accountNo,accountType,subAccount,financialStatement,balance,isCashAccount
Opening Capital,,Equity,Equity,Balance Sheet,-100000,false
Cash in Hand,,Cash,Current Assets,Balance Sheet,60000,true
Main Bank Account,1234567890,Savings Bank Account,Current Assets,Balance Sheet,40000,false`;

module.exports = {
  parseCsvText,
  validateImportRows,
  accountsToCsv,
  TEMPLATE_CSV,
};
