import { NextResponse } from 'next/server';
import { apiError, requireSameOrigin, requireUser, AccessError } from '@/server/access';
import { dispatch } from '@/server/data/dispatch';
import { object, text } from '@/server/validation';

export async function POST(request: Request, { params }: { params: Promise<{ domain: string }> }) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser();
    const raw = await request.text();
    if (raw.length > 64000) throw new AccessError(413, 'Request too large');
    const body = object(JSON.parse(raw));
    if (!Array.isArray(body.args) || body.args.length > 4) throw new AccessError(400, 'Invalid arguments');
    const { domain } = await params;
    const data = await dispatch(actor, domain, text(body.action, 60), body.args);
    return NextResponse.json({ data: data ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
