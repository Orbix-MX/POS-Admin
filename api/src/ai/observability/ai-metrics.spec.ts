import { AiMetrics } from './ai-metrics';

describe('AiMetrics', () => {
  it('expone en el snapshot lo que se registró (criterio de aceptación: aparece en /metrics)', async () => {
    const metrics = new AiMetrics();

    metrics.recordRequest('ai.echo', 'SUCCESS');
    metrics.recordDuration('ai.echo', 120);
    metrics.recordTokens(10, 20);
    metrics.recordSchemaRepair('ai.echo');
    metrics.recordQuotaRejection('FREE');

    const snapshot = await metrics.snapshot();

    expect(snapshot).toContain('ai_requests_total');
    expect(snapshot).toContain('feature="ai.echo"');
    expect(snapshot).toContain('status="SUCCESS"');
    expect(snapshot).toContain('ai_request_duration_seconds');
    expect(snapshot).toContain('ai_tokens_total');
    expect(snapshot).toContain('ai_schema_repair_total');
    expect(snapshot).toContain('ai_quota_rejections_total');
    expect(snapshot).toContain('plan="FREE"');
  });
});
