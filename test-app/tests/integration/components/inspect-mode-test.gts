import { click, render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'test-app/tests/helpers';
import InspectMode from 'ember-prototype-inspector/components/inspect-mode';

const noop = () => {};
const docsUrl = (component: string) =>
  component.startsWith('Ui::') ? `https://example.com/${component}` : null;

module('Integration | Component | inspect-mode', function (hooks) {
  setupRenderingTest(hooks);

  test('accepts a custom docs resolver and label', async function (assert) {
    await render(
      <template>
        <div
          data-inspect-component="Ui::Card"
          data-inspect-source="src/card.gts:4"
          data-test-target
        >Card</div>
        <InspectMode
          @onExit={{noop}}
          @docsUrl={{docsUrl}}
          @docsLabel="Design docs"
        />
      </template>,
    );

    await click('[data-test-target]');

    assert.dom('[data-test-inspect-panel] h2').hasText('Ui::Card');
    assert.dom('[data-test-inspect-source]').hasText('src/card.gts:4');
    assert
      .dom('[data-test-inspect-docs]')
      .hasAttribute('href', 'https://example.com/Ui::Card')
      .hasText('Design docs');
  });

  test('ignores clicks on elements without inspect metadata', async function (assert) {
    await render(
      <template>
        <button type="button" data-inspect-skip data-test-plain>Plain</button>
        <InspectMode @onExit={{noop}} />
      </template>,
    );

    await click('[data-test-plain]');

    assert.dom('[data-test-inspect-panel]').doesNotExist();
  });
});
