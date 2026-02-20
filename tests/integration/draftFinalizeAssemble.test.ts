import { PrismaClient } from '@prisma/client';
import { DraftService } from '../../src/services/draftService';
import { CharacterAssemblerService } from '../../src/services/characterAssemblerService';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping integration test: DATABASE_URL not set');
    return;
  }

  const prisma = new PrismaClient();
  const draftService = new DraftService(prisma);
  const assembler = new CharacterAssemblerService(prisma);

  let contentSource: any = null;
  let cls: any = null;
  let choice: any = null;
  let abilitySet: any = null;
  let characterId: string | null = null;

  try {
    contentSource = await prisma.contentSource.create({ data: { name: `integration-cs-${Date.now()}` } });

    cls = await prisma.class.create({
      data: {
        name: `IntegrationClass-${Date.now()}`,
        contentSourceId: contentSource.id,
        sourceRef: `integration:class:${Date.now()}`,
      },
    });

    choice = await prisma.choice.create({
      data: {
        contentSourceId: contentSource.id,
        sourceType: 'class',
        sourceId: cls.id,
        optionsJson: [{ id: 'opt1', label: 'Option 1' }],
      },
    });

    abilitySet = await prisma.abilityScoreSet.create({
      data: {
        method: 'manual',
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
    });

    const draft = await draftService.createDraft('integration-draft');
    await draftService.setClassForDraft(draft.id, cls.id);
    await draftService.setAbilityScoresForDraft(draft.id, 'manual', { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

    const fetched = await draftService.getDraft(draft.id);
    if (!Array.isArray(fetched.requiredChoices) || fetched.requiredChoices.length === 0) {
      throw new Error('Expected required choices for draft but found none');
    }

    // Attempt finalize should fail due to missing choice
    let finalizeFailed = false;
    try {
      await draftService.finalizeDraft(draft.id, 'test-telegram-1');
    } catch (err: any) {
      finalizeFailed = true;
      if (!err.message || !err.message.includes('Cannot finalize draft')) {
        throw err;
      }
    }

    if (!finalizeFailed) {
      throw new Error('Expected finalizeDraft to fail due to missing choices');
    }

    // Provide choice selection and finalize
    await draftService.saveChoiceForDraft(draft.id, choice.id, 'opt1');
    const finalizeResult = await draftService.finalizeDraft(draft.id, 'test-telegram-1');
    characterId = finalizeResult.characterId;

    if (!characterId) throw new Error('Finalize did not return characterId');

    const sheet = await assembler.assembleCharacter(characterId);
    if (!sheet || sheet.header.id !== characterId) {
      throw new Error('Assembled sheet invalid or does not reference created character');
    }

    console.log('Integration test draft→finalize→assemble: PASS');
  } finally {
    try {
      if (characterId) {
        await prisma.character.delete({ where: { id: characterId } });
      }
    } catch {}
    try { if (choice) await prisma.choice.delete({ where: { id: choice.id } }); } catch {}
    try { if (cls) await prisma.class.delete({ where: { id: cls.id } }); } catch {}
    try { if (abilitySet) await prisma.abilityScoreSet.delete({ where: { id: abilitySet.id } }); } catch {}
    try { if (contentSource) await prisma.contentSource.delete({ where: { id: contentSource.id } }); } catch {}
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
