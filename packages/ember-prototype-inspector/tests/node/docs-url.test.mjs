import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hdsDocsUrl } from '../../src/docs-url.ts';

const base = 'https://helios.hashicorp.design';

test('maps HDS components to Helios documentation pages', () => {
  assert.equal(hdsDocsUrl('Hds::Button'), `${base}/components/button`);
  assert.equal(hdsDocsUrl('Hds::ButtonSet'), `${base}/components/button-set`);
  assert.equal(
    hdsDocsUrl('Hds::Form::TextInput::Field'),
    `${base}/components/form/text-input`,
  );
  assert.equal(
    hdsDocsUrl('Hds::LinkStandalone'),
    `${base}/components/link/standalone`,
  );
  assert.equal(hdsDocsUrl('Hds::AppFrame'), `${base}/components/app-frame`);
  assert.equal(hdsDocsUrl('Hds::LayoutFlex'), `${base}/layouts/flex`);
});

test('returns null for non-HDS components', () => {
  assert.equal(hdsDocsUrl('DemoCard'), null);
  assert.equal(hdsDocsUrl('HTML::div'), null);
});
