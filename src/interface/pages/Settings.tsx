import MonacoReact from '@monaco-editor/react';

import {h} from 'preact';
import {useMemo} from 'preact/hooks';
import {LoadingIndicator} from '@create-figma-plugin/ui';
import {debounce} from 'common/delay';

import type {Settings} from 'types/settings';
import type {ConfigData} from 'interface/hooks/useConfig';

interface SettingsProps {
  settings: ConfigData;
  options: Settings['monaco']['general'];
  monaco: any;
}

export function Settings(props: SettingsProps) {
  const update = useMemo(() =>
    debounce(props.settings.update, 750), [props.settings.update]);
  return (
    <MonacoReact
      language="json"
      path="Settings.json"
      value={props.settings.raw}
      theme={props.options.theme}
      options={{...props.options, readOnly: false}}
      loading={<LoadingIndicator/> as JSX.Element}
      onChange={value => update(value)}
      onValidate={markers => {
        if (markers.length === 0) {
          const uri = props.monaco.Uri.parse('Settings.json');
          const model = props.monaco.editor.getModel(uri);
          props.settings.update(model.getValue(), true);
          props.settings.locked.current = false;
        } else {
          props.settings.locked.current = true;
        }
      }}
    />
  );
}
