// reportsExport.ts  ← move all the Excel/ZIP/SVG helpers here verbatim,
// then add this single public entry point:

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
  const base = `performance_trends_${sanitizeFilePart(subjectLabel)}_${periodMode}_${new Date().toISOString().slice(0,10)}`;
  const svg  = buildTrendChartSvg(trendPoints, subjectLabel, periodMode);
  const png  = await svgToPngBlob(svg, 1400, 460);
  const xml  = buildPerformanceTrendWorkbookXml({ ...params, chartAssetName: `${base}_chart.png` });
  await downloadTrendExportPackage({ baseFilename: base, workbookXml: xml, chartSvg: svg, chartPngBlob: png });
}
