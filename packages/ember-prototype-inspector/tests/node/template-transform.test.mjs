import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { preprocess, print } from '@glimmer/syntax';
import { transformAsync } from '@babel/core';

const require = createRequire(import.meta.url);
const inspectMetadata = require('../../template-transform.cjs');

const root = '/project';

function transform(source, options = {}, filename = `${root}/app/a.hbs`) {
  const plugin = inspectMetadata({ root, ...options });
  const ast = preprocess(source, {
    plugins: { ast: [(env) => plugin({ ...env, filename, contents: source })] },
  });
  return print(ast);
}

function attrs(source, options, filename) {
  const ast = preprocess(transform(source, options, filename));
  const element = ast.body.find((node) => node.type === 'ElementNode');
  return element.attributes.map((attr) => [
    attr.name,
    attr.value.type === 'TextNode' ? attr.value.chars : attr.value.type,
  ]);
}

function attr(source, name, options, filename) {
  return Object.fromEntries(attrs(source, options, filename))[name];
}

test('stamps HTML elements with source, invocation and id', () => {
  const result = Object.fromEntries(
    attrs('\n  <div class="card wide">x</div>'),
  );
  assert.equal(result['data-inspect-component'], 'Custom::card');
  assert.equal(result['data-inspect-source'], 'app/a.hbs:2');
  assert.equal(result['data-inspect-id'], 'app/a.hbs:2:2');
  assert.equal(
    decodeURIComponent(result['data-inspect-invocation']),
    '<div class="card wide">',
  );
  assert.equal(attr('<p>x</p>', 'data-inspect-component'), 'HTML::p');
});

test('names HDS, local and contextual components', () => {
  assert.equal(
    attr('<HdsButton @text="Save" />', 'data-inspect-component'),
    'Hds::Button',
  );
  assert.equal(
    attr('<Hds::Button @text="Save" />', 'data-inspect-component'),
    'Hds::Button',
  );
  assert.equal(
    attr('<HdsTextDisplay />', 'data-inspect-component'),
    'Hds::TextDisplay',
  );
  assert.equal(attr('<Hdsish />', 'data-inspect-component'), 'Hdsish');
  assert.equal(attr('<DemoCard />', 'data-inspect-component'), 'DemoCard');
  assert.equal(
    attr('<DemoCard />', 'data-inspect-component', { localNamespace: 'App::' }),
    'App::DemoCard',
  );
  assert.equal(
    attr('<A.Title>x</A.Title>', 'data-inspect-component'),
    'Contextual::A.Title',
  );
});

test('supports custom namespaces and a componentName override', () => {
  const namespaces = { Ui: 'Ui::', Hds: 'Hds::' };
  assert.equal(
    attr('<UiCard />', 'data-inspect-component', { namespaces }),
    'Ui::Card',
  );
  assert.equal(
    attr('<span class="x" />', 'data-inspect-component', {
      componentName: (info) =>
        info.kind === 'element' ? `El:${info.tag}.${info.classes[0]}` : null,
    }),
    'El:span.x',
  );
});

test('records authored arguments and the full opening tag', () => {
  const source = `<HdsButton
  @text="Go > there"
  @icon={{if this.ok "check" "x"}}
  {{on "click" this.go}}
/>`;
  const result = Object.fromEntries(attrs(source));
  assert.deepEqual(
    JSON.parse(decodeURIComponent(result['data-inspect-arguments'])),
    ['@text="Go > there"', '@icon={{if this.ok "check" "x"}}'],
  );
  assert.equal(decodeURIComponent(result['data-inspect-invocation']), source);
});

test('explicit attributes win and stamps go before ...attributes', () => {
  const names = attrs(
    '<section class="c" data-inspect-component="Mine" ...attributes></section>',
  );
  assert.equal(Object.fromEntries(names)['data-inspect-component'], 'Mine');
  const order = names.map(([name]) => name);
  assert.equal(order.at(-1), '...attributes');
  assert.equal(order.filter((n) => n === 'data-inspect-component').length, 1);
});

test('skips named blocks, document tags and data-inspect-skip', () => {
  const output = transform(
    '<HdsTable><:head as |H|><H.Tr /></:head></HdsTable><style></style><div data-inspect-skip><b></b></div>',
  );
  assert.doesNotMatch(output, /<:head[^>]*data-inspect/);
  assert.doesNotMatch(output, /<style[^>]*data-inspect/);
  assert.doesNotMatch(output, /data-inspect-skip/);
  assert.match(output, /<div>/);
  assert.match(output, /<b data-inspect-component="HTML::b"/);
  assert.match(output, /<H\.Tr data-inspect-component="Contextual::H\.Tr"/);
});

test('can be disabled, excluded or limited with include', () => {
  const source = '<div></div>';
  assert.equal(transform(source, { enabled: false }), source);
  assert.equal(transform(source, {}, `${root}/node_modules/x/a.hbs`), source);
  assert.equal(transform(source, { exclude: [/\/app\//] }), source);
  assert.equal(transform(source, { include: ['/other/'] }), source);
  assert.notEqual(transform(source, { include: ['/app/'] }), source);
});

test('applies sourcePrefix and strips query strings from filenames', () => {
  assert.equal(
    attr(
      '<div></div>',
      'data-inspect-source',
      { sourcePrefix: 'demo/' },
      `${root}/app/b.gts?import`,
    ),
    'demo/app/b.gts:1',
  );
});

test('works through babel-plugin-ember-template-compilation', async () => {
  const code = `import { precompileTemplate } from '@ember/template-compilation';
const Button = 1;
export default precompileTemplate('<Button @text="Hi" />', {
  strictMode: true,
  scope: () => ({ Button }),
});`;
  const result = await transformAsync(code, {
    filename: `${root}/app/components/x.js`,
    configFile: false,
    babelrc: false,
    plugins: [
      [
        'babel-plugin-ember-template-compilation',
        {
          targetFormat: 'hbs',
          transforms: [
            [require.resolve('../../template-transform.cjs'), { root }],
          ],
        },
      ],
    ],
  });
  assert.match(result.code, /data-inspect-component=\\?"Button\\?"/);
  assert.match(
    result.code,
    /data-inspect-source=\\?"app\/components\/x\.js:1\\?"/,
  );
});

test('reports file-relative locations for templates embedded in a file', async () => {
  const { mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'inspect-'));
  const file = join(dir, 'card.gts');
  const template = '<section class="card">\n  <h2>Title</h2>\n</section>';
  await writeFile(
    file,
    `import x from 'y';\n\nexport default <template>${template}</template>;\n`,
  );
  const output = transform(template, { root: dir }, file);
  assert.match(output, /<section[^>]*data-inspect-source="card\.gts:3"/);
  assert.match(output, /<section[^>]*data-inspect-id="card\.gts:3:25"/);
  assert.match(output, /<h2[^>]*data-inspect-id="card\.gts:4:2"/);
});

test('never stamps the inspector package itself', () => {
  const source = '<div></div>';
  assert.equal(
    transform(
      source,
      { exclude: [] },
      `${root}/packages/ember-prototype-inspector/dist/components/x.js`,
    ),
    source,
  );
});

test('maps trimmed and dedented <template> contents back to the file', async () => {
  const { mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'inspect-'));
  const file = join(dir, 'page.gts');
  await writeFile(
    file,
    [
      "import Card from './card';",
      '',
      'const A = <template><b>a</b></template>;',
      '',
      'export default <template>',
      '  <Card>',
      '    <p>Hi</p>',
      '  </Card>',
      '</template>;',
      '',
    ].join('\n'),
  );
  const output = transform('<Card>\n  <p>Hi</p>\n</Card>', { root: dir }, file);
  assert.match(output, /<Card[^>]*data-inspect-id="page\.gts:6:2"/);
  assert.match(output, /<p[^>]*data-inspect-id="page\.gts:7:4"/);
});
