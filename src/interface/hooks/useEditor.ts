import {useMonaco} from '@monaco-editor/react';
import {useEffect} from 'preact/hooks';
import {emit} from '@create-figma-plugin/utilities';
import schema from 'settings-schema.json';

import type {Settings} from 'types/settings';
import type {EventFocus} from 'types/events';
import type {PreviewEditorLib, PreviewEditorLinks} from 'types/preview';

export function useEditor(settings: Settings, links?: PreviewEditorLinks, libs?: PreviewEditorLib[]) {
  const monaco = useMonaco();

  // Setup linking to components
  useEffect(() => {
    return monaco?.languages.registerDefinitionProvider('typescript', {
      provideDefinition: (model, position) => {
        const link = links?.[model.getWordAtPosition(position).word];
        if (link) {
          emit<EventFocus>('FOCUS', link);
          return [];
        }
        return [];
      }
    }).dispose;
  }, [links]);
    
  // Setup JSON schema
  useEffect(() => {
    const json = monaco?.languages.json.jsonDefaults;
    json?.setDiagnosticsOptions({
      validate: true,
      schemas: [{
        schema,
        fileMatch: [monaco?.Uri.parse('Settings.json').toString()],
        uri: 'http://fig.run/settings-schema.json',
      }],
    });
  }, [monaco]);

  // Setup typescript user options + libraries
  useEffect(() => {
    const typescript = monaco?.languages.typescript.typescriptDefaults;
    typescript?.setCompilerOptions(settings.monaco.compiler);
    typescript?.setInlayHintsOptions(settings.monaco.inlayHints);
    typescript?.setDiagnosticsOptions(settings.monaco.diagnostics);
    if (libs) {
      typescript?.setExtraLibs(libs);
      libs.forEach((lib) => {
        monaco?.editor.createModel(lib.content, 'typescript', monaco.Uri.parse(lib.path))
      });
    }
  }, [monaco, settings, libs]);

  return monaco;
}
