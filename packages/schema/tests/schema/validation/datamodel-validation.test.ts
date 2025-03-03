import { loadModel, loadModelWithError } from '../../utils';

describe('Data Model Validation Tests', () => {
    const prelude = `
        datasource db {
            provider = "postgresql"
            url = "url"
        }
    `;

    it('duplicated fields', async () => {
        expect(
            await loadModelWithError(`
                ${prelude}
                model M {
                    id String @id
                    x Int
                    x String
                }
        `)
        ).toContain('Duplicated declaration name "x"');
    });

    it('scalar types', async () => {
        await loadModel(`
            ${prelude}
            model M {
                id String @id
                a String
                b Boolean?
                c Int[] @default([])
                c1 Int[] @default([1, 2, 3])
                d BigInt
                e Float
                f Decimal
                g DateTime
                h Json
                i Bytes
            }
        `);
    });

    it('Unsupported type valid arg', async () => {
        await loadModel(`
            ${prelude}
            model M {
                id String @id
                a Unsupported('foo')
            }
        `);
    });

    it('Unsupported type invalid arg', async () => {
        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                id String @id
                a Unsupported(123)
            }
        `)
        ).toContain('Unsupported type argument must be a string literal');
    });

    it('Unsupported type used in expression', async () => {
        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                id String @id
                a Unsupported('a')
                @@allow('all', a == 'a')
            }
        `)
        ).toContain('Field of "Unsupported" type cannot be used in expressions');
    });

    it('mix array and optional', async () => {
        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                id String @id
                x Int[]?
            }
        `)
        ).toContain('Optional lists are not supported. Use either `Type[]` or `Type?`');
    });

    it('unresolved field type', async () => {
        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                id String @id
                x Integer
            }
        `)
        ).toContain(`Could not resolve reference to TypeDeclaration named 'Integer'.`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                id String @id
                x Integer[]
            }
        `)
        ).toContain(`Could not resolve reference to TypeDeclaration named 'Integer'.`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                id String @id
                x Integer?
            }
        `)
        ).toContain(`Could not resolve reference to TypeDeclaration named 'Integer'.`);
    });

    it('id field', async () => {
        // no need for '@id' field when there's no access policy or field validation
        await loadModel(`
            ${prelude}
            model M {
                x Int
            }
        `);

        const err =
            'Model must include a field with @id or @unique attribute, or a model-level @@id or @@unique attribute to use access policies';

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int
                @@allow('all', x > 0)
            }
        `)
        ).toContain(err);

        // @unique used as id
        await loadModel(`
            ${prelude}
            model M {
                id Int @unique
                x Int
                @@allow('all', x > 0)
            }
        `);

        // @@unique used as id
        await loadModel(`
               ${prelude}
               model M {
                   x Int
                   @@unique([x])
                   @@allow('all', x > 0)
               }
           `);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int
                @@deny('all', x <= 0)
            }
        `)
        ).toContain(err);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int @gt(0)
            }
        `)
        ).toContain(err);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int @id
                y Int @id
            }
        `)
        ).toContain(`Model can include at most one field with @id attribute`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int @id
                y Int
                @@id([x, y])
            }
        `)
        ).toContain(`Model cannot have both field-level @id and model-level @@id attributes`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int? @id
            }
        `)
        ).toContain(`Field with @id attribute must not be optional`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int?
                @@id([x])
            }
        `)
        ).toContain(`Field with @id attribute must not be optional`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int[] @id
            }
        `)
        ).toContain(`Field with @id attribute must be of scalar type`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Int[]
                @@id([x])
            }
        `)
        ).toContain(`Field with @id attribute must be of scalar type`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Json @id
            }
        `)
        ).toContain(`Field with @id attribute must be of scalar type`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model M {
                x Json
                @@id([x])
            }
        `)
        ).toContain(`Field with @id attribute must be of scalar type`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model Id {
                id String @id
            }
            model M {
                myId Id @id
            }
        `)
        ).toContain(`Field with @id attribute must be of scalar type`);

        expect(
            await loadModelWithError(`
            ${prelude}
            model Id {
                id String @id
            }
            model M {
                myId Id
                @@id([myId])
            }
        `)
        ).toContain(`Field with @id attribute must be of scalar type`);
    });

    it('relation', async () => {
        // one-to-one
        await loadModel(`
            ${prelude}
            model A {
                id String @id
                b B?
            }

            model B {
                id String @id
                a A @relation(fields: [foreignId], references: [id], onUpdate: Cascade, onDelete: Cascade)
                foreignId String @unique
            }
        `);

        // one-to-many
        await loadModel(`
            ${prelude}
            model A {
                id String @id
                b B[]
            }

            model B {
                id String @id
                a A @relation(fields: [foreignId], references: [id])
                foreignId String
            }
        `);

        // many-to-many implicit
        //https://www.prisma.io/docs/concepts/components/prisma-schema/relations/many-to-many-relations#implicit-many-to-many-relations
        await loadModel(`
        ${prelude}
        model Post {
            id         Int        @id @default(autoincrement())
            title      String
            categories Category[]
          }
          
          model Category {
            id    Int    @id @default(autoincrement())
            name  String
            posts Post[]
          }
        `);

        // one-to-one incomplete
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id String @id
                b B?
            }

            model B {
                id String @id
            }
        `)
        ).toContain(`The relation field "b" on model "A" is missing an opposite relation field on model "B"`);

        // one-to-one ambiguous
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id String @id
                b B?
            }

            model B {
                id String @id
                a A
                a1 A
            }
        `)
        ).toContain(`Fields "a", "a1" on model "B" refer to the same relation to model "A"`);

        // fields or references missing
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id String @id
                b B?
            }

            model B {
                id String @id
                a A @relation(fields: [aId])
                aId String
            }
        `)
        ).toContain(`Both "fields" and "references" must be provided`);

        // one-to-one inconsistent attribute
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id String @id
                b B? @relation(references: [id])
            }

            model B {
                id String @id
                a A @relation(fields: [aId], references: [id])
                aId String
            }
        `)
        ).toContain(`"fields" and "references" must be provided only on one side of relation field`);

        // references mismatch
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                myId Int @id
                b B?
            }

            model B {
                id String @id
                a A @relation(fields: [aId], references: [id])
                aId String @unique
            }
        `)
        ).toContain(`values of "references" and "fields" must have the same type`);

        // "fields" and "references" typing consistency
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id Int @id
                b B?
            }

            model B {
                id String @id
                a A @relation(fields: [aId], references: [id])
                aId String @unique
            }
        `)
        ).toContain(`values of "references" and "fields" must have the same type`);

        // one-to-one missing @unique
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id String @id
                b B?
            }

            model B {
                id String @id
                a A @relation(fields: [aId], references: [id])
                aId String
            }
        `)
        ).toContain(
            `Field "aId" is part of a one-to-one relation and must be marked as @unique or be part of a model-level @@unique attribute`
        );

        // missing @relation
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id String @id
                b B?
            }

            model B {
                id String @id
                a A
            }
        `)
        ).toContain(
            `Field for one side of relation must carry @relation attribute with both "fields" and "references" fields`
        );

        // wrong relation owner field type
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id String @id
                b B
            }

            model B {
                id String @id
                a A @relation(fields: [aId], references: [id])
                aId String
            }
        `)
        ).toContain(`Relation field needs to be list or optional`);

        // unresolved field
        expect(
            await loadModelWithError(`
            ${prelude}
            model A {
                id String @id
                b B?
            }

            model B {
                id String @id
                a A @relation(fields: [aId], references: [id])
            }
        `)
        ).toContain(`Could not resolve reference to ReferenceTarget named 'aId'.`);

        // enum as foreign key
        await loadModel(`
            ${prelude}

            enum Role {
                ADMIN
                USER
            }
            
            model A {
                id String @id
                role Role @unique
                bs B[]
            }

            model B {
                id String @id
                a A @relation(fields: [aRole], references: [role])
                aRole Role
            }
        `);
    });

    it('self relation', async () => {
        // one-to-one
        // https://www.prisma.io/docs/concepts/components/prisma-schema/relations/self-relations#one-to-one-self-relations
        await loadModel(`
            ${prelude}
            model User {
                id          Int     @id @default(autoincrement())
                name        String?
                successorId Int?    @unique
                successor   User?   @relation("BlogOwnerHistory", fields: [successorId], references: [id])
                predecessor User?   @relation("BlogOwnerHistory")
            }
        `);

        // one-to-many
        // https://www.prisma.io/docs/concepts/components/prisma-schema/relations/self-relations#one-to-many-self-relations
        await loadModel(`
            ${prelude}
            model User {
                id        Int     @id @default(autoincrement())
                name      String?
                teacherId Int?
                teacher   User?   @relation("TeacherStudents", fields: [teacherId], references: [id])
                students  User[]  @relation("TeacherStudents")
            }
        `);

        // many-to-many
        // https://www.prisma.io/docs/concepts/components/prisma-schema/relations/self-relations#many-to-many-self-relations
        await loadModel(`
            ${prelude}
            model User {
                id         Int     @id @default(autoincrement())
                name       String?
                followedBy User[]  @relation("UserFollows")
                following  User[]  @relation("UserFollows")
            }
        `);

        // many-to-many explicit
        // https://www.prisma.io/docs/concepts/components/prisma-schema/relations/self-relations#many-to-many-self-relations
        await loadModel(`
            ${prelude}
            model User {
                id         Int       @id @default(autoincrement())
                name       String?
                followedBy Follows[] @relation("following")
                following  Follows[] @relation("follower")
            }

            model Follows {
                follower    User @relation("follower", fields: [followerId], references: [id])
                followerId  Int
                following   User @relation("following", fields: [followingId], references: [id])
                followingId Int

                @@id([followerId, followingId])
            }
        `);

        await loadModel(`
            ${prelude}
            model User {
                id         Int       @id
                eventTypes EventType[] @relation("user_eventtype")
            }

            model EventType {
                id         Int       @id
                users User[] @relation("user_eventtype")
            }
        `);

        // multiple self relations
        // https://www.prisma.io/docs/concepts/components/prisma-schema/relations/self-relations#defining-multiple-self-relations-on-the-same-model
        await loadModel(`
            ${prelude}
            model User {
                id         Int     @id @default(autoincrement())
                name       String?
                teacherId  Int?
                teacher    User?   @relation("TeacherStudents", fields: [teacherId], references: [id])
                students   User[]  @relation("TeacherStudents")
                followedBy User[]  @relation("UserFollows")
                following  User[]  @relation("UserFollows")
            }
        `);
    });

    it('abstract base type', async () => {
        const errors = await loadModelWithError(`
                    ${prelude}

                    abstract model Base {
                        id String @id
                    }

                    model A {
                        a String
                    }
        
                    model B extends Base,A {
                        b String
                    }
                `);
        expect(errors.length).toBe(1);

        expect(errors[0]).toEqual(`Model A cannot be extended because it's not abstract`);

        // relation incomplete from multiple level inheritance
        expect(
            await loadModelWithError(`
                ${prelude}
                  model User {
                    id Int @id @default(autoincrement())
                  }
                  
                  abstract model Base {
                    id Int @id @default(autoincrement())
                    user User @relation(fields: [userId], references: [id])
                    userId Int
                  }
                  
                  abstract model Base1 extends Base {
                    isPublic Boolean @default(false)
                  }
                  
                  model A extends Base1 {
                    a String
                  }
            `)
        ).toContain(`The relation field "user" on model "A" is missing an opposite relation field on model "User"`);
    });
});
