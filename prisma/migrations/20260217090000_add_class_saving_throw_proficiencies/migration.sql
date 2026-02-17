CREATE TABLE "class_saving_throw_proficiencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "ability" TEXT NOT NULL,
    CONSTRAINT "class_saving_throw_proficiencies_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "class_saving_throw_proficiencies_classId_ability_key" ON "class_saving_throw_proficiencies" ("classId", "ability");
