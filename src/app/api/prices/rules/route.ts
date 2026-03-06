import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getPriceService } from '@/app/api/_lib/service-factory';
import { jsonResponse, errorResponse } from '@/app/api/_lib/response';
import type { PriceRule, RuleFilter, RuleType } from '@/domain/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const filter: RuleFilter = {};

  const type = searchParams.get('type');
  if (type) filter.type = type as RuleType;

  const pricelistId = searchParams.get('pricelistId');
  if (pricelistId) filter.pricelistId = pricelistId;

  const enabledParam = searchParams.get('enabled');
  if (enabledParam !== null) {
    filter.enabled = enabledParam === 'true';
  }

  try {
    const service = getPriceService();
    const rules = await service.listRules(filter);
    return jsonResponse(rules);
  } catch (err) {
    console.error('Unexpected error in GET /api/prices/rules:', err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 'INVALID_BODY', 400);
  }

  const data = body as Record<string, unknown>;

  if (!data.name || typeof data.name !== 'string') {
    return errorResponse('Missing required field: name', 'MISSING_FIELD', 400);
  }
  if (!data.type || typeof data.type !== 'string') {
    return errorResponse('Missing required field: type', 'MISSING_FIELD', 400);
  }
  if (typeof data.priority !== 'number') {
    return errorResponse('Missing required field: priority (must be a number)', 'MISSING_FIELD', 400);
  }
  if (!Array.isArray(data.conditions)) {
    return errorResponse('Missing required field: conditions (must be an array)', 'MISSING_FIELD', 400);
  }
  if (!data.adjustment || typeof data.adjustment !== 'object') {
    return errorResponse('Missing required field: adjustment', 'MISSING_FIELD', 400);
  }

  const now = new Date().toISOString();
  const rule: PriceRule = {
    ...(data as Omit<PriceRule, 'id' | 'createdAt' | 'updatedAt'>),
    id: uuidv4(),
    name: data.name,
    type: data.type as RuleType,
    priority: data.priority,
    conditions: data.conditions,
    adjustment: data.adjustment as PriceRule['adjustment'],
    enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
    override: typeof data.override === 'boolean' ? data.override : undefined,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const service = getPriceService();
    const created = await service.createRule(rule);
    return jsonResponse(created, 201);
  } catch (err) {
    console.error('Unexpected error in POST /api/prices/rules:', err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
