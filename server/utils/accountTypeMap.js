// Maps accountType → subAccount and subAccount → financialStatement
// Keep in sync with client AccountsPage.js TYPE_TO_SUB / SUB_TO_FS

const TYPE_TO_SUB = {
  'Cash': 'Current Assets',
  'Savings Bank Account': 'Current Assets',
  'Digital Wallet': 'Current Assets',
  'Fixed Deposit Account': 'Current Assets',
  'DPS Account': 'Current Assets',
  'Accounts Receivable (Lending)': 'Current Assets',
  'Savings Certificate': 'Investments',
  'investment': 'Investments',
  'Insurence': 'Investments',
  'Share': 'Investments',
  'Other account': 'Investments',
  'Investment': 'Investments',
  'Fixed Assets': 'Fixed Assets',
  'Credit Card': 'Current Liabilities',
  'Borrowings': 'Current Liabilities',
  'Other': 'Current Liabilities',
  'Short-term Loans': 'Short-term Liabilities',
  'Long-term Liabilities': 'Long-term Liabilities',
  'Equity': 'Equity',
  'Employment Income': 'Revenue',
  'Business Income': 'Revenue',
  'Freelancing / Hobby Trading Income': 'Revenue',
  'Investment & Other Income': 'Revenue',
  'Other Income': 'Revenue',
  'Fixed Expenses': 'Expenses',
  'Household Expenses': 'Expenses',
  'Business & Hobby Expenses': 'Expenses',
  'Other Expenses': 'Expenses',
  'Finance & Banking Expenses': 'Expenses',
};

const SUB_TO_FS = {
  'Current Assets': 'Balance Sheet',
  'Investments': 'Balance Sheet',
  'Fixed Assets': 'Balance Sheet',
  'Current Liabilities': 'Balance Sheet',
  'Short-term Liabilities': 'Balance Sheet',
  'Long-term Liabilities': 'Balance Sheet',
  'Equity': 'Balance Sheet',
  'Revenue': 'Income Statement',
  'Expenses': 'Income Statement',
};

const VALID_SUB_ACCOUNTS = Object.keys(SUB_TO_FS);

module.exports = { TYPE_TO_SUB, SUB_TO_FS, VALID_SUB_ACCOUNTS };
