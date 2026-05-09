import { test } from 'node:test';
import assert from 'node:assert';
import { buildTrendPoints } from './reportsAnalytics.ts';

test('buildTrendPoints - empty inputs', () => {
  const result = buildTrendPoints([], [], 'weekly');
  assert.strictEqual(result.length, 0);
});

test('buildTrendPoints - basic weekly trend', () => {
  const subjectAudits = [
    { audit_date: '2024-01-01', quality_score: 90 },
    { audit_date: '2024-01-02', quality_score: 100 },
  ];
  const teamAudits = [
    { audit_date: '2024-01-01', quality_score: 80 },
  ];

  const result = buildTrendPoints(subjectAudits, teamAudits, 'weekly');

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].key, '2024-01-01');
  assert.strictEqual(result[0].subjectAverage, 95);
  assert.strictEqual(result[0].teamAverage, 80);
  assert.strictEqual(result[0].auditCount, 2);
  assert.strictEqual(result[0].teamAuditCount, 1);
});

test('buildTrendPoints - monthly mode', () => {
  const subjectAudits = [
    { audit_date: '2024-01-01', quality_score: 90 },
    { audit_date: '2024-02-01', quality_score: 80 },
  ];
  const teamAudits = [
    { audit_date: '2024-01-15', quality_score: 70 },
  ];

  const result = buildTrendPoints(subjectAudits, teamAudits, 'monthly');

  assert.strictEqual(result.length, 2);

  // January
  assert.strictEqual(result[0].key, '2024-01');
  assert.strictEqual(result[0].subjectAverage, 90);
  assert.strictEqual(result[0].teamAverage, 70);
  assert.strictEqual(result[0].auditCount, 1);
  assert.strictEqual(result[0].teamAuditCount, 1);

  // February
  assert.strictEqual(result[1].key, '2024-02');
  assert.strictEqual(result[1].subjectAverage, 80);
  assert.strictEqual(result[1].teamAverage, null);
  assert.strictEqual(result[1].auditCount, 1);
  assert.strictEqual(result[1].teamAuditCount, 0);
});

test('buildTrendPoints - multiple weeks', () => {
    const subjectAudits = [
      { audit_date: '2024-01-01', quality_score: 100 }, // Monday
      { audit_date: '2024-01-08', quality_score: 50 },  // Next Monday
    ];

    const result = buildTrendPoints(subjectAudits, [], 'weekly');

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].key, '2024-01-01');
    assert.strictEqual(result[1].key, '2024-01-08');
});

test('buildTrendPoints - handles invalid data', () => {
    const subjectAudits = [
      { audit_date: 'invalid', quality_score: 100 },
      { audit_date: '2024-01-01', quality_score: 'not-a-number' as any },
      { audit_date: '2024-01-01', quality_score: 100 },
    ];

    const result = buildTrendPoints(subjectAudits, [], 'weekly');

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].auditCount, 1);
    assert.strictEqual(result[0].subjectAverage, 100);
});

test('buildTrendPoints - handles missing scores in some audits but not others in same period', () => {
    const subjectAudits = [
        { audit_date: '2024-01-01', quality_score: 100 },
        { audit_date: '2024-01-01', quality_score: undefined },
      ];

      const result = buildTrendPoints(subjectAudits, [], 'weekly');

      // Based on implementation: if quality_score is undefined, asNumber returns null (because Number(undefined) is NaN),
      // and buildTrendPoints skips audits where score is null.
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].auditCount, 1);
      assert.strictEqual(result[0].subjectAverage, 100);
});

test('buildTrendPoints - handles quality_score of 0 correctly', () => {
    const subjectAudits = [
        { audit_date: '2024-01-01', quality_score: 0 },
        { audit_date: '2024-01-01', quality_score: 100 },
      ];

      const result = buildTrendPoints(subjectAudits, [], 'weekly');

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].auditCount, 2);
      assert.strictEqual(result[0].subjectAverage, 50);
});
