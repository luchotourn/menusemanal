import { describe, it, expect, vi, afterEach } from 'vitest';

// resolveApiUrl reads VITE_API_BASE_URL at module load, so each case stubs the
// env and re-imports the module with a fresh module registry.
async function loadResolver(base: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', base);
  const mod = await import('../queryClient');
  return mod.resolveApiUrl;
}

describe('resolveApiUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('keeps relative API paths on the web build (empty base)', async () => {
    const resolve = await loadResolver('');
    expect(resolve('/api/recipes')).toBe('/api/recipes');
    expect(resolve('/api/meal-plans?startDate=2026-06-22')).toBe(
      '/api/meal-plans?startDate=2026-06-22',
    );
  });

  it('prepends the base for the mobile/Capacitor build', async () => {
    const resolve = await loadResolver('https://menusemanal.app');
    expect(resolve('/api/recipes')).toBe('https://menusemanal.app/api/recipes');
  });

  it('strips a trailing slash on the base to avoid a double slash', async () => {
    const resolve = await loadResolver('https://menusemanal.app/');
    expect(resolve('/api/recipes')).toBe('https://menusemanal.app/api/recipes');
  });

  it('adds a separating slash when the path lacks a leading slash', async () => {
    const resolve = await loadResolver('https://menusemanal.app');
    expect(resolve('api/recipes')).toBe('https://menusemanal.app/api/recipes');
  });

  it('leaves already-absolute URLs untouched (mobile build)', async () => {
    const resolve = await loadResolver('https://menusemanal.app');
    expect(resolve('https://wa.me/?text=hola')).toBe('https://wa.me/?text=hola');
    expect(resolve('http://example.com/x')).toBe('http://example.com/x');
  });

  it('leaves absolute URLs untouched on web too', async () => {
    const resolve = await loadResolver('');
    expect(resolve('https://wa.me/?text=hola')).toBe('https://wa.me/?text=hola');
  });
});
