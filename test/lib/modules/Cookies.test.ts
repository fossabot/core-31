import {addUTC} from '@valkyriestudios/utils/date/addUTC';
import {describe, it} from 'node:test';
import * as assert from 'node:assert/strict';
import {type TriFrostCookieOptions, TriFrostCookies} from '../../../lib/modules/Cookies';
import CONSTANTS from '../../constants';
import {MockContext} from '../../MockContext';

describe('Modules - Cookies', () => {
    const createCtx = (cookie?:string) => new MockContext({headers: cookie === undefined ? {} : {cookie}});

    describe('constructor', () => {
        it('Parses multiple cookies from header', () => {
            const cookies = new TriFrostCookies(createCtx('a=1; b=2; c=3'), {});
            assert.deepEqual(cookies.all(), {
                a: '1',
                b: '2',
                c: '3',
            });
        });

        it('Decodes URI-encoded cookie values', () => {
            const cookies = new TriFrostCookies(createCtx('token=a%20b%20c'));
            assert.equal(cookies.get('token'), 'a b c');
        });

        it('Trims whitespace around keys and values', () => {
            const cookies = new TriFrostCookies(createCtx('  session = trimmed  ;  foo= bar '), {});
            assert.deepEqual(cookies.all(), {
                session: 'trimmed',
                foo: 'bar',
            });
        });

        it('Ignores malformed cookie header (wrong or empty)', () => {
            for (const el of CONSTANTS.NOT_STRING_WITH_EMPTY) {
                /* @ts-ignore */
                const cookies = new TriFrostCookies(createCtx(el), {});
                assert.deepEqual(cookies.all(), {});
            }
        });

        it('Ignores malformed cookies (missing value)', () => {
            const cookies = new TriFrostCookies(createCtx('valid=ok; badcookie; another=ok; badcookie2='), {});
            assert.deepEqual(cookies.all(), {
                valid: 'ok',
                another: 'ok',
            });
        });

        it('Handles completely empty cookie header', () => {
            const cookies = new TriFrostCookies(createCtx(''), {});
            assert.deepEqual(cookies.all(), {});
        });

        it('Handles absence of cookie header gracefully', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            assert.deepEqual(cookies.all(), {});
        });

        it('Accepts and stores global config', () => {
            const config = {
                path: '/secure',
                domain: 'trifrost.land',
                secure: true,
                httponly: true,
                samesite: 'Strict' as const,
            };
            const cookies = new TriFrostCookies(createCtx(), config);
            cookies.set('token', 'abc');
            assert.ok(cookies.outgoing[0].includes('Path=/secure'));
            assert.ok(cookies.outgoing[0].includes('Domain=trifrost.land'));
            assert.ok(cookies.outgoing[0].includes('Secure'));
            assert.ok(cookies.outgoing[0].includes('HttpOnly'));
            assert.ok(cookies.outgoing[0].includes('SameSite=Strict'));
        });

        it('Falls back to proper defaults if passed invalid config', () => {
            for (const el of CONSTANTS.NOT_OBJECT) {
                if (el === undefined) continue;
                const cookies = new TriFrostCookies(createCtx(), el as unknown as TriFrostCookieOptions);
                cookies.set('token', 'abc');
                assert.deepEqual(cookies.outgoing, ['token=abc; Secure']);
            }
        });
    });

    describe('get', () => {
        it('Retrieves existing cookie', () => {
            const cookies = new TriFrostCookies(createCtx('foo=bar'), {});
            assert.equal(cookies.get('foo'), 'bar');
        });

        it('Returns null for non-existent cookie', () => {
            const cookies = new TriFrostCookies(createCtx('foo=bar'), {});
            assert.equal(cookies.get('nope'), null);
        });

        it('Returns null when passed a non/empty-string', () => {
            const cookies = new TriFrostCookies(createCtx('foo=bar'), {});
            for (const el of CONSTANTS.NOT_STRING_WITH_EMPTY) assert.equal(cookies.get(el as unknown as string), null);
        });

        it('Handles empty cookie header', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            assert.equal(cookies.get('anything'), null);
        });

        it('Handles malformed cookie string (missing "=")', () => {
            const cookies = new TriFrostCookies(createCtx('foo'), {});
            assert.equal(cookies.get('foo'), null);
        });

        it('Trims whitespace around cookie names', () => {
            const cookies = new TriFrostCookies(createCtx(' foo =bar '), {});
            assert.equal(cookies.get('foo'), 'bar');
        });

        it('Decodes URI-encoded values correctly', () => {
            const cookies = new TriFrostCookies(createCtx('foo=space%20bar'), {});
            assert.equal(cookies.get('foo'), 'space bar');
        });

        it('Returns latest value if overwritten via set()', () => {
            const cookies = new TriFrostCookies(createCtx('foo=bar'), {});
            cookies.set('foo', 'baz');
            assert.equal(cookies.get('foo'), 'baz');
        });

        it('Handles cookies with equal signs in the value', () => {
            const cookies = new TriFrostCookies(createCtx('x=1=2=3'), {});
            assert.equal(cookies.get('x'), '1=2=3');
        });
    });

    describe('set', () => {
        it('Sets a valid cookie', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('token', 'abc123', {path: '/', httponly: true});
            assert.deepEqual(cookies.outgoing, [
                'token=abc123; Path=/; Secure; HttpOnly',
            ]);
        });

        it('Encodes values and appends secure if SameSite=None', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('sess', 'space bar', {secure: false, samesite: 'None'});
            assert.deepEqual(cookies.outgoing, [
                'sess=space%20bar; SameSite=None; Secure',
            ]);
        });

        it('Rejects cookie with non/empty string name', () => {
            const ctx = createCtx();
            const cookies = new TriFrostCookies(ctx, {});
            for (const el of CONSTANTS.NOT_STRING_WITH_EMPTY) cookies.set(el as unknown as string, 'hello');
            assert.deepEqual(cookies.outgoing, []);
        });

        it('Rejects cookie with invalid value', () => {
            const ctx = createCtx();
            const cookies = new TriFrostCookies(ctx, {});
            for (const el of CONSTANTS.NOT_STRING) {
                if (Number.isFinite(el)) continue;
                cookies.set('hello', el as unknown as string);
            }
            assert.deepEqual(cookies.outgoing, []);
        });

        it('Rejects cookie with invalid name (contains semicolon)', () => {
            const ctx = createCtx();
            const cookies = new TriFrostCookies(ctx, {});
            cookies.set('bad;name', 'val');
            assert.deepEqual(cookies.outgoing, []);
        });

        it('Rejects cookie with invalid value (non-ASCII)', () => {
            const ctx = createCtx();
            const cookies = new TriFrostCookies(ctx, {});
            cookies.set('validname', '💥');
            assert.deepEqual(cookies.outgoing, []);
        });

        it('Sets Max-Age and derives Expires from maxage', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('session', 'val', {maxage: 120});
            assert.deepEqual(cookies.outgoing, [
                `session=val; Expires=${addUTC(new Date(), 120, 'seconds').toUTCString()}; Max-Age=120; Secure`,
            ]);
        });

        it('Sets Expires and derives Max-Age from expires', () => {
            const expires = addUTC(new Date(), 300, 'seconds');
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('session', 'val', {expires});
            assert.deepEqual(cookies.outgoing, [
                `session=val; Expires=${expires.toUTCString()}; Max-Age=300; Secure`,
            ]);
        });

        it('Prefers expires over maxAge when both provided', () => {
            const expires = addUTC(new Date(), 600, 'seconds');
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('token', 'abc', {maxage: 300, expires});
            assert.deepEqual(cookies.outgoing, [
                `token=abc; Expires=${expires.toUTCString()}; Secure`,
            ]);
        });

        it('Adds Path, Domain, HttpOnly, SameSite options', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('token', 'val', {
                path: '/secure',
                domain: 'example.com',
                httponly: true,
                samesite: 'Lax',
            });
            assert.deepEqual(cookies.outgoing, [
                'token=val; Path=/secure; Domain=example.com; Secure; HttpOnly; SameSite=Lax',
            ]);
        });

        it('Ignores invalid options passed', () => {
            for (const el of CONSTANTS.NOT_OBJECT) {
                if (el === undefined) continue;
                const cookies = new TriFrostCookies(createCtx(), {
                    domain: 'example.com',
                    path: '/secure',
                });
                cookies.set('token', 'val', el as TriFrostCookieOptions);
                assert.deepEqual(cookies.outgoing, [
                    'token=val; Path=/secure; Domain=example.com; Secure',
                ]);
            }
        });

        it('Forces Secure when SameSite=None and secure=false explicitly', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('unsafe', 'val', {secure: false, samesite: 'None'});
            assert.deepEqual(cookies.outgoing, [
                'unsafe=val; SameSite=None; Secure',
            ]);
        });

        it('Adds new cookie without overriding previous', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('one', '1');
            cookies.set('two', '2');
            assert.deepEqual(cookies.outgoing, [
                'one=1; Secure',
                'two=2; Secure',
            ]);
        });

        it('Overwrites previously set cookie of same name', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('dup', 'first');
            cookies.set('dup', 'second');
            assert.deepEqual(cookies.all(), {dup: 'second'});
            assert.deepEqual(cookies.outgoing, ['dup=second; Secure']);
        });

        it('Normalizes numeric values via toString', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('n', 123);
            assert.deepEqual(cookies.all(), {n: '123'});
            assert.ok(cookies.outgoing[0].startsWith('n=123'));
        });

        it('Falls back to global config when no options passed in set()', () => {
            const cookies = new TriFrostCookies(createCtx(), {
                path: '/default',
                domain: 'trifrost.land',
                secure: true,
                httponly: true,
                samesite: 'Strict',
            });
            cookies.set('auth', 'ok');
            assert.ok(cookies.outgoing[0].includes('Path=/default'));
            assert.ok(cookies.outgoing[0].includes('Domain=trifrost.land'));
            assert.ok(cookies.outgoing[0].includes('Secure'));
            assert.ok(cookies.outgoing[0].includes('HttpOnly'));
            assert.ok(cookies.outgoing[0].includes('SameSite=Strict'));
        });

        it('Overrides global config with provided options in set()', () => {
            const cookies = new TriFrostCookies(createCtx(), {
                path: '/default',
                domain: 'trifrost.land',
                secure: true,
                samesite: 'Lax',
            });
            cookies.set('custom', 'value', {
                path: '/override',
                samesite: 'None',
                secure: false,
            });
            const out = cookies.outgoing[0];
            assert.ok(out.includes('Path=/override'));
            assert.ok(out.includes('SameSite=None'));
            assert.ok(out.includes('Secure'));
            assert.ok(!out.includes('Path=/default'));
            assert.ok(out.includes('Domain=trifrost.land'));
        });

        it('Does not add Secure if explicitly disabled and no SameSite=None', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('nonsecure', 'nope', {
                secure: false,
                samesite: 'Lax',
            });
            const out = cookies.outgoing[0];
            assert.ok(out.includes('SameSite=Lax'));
            assert.ok(!out.includes('Secure'));
        });

        it('Uses Expires value and ignores maxage when both provided', () => {
            const expires = addUTC(new Date(), 3600, 'seconds');
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('session', 'open', {
                maxage: 5,
                expires,
            });
            assert.ok(cookies.outgoing[0].includes(`Expires=${expires.toUTCString()}`));
            assert.ok(!cookies.outgoing[0].includes('Max-Age=5'));
        });
    });

    describe('del', () => {
        it('Deletes a cookie', () => {
            const cookies = new TriFrostCookies(createCtx('remove=me; donotremove=me'), {});
            const now = new Date();
            cookies.del('remove', {path: '/'});
            assert.deepEqual(cookies.outgoing, [
                `remove=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Path=/; Secure`,
            ]);
            cookies.del('donotremove');
            assert.deepEqual(cookies.outgoing, [
                `remove=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Path=/; Secure`,
                `donotremove=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Secure`,
            ]);
        });

        it('Does nothing if cookie is not in incoming or outgoing', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.del('ghost');
            assert.deepEqual(cookies.outgoing, []);
        });

        it('Does nothing if providing invalid val', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('shouldRemove', 'yup');
            for (const el of CONSTANTS.NOT_STRING_WITH_EMPTY) {
                cookies.del(el as unknown as string);
            }
            assert.deepEqual(cookies.outgoing, [
                'shouldRemove=yup; Secure',
            ]);
        });

        it('Removes cookie from outgoing if previously set', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.set('shouldRemove', 'yup');
            assert.deepEqual(cookies.outgoing, [
                'shouldRemove=yup; Secure',
            ]);
            cookies.del('shouldRemove');
            assert.deepEqual(cookies.outgoing, []);
            const all = cookies.all();
            assert.ok(!('shouldRemove' in all));
        });

        it('Removes from combined map after deletion', () => {
            const cookies = new TriFrostCookies(createCtx('killme=now'), {});
            assert.equal(cookies.get('killme'), 'now');
            cookies.del('killme');
            assert.equal(cookies.get('killme'), null);
        });

        it('Supports path and domain in deletion options', () => {
            const cookies = new TriFrostCookies(createCtx('target=zap'), {});
            const now = new Date();
            cookies.del('target', {path: '/admin', domain: 'foo.com'});
            assert.deepEqual(cookies.outgoing, [
                `target=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Path=/admin; Domain=foo.com; Secure`,
            ]);
        });


        it('Gracefully re-deletes a cookie that was already deleted', () => {
            const cookies = new TriFrostCookies(createCtx('dup=1'), {});
            const now = new Date();
            cookies.del('dup');
            cookies.del('dup');
            assert.equal(cookies.get('dup'), null);
            assert.deepEqual(cookies.all(), {});
            assert.deepEqual(cookies.outgoing, [
                `dup=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Secure`,
            ]);
        });

        it('Uses global config if delete options are not passed', () => {
            const cookies = new TriFrostCookies(
                createCtx('x=123'),
                {path: '/global', domain: 'global.com'}
            );
            const now = new Date();
            cookies.del('x');
            assert.deepEqual(cookies.outgoing, [
                `x=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Path=/global; Domain=global.com; Secure`,
            ]);
        });
    });

    describe('delAll', () => {
        it('Should remove all incoming cookies', () => {
            const cookies = new TriFrostCookies(createCtx('a=1; b=2; c=3'), {});
            const now = new Date();
            cookies.delAll({path: '/'});
            assert.deepEqual(cookies.outgoing, [
                `a=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Path=/; Secure`,
                `b=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Path=/; Secure`,
                `c=; Expires=${addUTC(now, 0, 'seconds').toUTCString()}; Max-Age=0; Path=/; Secure`,
            ]);
        });

        it('Does nothing if there are no incoming cookies', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.delAll();
            assert.deepEqual(cookies.outgoing, []);
        });

        it('Does not delete cookies that were set after construction', () => {
            const cookies = new TriFrostCookies(createCtx('foo=bar'), {});
            cookies.set('baz', '123');
            cookies.delAll();
            assert.deepEqual(cookies.outgoing, [
                'baz=123; Secure',
                `foo=; Expires=${addUTC(new Date(), 0, 'seconds').toUTCString()}; Max-Age=0; Secure`,
            ]);
        });

        it('Does not add deletion to outgoing if cookie not incoming or set', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            cookies.del('phantom');
            assert.deepEqual(cookies.outgoing, []);
        });

        it('Applies global config if no delAll options provided', () => {
            const cookies = new TriFrostCookies(
                createCtx('one=1; two=2'),
                {path: '/default', domain: 'trifrost.land'}
            );
            cookies.delAll();
            assert.deepEqual(cookies.outgoing, [
                `one=; Expires=${addUTC(new Date(), 0, 'seconds').toUTCString()}; Max-Age=0; Path=/default; Domain=trifrost.land; Secure`,
                `two=; Expires=${addUTC(new Date(), 0, 'seconds').toUTCString()}; Max-Age=0; Path=/default; Domain=trifrost.land; Secure`,
            ]);
        });

        it('Overrides global config with passed options', () => {
            const cookies = new TriFrostCookies(
                createCtx('x=1; y=2'),
                {path: '/global', domain: 'default.com'}
            );
            cookies.delAll({path: '/override', domain: 'override.com'});
            assert.deepEqual(cookies.outgoing, [
                `x=; Expires=${addUTC(new Date(), 0, 'seconds').toUTCString()}; Max-Age=0; Path=/override; Domain=override.com; Secure`,
                `y=; Expires=${addUTC(new Date(), 0, 'seconds').toUTCString()}; Max-Age=0; Path=/override; Domain=override.com; Secure`,
            ]);
        });
    });

    describe('all', () => {
        it('Reflects incoming and outgoing cookies', () => {
            const cookies = new TriFrostCookies(createCtx('x=old'), {});
            cookies.set('y', 'new');
            const all = cookies.all();
            assert.deepEqual(all, {x: 'old', y: 'new'});
        });

        it('Returns empty object when no incoming or outgoing cookies', () => {
            const cookies = new TriFrostCookies(createCtx(), {});
            assert.deepEqual(cookies.all(), {});
        });

        it('Reflects state changes after set and delete', () => {
            const cookies = new TriFrostCookies(createCtx('a=1; b=2'), {});
            cookies.set('c', '3');
            cookies.del('a');
            assert.deepEqual(cookies.all(), {b: '2', c: '3'});
        });

        it('Returns a shallow clone, not internal reference', () => {
            const cookies = new TriFrostCookies(createCtx('safe=yes'), {});
            const all = cookies.all();
            /* @ts-ignore */
            all.safe = 'nope';
            assert.equal(cookies.get('safe'), 'yes');
        });

        it('Reflects decoded incoming values', () => {
            const cookies = new TriFrostCookies(createCtx('fancy=spaced%20out'), {});
            assert.deepEqual(cookies.all(), {fancy: 'spaced out'});
        });

        it('Overwrites reflected value when same cookie is reset', () => {
            const cookies = new TriFrostCookies(createCtx('dup=old'), {});
            cookies.set('dup', 'new');
            assert.deepEqual(cookies.all(), {dup: 'new'});
        });
    });
});
