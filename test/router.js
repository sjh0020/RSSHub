// this is test_route.js
process.env.SOCKET = 'socket';

const supertest = require('supertest');
jest.mock('request-promise-native');
const server = require('../lib/index');
const request = supertest(server);
const Parser = require('rss-parser');
const parser = new Parser();
const config = require('../lib/config').value;

afterAll(() => {
    delete process.env.SOCKET;
});

async function checkRSS(response) {
    const checkDate = (date) => {
        expect(date).toEqual(expect.any(String));
        expect(Date.parse(date)).toEqual(expect.any(Number));
        expect(new Date() - new Date(date)).toBeGreaterThan(-1000 * 60 * 60 * 24 * 5);
        expect(new Date() - new Date(date)).toBeLessThan(1000 * 60 * 60 * 24 * 30 * 12 * 10);
    };

    const parsed = await parser.parseString(response.text);

    expect(parsed).toEqual(expect.any(Object));
    expect(parsed.title).toEqual(expect.any(String));
    expect(parsed.title).not.toBe('RSSHub');
    expect(parsed.description).toEqual(expect.any(String));
    expect(parsed.link).toEqual(expect.any(String));
    expect(parsed.lastBuildDate).toEqual(expect.any(String));
    expect(parsed.ttl).toEqual(((config.cache.routeExpire / 60) | 0) + '');
    expect(parsed.items).toEqual(expect.any(Array));
    checkDate(parsed.lastBuildDate);

    // check items
    const guids = [];
    parsed.items.forEach((item) => {
        expect(item).toEqual(expect.any(Object));
        expect(item.title).toEqual(expect.any(String));
        expect(item.link).toEqual(expect.any(String));
        expect(item.content).toEqual(expect.any(String));
        expect(item.guid).toEqual(expect.any(String));
        if (item.pubDate) {
            expect(item.pubDate).toEqual(expect.any(String));
            checkDate(item.pubDate);
        }

        // guid must be unique
        expect(guids).not.toContain(item.guid);
        guids.push(item.guid);
    });
}

afterAll(() => {
    server.close();
});

describe('router', () => {
    // root
    it(`/`, async () => {
        const response = await request.get('/');
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=UTF-8');
        expect(response.headers['cache-control']).toBe('no-cache');
    });

    // route
    it(`/test/1`, async () => {
        const response = await request.get('/test/1');
        expect(response.status).toBe(200);

        await checkRSS(response);
    });

    // robots.txt
    it('/robots.txt', async () => {
        config.disallowRobot = false;
        const response404 = await request.get('/robots.txt');
        expect(response404.status).toBe(404);

        config.disallowRobot = true;
        const response = await request.get('/robots.txt');
        expect(response.status).toBe(200);
        expect(response.text).toBe('User-agent: *\nDisallow: /');
        expect(response.headers['content-type']).toBe('text/plain');
    });

    // api
    it(`/api/routes/test`, async () => {
        const response = await request.get('/api/routes/test');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 0,
            data: {
                test: {
                    routes: ['/test/:id'],
                },
            },
            message: 'request returned 1 route',
        });
    }, 60000);
    it(`/api/routes`, async () => {
        const response = await request.get('/api/routes');
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            status: 0,
            data: {
                test: {
                    routes: ['/test/:id'],
                },
            },
            message: expect.stringMatching(/request returned (\d+) routes/),
        });
    });
});
