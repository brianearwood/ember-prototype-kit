'use strict';

/**
 * Glimmer template AST transform that stamps `data-inspect-*` metadata onto
 * every element and component invocation so Inspect Mode can connect rendered
 * DOM back to template source.
 *
 * Register it in babel-plugin-ember-template-compilation `transforms`:
 *
 *   transforms: [
 *     ['ember-prototype-inspector/template-transform', { root: __dirname }],
 *   ]
 *
 * or call the factory directly:
 *
 *   const inspectMetadata = require('ember-prototype-inspector/template-transform');
 *   transforms: [inspectMetadata({ enabled: process.env.NODE_ENV !== 'production' })]
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_NAME = 'ember-prototype-inspector:inspect-metadata';

const ATTRIBUTE_NAMES = [
  'data-inspect-component',
  'data-inspect-source',
  'data-inspect-invocation',
  'data-inspect-arguments',
  'data-inspect-id',
];

const SKIP_ATTRIBUTE = 'data-inspect-skip';

const DEFAULT_SKIPPED_TAGS = new Set([
  'base',
  'head',
  'html',
  'link',
  'meta',
  'noscript',
  'script',
  'slot',
  'style',
  'template',
  'title',
]);

const DEFAULT_NAMESPACES = { Hds: 'Hds::' };

const DEFAULT_EXCLUDE = [/[\\/]node_modules[\\/]/];

// The inspector's own UI is never stamped, even when it is linked into a
// workspace instead of installed into node_modules.
const SELF_PATTERN = /[\\/]ember-prototype-inspector[\\/](?:dist|src)[\\/]/;

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function matchesPattern(pattern, value) {
  if (typeof pattern === 'function') {
    return Boolean(pattern(value));
  }

  if (pattern instanceof RegExp) {
    return pattern.test(value);
  }

  return value.includes(pattern);
}

function invocationEnd(source) {
  let quote = null;
  let mustacheDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (mustacheDepth > 0 && quote) {
      if (character === quote && source[index - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (mustacheDepth === 0 && quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === '{' && nextCharacter === '{') {
      mustacheDepth += 1;
      index += 1;
      continue;
    }

    if (character === '}' && nextCharacter === '}' && mustacheDepth > 0) {
      mustacheDepth -= 1;
      index += 1;
      continue;
    }

    if (character === '>' && mustacheDepth === 0) {
      return index;
    }
  }

  return source.length - 1;
}

function locSource(node) {
  try {
    return node.loc.asString();
  } catch {
    return '';
  }
}

function openingTag(node) {
  const source = locSource(node);

  if (!source) {
    return `<${node.tag}>`;
  }

  return source.slice(0, invocationEnd(source) + 1);
}

function staticClasses(node) {
  const attribute = node.attributes.find((attr) => attr.name === 'class');

  if (!attribute) {
    return [];
  }

  const parts =
    attribute.value.type === 'TextNode'
      ? [attribute.value]
      : attribute.value.type === 'ConcatStatement'
        ? attribute.value.parts.filter((part) => part.type === 'TextNode')
        : [];

  return parts
    .flatMap((part) => part.chars.split(/\s+/))
    .filter((className) => className.length > 0);
}

function elementKind(tag) {
  if (/^[A-Z]/.test(tag) || tag.startsWith('@') || tag.includes('::')) {
    return tag.includes('.') ? 'contextual' : 'component';
  }

  if (tag.includes('.')) {
    return 'contextual';
  }

  return 'element';
}

function applyNamespaces(tag, namespaces) {
  const prefixes = Object.keys(namespaces).sort((a, b) => b.length - a.length);

  for (const prefix of prefixes) {
    if (!tag.startsWith(prefix)) {
      continue;
    }

    const remainder = tag.slice(prefix.length).replace(/^::/, '');

    if (remainder && !/^[A-Z]/.test(remainder)) {
      continue;
    }

    return `${namespaces[prefix]}${remainder}`;
  }

  return undefined;
}

function defaultComponentName(info, options) {
  const { classes, kind, tag } = info;

  if (kind === 'element') {
    return classes[0]
      ? `${options.customNamespace}${classes[0]}`
      : `${options.elementNamespace}${tag}`;
  }

  if (kind === 'contextual') {
    return `${options.contextualNamespace}${tag}`;
  }

  return (
    applyNamespaces(tag, options.namespaces) ??
    `${options.localNamespace}${tag}`
  );
}

function normalizeOptions(userOptions = {}) {
  return {
    enabled: userOptions.enabled ?? true,
    root: userOptions.root ?? process.cwd(),
    sourcePrefix: userOptions.sourcePrefix ?? '',
    include: userOptions.include ?? [],
    exclude: userOptions.exclude ?? DEFAULT_EXCLUDE,
    namespaces: userOptions.namespaces ?? DEFAULT_NAMESPACES,
    localNamespace: userOptions.localNamespace ?? '',
    contextualNamespace: userOptions.contextualNamespace ?? 'Contextual::',
    elementNamespace: userOptions.elementNamespace ?? 'HTML::',
    customNamespace: userOptions.customNamespace ?? 'Custom::',
    skipTags: new Set([
      ...DEFAULT_SKIPPED_TAGS,
      ...(userOptions.skipTags ?? []),
    ]),
    componentName: userOptions.componentName,
  };
}

function sourcePathFor(env, options) {
  const filename = env.filename ?? env.meta?.moduleName ?? env.moduleName;

  if (!filename) {
    return null;
  }

  const cleanFilename = String(filename).replace(/\?.*$/, '');
  const relative = path.isAbsolute(cleanFilename)
    ? path.relative(options.root, cleanFilename)
    : cleanFilename;

  return {
    absolute: cleanFilename,
    relative: `${options.sourcePrefix}${toPosix(relative)}`,
  };
}

function leadingWhitespace(line) {
  return line.length - line.trimStart().length;
}

function lineAndColumn(source, index) {
  const lines = source.slice(0, index).split('\n');

  return { line: lines.length - 1, column: lines[lines.length - 1].length };
}

/**
 * Template-tag (`<template>`) and inline templates are compiled on their own,
 * and Embroider trims and dedents `<template>` contents first, so Glimmer
 * locations are relative to the processed template rather than the file. Find
 * the template in the file on disk and return a function that maps template
 * locations back to file locations. Falls back to template-relative locations.
 */
function locationMapper(env, sourcePath) {
  const identity = (line, column) => ({ line, column });
  const contents = env.contents;

  if (!sourcePath || typeof contents !== 'string' || !contents) {
    return identity;
  }

  let source;

  try {
    source = fs.readFileSync(sourcePath.absolute, 'utf8');
  } catch {
    return identity;
  }

  const exactIndex = source.indexOf(contents);

  if (exactIndex !== -1) {
    const offset = lineAndColumn(source, exactIndex);

    return (line, column) => ({
      line: line + offset.line,
      column: column + (line === 1 ? offset.column : 0),
    });
  }

  const contentLines = contents.split('\n');
  const templatePattern = /<template\b[^>]*>([\s\S]*?)<\/template>/g;

  for (const match of source.matchAll(templatePattern)) {
    const bodyIndex = match.index + match[0].length - match[1].length - 11;
    const start = lineAndColumn(source, bodyIndex);
    const bodyLines = match[1].split('\n').map((text, index) => ({
      text,
      line: start.line + index,
      column: index === 0 ? start.column : 0,
    }));

    while (bodyLines.length > 0 && bodyLines[0].text.trim() === '') {
      bodyLines.shift();
    }

    while (
      bodyLines.length > 0 &&
      bodyLines[bodyLines.length - 1].text.trim() === ''
    ) {
      bodyLines.pop();
    }

    if (
      bodyLines.length !== contentLines.length ||
      bodyLines.some(
        (bodyLine, index) =>
          bodyLine.text.trim() !== contentLines[index].trim(),
      )
    ) {
      continue;
    }

    return (line, column) => {
      const bodyLine = bodyLines[line - 1];
      const contentLine = contentLines[line - 1];

      if (!bodyLine || contentLine === undefined) {
        return { line, column };
      }

      return {
        line: bodyLine.line + 1,
        column:
          column +
          bodyLine.column +
          leadingWhitespace(bodyLine.text) -
          leadingWhitespace(contentLine),
      };
    };
  }

  return identity;
}

function shouldProcess(sourcePath, options) {
  const filename = sourcePath ? toPosix(sourcePath.absolute) : '';

  if (SELF_PATTERN.test(filename)) {
    return false;
  }

  if (
    options.include.length > 0 &&
    !options.include.some((pattern) => matchesPattern(pattern, filename))
  ) {
    return false;
  }

  return !options.exclude.some((pattern) => matchesPattern(pattern, filename));
}

/**
 * @param {import('./template-transform').InspectMetadataOptions} [userOptions]
 */
function inspectMetadataTransform(userOptions) {
  const options = normalizeOptions(userOptions);

  function plugin(env) {
    const sourcePath = sourcePathFor(env, options);

    if (!options.enabled || !shouldProcess(sourcePath, options)) {
      return { name: PLUGIN_NAME, visitor: {} };
    }

    const builders = env.syntax.builders;
    const mapLocation = locationMapper(env, sourcePath);

    return {
      name: PLUGIN_NAME,
      visitor: {
        ElementNode(node) {
          const skipIndex = node.attributes.findIndex(
            (attr) => attr.name === SKIP_ATTRIBUTE,
          );

          if (skipIndex !== -1) {
            node.attributes.splice(skipIndex, 1);
            return;
          }

          const tag = node.tag;

          if (tag.startsWith(':') || options.skipTags.has(tag)) {
            return;
          }

          const info = {
            classes: staticClasses(node),
            filename: sourcePath?.absolute ?? null,
            kind: elementKind(tag),
            tag,
          };
          const component =
            options.componentName?.(info) ??
            defaultComponentName(info, options);
          const start = node.loc.startPosition ?? node.loc.start;
          const { line, column } = mapLocation(
            start?.line ?? 0,
            start?.column ?? 0,
          );
          const sourceReference = sourcePath
            ? `${sourcePath.relative}:${line}`
            : `${line}`;
          const authoredArguments = node.attributes
            .filter((attr) => attr.name.startsWith('@'))
            .map((attr) => locSource(attr) || attr.name);
          const values = {
            'data-inspect-component': component,
            'data-inspect-source': sourceReference,
            'data-inspect-invocation': encodeURIComponent(openingTag(node)),
            'data-inspect-arguments': encodeURIComponent(
              JSON.stringify(authoredArguments),
            ),
            'data-inspect-id': `${sourceReference}:${column}`,
          };
          // Explicitly authored attributes take precedence over generated ones.
          const stamped = ATTRIBUTE_NAMES.filter(
            (name) => !node.attributes.some((attr) => attr.name === name),
          ).map((name) => builders.attr(name, builders.text(values[name])));

          if (stamped.length === 0) {
            return;
          }

          // Insert before `...attributes` so metadata stamped on a component's
          // invocation overrides the metadata of that component's root element.
          const splatIndex = node.attributes.findIndex(
            (attr) => attr.name === '...attributes',
          );
          const insertAt =
            splatIndex === -1 ? node.attributes.length : splatIndex;

          node.attributes.splice(insertAt, 0, ...stamped);
        },
      },
    };
  }

  return plugin;
}

module.exports = inspectMetadataTransform;
module.exports.default = inspectMetadataTransform;
module.exports.inspectMetadataTransform = inspectMetadataTransform;
module.exports.ATTRIBUTE_NAMES = ATTRIBUTE_NAMES;
module.exports.PLUGIN_NAME = PLUGIN_NAME;
