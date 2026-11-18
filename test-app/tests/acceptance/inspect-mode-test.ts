import {
  click,
  currentURL,
  triggerEvent,
  triggerKeyEvent,
  visit,
} from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'test-app/tests/helpers';

const PANEL = '[data-test-inspect-panel]';

module('Acceptance | inspect mode', function (hooks) {
  setupApplicationTest(hooks);

  test('stamps template-tag components with file-relative sources', async function (assert) {
    await visit('/');

    assert
      .dom('[data-test-primary]')
      .hasAttribute('data-inspect-component', 'Hds::Button')
      .hasAttribute(
        'data-inspect-source',
        /^app\/templates\/application\.gts:\d+$/,
      );
    assert
      .dom('[data-test-demo-card]')
      .hasAttribute('data-inspect-component', 'DemoCard')
      .hasAttribute(
        'data-inspect-source',
        /^app\/templates\/application\.gts:\d+$/,
        'invocation metadata wins over the component root element',
      );
    assert
      .dom('[data-test-demo-card] h2')
      .hasAttribute(
        'data-inspect-source',
        /^app\/components\/demo-card\.gts:\d+$/,
      );
  });

  test('selects an HDS component and shows its source, invocation and docs', async function (assert) {
    await visit('/?inspect=true');

    assert.dom(PANEL).doesNotExist();

    await triggerEvent('[data-test-primary]', 'mouseover');
    assert.dom('.inspect-hover-label').hasText('Hds::Button');

    await click('[data-test-primary]');

    assert.dom(`${PANEL} h2`).hasText('Hds::Button');
    assert
      .dom('[data-test-inspect-source]')
      .hasText(/^app\/templates\/application\.gts:\d+$/);
    assert
      .dom('[data-test-inspect-invocation]')
      .includesText('<HdsButton @text="Primary action" @icon="plus"');
    assert
      .dom('[data-test-inspect-docs]')
      .hasAttribute(
        'href',
        'https://helios.hashicorp.design/components/button',
      );
    assert.dom(PANEL).includesText('Component properties');
    assert.dom(PANEL).includesText('Icons');
    assert.dom(PANEL).includesText('plus');
    assert.dom(PANEL).includesText('Typography');
    assert.dom(PANEL).includesText('--hds-typography');
    assert.dom(PANEL).includesText('Spacing and dimensions');
  });

  test('reads typography from the element that renders the text', async function (assert) {
    await visit('/?inspect=true');

    const button = document.querySelector<HTMLElement>('[data-test-primary]')!;
    const text = button.querySelector<HTMLElement>('.hds-button__text')!;
    const textStyle = getComputedStyle(text);

    assert.notStrictEqual(
      getComputedStyle(button).fontSize,
      textStyle.fontSize,
      'the button and its text have different font sizes',
    );

    await click('[data-test-primary]');

    assert
      .dom('[data-test-inspect-typography-source]')
      .hasText('Read from span.hds-button__text');
    assert
      .dom('[data-test-inspect-typography="Font size"] dd code')
      .hasText(textStyle.fontSize);
    assert
      .dom('[data-test-inspect-typography="Font weight"] dd code')
      .hasText(textStyle.fontWeight);
  });

  test('reads typography from the selected element when it holds text', async function (assert) {
    await visit('/?inspect=true');

    await click('[data-test-demo-card] h2');

    assert.dom('[data-test-inspect-typography-source]').doesNotExist();
    assert
      .dom('[data-test-inspect-typography="Font size"] dd code')
      .hasText(
        getComputedStyle(document.querySelector('[data-test-demo-card] h2')!)
          .fontSize,
      );
  });

  test('shows guidance notes and ancestor breadcrumbs for local components', async function (assert) {
    await visit('/?inspect=true');

    await click('[data-test-demo-card] h2');

    assert.dom(`${PANEL} h2`).hasText('Custom::demo-card-title');
    assert
      .dom('[data-test-inspect-source]')
      .hasText(/^app\/components\/demo-card\.gts:\d+$/);
    assert.dom('[data-test-inspect-docs]').doesNotExist();
    assert.dom('[data-test-inspect-note]').doesNotExist();

    await click('.inspect-breadcrumbs button:last-of-type');

    assert.dom(`${PANEL} h2`).hasText('DemoCard');
    assert
      .dom('[data-test-inspect-note]')
      .includesText('Local layout component');

    await click('[data-test-inspect-close]');

    assert.dom(PANEL).doesNotExist();
  });

  test('inspects components in classic .hbs templates', async function (assert) {
    await visit('/classic?inspect=true');

    await click('[data-test-classic-button]');

    assert.dom(`${PANEL} h2`).hasText('Hds::Button');
    assert
      .dom('[data-test-inspect-source]')
      .hasText('app/templates/classic.hbs:3');
    assert.dom('[data-test-inspect-invocation]').includesText('<Hds::Button');
  });

  test('Alt-click passes through and Escape exits', async function (assert) {
    await visit('/?inspect=true');

    await triggerEvent('[data-test-primary]', 'click', { altKey: true });

    assert.dom(PANEL).doesNotExist();

    await triggerKeyEvent(document, 'keydown', 'Escape');

    assert.dom('.inspect-hover-label').doesNotExist();
    assert.false(currentURL().includes('inspect=true'));
  });
});
