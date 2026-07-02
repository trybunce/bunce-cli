/** Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF. */
export function parseCsv(input: string): Record<string, string>[] {
  const rows = tokenize(input);
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim());
  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 1 && row[0] === '') continue;
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = (row[idx] ?? '').trim();
    });
    records.push(record);
  }
  return records;
}

function tokenize(input: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      i++;
    } else {
      field += char;
      i++;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
