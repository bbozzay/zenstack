import { withOmit } from '@zenstackhq/runtime';
import { loadSchema } from '@zenstackhq/testtools';
import path from 'path';

describe('Omit test', () => {
    let origDir: string;

    beforeAll(async () => {
        origDir = path.resolve('.');
    });

    afterEach(async () => {
        process.chdir(origDir);
    });

    const model = `
    model User {
        id String @id @default(cuid())
        password String @omit
        profile Profile?
    
        @@allow('all', true)
    }
    
    model Profile {
        id String @id @default(cuid())
        user User @relation(fields: [userId], references: [id])
        userId String @unique
        image String @omit
    
        @@allow('all', true)
    }
    `;

    it('omit tests', async () => {
        const { withOmit } = await loadSchema(model);

        const db = withOmit();
        const r = await db.user.create({
            include: { profile: true },
            data: {
                id: '1',
                password: 'abc123',
                profile: {
                    create: {
                        image: 'an image',
                    },
                },
            },
        });
        expect(r.password).toBeUndefined();
        expect(r.profile.image).toBeUndefined();

        const r1 = await db.user.findUnique({
            where: { id: '1' },
            include: { profile: true },
        });
        expect(r1.password).toBeUndefined();
        expect(r1.profile.image).toBeUndefined();

        await db.user.create({
            include: { profile: true },
            data: {
                id: '2',
                password: 'abc234',
                profile: {
                    create: {
                        image: 'another image',
                    },
                },
            },
        });

        const r2 = await db.user.findMany({ include: { profile: true } });
        r2.forEach((e: any) => {
            expect(e.password).toBeUndefined();
            expect(e.profile.image).toBeUndefined();
        });
    });

    it('customization', async () => {
        const { prisma } = await loadSchema(model, { getPrismaOnly: true, output: './zen' });

        const db = withOmit(prisma, { loadPath: './zen' });
        const r = await db.user.create({
            include: { profile: true },
            data: {
                id: '1',
                password: 'abc123',
                profile: { create: { image: 'an image' } },
            },
        });
        expect(r.password).toBeUndefined();
        expect(r.profile.image).toBeUndefined();

        const db1 = withOmit(prisma, { modelMeta: require(path.resolve('./zen/model-meta')).default });
        const r1 = await db1.user.create({
            include: { profile: true },
            data: {
                id: '2',
                password: 'abc123',
                profile: { create: { image: 'an image' } },
            },
        });
        expect(r1.password).toBeUndefined();
        expect(r1.profile.image).toBeUndefined();
    });
});
