type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, string | number>,
  ) => Promise<{ error: { message?: string } | null }>;
};

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function consumeRateLimit(
  supabase: RpcClient,
  action: string,
  bucketKey: string,
  maxCount: number,
  windowSeconds: number,
): Promise<boolean> {
  const { error } = await supabase.rpc('assert_rate_limit', {
    p_action: action,
    p_bucket_key: bucketKey,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });

  return !error;
}
