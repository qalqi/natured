import CodeBlockWriter from 'code-block-writer';
import {getColor, sortProps, getSlug, propsToString} from 'utils/figma';

import type {ParsedComponent, ParseState} from 'types/parse';
import type {Settings} from 'types/settings';

export function writeImports(
  writer: CodeBlockWriter,
  settings: Settings,
  primitives: Set<string>,
  libraries?: Set<string>,
  components?: string[],
) {
  // Import React explicitly if set 
  if (settings.output?.react?.addImport) {
    writer.write('import React from');
    writer.space();
    writer.quote('react');
    writer.write(';');
    writer.newLine();
  }

  // Import LinguiJS if set and Text primitive is used
  if (settings.output?.react?.addTranslate && primitives.has('Text')) {
    writer.write('import {t} from');
    writer.space();
    writer.quote('@lingui/macro');
    writer.write(';');
    writer.newLine();
  }

  // Import primitives
  writer.write(`import {StyleSheet, ${['View', ...primitives].join(', ')}} from`);
  writer.space();
  writer.quote('react-native');
  writer.write(';');
  writer.newLine();

  // Import libraries
  libraries?.forEach(library => {
    writer.write(`import {Svg, Path} from`);
    writer.space();
    writer.quote(library);
    writer.write(';');
    writer.newLine();
  });

  // Import subcomponents
  components?.forEach(component => {
    writer.write(`import {${component}} from`);
    writer.space();
    writer.quote(`./${component}`);
    writer.write(';');
    writer.newLine();
  });

  // Import theme file
  // TODO: do not include if no theme properties are used
  writer.write(`import theme from`);
  writer.space();
  writer.quote(`./theme`);
  writer.write(';');
  writer.newLine();
}

export function writeFunction(
  writer: CodeBlockWriter,
  settings: Settings,
  rootView: ParsedComponent,
  children: ParsedComponent[],
  styleid: string = 'styles',
) {
  const isVariant = !!rootView.node?.variantProperties;
  const masterNode = isVariant ? rootView.node?.parent : rootView.node;

  // Component props
  const propDefs = Object.entries(masterNode?.componentPropertyDefinitions);
  let propVariants: string[] = [];
  if (propDefs.length > 0) {
    writer.write(`export interface ${rootView.name}Props`).block(() => {
      propDefs.sort(sortProps).forEach(([key, prop]) => {
        const {type, variantOptions}: any = prop;
        const name = getSlug(key.split('#').shift());
        const typing = type === 'VARIANT'
          ? variantOptions.map((v: any) => `'${v}'`).join(' | ')
          : type === 'INSTANCE_SWAP'
            ? `JSX.Element`
            : type === 'TEXT'
              ? 'string'
              : type.toLowerCase();
        if (type === 'VARIANT')
          propVariants = variantOptions;
        writer.writeLine(`${name}: ${typing};`);
      });
    });
    writer.blankLine();
  }

  // Component documentation
  if (masterNode.description) {
    writer.writeLine(`/**`);
    masterNode.description.split('\n').forEach((line: string) => {
      writer.writeLine(` * ${line.trim()}`);
    });
    if (masterNode?.documentationLinks?.length > 0) {
      writer.writeLine(` * @link ${masterNode.documentationLinks[0].uri}`);
    }
    writer.writeLine(` */`);
  }

  // Component function body and children
  const attrProps = `${propDefs.length > 0 ? `props: ${rootView.name}Props` : ''}`;
  writer.write(`export function ${rootView.name}(${attrProps})`).block(() => {
    if (isVariant && propVariants.length > 0) {
      writeClasses(writer, rootView, propVariants);
    }
    
    writer.write(`return (`).indent(() => {
      writer.write(`<${rootView.tag} style={${styleid}.${rootView.slug}}>`).indent(() => {
        writeChildren(writer, settings, children, styleid);
      });
      writer.writeLine(`</${rootView.tag}>`);
    });
    writer.writeLine(');');
  });
}

export function writeChildren(
  writer: CodeBlockWriter,
  settings: Settings,
  children: ParsedComponent[],
  styleid: string = 'styles',
) {
  children.forEach((child) => {
    const isVariant = !!child.node.variantProperties;
    const masterNode = isVariant ? child.node.parent : child.node;
    const propRefs = masterNode?.componentPropertyReferences;
    // Conditional rendering
    if (propRefs?.visible) {
      const name = getSlug(propRefs?.visible.split('#').shift());
      writer.write(`{props.${name} &&`).space().indent(() => {
        writeChild(writer, settings, child, styleid);
      }).write('}').newLine();
    // Default rendering
    } else {
      writeChild(writer, settings, child, styleid);
    }
  });
}

export function writeChild(
  writer: CodeBlockWriter,
  settings: Settings,
  child: ParsedComponent,
  styleid: string = 'styles',
) {
  // Component instance swap
  if (child.swap) {
    writer.writeLine(`{props.${child.swap}}`);
    return;
  }

  // Create component tag
  const attrProps = propsToString(child.props);
  const attrRect = child.box ? ` width="${child.box.width}" height="${child.box.height}"` : '';
  const attrStyle = child.slug ? ` style={${styleid}.${child.slug}}` : '';
  const tagString = child.tag + attrStyle + attrRect + attrProps;

  // No children
  if (!child.value && !child.children && !child.paths) {
    writer.writeLine(`<${tagString}/>`);
    return;
  }

  // Child nodes
  writer.write(`<${tagString}>`).indent(() => {
    // Text child
    if (child.tag === 'Text') {
      if (child.value.startsWith('props.')) {
        writer.write(`{${child.value}}`);
      } else {
        if (settings.output?.react?.addTranslate) {
          writer.write('{t`' + child.value  + '`}');
        } else {
          writer.write('{`' + child.value + '`}');
        }
      }
    // SVG child paths
    } else if (child.paths) {
      child.paths.forEach((path: any, i: number) => {
        const fill = getColor(child.fills[i]?.color);
        writer.write(`<Path d="${path.data}" fill="${fill}"/>`)
      });
    // View children (recurse)
    } else if (child.tag === 'View') {
      writeChildren(writer, settings, child.children);
    }
  });

  // Closing tag
  writer.writeLine(`</${child.tag}>`);
}

export function writeStyleSheet(
  writer: CodeBlockWriter,
  rootView: ParsedComponent,
  stylesheet: ParseState['stylesheet'],
  styleid: string = 'styles',
) {
  writer.write(`const ${styleid} = StyleSheet.create(`).inlineBlock(() => {
    writeStyle(writer, rootView, rootView.styles);
    Object.keys(stylesheet).forEach(slug => {
      const {component, styles} = stylesheet[slug];
      writeStyle(writer, component, styles);
    });
  });
  writer.write(');');
}

export function writeStyle(
  writer: CodeBlockWriter,
  node: ParsedComponent,
  styles: any,
) {
  const props = Object.keys(styles).filter(c => styles[c] !== undefined);
  if (props.length > 0) {
    writer.write(`${node.slug}: {`).indent(() => {
      props.forEach(prop => {
        const value = styles[prop];
        writer.write(`${prop}: `);
        if (typeof value === 'number') {
          writer.write(value.toString());
        } else if (value.startsWith('theme.')) {
          writer.write(value);
        } else {
          writer.quote(value);
        }
        writer.write(',');
        writer.newLine();
      });
    });
    writer.writeLine('},');
  }
}

export function writeClasses(
  writer: CodeBlockWriter,
  rootView: ParsedComponent,
  propVariants: string[],
) {
  /*
  getObjectDiff(rootView.styles, propVariants.map(variant => rootView.styles[variant]));
  writer.write(`const classes = `).inlineBlock(() => {
    const stylesWithDifferences = ['root', 'test'];
    stylesWithDifferences.forEach(styleName => {
      writer.write(`${styleName}: [`).indent(() => {
        writer.writeLine(`styles.${styleName},`);
        propVariants.forEach((variant, i) => {
          writer.writeLine(`props.state === '${variant}' && styles.${styleName}${variant},`);
        });
      });
      writer.writeLine('],');
    });
  });
  writer.write(';');
  writer.blankLine();
  */
}

export function writeInteractionStyle(
  writer: CodeBlockWriter,
  rootView: ParsedComponent,
  styleid: string = 'styles',
) {
  /*
    ({hovered, pressed, focused}) => [
      styles.example,
      hovered && styles.exampleHover,
      pressed && styles.examplePressed,
      focused && styles.exampleFocused,
    ],
  */
  const hasHover = true;
  const hasPressed = true;
  const hasFocused = true;
  const actions = [
    hasHover && 'hovered',
    hasPressed && 'pressed',
    hasFocused && 'focused',
  ].filter(Boolean).join(', ');

  writer.write(`({${actions}}) = [`).inlineBlock(() => {
    const rules = Object
      .keys(rootView.styles)
      .filter(c => rootView.styles[c] !== undefined);
    if (rules.length > 0) {
      rules.forEach(rule => {
        writer.writeLine(`${styleid}.${rule},`);
        hasHover && writer.write(`${styleid}.${rule}Hover,`);
        hasPressed && writer.write(`${styleid}.${rule}Pressed,`);
        hasFocused && writer.write(`${styleid}.${rule}Focused,`);
      });
    }
  });

  writer.write('],');
  writer.newLine();
}