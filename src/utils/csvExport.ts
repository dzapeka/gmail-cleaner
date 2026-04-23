import type { SenderGroup } from '../types';

const CSV_HEADERS = [
  'Email Address',
  'Sender Name',
  'Email Count',
  'Percentage of Total',
  'First Email Date',
  'Last Email Date',
  'Suspected Spam',
  'Has Unsubscribe Link',
] as const;

/** Wrap a value in double quotes and escape internal double quotes as "". */
function escapeField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Generate a CSV string from an array of SenderGroups.
 * Includes a UTF-8 BOM and a header row.
 */
export function generateCsv(groups: SenderGroup[], totalCount: number): string {
  const rows: string[] = [CSV_HEADERS.map(escapeField).join(',')];

  for (const group of groups) {
    const percentage =
      totalCount === 0
        ? '0.00%'
        : `${((group.count / totalCount) * 100).toFixed(2)}%`;

    const fields = [
      group.sender.email,
      group.sender.name,
      String(group.count),
      percentage,
      group.firstDate,
      group.lastDate,
      group.isSuspectedSpam ? 'Yes' : 'No',
      group.unsubscribeLink !== null ? 'Yes' : 'No',
    ];

    rows.push(fields.map(escapeField).join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Trigger a CSV file download in the browser.
 * Falls back to clipboard copy if the download fails.
 */
export function downloadCsv(content: string): void {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `gmail-cleaner-export-${date}.csv`;

  try {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);
  } catch {
    navigator.clipboard.writeText(content).catch(() => {
      // Clipboard also unavailable — nothing more we can do
    });
  }
}
