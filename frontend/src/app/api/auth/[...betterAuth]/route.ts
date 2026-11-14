import { NextRequest, NextResponse } from 'next/server';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.VIBRA_API_ORIGIN || 'http://127.0.0.1:4173';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ betterAuth: string[] }> }
) {
  const { betterAuth } = await params;
  const path = betterAuth.join('/');
  const url = new URL(`/api/auth/${path}`, API_ORIGIN);
  url.search = request.nextUrl.search;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': request.headers.get('cookie') || '',
      'Origin': request.headers.get('origin') || '',
    },
    credentials: 'include',
  });

  return handleResponse(response);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ betterAuth: string[] }> }
) {
  const { betterAuth } = await params;
  const path = betterAuth.join('/');
  const url = new URL(`/api/auth/${path}`, API_ORIGIN);
  url.search = request.nextUrl.search;

  const body = await request.text();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('cookie') || '',
      'Origin': request.headers.get('origin') || '',
    },
    body: body || undefined,
    credentials: 'include',
  });

  return handleResponse(response);
}

async function handleResponse(response: Response): Promise<NextResponse> {
  const responseHeaders = new Headers(response.headers);
  
  // Rewrite Set-Cookie headers to work on frontend domain
  const setCookieHeaders = responseHeaders.getSetCookie();
  if (setCookieHeaders.length > 0) {
    responseHeaders.delete('set-cookie');
    for (const cookie of setCookieHeaders) {
      // Remove Domain attribute to make it host-only (frontend domain)
      // Change SameSite=Lax to SameSite=None for cross-site (if needed)
      let newCookie = cookie
        .replace(/;?\s*Domain=[^;]+/i, '')
        .replace(/;?\s*SameSite=Lax/i, '; SameSite=None');
      
      // Ensure Secure is present with SameSite=None
      if (!/;?\s*Secure/i.test(newCookie)) {
        newCookie += '; Secure';
      }
      
      responseHeaders.append('Set-Cookie', newCookie);
    }
  }

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}