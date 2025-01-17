import {createIdentifierCamel, createIdentifierPascal} from 'common/string';

import type {ParseAssetData} from 'types/parse';

const IMAGE_BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

export async function convertAssets(nodes: Set<string>, isPreview: boolean): Promise<{assets: ParseAssetData, hasImage: boolean}> {
  const assets: ParseAssetData = {};
  const vectorTypes: NodeType[] = ['VECTOR', 'LINE', 'ELLIPSE', 'POLYGON', 'STAR'];
  const images: Record<string, number> = {};
  const vectors: Record<string, number> = {};
  let hasImage = false;
  try {
    for await (const id of nodes) {
      let data: string;
      let count: number;
      let bytes: Uint8Array | null;
      const node = figma.getNodeById(id) as SceneNode & ExportMixin & ChildrenMixin;
      const {width, height} = node;
      const isVector = vectorTypes.includes(node.type)
        || (node.findAllWithCriteria && node.findAllWithCriteria({types: vectorTypes})?.length > 0);
      if (isVector) {
        if (isPreview) {
          data = await node.exportAsync({format: 'SVG_STRING'});
          data = data
            .replace(/fill=\"none\"/, `fill="currentColor"`)
            .replace(/fill="#[0-9A-Fa-f]+"/g, 'fill="currentColor"');
        } else {
          bytes = await node.exportAsync({format: 'SVG'});
          data = '';
        }
        vectors[node.name] = 1 + (vectors[node.name] || 0);
        count = vectors[node.name];
      } else {
        let arr: Uint8Array;
        try {arr = await node.exportAsync({format: 'PNG', constraint: {type: 'SCALE', value: 2}});} catch (err) {}
        if (isPreview) {
          data = arr ? `data:image/png;base64,${figma.base64Encode(arr)}` : IMAGE_BLANK_PIXEL;
        } else {
          bytes = arr || null;
          data = '';
        }
        images[node.name] = 1 + (images[node.name] || 0);
        count = images[node.name];
        hasImage = true;
      }
      const nameBase = isVector
        ? createIdentifierPascal(node.name)
        : createIdentifierCamel(node.name);
      const name = count > 1 ? `${nameBase}${count}` : nameBase;
      assets[id] = {width, height, name, data, bytes, isVector};
    }
  } catch (err) {
    console.error('Failed to convert assets', err);
  }
  return {assets, hasImage};
}
