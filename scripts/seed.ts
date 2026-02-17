import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Create ContentSource
    const srdSource = await prisma.contentSource.create({
        data: {
            name: 'SRD Demo',
        },
    });

    // Create Features
    const rageFeature = await prisma.feature.create({
        data: {
            name: 'Rage',
            description: 'You can enter a furious rage as an action on your turn.',
            contentSourceId: srdSource.id,
        },
    });

    const unarmoredDefenseFeature = await prisma.feature.create({
        data: {
            name: 'Unarmored Defense',
            description: 'While you are not wearing any armor, your AC equals 10 + your Dexterity modifier.',
            contentSourceId: srdSource.id,
        },
    });

    const bardicInspirationFeature = await prisma.feature.create({
        data: {
            name: 'Bardic Inspiration',
            description: 'You can inspire others through music or oration.',
            contentSourceId: srdSource.id,
        },
    });

    // Create Classes
    const barbarianClass = await prisma.class.create({
        data: {
            name: 'Barbarian',
            contentSourceId: srdSource.id,
        },
    });

    const bardClass = await prisma.class.create({
        data: {
            name: 'Bard',
            contentSourceId: srdSource.id,
        },
    });

    await prisma.classSavingThrowProficiency.createMany({
        data: [
            { classId: barbarianClass.id, ability: 'str' },
            { classId: barbarianClass.id, ability: 'con' },
        ],
        skipDuplicates: true,
    });

    await prisma.skill.createMany({
        data: [
            { name: 'Athletics', ability: 'str', contentSourceId: srdSource.id },
            { name: 'Acrobatics', ability: 'dex', contentSourceId: srdSource.id },
            { name: 'Stealth', ability: 'dex', contentSourceId: srdSource.id },
            { name: 'Perception', ability: 'wis', contentSourceId: srdSource.id },
            { name: 'Arcana', ability: 'int', contentSourceId: srdSource.id },
        ],
        skipDuplicates: true,
    });

    await prisma.choice.create({
        data: {
            contentSourceId: srdSource.id,
            sourceType: 'class',
            sourceId: barbarianClass.id,
            chooseCount: 1,
            optionsJson: [
                { id: 'acrobatics', name: 'Acrobatics', description: 'Dexterity' },
                { id: 'animal_handling', name: 'Animal Handling', description: 'Wisdom' },
                { id: 'athletics', name: 'Athletics', description: 'Strength' },
                { id: 'survival', name: 'Survival', description: 'Wisdom' },
            ],
        },
    });

    // Assign features to Barbarian
    await prisma.classFeature.create({
        data: {
            classId: barbarianClass.id,
            featureId: rageFeature.id,
            levelRequired: 1,
        },
    });

    await prisma.classFeature.create({
        data: {
            classId: barbarianClass.id,
            featureId: unarmoredDefenseFeature.id,
            levelRequired: 1,
        },
    });

    // Example modifier: Rage grants +2 attack damage (stored data-driven).
    await prisma.modifier.create({
        data: {
            sourceType: 'feature',
            sourceId: rageFeature.id,
            target: 'attack',
            targetKey: null,
            operation: 'add',
            value: 2,
        },
    });

    // Assign feature to Bard
    await prisma.classFeature.create({
        data: {
            classId: bardClass.id,
            featureId: bardicInspirationFeature.id,
            levelRequired: 1,
        },
    });

    // Items
    const longsword = await prisma.item.create({
        data: {
            name: 'Longsword',
            description: '+1 attack bonus melee weapon',
            slot: 'weapon',
            contentSourceId: srdSource.id,
        },
    });

    const chainMail = await prisma.item.create({
        data: {
            name: 'Chain Mail',
            description: 'Heavy armor providing base AC 16',
            slot: 'armor',
            contentSourceId: srdSource.id,
        },
    });

    await prisma.modifier.create({
        data: {
            sourceType: 'item',
            sourceId: longsword.id,
            target: 'attack',
            targetKey: null,
            operation: 'add',
            value: 1,
        },
    });

    await prisma.modifier.create({
        data: {
            sourceType: 'item',
            sourceId: chainMail.id,
            target: 'ac',
            targetKey: null,
            operation: 'set',
            value: 16,
        },
    });

    // Create skill choice for Bard (choose 2 skills)
    await prisma.choice.create({
        data: {
            contentSourceId: srdSource.id,
            sourceType: 'class',
            sourceId: bardClass.id,
            chooseCount: 2,
            optionsJson: [
                { id: 'acrobatics', name: 'Acrobatics', description: 'Dexterity' },
                { id: 'animal_handling', name: 'Animal Handling', description: 'Wisdom' },
                { id: 'arcana', name: 'Arcana', description: 'Intelligence' },
                { id: 'athletics', name: 'Athletics', description: 'Strength' },
                { id: 'deception', name: 'Deception', description: 'Charisma' },
                { id: 'history', name: 'History', description: 'Intelligence' },
                { id: 'insight', name: 'Insight', description: 'Wisdom' },
                { id: 'intimidation', name: 'Intimidation', description: 'Charisma' },
                { id: 'investigation', name: 'Investigation', description: 'Intelligence' },
                { id: 'medicine', name: 'Medicine', description: 'Wisdom' },
                { id: 'nature', name: 'Nature', description: 'Intelligence' },
                { id: 'perception', name: 'Perception', description: 'Wisdom' },
                { id: 'performance', name: 'Performance', description: 'Charisma' },
                { id: 'persuasion', name: 'Persuasion', description: 'Charisma' },
                { id: 'religion', name: 'Religion', description: 'Intelligence' },
                { id: 'sleight_of_hand', name: 'Sleight of Hand', description: 'Dexterity' },
                { id: 'stealth', name: 'Stealth', description: 'Dexterity' },
                { id: 'survival', name: 'Survival', description: 'Wisdom' },
            ],
        },
    });

    // Create Races
    const humanRace = await prisma.race.create({
        data: {
            name: 'Human',
            contentSourceId: srdSource.id,
        },
    });

    // Create race features
    const abilityImprovementFeature = await prisma.feature.create({
        data: {
            name: 'Ability Score Improvement',
            description: 'Your ability scores each increase by 1.',
            contentSourceId: srdSource.id,
        },
    });

    // Assign feature to Human race
    await prisma.raceFeature.create({
        data: {
            raceId: humanRace.id,
            featureId: abilityImprovementFeature.id,
        },
    });

    // Human racial modifier: +1 to all abilities.
    await prisma.modifier.create({
        data: {
            sourceType: 'feature',
            sourceId: abilityImprovementFeature.id,
            target: 'ability',
            targetKey: 'all',
            operation: 'add',
            value: 1,
        },
    });

    // Create Backgrounds
    const soldierBackground = await prisma.background.create({
        data: {
            name: 'Soldier',
            contentSourceId: srdSource.id,
        },
    });

    // Create background features
    const militaryTrainingFeature = await prisma.feature.create({
        data: {
            name: 'Military Rank',
            description: 'You have a military rank from your years of service.',
            contentSourceId: srdSource.id,
        },
    });

    // Assign feature to Soldier background
    await prisma.backgroundFeature.create({
        data: {
            backgroundId: soldierBackground.id,
            featureId: militaryTrainingFeature.id,
        },
    });

    // Create equipment choice for Soldier background
    await prisma.choice.create({
        data: {
            contentSourceId: srdSource.id,
            sourceType: 'background',
            sourceId: soldierBackground.id,
            chooseCount: 1,
            optionsJson: [
                { id: 'longsword', name: 'Longsword', description: 'Martial melee weapon' },
                { id: 'battleaxe', name: 'Battleaxe', description: 'Martial melee weapon' },
                { id: 'crossbow', name: 'Crossbow', description: 'Ranged weapon' },
            ],
        },
    });

    console.log('✅ Seeding completed successfully!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });