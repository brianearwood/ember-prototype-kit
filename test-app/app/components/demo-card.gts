import type { TOC } from '@ember/component/template-only';

interface DemoCardSignature {
  Args: { title: string };
  Blocks: { default: [] };
  Element: HTMLElement;
}

const DemoCard = <template>
  <section
    class="demo-card"
    data-inspect-note="Local layout component. Pair it with HDS components for content and actions."
    ...attributes
  >
    <h2 class="demo-card-title">{{@title}}</h2>
    {{yield}}
  </section>
</template> satisfies TOC<DemoCardSignature>;

export default DemoCard;
