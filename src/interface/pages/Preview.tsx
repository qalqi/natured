import {emit} from '@create-figma-plugin/utilities';
import {h, Fragment} from 'preact';
import {useState, useCallback, useEffect, useRef} from 'preact/hooks';
import {init, preview} from 'interface/utils/preview';
import {Watermark} from 'interface/base/Watermark';

import type {PreviewComponent} from 'types/preview';
import type {EventFocus} from 'types/events';
import type {Settings} from 'types/settings';

interface PreviewProps {
  component: PreviewComponent,
  settings: Settings;
}

export function Preview(props: PreviewProps) {
  const {component, settings} = props;
  const [src, setSrc] = useState('');

  const iframe = useRef<HTMLIFrameElement>(null);

  const update = useCallback((preview: string) => {
    iframe.current?.contentWindow?.postMessage({type: 'preview', preview, name: component?.name});
  }, [iframe, component]);

  const inspect = useCallback((enabled: boolean) => {
    iframe.current?.contentWindow?.postMessage({type: 'inspect', enabled});
  }, [iframe]);

  const load = useCallback(() => {
    init(settings).then(setSrc);
  }, [settings]);

  const render = useCallback(() => {
    if (!component || !component.preview) return;
    const tag = '<' + component.name + component.props + '/>';
    preview(component.preview, component.name, tag, settings).then(update);
    console.debug('[preview]', tag, component.preview);
  }, [component, settings]);

  // Initialize the loader
  useEffect(load, [settings]);

  // Update the preview when the component or settings change
  useEffect(render, [component, settings]);

  // Handle focus events from inspect mode
  useEffect(() => {
    const onFocus = (e) => {
      if (e.data?.type === 'focus' && e.data.id) {
        emit<EventFocus>('FOCUS', e.data.id);
      }
    };
    addEventListener('message', onFocus);
    return () => removeEventListener('message', onFocus);
  }, []);

  // Enable inspect mode when the user holds down the control/meta key
  useEffect(() => {
    if (!src) return;

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        inspect(true);
      }
    };
    const onKeyup = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        inspect(false);
      }
    };

    addEventListener('keydown', onKeydown);
    addEventListener('keyup', onKeyup);
    return () => {
      removeEventListener('keydown', onKeydown);
      removeEventListener('keyup', onKeyup);
    };
  }, [src]);

  return (
    <Fragment>
      {!component?.preview &&
        <Watermark/>
      }
      <iframe
        ref={iframe}
        srcDoc={src}
        onLoad={render}
        style={{
          opacity: src ? 1 : 0,
          transition: 'opacity .5s',
        }}
      />
    </Fragment>
  );
}
