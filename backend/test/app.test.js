import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';

describe('api', () => {
  it('returns projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('returns memory groups', async () => {
    const res = await request(app).get('/api/memory');
    expect(res.status).toBe(200);
    expect(res.body.some((x) => x.agent === 'Etiven')).toBe(true);
  });
});
