import { useState, useRef } from 'react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/format';
import { downloadTextFile, readFileAsText } from '../../utils/fileDownload';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';

const STEPS = { upload: 'upload', preview: 'preview', result: 'result' };

function PreviewTable({ rows, maxRows = 8 }) {
  const shown = rows.slice(0, maxRows);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="table-th">Row</th>
            <th className="table-th">Account</th>
            <th className="table-th">Type</th>
            <th className="table-th text-right">Balance</th>
            <th className="table-th">Status</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.rowNumber} className={r.errors?.length ? 'bg-red-50' : ''}>
              <td className="table-td text-gray-400">{r.rowNumber}</td>
              <td className="table-td font-medium max-w-[140px] truncate">{r.accountTitle}</td>
              <td className="table-td text-gray-500">{r.subAccount}</td>
              <td className="table-td text-right font-mono">{formatCurrency(r.balance)}</td>
              <td className="table-td">
                {r.errors?.length
                  ? <span className="text-red-600" title={r.errors.join('; ')}>Error</span>
                  : r.isCashAccount
                    ? <span className="text-green-700">💵 Cash</span>
                    : <span className="text-green-600">OK</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p className="text-xs text-gray-400 text-center py-2 bg-gray-50">
          + {rows.length - maxRows} more rows
        </p>
      )}
    </div>
  );
}

export default function ImportAccountsModal({ open, onClose, onSuccess, hasAccounts }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(STEPS.upload);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState(hasAccounts ? 'merge' : 'replace');
  const [forceUnbalanced, setForceUnbalanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep(STEPS.upload);
    setCsvText('');
    setFileName('');
    setPreview(null);
    setMode(hasAccounts ? 'merge' : 'replace');
    setForceUnbalanced(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const { data } = await api.get('/accounts/import/template', { responseType: 'text' });
      downloadTextFile('chart-of-accounts-template.csv', data);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a .csv file');
      return;
    }
    setLoading(true);
    try {
      const text = await readFileAsText(file);
      setCsvText(text);
      setFileName(file.name);
      const { data } = await api.post('/accounts/import/preview', { csv: text });
      setPreview(data);
      setMode(data.canReplace ? (hasAccounts ? 'merge' : 'replace') : 'merge');
      setStep(STEPS.preview);
    } catch (err) {
      toast.error(err.message || 'Failed to parse CSV');
      setCsvText('');
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!csvText || !preview) return;
    if (preview.invalidCount > 0) {
      toast.error('Fix CSV errors before importing');
      return;
    }
    if (!preview.balanced && !forceUnbalanced) {
      toast.error('Trial balance is not zero — check "Import anyway" or fix balances');
      return;
    }
    if (mode === 'replace' && !preview.canReplace) {
      toast.error('Cannot replace accounts while transactions exist');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/accounts/import', {
        csv: csvText,
        mode,
        forceUnbalanced,
      });
      setResult(data);
      setStep(STEPS.result);
      toast.success(data.message);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Chart of Accounts"
      size="lg"
    >
      {step === STEPS.upload && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload a CSV file to set up your chart of accounts with opening balances.
            Anyone can start fresh or migrate from Excel/Google Sheets.
          </p>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-2">
            <p className="font-semibold">CSV columns</p>
            <code className="block text-xs bg-white/70 p-2 rounded font-mono break-all">
              accountTitle, accountNo, accountType, subAccount, financialStatement, balance, isCashAccount
            </code>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              <li><strong>balance</strong> — signed amount (assets/expenses positive, liabilities/equity/revenue negative)</li>
              <li>Or use <strong>debit</strong> and <strong>credit</strong> columns instead of balance</li>
              <li>Mark exactly one account with <strong>isCashAccount=true</strong> for cash transactions</li>
              <li>Grand total of all balances should equal <strong>0</strong></li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleDownloadTemplate} className="btn btn-secondary btn-sm">
              ⬇ Blank Template
            </button>
            <button type="button" onClick={async () => {
              try {
                const { data } = await api.get('/accounts/import/template/full', { responseType: 'text' });
                downloadTextFile('chart-of-accounts-full-sample.csv', data);
              } catch { toast.error('Failed to download sample'); }
            }} className="btn btn-secondary btn-sm">
              ⬇ Full Sample (145 accounts)
            </button>
          </div>

          <label className="block">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileSelect}
              disabled={loading}
            />
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${loading ? 'opacity-60 pointer-events-none' : 'hover:border-primary-400 hover:bg-primary-50/30'}
                border-gray-200`}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <p className="text-3xl mb-2">📄</p>
              <p className="font-semibold text-gray-800">Choose CSV file</p>
              <p className="text-xs text-gray-400 mt-1">or drag &amp; click to browse</p>
            </div>
          </label>

          <div className="flex justify-end">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
          </div>
        </div>
      )}

      {step === STEPS.preview && preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-gray-600">
              <strong>{fileName}</strong> — {preview.validRows?.length || 0} valid rows
              {preview.invalidCount > 0 && (
                <span className="text-red-600">, {preview.invalidCount} errors</span>
              )}
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setStep(STEPS.upload); setPreview(null); }}>
              ← Choose another file
            </button>
          </div>

          {preview.warnings?.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              {preview.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-400 uppercase">Rows</p>
              <p className="font-bold text-lg">{preview.rows?.length || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-400 uppercase">Grand Total</p>
              <p className={`font-bold text-lg font-mono ${preview.balanced ? 'text-income' : 'text-warning'}`}>
                {preview.grandTotal === 0 ? '0 ✓' : preview.grandTotal}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-400 uppercase">Existing</p>
              <p className="font-bold text-lg">{preview.existingAccountCount}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-400 uppercase">Transactions</p>
              <p className="font-bold text-lg">{preview.transactionCount}</p>
            </div>
          </div>

          <PreviewTable rows={preview.rows || []} />

          {preview.invalidCount > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 max-h-24 overflow-y-auto">
              {preview.rows.filter(r => r.errors?.length).map(r => (
                <p key={r.rowNumber}>Row {r.rowNumber} ({r.accountTitle}): {r.errors.join('; ')}</p>
              ))}
            </div>
          )}

          <div className="space-y-3 p-4 bg-surface-50 rounded-xl border border-surface-200">
            <p className="text-sm font-semibold text-gray-800">Import mode</p>
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${mode === 'replace' ? 'border-primary-400 bg-primary-50' : 'border-gray-200'}`}>
              <input
                type="radio"
                name="importMode"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                disabled={!preview.canReplace}
                className="mt-1"
              />
              <div className={!preview.canReplace ? 'opacity-50' : ''}>
                <p className="text-sm font-medium">Replace all accounts</p>
                <p className="text-xs text-gray-500">Deletes existing accounts and imports fresh from CSV. Only allowed when no transactions exist.</p>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${mode === 'merge' ? 'border-primary-400 bg-primary-50' : 'border-gray-200'}`}>
              <input type="radio" name="importMode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1" />
              <div>
                <p className="text-sm font-medium">Add missing only</p>
                <p className="text-xs text-gray-500">Keeps existing accounts; adds new titles from CSV. Skips duplicates.</p>
              </div>
            </label>
          </div>

          {!preview.balanced && (
            <label className="flex items-center gap-2 text-sm text-amber-800">
              <input type="checkbox" checked={forceUnbalanced} onChange={e => setForceUnbalanced(e.target.checked)} />
              Import anyway (trial balance total is not zero)
            </label>
          )}

          {mode === 'replace' && preview.canReplace && hasAccounts && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              ⚠️ This will permanently delete all {preview.existingAccountCount} existing account(s) and replace them with the CSV data.
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" className="btn btn-secondary flex-1 justify-center" onClick={handleClose} disabled={loading}>Cancel</button>
            <button
              type="button"
              className="btn-primary flex-1 justify-center"
              onClick={handleImport}
              disabled={loading || preview.invalidCount > 0}
            >
              {loading ? 'Importing…' : mode === 'replace' ? '🔄 Replace & Import' : '➕ Import Accounts'}
            </button>
          </div>
        </div>
      )}

      {step === STEPS.result && result && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border-2 ${result.balanced ? 'bg-income-light border-income/40' : 'bg-warning-light border-warning/40'}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{result.balanced ? '✅' : '⚠️'}</span>
              <p className="font-bold text-gray-900">{result.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Imported</p>
                <p className="font-bold text-2xl text-primary-700">{result.inserted}</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Total Accounts</p>
                <p className="font-bold text-2xl text-gray-800">{result.total}</p>
              </div>
              {result.skipped > 0 && (
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs">Skipped</p>
                  <p className="font-bold text-2xl text-gray-500">{result.skipped}</p>
                </div>
              )}
              {result.removed > 0 && (
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs">Removed</p>
                  <p className="font-bold text-2xl text-gray-500">{result.removed}</p>
                </div>
              )}
              <div className={`rounded-lg p-3 text-center col-span-2 ${result.balanced ? 'bg-income-light' : 'bg-warning-light'}`}>
                <p className="text-gray-400 text-xs">Grand Total</p>
                <p className={`font-bold text-lg font-mono ${result.balanced ? 'text-income' : 'text-warning'}`}>
                  {result.grandTotal === 0 ? '0.00 ✓' : result.grandTotal}
                </p>
              </div>
            </div>
          </div>
          <button type="button" className="btn-primary w-full justify-center" onClick={handleClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}
