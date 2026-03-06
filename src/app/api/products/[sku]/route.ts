import { NextRequest } from 'next/server';
import { getPriceService } from '@/app/api/_lib/service-factory';
import { jsonResponse, errorResponse } from '@/app/api/_lib/response';

type RouteContext = { params: Promise<{ sku: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { sku } = await params;

  try {
    const service = getPriceService();
    const product = await service.getProduct(sku);
    if (!product) {
      return errorResponse(`Product not found: ${sku}`, 'NOT_FOUND', 404);
    }
    return jsonResponse(product);
  } catch (err) {
    console.error(`Unexpected error in GET /api/products/${sku}:`, err);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
