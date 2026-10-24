import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as supabaseClientModule from '@/lib/supabase/client';
import { GET } from '@/app/api/health/route';

describe('/api/health GET handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { ok: true } with status 200 when Supabase query succeeds', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'coord-1' }], error: null }),
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>
    );

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockSupabase.from).toHaveBeenCalledWith('coordinates');
    expect(mockSelect).toHaveBeenCalledWith('id');
  });

  it('returns { ok: false } with status 500 when Supabase query returns an error', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database paused' } }),
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>
    );

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ ok: false });
    // Verify no error details are exposed
    expect(data.error).toBeUndefined();
  });

  it('returns { ok: false } with status 500 when Supabase is not configured', async () => {
    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ ok: false });
  });

  it('returns { ok: false } with status 500 when query throws an unhandled exception', async () => {
    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockImplementation(() => {
      throw new Error('Network fatal error');
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ ok: false });
    expect(data.message).toBeUndefined();
  });
});
