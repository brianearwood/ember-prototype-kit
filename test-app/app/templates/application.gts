import { pageTitle } from 'ember-page-title';
import { LinkTo } from '@ember/routing';
import { on } from '@ember/modifier';
import {
  HdsBadge,
  HdsButton,
  HdsTextBody,
} from '@hashicorp/design-system-components/components';
import type { TOC } from '@ember/component/template-only';
import InspectMode from 'ember-prototype-inspector/components/inspect-mode';
import DemoCard from 'test-app/components/demo-card';
import type ApplicationController from 'test-app/controllers/application';

interface ApplicationSignature {
  Args: { controller: ApplicationController };
}

export default <template>
  {{pageTitle "ember-prototype-inspector demo"}}

  <main class="demo-main" id="main">
    <div class="demo-row" data-inspect-skip>
      <HdsButton
        @text={{if @controller.inspect "Exit inspect mode" "Inspect"}}
        @icon="search"
        @color="secondary"
        {{on "click" @controller.toggleInspect}}
        data-test-toggle-inspect
      />
      <LinkTo @route="index">Template tag demo</LinkTo>
      <LinkTo @route="classic">Classic .hbs demo</LinkTo>
    </div>

    <DemoCard @title="Example card" data-test-demo-card>
      <HdsTextBody @tag="p" @size="200">
        Turn on inspect mode, then click any element to see where it came from.
      </HdsTextBody>
      <div class="demo-row">
        <HdsButton @text="Primary action" @icon="plus" data-test-primary />
        <HdsBadge @text="Ready" @color="success" data-test-badge />
      </div>
    </DemoCard>

    {{outlet}}
  </main>

  {{#if @controller.inspect}}
    <InspectMode @onExit={{@controller.exitInspect}} />
  {{/if}}
</template> satisfies TOC<ApplicationSignature>;
