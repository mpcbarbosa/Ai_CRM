import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function settingsRoutes(app: FastifyInstance) {
  // GET all settings
  app.get('/api/settings', async (req, reply) => {
    const settings = await prisma.setting.findMany();
    const result: Record<string, any> = {};
    for (const s of settings) {
      try { result[s.key] = JSON.parse(s.value); }
      catch { result[s.key] = s.value; }
    }
    return reply.send(result);
  });

  // GET single setting
  app.get('/api/settings/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const setting = await prisma.setting.findUnique({ where: { key } });
    if (!setting) return reply.status(404).send({ error: 'Setting not found' });
    try { return reply.send({ key, value: JSON.parse(setting.value) }); }
    catch { return reply.send({ key, value: setting.value }); }
  });

  // PUT update setting
  app.put('/api/settings/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { value } = req.body as { value: any };
    const stored = typeof value === 'string' ? value : JSON.stringify(value);
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: stored },
      create: { key, value: stored },
    });
    return reply.send({ key, value });
  });
}
