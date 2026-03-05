import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';

describe('api', () => {
  it('returns projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('returns memory groups with files array', async () => {
    const res = await request(app).get('/api/memory');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('uploads a memory markdown file', async () => {
    const res = await request(app)
      .post('/api/memory')
      .field('agent', 'Etiven')
      .field('title', 'Memory-Unit-Test')
      .attach('file', Buffer.from('# Test Memory\n\ncontent'), 'test.md');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });
});
