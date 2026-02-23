import { prisma } from '../src/lib/prisma';

async function main() {
  // Find all leads, group by company name, keep highest score
  const leads = await prisma.lead.findMany({
    include: { company: true },
    orderBy: { totalScore: 'desc' },
  });

  const seen = new Map<string, string>(); // name -> leadId to keep
  const toDelete: string[] = [];

  for (const lead of leads) {
    const name = lead.company?.name?.toLowerCase().trim();
    if (!name) continue;
    if (seen.has(name)) {
      toDelete.push(lead.id);
      console.log(`Duplicate: ${lead.company?.name} (id=${lead.id}, score=${lead.totalScore}) → will delete`);
    } else {
      seen.set(name, lead.id);
    }
  }

  console.log(`\nFound ${toDelete.length} duplicates to remove`);
  for (const id of toDelete) {
    await prisma.auditLog.deleteMany({ where: { leadId: id } });
    await prisma.note.deleteMany({ where: { leadId: id } });
    await prisma.task.deleteMany({ where: { leadId: id } });
    await prisma.opportunity.deleteMany({ where: { leadId: id } });
    await prisma.lead.delete({ where: { id } });
    console.log(`Deleted lead ${id}`);
  }
  console.log('Done');
}

main().catch(console.error).finally(() => (prisma as any).$disconnect());
