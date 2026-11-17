import type { Bounds } from './modifiers/position-inspect-overlay.ts';

export type { Bounds };

export interface TokenReference {
  declarations: string[];
  selector: string;
}

export interface InspectionValue {
  label: string;
  tokens: string[];
  value: string;
}

export interface ComponentProperty {
  name: string;
  source: 'authored' | 'rendered';
  value: string;
}

interface StyleInspection {
  inheritedTokens: Map<string, Set<string>>;
  references: TokenReference[];
  selectedTokens: Map<string, Set<string>>;
}

export interface InspectOptions {
  docsUrl: (component: string) => string | null;
  tokenPrefixes: string[];
}

type TypographyProperty =
  | 'font-family'
  | 'font-size'
  | 'font-weight'
  | 'letter-spacing'
  | 'line-height';

export interface InspectTarget {
  ancestors: InspectTarget[];
  arguments: string[];
  component: string;
  componentProperties: ComponentProperty[];
  docsUrl: string | null;
  element: HTMLElement;
  icons: string[];
  invocation: string;
  note: string | null;
  spacing: InspectionValue[];
  source: string;
  tokens: TokenReference[];
  typography: InspectionValue[];
}

function parseArguments(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed)
      ? parsed.filter(
          (argument): argument is string => typeof argument === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function isToken(name: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => name.startsWith(prefix));
}

function usesToken(value: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => value.includes(`var(${prefix}`));
}

function tokenNames(value: string, prefixes: string[]): string[] {
  return Array.from(value.matchAll(/var\((--[^),\s]+)/g), (match) => {
    return match[1];
  }).filter(
    (token): token is string => Boolean(token) && isToken(token!, prefixes),
  );
}

function addTokens(
  tokenMap: Map<string, Set<string>>,
  property: string,
  value: string,
  prefixes: string[],
): void {
  const names = tokenNames(value, prefixes);

  if (names.length === 0) {
    return;
  }

  const existingTokens = tokenMap.get(property) ?? new Set<string>();

  for (const name of names) {
    existingTokens.add(name);
  }

  tokenMap.set(property, existingTokens);
}

function inspectStyles(
  element: HTMLElement,
  prefixes: string[],
): StyleInspection {
  const references: TokenReference[] = [];
  const seen = new Set<string>();
  const selectedTokens = new Map<string, Set<string>>();
  const inheritedTokens = new Map<string, Set<string>>();
  const elements = [element];
  let parent = element.parentElement;

  while (parent) {
    elements.push(parent);
    parent = parent.parentElement;
  }

  function inspectRules(
    rules: CSSRuleList,
    matchedElement: HTMLElement,
    isSelectedElement: boolean,
  ): void {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        let matches = false;

        try {
          matches = matchedElement.matches(rule.selectorText);
        } catch {
          continue;
        }

        if (!matches) {
          continue;
        }

        const declarations: string[] = [];

        for (const property of rule.style) {
          const value = rule.style.getPropertyValue(property).trim();

          if (usesToken(value, prefixes)) {
            addTokens(inheritedTokens, property, value, prefixes);

            if (isSelectedElement) {
              addTokens(selectedTokens, property, value, prefixes);
              declarations.push(`${property}: ${value}`);
            }
          }
        }

        if (isSelectedElement && declarations.length > 0) {
          const key = `${rule.selectorText}:${declarations.join(';')}`;

          if (!seen.has(key)) {
            seen.add(key);
            references.push({
              declarations,
              selector: rule.selectorText,
            });
          }
        }
      } else if ('cssRules' in rule) {
        inspectRules(
          (rule as CSSMediaRule).cssRules,
          matchedElement,
          isSelectedElement,
        );
      }
    }
  }

  for (const [index, matchedElement] of elements.entries()) {
    for (const styleSheet of document.styleSheets) {
      try {
        inspectRules(styleSheet.cssRules, matchedElement, index === 0);
      } catch {
        continue;
      }
    }
  }

  return {
    inheritedTokens,
    references: references.slice(0, 12),
    selectedTokens,
  };
}

function tokensForProperties(
  tokenMap: Map<string, Set<string>>,
  properties: string[],
): string[] {
  const tokens = new Set<string>();

  for (const property of properties) {
    for (const token of tokenMap.get(property) ?? []) {
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}

function typographyTokenNames(prefixes: string[]): Set<string> {
  const tokens = new Set<string>();

  function inspectRules(rules: CSSRuleList): void {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        for (const property of rule.style) {
          if (
            prefixes.some((prefix) =>
              property.startsWith(`${prefix}typography-`),
            )
          ) {
            tokens.add(property);
          }
        }
      } else if ('cssRules' in rule) {
        inspectRules((rule as CSSMediaRule).cssRules);
      }
    }
  }

  for (const styleSheet of document.styleSheets) {
    try {
      inspectRules(styleSheet.cssRules);
    } catch {
      continue;
    }
  }

  return tokens;
}

function inferredTypographyTokens(
  element: HTMLElement,
  style: CSSStyleDeclaration,
  prefixes: string[],
): Map<string, Set<string>> {
  const inferredTokens = new Map<string, Set<string>>();
  const scaleTokens = new Map<string, Map<TypographyProperty, string>>();
  const standaloneTokens = new Map<TypographyProperty, string[]>();

  for (const token of typographyTokenNames(prefixes)) {
    const scaleMatch = token.match(
      /^(--.*typography-(?:body|code|display)-\d+)-(font-family|font-size|letter-spacing|line-height)$/,
    );

    if (scaleMatch?.[1] && scaleMatch[2]) {
      const properties =
        scaleTokens.get(scaleMatch[1]) ?? new Map<TypographyProperty, string>();
      properties.set(scaleMatch[2] as TypographyProperty, token);
      scaleTokens.set(scaleMatch[1], properties);
      continue;
    }

    const property =
      token.endsWith('-font-family') || token.includes('-font-stack-')
        ? 'font-family'
        : token.includes('-font-weight-')
          ? 'font-weight'
          : null;

    if (property) {
      standaloneTokens.set(property, [
        ...(standaloneTokens.get(property) ?? []),
        token,
      ]);
    }
  }

  for (const properties of scaleTokens.values()) {
    const requiredProperties: TypographyProperty[] = [
      'font-family',
      'font-size',
      'line-height',
    ];
    const matchesScale = requiredProperties.every((property) => {
      const token = properties.get(property);

      return (
        token &&
        tokenMatchesComputedValue(
          element,
          property,
          token,
          style.getPropertyValue(property),
        )
      );
    });

    if (!matchesScale) {
      continue;
    }

    for (const [property, token] of properties) {
      if (
        tokenMatchesComputedValue(
          element,
          property,
          token,
          style.getPropertyValue(property),
        )
      ) {
        addTokens(inferredTokens, property, `var(${token})`, prefixes);
      }
    }
  }

  for (const [property, tokens] of standaloneTokens) {
    for (const token of tokens) {
      if (
        tokenMatchesComputedValue(
          element,
          property,
          token,
          style.getPropertyValue(property),
        )
      ) {
        addTokens(inferredTokens, property, `var(${token})`, prefixes);
      }
    }
  }

  return inferredTokens;
}

function mergedTokenMaps(
  primary: Map<string, Set<string>>,
  fallback: Map<string, Set<string>>,
): Map<string, Set<string>> {
  const merged = new Map(
    Array.from(primary, ([property, tokens]) => [property, new Set(tokens)]),
  );

  for (const [property, tokens] of fallback) {
    const mergedTokens = merged.get(property) ?? new Set<string>();

    for (const token of tokens) {
      mergedTokens.add(token);
    }

    merged.set(property, mergedTokens);
  }

  return merged;
}

function computedInspectionValue(
  label: string,
  value: string,
  tokenMap: Map<string, Set<string>>,
  properties: string[],
  element?: HTMLElement,
  computedProperty?: string,
): InspectionValue {
  let tokens = tokensForProperties(tokenMap, properties);

  if (element && computedProperty) {
    tokens = tokens.filter((token) =>
      tokenMatchesComputedValue(element, computedProperty, token, value),
    );
  }

  return {
    label,
    tokens,
    value: formattedComputedValue(value),
  };
}

function formattedComputedValue(value: string): string {
  const pixelValue = value.match(/^(-?\d+(?:\.\d+)?)px$/);

  if (!pixelValue?.[1]) {
    return value;
  }

  return `${Math.round(Number(pixelValue[1]) * 100) / 100}px`;
}

function normalizedGap(value: string): string {
  return value === 'normal' ? '0px' : value;
}

function normalizedComputedValue(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/["']/g, '')
    .replaceAll(/\s*,\s*/g, ',')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function tokenMatchesComputedValue(
  element: HTMLElement,
  property: string,
  token: string,
  computedValue: string,
): boolean {
  const probe = document.createElement('span');
  const selectedStyle = getComputedStyle(element);

  probe.setAttribute('data-inspect-ui', '');
  probe.style.position = 'fixed';
  probe.style.visibility = 'hidden';
  probe.style.fontSize = selectedStyle.fontSize;
  probe.style.setProperty(property, `var(${token})`);
  document.body.append(probe);

  const tokenValue = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();

  return (
    normalizedComputedValue(tokenValue) ===
    normalizedComputedValue(computedValue)
  );
}

function boxValue(
  top: string,
  right: string,
  bottom: string,
  left: string,
): string {
  if (top === right && top === bottom && top === left) {
    return top;
  }

  if (top === bottom && right === left) {
    return `${top} ${right}`;
  }

  if (right === left) {
    return `${top} ${right} ${bottom}`;
  }

  return `${top} ${right} ${bottom} ${left}`;
}

function typographyValues(
  element: HTMLElement,
  styleInspection: StyleInspection,
  prefixes: string[],
): InspectionValue[] {
  const style = getComputedStyle(element);
  const tokenMap = mergedTokenMaps(
    styleInspection.inheritedTokens,
    inferredTypographyTokens(element, style, prefixes),
  );

  return [
    computedInspectionValue(
      'Font family',
      style.fontFamily,
      tokenMap,
      ['font', 'font-family'],
      element,
      'font-family',
    ),
    computedInspectionValue(
      'Font size',
      style.fontSize,
      tokenMap,
      ['font', 'font-size'],
      element,
      'font-size',
    ),
    computedInspectionValue(
      'Font weight',
      style.fontWeight,
      tokenMap,
      ['font', 'font-weight'],
      element,
      'font-weight',
    ),
    computedInspectionValue(
      'Line height',
      style.lineHeight,
      tokenMap,
      ['font', 'line-height'],
      element,
      'line-height',
    ),
    computedInspectionValue(
      'Letter spacing',
      style.letterSpacing,
      tokenMap,
      ['font', 'letter-spacing'],
      element,
      'letter-spacing',
    ),
  ];
}

function spacingValues(
  element: HTMLElement,
  styleInspection: StyleInspection,
): InspectionValue[] {
  const style = getComputedStyle(element);
  const parent = element.parentElement;
  const parentStyle = parent ? getComputedStyle(parent) : null;
  const rect = element.getBoundingClientRect();
  const values = [
    computedInspectionValue(
      'Dimensions',
      `${Math.round(rect.width * 100) / 100}px × ${
        Math.round(rect.height * 100) / 100
      }px`,
      styleInspection.selectedTokens,
      ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'],
    ),
    computedInspectionValue(
      'Padding',
      boxValue(
        style.paddingTop,
        style.paddingRight,
        style.paddingBottom,
        style.paddingLeft,
      ),
      styleInspection.selectedTokens,
      [
        'padding',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
      ],
    ),
    computedInspectionValue(
      'Margin',
      boxValue(
        style.marginTop,
        style.marginRight,
        style.marginBottom,
        style.marginLeft,
      ),
      styleInspection.selectedTokens,
      ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
    ),
  ];

  if (style.display === 'flex' || style.display === 'grid') {
    values.push(
      computedInspectionValue(
        'Content gap',
        boxValue(
          normalizedGap(style.rowGap),
          normalizedGap(style.columnGap),
          normalizedGap(style.rowGap),
          normalizedGap(style.columnGap),
        ),
        styleInspection.selectedTokens,
        ['gap', 'row-gap', 'column-gap'],
      ),
    );
  }

  if (
    parentStyle &&
    (parentStyle.display === 'flex' || parentStyle.display === 'grid')
  ) {
    values.push({
      label: 'Parent gap',
      tokens: [],
      value: boxValue(
        normalizedGap(parentStyle.rowGap),
        normalizedGap(parentStyle.columnGap),
        normalizedGap(parentStyle.rowGap),
        normalizedGap(parentStyle.columnGap),
      ),
    });
  }

  return values;
}

function authoredProperties(argumentsList: string[]): ComponentProperty[] {
  return argumentsList.map((argument) => {
    const match = argument.match(/^@([^=\s]+)(?:\s*=\s*(.*))?$/);

    return {
      name: match?.[1] ?? argument,
      source: 'authored',
      value: match?.[2] ?? 'true',
    };
  });
}

function renderedProperties(
  element: HTMLElement,
  authored: ComponentProperty[],
  component: string,
): ComponentProperty[] {
  const authoredNames = new Set(authored.map((property) => property.name));
  const properties: ComponentProperty[] = [];
  const seen = new Set<string>();
  const propertyNames = [
    'align',
    'background',
    'color',
    'density',
    'direction',
    'level',
    'position',
    'size',
    'type',
    'valign',
  ];

  const isHdsComponent =
    component.startsWith('Hds::') ||
    Array.from(element.classList).some((name) => name.startsWith('hds-'));

  if (!isHdsComponent) {
    properties.push({
      name: 'element',
      source: 'rendered',
      value: element.tagName.toLowerCase(),
    });

    if (element.classList.length > 0) {
      properties.push({
        name: 'classes',
        source: 'rendered',
        value: Array.from(element.classList).join(' '),
      });
    }
  }

  for (const className of element.classList) {
    const variant = className.match(/^hds-[a-z0-9-]+--(.+)$/)?.[1];

    if (!variant) {
      continue;
    }

    const name =
      propertyNames.find((propertyName) =>
        variant.startsWith(`${propertyName}-`),
      ) ?? 'variant';
    const value = name === 'variant' ? variant : variant.slice(name.length + 1);
    const key = `${name}:${value}`;

    if (!seen.has(key) && !authoredNames.has(name)) {
      seen.add(key);
      properties.push({
        name,
        source: 'rendered',
        value,
      });
    }
  }

  return properties;
}

function iconNames(
  element: HTMLElement,
  properties: ComponentProperty[],
): string[] {
  const icons = new Set<string>();

  for (const property of properties) {
    if (property.name === 'icon') {
      icons.add(property.value.replace(/^["']|["']$/g, ''));
    }
  }

  for (const svg of element.querySelectorAll('svg[data-test-icon]')) {
    const icon = svg.getAttribute('data-test-icon');

    if (icon) {
      icons.add(icon);
    }
  }

  for (const useElement of element.querySelectorAll('svg use')) {
    const reference =
      useElement.getAttribute('href') ?? useElement.getAttribute('xlink:href');
    const icon = reference?.match(
      /#hds-icon-(?:flight|carbon)-(.+?)(?:-\d+)?$/,
    )?.[1];

    if (icon) {
      icons.add(icon);
    }
  }

  return Array.from(icons);
}

export function targetFromElement(
  element: HTMLElement,
  options: InspectOptions,
  includeAncestors = true,
): InspectTarget {
  const component = element.dataset['inspectComponent'] ?? 'Unknown component';
  const ancestors: InspectTarget[] = [];
  const argumentsList = parseArguments(element.dataset['inspectArguments']);
  const authored = authoredProperties(argumentsList);
  const properties = [
    ...authored,
    ...renderedProperties(element, authored, component),
  ];
  const styleInspection = inspectStyles(element, options.tokenPrefixes);

  if (includeAncestors) {
    let parent = element.parentElement?.closest<HTMLElement>(
      '[data-inspect-component]',
    );

    while (parent) {
      ancestors.unshift(targetFromElement(parent, options, false));
      parent = parent.parentElement?.closest<HTMLElement>(
        '[data-inspect-component]',
      );
    }
  }

  return {
    ancestors,
    arguments: argumentsList,
    component,
    componentProperties: properties,
    docsUrl: options.docsUrl(component),
    element,
    icons: iconNames(element, properties),
    invocation: element.dataset['inspectInvocation']
      ? decodeURIComponent(element.dataset['inspectInvocation'])
      : '',
    note: element.dataset['inspectNote'] ?? null,
    spacing: spacingValues(element, styleInspection),
    source: element.dataset['inspectSource'] ?? '',
    tokens: styleInspection.references,
    typography: typographyValues(
      element,
      styleInspection,
      options.tokenPrefixes,
    ),
  };
}

export function boundsFor(element: HTMLElement | null): Bounds | null {
  if (!element?.isConnected) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}
