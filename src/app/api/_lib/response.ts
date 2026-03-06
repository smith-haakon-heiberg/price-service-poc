import { NextResponse } from 'next/server';

export function jsonResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(
  message: string,
  code: string,
  status: number
): NextResponse {
  return NextResponse.json(
    { error: { message, code } },
    { status }
  );
}
