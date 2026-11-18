import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { registerDestructor } from '@ember/destroyable';
import type Owner from '@ember/owner';
import {
  HdsAlert,
  HdsButton,
  HdsLinkStandalone,
  HdsTextDisplay,
} from '@hashicorp/design-system-components/components';
import positionInspectOverlay from '../modifiers/position-inspect-overlay.ts';
import { hdsDocsUrl, type DocsUrlResolver } from '../docs-url.ts';
import {
  boundsFor,
  targetFromElement,
  type Bounds,
  type InspectTarget,
} from '../inspect.ts';
import '../styles.css';

export const DEFAULT_TOKEN_PREFIXES = ['--hds-', '--token-'];

export interface InspectModeSignature {
  Args: {
    /** Called when the user presses Escape. */
    onExit: () => void;
    /**
     * Resolves a documentation URL for a component name. Defaults to
     * `hdsDocsUrl`, which links `Hds::*` components to helios.hashicorp.design.
     */
    docsUrl?: DocsUrlResolver;
    /** Label for the documentation link. Defaults to "Documentation". */
    docsLabel?: string;
    /**
     * CSS custom property prefixes reported as design tokens. Defaults to
     * `['--hds-', '--token-']` (HDS 7 and HDS 6 token names).
     */
    tokenPrefixes?: string[];
  };
}

type CopiedValue = 'invocation' | 'source';

const eq = (a: unknown, b: unknown): boolean => a === b;

export default class InspectMode extends Component<InspectModeSignature> {
  @tracked hoveredElement: HTMLElement | null = null;
  @tracked hoveredBounds: Bounds | null = null;
  @tracked selectedBounds: Bounds | null = null;
  @tracked selectedTarget: InspectTarget | null = null;
  @tracked copiedValue: CopiedValue | null = null;
  @tracked copyError: string | null = null;

  constructor(owner: Owner, args: InspectModeSignature['Args']) {
    super(owner, args);

    document.addEventListener('mouseover', this.handleMouseOver, true);
    document.addEventListener('focusin', this.handleFocusIn, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('resize', this.refreshBounds);
    window.addEventListener('scroll', this.refreshBounds, true);

    registerDestructor(this, () => {
      document.removeEventListener('mouseover', this.handleMouseOver, true);
      document.removeEventListener('focusin', this.handleFocusIn, true);
      document.removeEventListener('click', this.handleClick, true);
      document.removeEventListener('keydown', this.handleKeyDown, true);
      window.removeEventListener('resize', this.refreshBounds);
      window.removeEventListener('scroll', this.refreshBounds, true);
    });
  }

  get docsLabel(): string {
    return this.args.docsLabel ?? 'Documentation';
  }

  private inspectableElement(event: Event): HTMLElement | null {
    if (
      event
        .composedPath()
        .some(
          (entry) =>
            entry instanceof HTMLElement &&
            entry.hasAttribute('data-inspect-ui'),
        )
    ) {
      return null;
    }

    return event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-inspect-component]')
      : null;
  }

  private handleMouseOver = (event: MouseEvent): void => {
    const element = this.inspectableElement(event);
    this.hoveredElement = element;
    this.hoveredBounds = boundsFor(element);
  };

  private handleFocusIn = (event: FocusEvent): void => {
    const element = this.inspectableElement(event);

    if (element) {
      this.hoveredElement = element;
      this.hoveredBounds = boundsFor(element);
    }
  };

  private handleClick = (event: MouseEvent): void => {
    if (event.altKey) {
      return;
    }

    const element = this.inspectableElement(event);

    if (!element) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.selectElement(element);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.args.onExit();
    }
  };

  private refreshBounds = (): void => {
    this.hoveredBounds = boundsFor(this.hoveredElement);
    this.selectedBounds = boundsFor(this.selectedTarget?.element ?? null);
  };

  private selectElement(element: HTMLElement): void {
    this.selectedTarget = targetFromElement(element, {
      docsUrl: this.args.docsUrl ?? hdsDocsUrl,
      tokenPrefixes: this.args.tokenPrefixes ?? DEFAULT_TOKEN_PREFIXES,
    });
    this.selectedBounds = boundsFor(element);
    this.copiedValue = null;
    this.copyError = null;
  }

  @action
  selectAncestor(element: HTMLElement): void {
    this.selectElement(element);
  }

  @action
  closePanel(): void {
    this.selectedTarget = null;
    this.selectedBounds = null;
    this.copiedValue = null;
    this.copyError = null;
  }

  @action
  async copyValue(value: string, copiedValue: CopiedValue): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copiedValue = copiedValue;
      this.copyError = null;
    } catch {
      this.copyError =
        'Unable to copy. Select the text and copy it manually instead.';
    }
  }

  <template>
    <div data-inspect-ui>
      {{#if this.hoveredBounds}}
        <div
          class="inspect-outline inspect-outline-hover"
          {{positionInspectOverlay this.hoveredBounds}}
          aria-hidden="true"
        ></div>
        <div
          class="inspect-hover-label"
          {{positionInspectOverlay this.hoveredBounds label=true}}
          aria-hidden="true"
        >
          {{this.hoveredElement.dataset.inspectComponent}}
        </div>
      {{/if}}

      {{#if this.selectedBounds}}
        <div
          class="inspect-outline inspect-outline-selected"
          {{positionInspectOverlay this.selectedBounds}}
          aria-hidden="true"
        ></div>
      {{/if}}

      {{#if this.selectedTarget}}
        <aside
          class="inspect-panel"
          aria-label="Component inspector"
          data-test-inspect-panel
        >
          <header class="inspect-panel-header">
            <HdsTextDisplay @tag="h2" @size="300">
              {{this.selectedTarget.component}}
            </HdsTextDisplay>
            <HdsButton
              @text="Close inspector"
              @icon="x"
              @isIconOnly={{true}}
              @size="small"
              @color="secondary"
              {{on "click" this.closePanel}}
              data-test-inspect-close
            />
          </header>

          {{#if this.selectedTarget.ancestors.length}}
            <nav class="inspect-breadcrumbs" aria-label="Component hierarchy">
              {{#each this.selectedTarget.ancestors as |ancestor|}}
                <button
                  type="button"
                  {{on "click" (fn this.selectAncestor ancestor.element)}}
                >
                  {{ancestor.component}}
                </button>
                <span aria-hidden="true">/</span>
              {{/each}}
              <span aria-current="page">{{this.selectedTarget.component}}</span>
            </nav>
          {{/if}}

          <div class="inspect-panel-content">
            {{#if this.copyError}}
              <HdsAlert @type="compact" @color="critical" as |A|>
                <A.Title>Copy failed</A.Title>
                <A.Description>{{this.copyError}}</A.Description>
              </HdsAlert>
            {{/if}}

            {{#if this.selectedTarget.note}}
              <section
                class="inspect-section inspect-note"
                data-test-inspect-note
              >
                <h3>Guidance</h3>
                <p>{{this.selectedTarget.note}}</p>
              </section>
            {{/if}}

            <section class="inspect-section">
              <h3>Source</h3>
              <code
                data-test-inspect-source
              >{{this.selectedTarget.source}}</code>
              <div class="inspect-copy-actions">
                <HdsButton
                  @text={{if
                    (eq this.copiedValue "source")
                    "Copied"
                    "Copy source"
                  }}
                  @icon={{if
                    (eq this.copiedValue "source")
                    "check"
                    "clipboard-copy"
                  }}
                  @size="small"
                  @color="secondary"
                  {{on
                    "click"
                    (fn this.copyValue this.selectedTarget.source "source")
                  }}
                />
                {{#if this.selectedTarget.docsUrl}}
                  <HdsLinkStandalone
                    @text={{this.docsLabel}}
                    @href={{this.selectedTarget.docsUrl}}
                    @icon="external-link"
                    @iconPosition="trailing"
                    @size="small"
                    target="_blank"
                    rel="noreferrer"
                    data-test-inspect-docs
                  />
                {{/if}}
              </div>
            </section>

            {{#if this.selectedTarget.componentProperties.length}}
              <section class="inspect-section">
                <h3>Component properties</h3>
                <ul class="inspect-property-list">
                  {{#each
                    this.selectedTarget.componentProperties
                    as |property|
                  }}
                    <li>
                      <div class="inspect-property-heading">
                        <span>{{property.name}}</span>
                        <span class="inspect-property-source">
                          {{property.source}}
                        </span>
                      </div>
                      <code>{{property.value}}</code>
                    </li>
                  {{/each}}
                </ul>
              </section>
            {{/if}}

            {{#if this.selectedTarget.icons.length}}
              <section class="inspect-section">
                <h3>Icons</h3>
                <ul class="inspect-code-list">
                  {{#each this.selectedTarget.icons as |icon|}}
                    <li><code>{{icon}}</code></li>
                  {{/each}}
                </ul>
              </section>
            {{/if}}

            <section class="inspect-section">
              <h3>Typography</h3>
              {{#if this.selectedTarget.typographySource}}
                <p
                  class="inspect-section-hint"
                  data-test-inspect-typography-source
                >
                  Read from
                  <code>{{this.selectedTarget.typographySource}}</code>
                </p>
              {{/if}}
              <dl class="inspect-detail-list">
                {{#each this.selectedTarget.typography as |detail|}}
                  <div
                    class="inspect-detail-row"
                    data-test-inspect-typography={{detail.label}}
                  >
                    <dt>{{detail.label}}</dt>
                    <dd>
                      <code>{{detail.value}}</code>
                      {{#each detail.tokens as |token|}}
                        <code class="inspect-token-name">{{token}}</code>
                      {{/each}}
                    </dd>
                  </div>
                {{/each}}
              </dl>
            </section>

            <section class="inspect-section">
              <h3>Spacing and dimensions</h3>
              <dl class="inspect-detail-list">
                {{#each this.selectedTarget.spacing as |detail|}}
                  <div class="inspect-detail-row">
                    <dt>{{detail.label}}</dt>
                    <dd>
                      <code>{{detail.value}}</code>
                      {{#each detail.tokens as |token|}}
                        <code class="inspect-token-name">{{token}}</code>
                      {{/each}}
                    </dd>
                  </div>
                {{/each}}
              </dl>
            </section>

            {{#if this.selectedTarget.invocation}}
              <section class="inspect-section">
                <div class="inspect-section-heading">
                  <h3>Invocation</h3>
                  <HdsButton
                    @text={{if
                      (eq this.copiedValue "invocation")
                      "Copied"
                      "Copy invocation"
                    }}
                    @icon={{if
                      (eq this.copiedValue "invocation")
                      "check"
                      "clipboard-copy"
                    }}
                    @size="small"
                    @color="secondary"
                    {{on
                      "click"
                      (fn
                        this.copyValue
                        this.selectedTarget.invocation
                        "invocation"
                      )
                    }}
                    data-test-copy-inspect-invocation
                  />
                </div>
                <pre><code
                    data-test-inspect-invocation
                  >{{this.selectedTarget.invocation}}</code></pre>
              </section>
            {{/if}}

            <section class="inspect-section">
              <h3>Applied token references</h3>
              {{#if this.selectedTarget.tokens.length}}
                <ul class="inspect-token-list">
                  {{#each this.selectedTarget.tokens as |reference|}}
                    <li>
                      <code
                        class="inspect-selector"
                      >{{reference.selector}}</code>
                      {{#each reference.declarations as |declaration|}}
                        <code>{{declaration}}</code>
                      {{/each}}
                    </li>
                  {{/each}}
                </ul>
              {{else}}
                <p>No matching token declarations were found in loaded
                  stylesheets.</p>
              {{/if}}
            </section>
          </div>

          <footer class="inspect-panel-footer">
            Click to select · Alt-click to interact · Esc to exit
          </footer>
        </aside>
      {{/if}}
    </div>
  </template>
}
