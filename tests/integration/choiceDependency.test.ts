import { PrismaClient } from '@prisma/client';
import { DraftService } from '../../src/services/draftService';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping integration test: DATABASE_URL not set');
    return;
  }

  const prisma = new PrismaClient();
  const draftService = new DraftService(prisma);

  let cs: any = null;
  let choiceInclude: any = null;
  let choiceExclude: any = null;
  let dep: any = null;
  let draft: any = null;

  try {
    cs = await prisma.contentSource.create({ data: { name: `choice-dep-cs-${Date.now()}` } });

    const cls = await prisma.class.create({
      data: {
        name: `DepClass-${Date.now()}`,
        contentSourceId: cs.id,
        sourceRef: `cs:class:dep-${Date.now()}`,
      },
    });

    choiceInclude = await prisma.choice.create({
      data: {
        contentSourceId: cs.id,
        sourceType: 'class',
        sourceId: cls.id,
        sourceRef: `choice:include:${Date.now()}`,
        optionsJson: [{ id: 'o1', label: 'O1' }],
      },
    });

    choiceExclude = await prisma.choice.create({
      data: {
        contentSourceId: cs.id,
        sourceType: 'class',
        sourceId: cls.id,
        sourceRef: `choice:exclude:${Date.now()}`,
        optionsJson: [{ id: 'o2', label: 'O2' }],
      },
    });

    // Add dependency: choiceExclude excludes the class sourceRef, so it should be filtered out
    dep = await prisma.ruleDependency.create({
      data: {
        sourceRef: choiceExclude.sourceRef ?? `choice:exclude:${Date.now()}`,
        targetRef: cls.sourceRef ?? `cs:class:dep-${Date.now()}`,
        relationType: 'excludes',
      },
    });

    draft = await draftService.createDraft('choice-dep-draft');
    await draftService.setClassForDraft(draft.id, cls.id);

    const fetched = await draftService.getDraft(draft.id);

    const ids = (fetched.requiredChoices || []).map((c: any) => c.id);

    if (!ids.includes(choiceInclude.id)) {
      throw new Error('Expected include choice to be present');
    }

    if (ids.includes(choiceExclude.id)) {
      throw new Error('Expected exclude choice to be filtered out by dependency');
    }

    console.log('choiceDependency integration test: PASS');
  } finally {
    try { if (draft) await prisma.characterDraft.delete({ where: { id: draft.id } }); } catch {}
    try { if (choiceInclude) await prisma.choice.delete({ where: { id: choiceInclude.id } }); } catch {}
    try { if (choiceExclude) await prisma.choice.delete({ where: { id: choiceExclude.id } }); } catch {}
    try { if (dep) await prisma.ruleDependency.delete({ where: { id: dep.id } }); } catch {}
    try { if (cs) await prisma.contentSource.delete({ where: { id: cs.id } }); } catch {}
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
