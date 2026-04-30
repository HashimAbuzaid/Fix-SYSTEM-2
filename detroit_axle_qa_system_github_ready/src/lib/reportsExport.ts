import type {
  TrendPoint,
  RecurringIssue,
  ProcedureHotspot,
  ProcedureCaseItem,
} from './reportsAnalytics';

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'all';
}

function buildTrendChartSvg(points: TrendPoint[], subjectLabel: string, periodMode: 'weekly' | 'monthly'): string {
  const width = 1400;
  const height = 460;
  const padLeft = 70;
  const padRight = 34;
  const padTop = 58;
  const padBottom = 70;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const values = points
    .flatMap((p) => [p.subjectAverage, p.teamAverage])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const min = Math.min(60, ...values);
  const max = Math.max(100, ...values);
  const x = (idx: number) => (points.length <= 1 ? padLeft : padLeft + (idx * chartW) / (points.length - 1));
  const y = (value: number | null) => {
    const safe = typeof value === 'number' && Number.isFinite(value) ? value : min;
    return padTop + chartH - ((safe - min) / Math.max(1, max - min)) * chartH;
  };
  const pathFor = (selector: (p: TrendPoint) => number | null) =>
    points.map((p, idx) => {
      const value = selector(p);
      if (value === null || !Number.isFinite(value)) return '';
      return `${idx === 0 ? 'M' : 'L'} ${x(idx).toFixed(1)} ${y(value).toFixed(1)}`;
    }).filter(Boolean).join(' ');

  const ticks = [60, 70, 80, 90, 100];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="24" fill="#0f172a"/>
  <text x="${padLeft}" y="34" fill="#f8fafc" font-family="Arial, sans-serif" font-size="24" font-weight="700">${xmlEscape(subjectLabel)} Performance Trends</text>
  <text x="${width - padRight}" y="34" text-anchor="end" fill="#94a3b8" font-family="Arial, sans-serif" font-size="14">${xmlEscape(periodMode)}</text>
  ${ticks.map((tick) => `<g><line x1="${padLeft}" x2="${width - padRight}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}" stroke="#334155"/><text x="24" y="${(y(tick) + 5).toFixed(1)}" fill="#94a3b8" font-family="Arial, sans-serif" font-size="13">${tick}%</text></g>`).join('')}
  <path d="${pathFor((p) => p.teamAverage)}" fill="none" stroke="#a78bfa" stroke-width="4" opacity="0.75"/>
  <path d="${pathFor((p) => p.subjectAverage)}" fill="none" stroke="#38bdf8" stroke-width="5"/>
  ${points.map((p, idx) => `<g><circle cx="${x(idx).toFixed(1)}" cy="${y(p.subjectAverage).toFixed(1)}" r="6" fill="#38bdf8"/><text x="${x(idx).toFixed(1)}" y="${height - 30}" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="12">${xmlEscape(p.shortLabel || p.label)}</text></g>`).join('')}
</svg>`;
}

async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render SVG chart.'));
    });
    img.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not convert chart to PNG.')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cell(value: unknown, numeric = false): string {
  const isNumber = numeric && value !== null && value !== undefined && Number.isFinite(Number(value));
  return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${xmlEscape(isNumber ? Number(value) : value)}</Data></Cell>`;
}

function row(values: unknown[], numericIndexes: number[] = []): string {
  return `<Row>${values.map((value, idx) => cell(value, numericIndexes.includes(idx))).join('')}</Row>`;
}

function sheet(name: string, rows: string[]): string {
  return `<Worksheet ss:Name="${xmlEscape(name).slice(0, 31)}"><Table>${rows.join('')}</Table></Worksheet>`;
}

function buildPerformanceTrendWorkbookXml(params: {
  subjectLabel: string;
  periodMode: 'weekly' | 'monthly';
  trendPoints: TrendPoint[];
  recurringIssues: RecurringIssue[];
  procedureHotspots: ProcedureHotspot[];
  procedureCases: ProcedureCaseItem[];
  latestAverage: number | null;
  momentumDelta: number | null;
  teamGap: number | null;
  chartAssetName: string;
}): string {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheet('Summary', [
  row(['Metric', 'Value']),
  row(['Subject', params.subjectLabel]),
  row(['Period Mode', params.periodMode]),
  row(['Latest Average', params.latestAverage], [1]),
  row(['Momentum Delta', params.momentumDelta], [1]),
  row(['Team Gap', params.teamGap], [1]),
  row(['Chart Asset', params.chartAssetName]),
  row(['Generated At', new Date().toISOString()]),
])}
${sheet('Trends', [
  row(['Period', 'Label', 'Subject Average', 'Team Average', 'Subject Audit Count', 'Team Audit Count']),
  ...params.trendPoints.map((p) => row([p.key, p.label, p.subjectAverage, p.teamAverage, p.auditCount, p.teamAuditCount], [2, 3, 4, 5])),
])}
${sheet('Recurring Issues', [
  row(['Metric', 'Total', 'Borderline', 'Fail', 'Auto-Fail']),
  ...params.recurringIssues.map((i) => row([i.metric, i.count, i.borderlineCount, i.failCount, i.autoFailCount], [1, 2, 3, 4])),
])}
${sheet('Procedure Hotspots', [
  row(['Metric', 'Count', 'Average Score', 'Fail Rate']),
  ...params.procedureHotspots.map((h) => row([h.metric, h.count, h.averageScore, h.failRate], [1, 2, 3])),
])}
${sheet('Flagged Cases', [
  row(['ID', 'Agent', 'Team', 'Case Type', 'Audit Date', 'Quality Score', 'Issue', 'Result', 'Comment']),
  ...params.procedureCases.map((c) => row([c.id, c.agentName, c.team, c.caseType, c.auditDate, c.qualityScore, c.issue, c.result, c.comment], [5])),
])}
</Workbook>`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u16 = (value: number) => [value & 0xff, (value >>> 8) & 0xff];
const u32 = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];

async function makeZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);
    const localHeader = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0),
    ]);
    localParts.push(localHeader, nameBytes, data);
    const centralHeader = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

async function downloadTrendExportPackage(params: {
  baseFilename: string;
  workbookXml: string;
  chartSvg: string;
  chartPngBlob: Blob;
}) {
  const zip = await makeZip([
    { name: `${params.baseFilename}.xls`, blob: new Blob([params.workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8' }) },
    { name: `${params.baseFilename}_chart.svg`, blob: new Blob([params.chartSvg], { type: 'image/svg+xml;charset=utf-8' }) },
    { name: `${params.baseFilename}_chart.png`, blob: params.chartPngBlob },
  ]);
  const url = URL.createObjectURL(zip);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.baseFilename}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function runTrendExport(params: {
  subjectLabel: string;
  periodMode: 'weekly' | 'monthly';
  trendPoints: TrendPoint[];
  recurringIssues: RecurringIssue[];
  procedureHotspots: ProcedureHotspot[];
  procedureCases: ProcedureCaseItem[];
  latestAverage: number | null;
  momentumDelta: number | null;
  teamGap: number | null;
}) {
  const { subjectLabel, periodMode, trendPoints } = params;
  const base = `performance_trends_${sanitizeFilePart(subjectLabel)}_${periodMode}_${new Date().toISOString().slice(0, 10)}`;
  const svg = buildTrendChartSvg(trendPoints, subjectLabel, periodMode);
  const png = await svgToPngBlob(svg, 1400, 460);
  const xml = buildPerformanceTrendWorkbookXml({ ...params, chartAssetName: `${base}_chart.png` });
  await downloadTrendExportPackage({ baseFilename: base, workbookXml: xml, chartSvg: svg, chartPngBlob: png });
}
