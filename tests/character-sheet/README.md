# Character Sheet Tests

This folder contains the test scaffolding and acceptance criteria for the `CharacterSheet` contract.

Goals:
- Validate `character-sheet.schema.json` against golden fixtures.
- Provide unit/integration test tasks for `CharacterAssemblerService`.

Immediate checks to implement (iteration 1):
- Unit: `assembleCharacter` returns complete object for a valid character.
- Integration: create draft -> finalize -> assembled sheet equals golden fixture (barbarian/bard L1).
- Smoke: finalize rejects when `unresolvedChoices > 0` or invalid equipment/loadout.

Suggested tools:
- Use `ajv` for JSON-schema validation in CI.
- Store golden fixtures in `tests/golden/character_sheet/`.

Run (example, when implemented):
```
npm run test:character:golden
```
