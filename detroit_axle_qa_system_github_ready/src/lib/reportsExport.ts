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

function buildTrendChartSvg(
  points: TrendPoint[],
  subjectLabel: string,
  periodMode: 'weekly' | 'monthly',
): string {
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

  const x = (idx: number) =>
    points.length <= 1 ? padLeft : padLeft + (idx * chartW) / (points.length - 1);

  const y = (value: number | null) => {
    const safe = typeof value === 'number' && Number.isFinite(value) ? value : min;
    return padTop + chartH - ((safe - min) / Math.max(1, max - min)) * chartH;
  };

  const pathFor = (selector: (p: TrendPoint) => number | null) =>
    points
      .map((p, idx) => {
        const value = selector(p);
        if (value === null || !Number.isFinite(value)) return '';
        return `${idx === 0 ? 'M' : 'L'} ${x(idx).toFixed(1)} ${y(value).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

  const ticks = [60, 70, 80, 90, 100];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="24" fill="#0f172a"/>
  <text x="${padLeft}" y="34" fill="#f8fafc" font-family="Arial, sans-serif" font-size="24" font-weight="700">${xmlEscape(subjectLabel)} Performance Trends</text>
  <text x="${width - padRight}" y="34" text-anchor="end" fill="#94a3b8" font-family="Arial, sans-serif" font-size="14">${xmlEscape(periodMode)}</text>
  ${ticks.map((tick) => `<g><line x1="${padLeft}" x2="${width - padRight}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}" stroke="#334155"/><text x="24" y="${(y(tick) + 5).toFixed(1)}" fill="#94a3b8" font-family="Arial, sans-serif" font-size="13">${tick}%</text></g>`).join('')}
  <path d="${pathFor((p) => p.teamAverage)}" fill="none" stroke="#a78bfa" stroke-width="4" opacity="0.75"/>
  <path d="${pathFor((p) => p.subjectAverage)}" fill="none" stroke="#38bdf8" stroke-width="5"/>
  ${points.map((p, idx) => {
    const sx = x(idx);
    const sy = y(p.subjectAverage);
    const label = xmlEscape(p.shortLabel || p.label);
    return `<g><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="6" fill="#38bdf8"/><text x="${sx.toFixed(1)}" y="${height - 30}" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="12">${label}</text></g>`;
  }).join('')}
  <g transform="translate(${padLeft},${height - 18})">
    <circle cx="0" cy="0" r="6" fill="#38bdf8"/><text x="14" y="5" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Subject average</text>
    <circle cx="150" cy="0" r="6" fill="#a78bfa"/><text x="164" y="5" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Team average</text>
  </g>
</svg>`;
}

async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = 'async';

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
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not convert chart to PNG.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cell(value: unknown, type: 'String' | 'Number' = 'String'): string {
  const safeType =
    type === 'Number' && value !== null && value !== undefined && Number.isFinite(Number(value))
      ? 'Number'
      : 'String';

  return `<Cell><Data ss:Type="${safeType}">${xmlEscape(
    safeType === 'Number' ? Number(value) : value,
  )}</Data></Cell>`;
}

function row(values: unknown[], numericIndexes: number[] = []): string {
  return `<Row>${values
    .map((value, idx) => cell(value, numericIndexes.includes(idx) ? 'Number' : 'String'))
    .join('')}</Row>`;
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
  const summaryRows = [
    row(['Metric', 'Value']),
    row(['Subject', params.subjectLabel]),
    row(['Period Mode', params.periodMode]),
    row(['Latest Average', params.latestAverage], [1]),
    row(['Momentum Delta', params.momentumDelta], [1]),
    row(['Team Gap', params.teamGap], [1]),
    row(['Chart Asset', params.chartAssetName]),
    row(['Generated At', new Date().toISOString()]),
  ];

  const trendRows = [
    row(['Period', 'Label', 'Subject Average', 'Team Average', 'Subject Audit Count', 'Team Audit Count']),
    ...params.trendPoints.map((p) =>
      row([p.key, p.label, p.subjectAverage, p.teamAverage, p.auditCount, p.teamAuditCount], [2, 3, 4, 5]),
    ),
  ];

  const issueRows = [
    row(['Metric', 'Total', 'Borderline', 'Fail', 'Auto-Fail']),
    ...params.recurringIssues.map((i) =>
      row([i.metric, i.count, i.borderlineCount, i.failCount, i.autoFailCount], [1, 2, 3, 4]),
    ),
  ];

  const hotspotRows = [
    row(['Metric', 'Count', 'Average Score', 'Fail Rate']),
    ...params.procedureHotspots.map((h) =>
      row([h.metric, h.count, h.averageScore, h.failRate], [1, 2, 3]),
    ),
  ];

  const caseRows = [
    row(['ID', 'Agent', 'Team', 'Case Type', 'Audit Date', 'Quality Score', 'Issue', 'Result', 'Comment']),
    ...params.procedureCases.map((c) =>
      row([c.id, c.agentName, c.team, c.caseType, c.auditDate, c.qualityScore, c.issue, c.result, c.comment], [5]),
    ),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 ${sheet('Summary', summaryRows)}
 ${sheet('Trends', trendRows)}
 ${sheet('Recurring Issues', issueRows)}
 ${sheet('Procedure Hotspots', hotspotRows)}
 ${sheet('Flagged Cases', caseRows)}
</Workbook>`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;

  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }

  return (c ^ 0xffffffff) >>> 0;
}

function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(totalLength);

  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }

  return output;
}

async function makeZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const encoder = new TextEncoder();

  const processedFiles = await Promise.all(
    files.map(async (file) => {
      const nameBytes = encoder.encode(file.name);
      const data = await blobToBytes(file.blob);
      const crc = crc32(data);
      return { nameBytes, data, crc };
    }),
  );

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const { nameBytes, data, crc } of processedFiles) {
    const localHeader = new Uint8Array([
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0),
    ]);

    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
    ]);

    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ]);

  const combined = concatUint8Arrays([...localParts, ...centralParts, end]);

  // Important for strict DOM typings:
  // do not pass generic Uint8Array<ArrayBufferLike>[] directly to Blob.
  return new Blob([combined.buffer as ArrayBuffer], { type: 'application/zip' });
}

async function downloadTrendExportPackage(params: {
  baseFilename: string;
  workbookXml: string;
  chartSvg: string;
  chartPngBlob: Blob;
}) {
  const zip = await makeZip([
    {
      name: `${params.baseFilename}.xls`,
      blob: new Blob([params.workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    },
    {
      name: `${params.baseFilename}_chart.svg`,
      blob: new Blob([params.chartSvg], { type: 'image/svg+xml;charset=utf-8' }),
    },
    {
      name: `${params.baseFilename}_chart.png`,
      blob: params.chartPngBlob,
    },
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
  const base = `performance_trends_${sanitizeFilePart(subjectLabel)}_${periodMode}_${new Date()
    .toISOString()
    .slice(0, 10)}`;
  const svg = buildTrendChartSvg(trendPoints, subjectLabel, periodMode);
  const png = await svgToPngBlob(svg, 1400, 460);
  const xml = buildPerformanceTrendWorkbookXml({ ...params, chartAssetName: `${base}_chart.png` });

  await downloadTrendExportPackage({
    baseFilename: base,
    workbookXml: xml,
    chartSvg: svg,
    chartPngBlob: png,
  });
}
