import { useMemo, useState, type CSSProperties } from 'react';

type TeamName = 'Calls' | 'Tickets' | 'Sales';

type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjustedWeight: number;
  earned: number;
  counts_toward_score?: boolean;
  metric_comment?: string | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName | string;
  case_type: string;
  audit_date: string;
  quality_score: number;
  comments: string | null;
  score_details?: ScoreDetail[];
};

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
};

type PeriodMode = 'weekly' | 'monthly';

type TrendPoint = {
  key: string;
  label: string;
  shortLabel: string;
  subjectAverage: number | null;
  teamAverage: number | null;
  auditCount: number;
  teamAuditCount: number;
};

type RecurringIssue = {
  metric: string;
  count: number;
  failCount: number;
  borderlineCount: number;
  autoFailCount: number;
};

type ProcedureHotspot = {
  caseType: string;
  count: number;
  borderlineCount: number;
  failCount: number;
  autoFailCount: number;
};

type ProcedureCaseItem = {
  id: string;
  auditDate: string;
  agentName: string;
  team: TeamName | string;
  caseType: string;
  qualityScore: number;
  procedureResult: string;
  metricComment: string | null;
};

type Props = {
  audits: AuditItem[];
  allAudits: AuditItem[];
  selectedAgent: AgentProfile | null;
  effectiveTeamFilter: string;
};

const ISSUE_RESULTS = new Set(['Borderline', 'Fail', 'Auto-Fail']);

function startOfWeek(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekLabel(dateValue: string) {
  const weekStart = startOfWeek(dateValue);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    key: formatIsoDate(weekStart),
    label: `${weekStart.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })} - ${weekEnd.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}`,
    shortLabel: weekStart.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  };
}

function formatMonthLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);

  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: first.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    }),
    shortLabel: first.toLocaleDateString(undefined, {
      month: 'short',
    }),
  };
}

function getPeriodMeta(dateValue: string, mode: PeriodMode) {
  return mode === 'weekly' ? formatWeekLabel(dateValue) : formatMonthLabel(dateValue);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundScore(value: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(2));
}

function buildTrendPoints(
  subjectAudits: AuditItem[],
  teamAudits: AuditItem[],
  mode: PeriodMode
): TrendPoint[] {
  const keys = new Set<string>();
  const subjectMap = new Map<string, number[]>();
  const teamMap = new Map<string, number[]>();
  const labels = new Map<string, { label: string; shortLabel: string }>();

  subjectAudits.forEach((audit) => {
    const meta = getPeriodMeta(audit.audit_date, mode);
    keys.add(meta.key);
    labels.set(meta.key, { label: meta.label, shortLabel: meta.shortLabel });

    const scores = subjectMap.get(meta.key) || [];
    scores.push(Number(audit.quality_score));
    subjectMap.set(meta.key, scores);
  });

  teamAudits.forEach((audit) => {
    const meta = getPeriodMeta(audit.audit_date, mode);
    keys.add(meta.key);
    labels.set(meta.key, { label: meta.label, shortLabel: meta.shortLabel });

    const scores = teamMap.get(meta.key) || [];
    scores.push(Number(audit.quality_score));
    teamMap.set(meta.key, scores);
  });

  return Array.from(keys)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      label: labels.get(key)?.label || key,
      shortLabel: labels.get(key)?.shortLabel || key,
      subjectAverage: roundScore(average(subjectMap.get(key) || [])),
      teamAverage: roundScore(average(teamMap.get(key) || [])),
      auditCount: (subjectMap.get(key) || []).length,
      teamAuditCount: (teamMap.get(key) || []).length,
    }));
}

function buildRecurringIssues(audits: AuditItem[]): RecurringIssue[] {
  const counts = new Map<
    string,
    { count: number; borderlineCount: number; failCount: number; autoFailCount: number }
  >();

  audits.forEach((audit) => {
    (audit.score_details || []).forEach((detail) => {
      if (!detail.metric || !ISSUE_RESULTS.has(String(detail.result || ''))) {
        return;
      }

      const current = counts.get(detail.metric) || {
        count: 0,
        borderlineCount: 0,
        failCount: 0,
        autoFailCount: 0,
      };

      current.count += 1;
      if (detail.result === 'Borderline') current.borderlineCount += 1;
      if (detail.result === 'Fail') current.failCount += 1;
      if (detail.result === 'Auto-Fail') current.autoFailCount += 1;

      counts.set(detail.metric, current);
    });
  });

  return Array.from(counts.entries())
    .map(([metric, value]) => ({
      metric,
      count: value.count,
      borderlineCount: value.borderlineCount,
      failCount: value.failCount,
      autoFailCount: value.autoFailCount,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.autoFailCount !== a.autoFailCount) return b.autoFailCount - a.autoFailCount;
      if (b.failCount !== a.failCount) return b.failCount - a.failCount;
      return a.metric.localeCompare(b.metric);
    })
    .slice(0, 6);
}

function getProcedureIssueDetail(audit: AuditItem) {
  return (audit.score_details || []).find(
    (detail) =>
      String(detail.metric || '').trim() === 'Procedure' &&
      ISSUE_RESULTS.has(String(detail.result || ''))
  ) || null;
}

function buildProcedureHotspots(audits: AuditItem[]): ProcedureHotspot[] {
  const counts = new Map<
    string,
    { count: number; borderlineCount: number; failCount: number; autoFailCount: number }
  >();

  audits.forEach((audit) => {
    const detail = getProcedureIssueDetail(audit);
    if (!detail) return;

    const caseType = String(audit.case_type || 'Unknown').trim() || 'Unknown';
    const current = counts.get(caseType) || {
      count: 0,
      borderlineCount: 0,
      failCount: 0,
      autoFailCount: 0,
    };

    current.count += 1;
    if (detail.result === 'Borderline') current.borderlineCount += 1;
    if (detail.result === 'Fail') current.failCount += 1;
    if (detail.result === 'Auto-Fail') current.autoFailCount += 1;

    counts.set(caseType, current);
  });

  return Array.from(counts.entries())
    .map(([caseType, value]) => ({
      caseType,
      count: value.count,
      borderlineCount: value.borderlineCount,
      failCount: value.failCount,
      autoFailCount: value.autoFailCount,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.failCount !== a.failCount) return b.failCount - a.failCount;
      if (b.borderlineCount !== a.borderlineCount) return b.borderlineCount - a.borderlineCount;
      return a.caseType.localeCompare(b.caseType);
    });
}

function buildProcedureFlaggedCases(audits: AuditItem[]): ProcedureCaseItem[] {
  return audits
    .map((audit) => {
      const detail = getProcedureIssueDetail(audit);
      if (!detail) return null;

      return {
        id: audit.id,
        auditDate: audit.audit_date,
        agentName: audit.agent_name,
        team: audit.team,
        caseType: audit.case_type,
        qualityScore: Number(audit.quality_score),
        procedureResult: detail.result,
        metricComment: detail.metric_comment || null,
      } satisfies ProcedureCaseItem;
    })
    .filter((item): item is ProcedureCaseItem => item !== null)
    .sort((a, b) => {
      const dateCompare = String(b.auditDate || '').localeCompare(String(a.auditDate || ''));
      if (dateCompare !== 0) return dateCompare;
      return a.agentName.localeCompare(b.agentName);
    });
}

type ExcelCell = {
  value: string | number | null;
  type?: 'String' | 'Number';
  styleId?: string;
};

type ExcelSheet = {
  name: string;
  columnWidths?: number[];
  rows: ExcelCell[][];
};

function escapeExcelXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeExcelCell(
  value: string | number | null | undefined,
  styleId = 'Body',
  type?: 'String' | 'Number'
): ExcelCell {
  if (value == null || value === '') {
    return { value: '', styleId, type: 'String' };
  }

  if (type) {
    return { value, styleId, type };
  }

  return typeof value === 'number'
    ? { value, styleId, type: 'Number' }
    : { value: String(value), styleId, type: 'String' };
}

function buildExcelWorkbookXml(sheets: ExcelSheet[]) {
  const stylesXml = `
    <Styles>
      <Style ss:ID="Default" ss:Name="Normal">
        <Alignment ss:Vertical="Center"/>
        <Borders/>
        <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1F2937"/>
        <Interior/>
        <NumberFormat/>
        <Protection/>
      </Style>
      <Style ss:ID="Title">
        <Font ss:FontName="Calibri" ss:Bold="1" ss:Size="16" ss:Color="#0F172A"/>
        <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
        <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      </Style>
      <Style ss:ID="Section">
        <Font ss:FontName="Calibri" ss:Bold="1" ss:Size="11" ss:Color="#1D4ED8"/>
        <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
      </Style>
      <Style ss:ID="Header">
        <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#FFFFFF"/>
        <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
        <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        </Borders>
      </Style>
      <Style ss:ID="Body">
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        </Borders>
      </Style>
      <Style ss:ID="Number">
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        </Borders>
        <NumberFormat ss:Format="0.00"/>
      </Style>
      <Style ss:ID="Count">
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        </Borders>
        <NumberFormat ss:Format="0"/>
      </Style>
      <Style ss:ID="Good">
        <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#166534"/>
        <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
        </Borders>
      </Style>
      <Style ss:ID="Warning">
        <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#92400E"/>
        <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
        </Borders>
      </Style>
      <Style ss:ID="Bad">
        <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#991B1B"/>
        <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
        </Borders>
      </Style>
    </Styles>
  `.trim();

  const worksheetsXml = sheets
    .map((sheet) => {
      const columnsXml = (sheet.columnWidths || [])
        .map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`)
        .join('');

      const rowsXml = sheet.rows
        .map((row) => {
          const cellsXml = row
            .map((cell) => {
              const styleAttr = cell.styleId ? ` ss:StyleID="${cell.styleId}"` : '';
              const type = cell.type || (typeof cell.value === 'number' ? 'Number' : 'String');
              const value =
                cell.value == null
                  ? ''
                  : type === 'Number'
                  ? String(cell.value)
                  : escapeExcelXml(String(cell.value));

              return `<Cell${styleAttr}><Data ss:Type="${type}">${value}</Data></Cell>`;
            })
            .join('');

          return `<Row>${cellsXml}</Row>`;
        })
        .join('');

      return `
        <Worksheet ss:Name="${escapeExcelXml(sheet.name.slice(0, 31))}">
          <Table>
            ${columnsXml}
            ${rowsXml}
          </Table>
        </Worksheet>
      `.trim();
    })
    .join('');

  return `<?xml version="1.0"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  ${stylesXml}
  ${worksheetsXml}
</Workbook>`;
}

function downloadExcelWorkbook(filename: string, xml: string) {
  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilePart(value: string) {
  return String(value || 'trends')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || 'trends';
}

function getProcedureResultStyleId(result: string | null | undefined) {
  if (result === 'Borderline') return 'Warning';
  if (result === 'Fail' || result === 'Auto-Fail') return 'Bad';
  return 'Body';
}

function buildPerformanceTrendWorkbookXml(params: {
  subjectLabel: string;
  periodMode: PeriodMode;
  latestAverage: number | null;
  momentumDelta: number | null;
  teamGap: number | null;
  strongestIssue: string;
  procedureTotal: number;
  topProcedureCaseType: string;
  trendPoints: TrendPoint[];
  recurringIssues: RecurringIssue[];
  procedureHotspots: ProcedureHotspot[];
  procedureCases: ProcedureCaseItem[];
}) {
  const {
    subjectLabel,
    periodMode,
    latestAverage,
    momentumDelta,
    teamGap,
    strongestIssue,
    procedureTotal,
    topProcedureCaseType,
    trendPoints,
    recurringIssues,
    procedureHotspots,
    procedureCases,
  } = params;

  return buildExcelWorkbookXml([
    {
      name: 'Overview',
      columnWidths: [200, 200, 180, 180],
      rows: [
        [makeExcelCell('Performance Trends Export', 'Title')],
        [makeExcelCell('Generated', 'Section'), makeExcelCell(new Date().toLocaleString(), 'Body')],
        [makeExcelCell('Scope', 'Section'), makeExcelCell(subjectLabel, 'Body')],
        [makeExcelCell('Period Mode', 'Section'), makeExcelCell(periodMode === 'weekly' ? 'Weekly' : 'Monthly', 'Body')],
        [makeExcelCell('Current Average', 'Header'), makeExcelCell(latestAverage ?? '', latestAverage == null ? 'Body' : 'Number', latestAverage == null ? 'String' : 'Number')],
        [makeExcelCell('Momentum (pts)', 'Header'), makeExcelCell(momentumDelta ?? '', momentumDelta == null ? 'Body' : getProcedureResultStyleId(momentumDelta < 0 ? 'Fail' : momentumDelta > 0 ? 'Borderline' : ''), momentumDelta == null ? 'String' : 'Number')],
        [makeExcelCell('Vs Team Average (pts)', 'Header'), makeExcelCell(teamGap ?? '', teamGap == null ? 'Body' : getProcedureResultStyleId(teamGap < 0 ? 'Fail' : teamGap > 0 ? 'Borderline' : ''), teamGap == null ? 'String' : 'Number')],
        [makeExcelCell('Top Recurring Issue', 'Header'), makeExcelCell(strongestIssue, 'Body')],
        [makeExcelCell('Procedure Flagged Cases', 'Header'), makeExcelCell(procedureTotal, 'Count', 'Number')],
        [makeExcelCell('Top Procedure Case Type', 'Header'), makeExcelCell(topProcedureCaseType, 'Body')],
      ],
    },
    {
      name: 'Trend Breakdown',
      columnWidths: [130, 170, 130, 130, 120],
      rows: [
        [
          makeExcelCell('Period', 'Header'),
          makeExcelCell('Selected Scope Avg', 'Header'),
          makeExcelCell('Team Avg', 'Header'),
          makeExcelCell('Scoped Audits', 'Header'),
          makeExcelCell('Team Audits', 'Header'),
        ],
        ...trendPoints.map((point) => [
          makeExcelCell(point.label, 'Body'),
          makeExcelCell(point.subjectAverage ?? '', point.subjectAverage == null ? 'Body' : 'Number', point.subjectAverage == null ? 'String' : 'Number'),
          makeExcelCell(point.teamAverage ?? '', point.teamAverage == null ? 'Body' : 'Number', point.teamAverage == null ? 'String' : 'Number'),
          makeExcelCell(point.auditCount, 'Count', 'Number'),
          makeExcelCell(point.teamAuditCount, 'Count', 'Number'),
        ]),
      ],
    },
    {
      name: 'Recurring Issues',
      columnWidths: [180, 100, 100, 100, 100],
      rows: [
        [
          makeExcelCell('Metric', 'Header'),
          makeExcelCell('Total', 'Header'),
          makeExcelCell('Borderline', 'Header'),
          makeExcelCell('Fail', 'Header'),
          makeExcelCell('Auto-Fail', 'Header'),
        ],
        ...recurringIssues.map((issue) => [
          makeExcelCell(issue.metric, 'Body'),
          makeExcelCell(issue.count, 'Count', 'Number'),
          makeExcelCell(issue.borderlineCount, 'Count', 'Number'),
          makeExcelCell(issue.failCount, 'Count', 'Number'),
          makeExcelCell(issue.autoFailCount, 'Count', 'Number'),
        ]),
      ],
    },
    {
      name: 'Procedure Hotspots',
      columnWidths: [180, 100, 100, 100, 100],
      rows: [
        [
          makeExcelCell('Case Type', 'Header'),
          makeExcelCell('Total', 'Header'),
          makeExcelCell('Borderline', 'Header'),
          makeExcelCell('Fail', 'Header'),
          makeExcelCell('Auto-Fail', 'Header'),
        ],
        ...procedureHotspots.map((item) => [
          makeExcelCell(item.caseType, 'Body'),
          makeExcelCell(item.count, 'Count', 'Number'),
          makeExcelCell(item.borderlineCount, 'Count', 'Number'),
          makeExcelCell(item.failCount, 'Count', 'Number'),
          makeExcelCell(item.autoFailCount, 'Count', 'Number'),
        ]),
      ],
    },
    {
      name: 'Procedure Cases',
      columnWidths: [90, 140, 90, 140, 120, 110, 240],
      rows: [
        [
          makeExcelCell('Audit Date', 'Header'),
          makeExcelCell('Agent', 'Header'),
          makeExcelCell('Team', 'Header'),
          makeExcelCell('Case Type', 'Header'),
          makeExcelCell('Procedure Result', 'Header'),
          makeExcelCell('Quality Score', 'Header'),
          makeExcelCell('QA Note', 'Header'),
        ],
        ...procedureCases.map((item) => [
          makeExcelCell(item.auditDate, 'Body'),
          makeExcelCell(item.agentName, 'Body'),
          makeExcelCell(item.team, 'Body'),
          makeExcelCell(item.caseType, 'Body'),
          makeExcelCell(item.procedureResult, getProcedureResultStyleId(item.procedureResult)),
          makeExcelCell(item.qualityScore, 'Number', 'Number'),
          makeExcelCell(item.metricComment || '', 'Body'),
        ]),
      ],
    },
  ]);
}

function getMomentumLabel(value: number | null) {
  if (value == null) return 'Not enough data';
  if (value >= 2) return 'Rising';
  if (value <= -2) return 'Needs Attention';
  return 'Stable';
}

function getLineChartPoints(values: Array<number | null>, width: number, height: number, padding: number) {
  const validValues = values.filter((value): value is number => value != null);
  if (validValues.length === 0) return '';

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      if (value == null) return null;
      const x =
        padding +
        (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
      const y =
        height -
        padding -
        ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');
}

function MiniTrendChart({ points }: { points: TrendPoint[] }) {
  const subjectValues = points.map((point) => point.subjectAverage);
  const teamValues = points.map((point) => point.teamAverage);

  const subjectPolyline = getLineChartPoints(subjectValues, 1000, 240, 28);
  const teamPolyline = getLineChartPoints(teamValues, 1000, 240, 28);

  if (points.length === 0) {
    return <div style={emptyStateStyle}>No audit trend data for this selection.</div>;
  }

  return (
    <div style={chartShellStyle}>
      <svg
        viewBox="0 0 1000 240"
        preserveAspectRatio="none"
        style={chartSvgStyle}
      >
        <line x1="28" y1="212" x2="972" y2="212" style={chartAxisStyle} />
        {teamPolyline ? (
          <polyline
            points={teamPolyline}
            fill="none"
            stroke="rgba(148,163,184,0.85)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {subjectPolyline ? (
          <polyline
            points={subjectPolyline}
            fill="none"
            stroke="rgba(37,99,235,0.95)"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      <div style={chartLegendStyle}>
        <span style={legendItemStyle}>
          <span style={{ ...legendDotStyle, background: 'rgba(37,99,235,0.95)' }} />
          Selected Scope
        </span>
        <span style={legendItemStyle}>
          <span style={{ ...legendDotStyle, background: 'rgba(148,163,184,0.85)' }} />
          Team Average
        </span>
      </div>

      <div style={chartLabelsRowStyle}>
        {points.map((point) => (
          <div key={point.key} style={chartLabelStyle}>
            {point.shortLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerformanceTrendsSection({
  audits,
  allAudits,
  selectedAgent,
  effectiveTeamFilter,
}: Props) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');

  const trendPoints = useMemo(() => {
    return buildTrendPoints(audits, allAudits, periodMode);
  }, [audits, allAudits, periodMode]);

  const recurringIssues = useMemo(() => {
    return buildRecurringIssues(audits);
  }, [audits]);

  const procedureHotspots = useMemo(() => {
    return buildProcedureHotspots(audits);
  }, [audits]);

  const procedureCases = useMemo(() => {
    return buildProcedureFlaggedCases(audits);
  }, [audits]);

  const latestAverage = trendPoints.length > 0
    ? trendPoints[trendPoints.length - 1].subjectAverage
    : null;

  const previousAverage = trendPoints.length > 1
    ? trendPoints[trendPoints.length - 2].subjectAverage
    : null;

  const teamLatestAverage = trendPoints.length > 0
    ? trendPoints[trendPoints.length - 1].teamAverage
    : null;

  const momentumDelta =
    latestAverage != null && previousAverage != null
      ? Number((latestAverage - previousAverage).toFixed(2))
      : null;

  const teamGap =
    latestAverage != null && teamLatestAverage != null
      ? Number((latestAverage - teamLatestAverage).toFixed(2))
      : null;

  const subjectLabel = selectedAgent
    ? (selectedAgent.display_name
        ? `${selectedAgent.agent_name} - ${selectedAgent.display_name}`
        : `${selectedAgent.agent_name} - ${selectedAgent.agent_id || '-'}`)
    : effectiveTeamFilter
    ? `${effectiveTeamFilter} Team`
    : 'All Teams';

  const strongestIssue = recurringIssues[0]?.metric || 'None';
  const totalIssueTouches = recurringIssues.reduce((sum, issue) => sum + issue.count, 0);
  const procedureTotal = procedureCases.length;
  const topProcedureCaseType = procedureHotspots[0]?.caseType || 'None';

  function handleExportTrendWorkbook() {
    const workbookXml = buildPerformanceTrendWorkbookXml({
      subjectLabel,
      periodMode,
      latestAverage,
      momentumDelta,
      teamGap,
      strongestIssue,
      procedureTotal,
      topProcedureCaseType,
      trendPoints,
      recurringIssues,
      procedureHotspots,
      procedureCases,
    });

    downloadExcelWorkbook(
      `performance_trends_${sanitizeFilePart(subjectLabel)}_${periodMode}_${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
      workbookXml
    );
  }

  return (
    <Section title="Performance Trends">
      <div style={sectionHeaderRowStyle}>
        <div>
          <div style={sectionEyebrowStyle}>Trend Layer</div>
          <h3 style={sectionTitleStyle}>Quality movement, team baseline, recurring issues, and procedure risk</h3>
          <p style={sectionSubtitleStyle}>
            Selected scope: <strong>{subjectLabel}</strong>
          </p>
        </div>

        <div style={trendActionsWrapStyle}>
          <div style={toggleWrapStyle}>
            <button
              type="button"
              onClick={() => setPeriodMode('weekly')}
              style={{
                ...toggleButtonStyle,
                ...(periodMode === 'weekly' ? toggleButtonActiveStyle : {}),
              }}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('monthly')}
              style={{
                ...toggleButtonStyle,
                ...(periodMode === 'monthly' ? toggleButtonActiveStyle : {}),
              }}
            >
              Monthly
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportTrendWorkbook}
            style={exportTrendButtonStyle}
          >
            Export Trends Excel
          </button>
        </div>
      </div>

      <div style={summaryGridStyle}>
        <SummaryCard
          title="Current Average"
          value={latestAverage != null ? `${latestAverage.toFixed(2)}%` : '-'}
          subtitle="Latest visible period"
        />
        <SummaryCard
          title="Momentum"
          value={getMomentumLabel(momentumDelta)}
          subtitle={
            momentumDelta != null
              ? `${momentumDelta > 0 ? '+' : ''}${momentumDelta.toFixed(2)} pts vs prior period`
              : 'Need at least 2 periods'
          }
        />
        <SummaryCard
          title="Vs Team Average"
          value={
            teamGap != null
              ? `${teamGap > 0 ? '+' : ''}${teamGap.toFixed(2)} pts`
              : '-'
          }
          subtitle="Latest visible period"
        />
        <SummaryCard
          title="Top Recurring Issue"
          value={strongestIssue}
          subtitle={`${totalIssueTouches} total issue hits in selection`}
        />
        <SummaryCard
          title="Procedure Flags"
          value={procedureTotal ? String(procedureTotal) : '-'}
          subtitle={`Top case type: ${topProcedureCaseType}`}
        />
      </div>

      <MiniTrendChart points={trendPoints} />

      <div style={detailsGridStyle}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Trend Breakdown</div>

          {trendPoints.length === 0 ? (
            <div style={emptyStateStyle}>No periods available.</div>
          ) : (
            <div style={tableWrapStyle}>
              <div style={{ ...tableRowStyle, ...tableHeaderRowStyle }}>
                <div>Period</div>
                <div>Selected Scope</div>
                <div>Team Avg</div>
                <div>Scoped Audits</div>
                <div>Team Audits</div>
              </div>

              {trendPoints.map((point) => (
                <div key={point.key} style={tableRowStyle}>
                  <div>{point.label}</div>
                  <div>{point.subjectAverage != null ? `${point.subjectAverage.toFixed(2)}%` : '-'}</div>
                  <div>{point.teamAverage != null ? `${point.teamAverage.toFixed(2)}%` : '-'}</div>
                  <div>{point.auditCount}</div>
                  <div>{point.teamAuditCount}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <div style={panelTitleStyle}>Recurring Issues</div>

          {recurringIssues.length === 0 ? (
            <div style={emptyStateStyle}>No recurring Borderline / Fail / Auto-Fail issues in this range.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {recurringIssues.map((issue) => (
                <div key={issue.metric} style={issueCardStyle}>
                  <div style={issueHeaderRowStyle}>
                    <div style={issueMetricStyle}>{issue.metric}</div>
                    <div style={issueCountPillStyle}>{issue.count}</div>
                  </div>

                  <div style={issueMetaStyle}>
                    Borderline: {issue.borderlineCount} · Fail: {issue.failCount} · Auto-Fail: {issue.autoFailCount}
                  </div>

                  <div style={issueBarTrackStyle}>
                    <div
                      style={{
                        ...issueBarFillStyle,
                        width: `${Math.max(
                          12,
                          Math.round((issue.count / Math.max(recurringIssues[0]?.count || 1, 1)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={procedurePanelGridStyle}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Procedure Hotspots by Case Type</div>

          {procedureHotspots.length === 0 ? (
            <div style={emptyStateStyle}>No procedure Borderline / Fail cases in this range.</div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ ...procedureHotspotRowStyle, ...tableHeaderRowStyle }}>
                <div>Case Type</div>
                <div>Total</div>
                <div>Borderline</div>
                <div>Fail</div>
                <div>Auto-Fail</div>
              </div>

              {procedureHotspots.slice(0, 8).map((item) => (
                <div key={item.caseType} style={procedureHotspotRowStyle}>
                  <div>{item.caseType}</div>
                  <div>{item.count}</div>
                  <div>{item.borderlineCount}</div>
                  <div>{item.failCount}</div>
                  <div>{item.autoFailCount}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <div style={panelTitleStyle}>Recent Procedure Borderline / Fail Cases</div>

          {procedureCases.length === 0 ? (
            <div style={emptyStateStyle}>No procedure-flagged cases in this range.</div>
          ) : (
            <div style={procedureCasesWrapStyle}>
              <div style={procedureCasesTableStyle}>
                <div style={{ ...procedureCasesRowStyle, ...tableHeaderRowStyle }}>
                  <div>Date</div>
                  <div>Agent</div>
                  <div>Team</div>
                  <div>Case Type</div>
                  <div>Procedure</div>
                  <div>Quality</div>
                </div>

                {procedureCases.slice(0, 16).map((item) => (
                  <div key={item.id} style={procedureCasesRowStyle}>
                    <div>{item.auditDate}</div>
                    <div>{item.agentName}</div>
                    <div>{item.team}</div>
                    <div>{item.caseType}</div>
                    <div>{item.procedureResult}</div>
                    <div>{item.qualityScore.toFixed(2)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedAgent && effectiveTeamFilter ? (
        <div style={helperNoteStyle}>
          Team trend is comparing the filtered team against itself. Once an agent is selected, this block becomes agent vs team.
        </div>
      ) : null}

      {!selectedAgent && !effectiveTeamFilter ? (
        <div style={helperNoteStyle}>
          With no team or agent selected, this block shows all visible audits as the selected scope and compares them to the same overall baseline.
        </div>
      ) : null}
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStaticStyle}>
        <div style={sectionEyebrowStyle}>Insights</div>
        <h2 style={sectionTopTitleStyle}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{title}</div>
      <div style={summaryValueStyle}>{value}</div>
      <div style={summarySubtextStyle}>{subtitle}</div>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  marginTop: '28px',
  padding: '22px',
  borderRadius: '24px',
  border: '1px solid var(--screen-border, rgba(148,163,184,0.14))',
  background:
    'var(--screen-panel-bg, linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%))',
  boxShadow: 'var(--screen-shadow, 0 18px 40px rgba(2,6,23,0.35))',
};

const sectionHeaderStaticStyle: CSSProperties = {
  marginBottom: '18px',
};

const sectionTopTitleStyle: CSSProperties = {
  margin: '6px 0 0 0',
  color: 'var(--screen-heading, #f8fafc)',
  fontSize: '28px',
};

const sectionHeaderRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
};

const sectionEyebrowStyle: CSSProperties = {
  color: 'var(--screen-accent, #60a5fa)',
  fontSize: '12px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 800,
};

const sectionTitleStyle: CSSProperties = {
  margin: '8px 0 6px 0',
  color: 'var(--screen-heading, #f8fafc)',
  fontSize: '24px',
};

const sectionSubtitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--screen-muted, #94a3b8)',
};

const trendActionsWrapStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const toggleWrapStyle: CSSProperties = {
  display: 'inline-flex',
  gap: '8px',
  padding: '6px',
  borderRadius: '18px',
  background: 'var(--screen-card-soft-bg, rgba(15,23,42,0.52))',
  border: '1px solid var(--screen-border, rgba(148,163,184,0.14))',
};

const toggleButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--screen-muted, #94a3b8)',
  padding: '10px 14px',
  borderRadius: '12px',
  fontWeight: 800,
  cursor: 'pointer',
};

const toggleButtonActiveStyle: CSSProperties = {
  background: 'rgba(37,99,235,0.16)',
  color: 'var(--screen-heading, #f8fafc)',
};

const exportTrendButtonStyle: CSSProperties = {
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  padding: '12px 16px',
  borderRadius: '12px',
  fontWeight: 800,
  cursor: 'pointer',
};

const summaryGridStyle: CSSProperties = {
  marginTop: '18px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
};

const summaryCardStyle: CSSProperties = {
  borderRadius: '20px',
  padding: '16px',
  background: 'var(--screen-card-bg, rgba(15,23,42,0.82))',
  border: '1px solid var(--screen-border, rgba(148,163,184,0.14))',
};

const summaryLabelStyle: CSSProperties = {
  color: 'var(--screen-muted, #94a3b8)',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  fontWeight: 800,
};

const summaryValueStyle: CSSProperties = {
  marginTop: '10px',
  fontSize: '28px',
  fontWeight: 900,
  color: 'var(--screen-heading, #f8fafc)',
};

const summarySubtextStyle: CSSProperties = {
  marginTop: '8px',
  color: 'var(--screen-subtle, #94a3b8)',
  fontSize: '13px',
  lineHeight: 1.5,
};

const chartShellStyle: CSSProperties = {
  marginTop: '18px',
  borderRadius: '22px',
  padding: '18px',
  background: 'var(--screen-card-bg, rgba(15,23,42,0.82))',
  border: '1px solid var(--screen-border, rgba(148,163,184,0.14))',
};

const chartSvgStyle: CSSProperties = {
  width: '100%',
  height: '260px',
  display: 'block',
};

const chartAxisStyle = {
  stroke: 'rgba(148,163,184,0.28)',
  strokeWidth: 2,
};

const chartLegendStyle: CSSProperties = {
  display: 'flex',
  gap: '18px',
  flexWrap: 'wrap',
  marginTop: '10px',
};

const legendItemStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  color: 'var(--screen-muted, #94a3b8)',
  fontWeight: 700,
  fontSize: '13px',
};

const legendDotStyle: CSSProperties = {
  width: '12px',
  height: '12px',
  borderRadius: '999px',
  display: 'inline-block',
};

const chartLabelsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
  gap: '8px',
  marginTop: '14px',
};

const chartLabelStyle: CSSProperties = {
  color: 'var(--screen-subtle, #94a3b8)',
  fontSize: '12px',
  textAlign: 'center',
};

const detailsGridStyle: CSSProperties = {
  marginTop: '18px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
  gap: '14px',
};

const procedurePanelGridStyle: CSSProperties = {
  marginTop: '18px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
  gap: '14px',
};

const panelStyle: CSSProperties = {
  borderRadius: '20px',
  padding: '18px',
  background: 'var(--screen-card-bg, rgba(15,23,42,0.82))',
  border: '1px solid var(--screen-border, rgba(148,163,184,0.14))',
};

const panelTitleStyle: CSSProperties = {
  margin: '0 0 14px 0',
  color: 'var(--screen-heading, #f8fafc)',
  fontSize: '18px',
  fontWeight: 800,
};

const tableWrapStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
};

const tableRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.35fr 0.9fr 0.9fr 0.7fr 0.7fr',
  gap: '12px',
  padding: '12px 14px',
  borderRadius: '14px',
  background: 'var(--screen-card-soft-bg, rgba(15,23,42,0.52))',
  color: 'var(--screen-text, #e5eefb)',
  alignItems: 'center',
};

const procedureHotspotRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 0.6fr 0.8fr 0.6fr 0.7fr',
  gap: '12px',
  padding: '12px 14px',
  borderRadius: '14px',
  background: 'var(--screen-card-soft-bg, rgba(15,23,42,0.52))',
  color: 'var(--screen-text, #e5eefb)',
  alignItems: 'center',
};

const procedureCasesWrapStyle: CSSProperties = {
  maxHeight: '360px',
  overflowY: 'auto',
  borderRadius: '16px',
  border: '1px solid var(--screen-border, rgba(148,163,184,0.14))',
  background: 'var(--screen-card-soft-bg, rgba(15,23,42,0.52))',
};

const procedureCasesTableStyle: CSSProperties = {
  minWidth: '100%',
};

const procedureCasesRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '0.9fr 1.2fr 0.7fr 1.1fr 0.9fr 0.8fr',
  gap: '12px',
  padding: '12px 14px',
  borderBottom: '1px solid var(--screen-border, rgba(148,163,184,0.14))',
  alignItems: 'center',
  color: 'var(--screen-text, #e5eefb)',
};

const tableHeaderRowStyle: CSSProperties = {
  color: 'var(--screen-accent, #60a5fa)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: 800,
  fontSize: '12px',
};

const issueCardStyle: CSSProperties = {
  padding: '14px',
  borderRadius: '16px',
  background: 'var(--screen-card-soft-bg, rgba(15,23,42,0.52))',
  border: '1px solid var(--screen-border, rgba(148,163,184,0.14))',
};

const issueHeaderRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  alignItems: 'center',
};

const issueMetricStyle: CSSProperties = {
  color: 'var(--screen-heading, #f8fafc)',
  fontWeight: 800,
};

const issueCountPillStyle: CSSProperties = {
  minWidth: '32px',
  height: '32px',
  padding: '0 10px',
  borderRadius: '999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(37,99,235,0.16)',
  color: 'var(--screen-heading, #f8fafc)',
  fontWeight: 900,
};

const issueMetaStyle: CSSProperties = {
  marginTop: '8px',
  color: 'var(--screen-muted, #94a3b8)',
  fontSize: '13px',
};

const issueBarTrackStyle: CSSProperties = {
  marginTop: '10px',
  width: '100%',
  height: '10px',
  borderRadius: '999px',
  background: 'rgba(148,163,184,0.16)',
  overflow: 'hidden',
};

const issueBarFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: '999px',
  background: 'linear-gradient(90deg, rgba(37,99,235,0.95) 0%, rgba(59,130,246,0.88) 100%)',
};

const helperNoteStyle: CSSProperties = {
  marginTop: '14px',
  color: 'var(--screen-muted, #94a3b8)',
  fontSize: '13px',
  lineHeight: 1.6,
};

const emptyStateStyle: CSSProperties = {
  color: 'var(--screen-muted, #94a3b8)',
  fontSize: '14px',
  lineHeight: 1.6,
};