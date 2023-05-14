import {generateStory} from 'modules/gen/react-native/story';
import {generatePreview} from 'modules/gen/react-native/preview';
import {generateComponent} from 'modules/gen/react-native/component';
import {getName, propsToString} from 'modules/fig/utils';
import {parseStyles} from 'modules/fig/styles';
import {parseNodes} from 'modules/fig/nodes';

import type {EditorComponent, EditorLinks} from 'types/editor';
import type {ParsedComponent} from 'types/parse';
import type {TargetNode} from 'types/figma';
import type {Settings} from 'types/settings';

export function generateBundle(component: TargetNode, settings: Settings, noPreview?: boolean): EditorComponent {
  if (!component) {
    return {name: '', props: '',  code: '', story: '', preview: '', links: {}};
  }

  const isVariant = !!component.variantProperties;
  const masterNode = isVariant ? component?.parent : component;
  const selectedVariant = isVariant
    ? masterNode.children.filter((n: any) => figma.currentPage.selection.includes(n)).pop()
    : undefined;

  const children = parseNodes([...component.children]);
  const propDefs = masterNode?.componentPropertyDefinitions;
  if (selectedVariant) {
    Object.entries(selectedVariant?.variantProperties).forEach((v: any) => {
      propDefs[v[0]].defaultValue = v[1];
    });
  }

  const props = propsToString({...propDefs});
  const links: EditorLinks = {};
  const root: ParsedComponent = {
    id: component.id,
    tag: 'View',
    slug: 'root',
    node: component,
    name: getName(masterNode.name),
    styles: parseStyles(component, true),
  };

  Object.entries(children.state.components).forEach((c: any) => {
    links[getName(c[1].name)] = c[0];
  });

  return {
    props,
    links,
    name: root.name,
    code: generateComponent(root, children, settings),
    story: generateStory(root, settings),
    preview: !noPreview ? generatePreview(root, children, settings) : '',
  };
}