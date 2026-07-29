'use strict';

const { createQualityGate } = require('../quality-gate');

describe('quality gate', () => {
  test('evaluates files and scores code quality', async () => {
    const q = createQualityGate();

    const goodCode = "'use strict';\nfunction add(a, b) { return a + b; }\nmodule.exports = { add };";
    const badCode = "'use strict';\nconst x = eval('1+1');\nconst token = '12345678:ABC-DEF1234ghIkl-zyx_1234567890abcde';\nmodule.exports = { x };";

    const files = {
      'src/math.js': goodCode,
      'src/evil.js': badCode
    };

    const storage = {
      readFile: jest.fn(path => ({ ok: true, content: files[path] }))
    };

    const r1 = await q.checkFiles(['src/math.js'], { storage });
    expect(r1.ok).toBe(true);
    expect(r1.score).toBe(100);

    const r2 = await q.checkFiles(['src/evil.js'], { storage });
    expect(r2.ok).toBe(false);
    expect(r2.score).toBeLessThan(100);
    expect(r2.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'no-eval' }),
      expect.objectContaining({ rule: 'no-hardcoded-token' })
    ]));
  });
});
