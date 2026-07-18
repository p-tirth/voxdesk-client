'use client';

import { useCallback, useEffect, useState } from 'react';

import { ThemeProvider } from '@pipecat-ai/voice-ui-kit';

import type { PipecatBaseChildProps } from '@pipecat-ai/voice-ui-kit';
import {
  ErrorCard,
  FullScreenContainer,
  PipecatAppBase,
  SpinLoader,
} from '@pipecat-ai/voice-ui-kit';

import { App } from './components/App';
import {
  AVAILABLE_TRANSPORTS,
  DEFAULT_TRANSPORT,
  TRANSPORT_PROPS,
  buildConnectParams,
} from '../config';
import type {
  ModelLayer,
  ModelSelection,
  ModelsResponse,
  TransportType,
} from '../config';

export default function Home() {
  const [transportType, setTransportType] =
    useState<TransportType>(DEFAULT_TRANSPORT);

  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [selection, setSelection] = useState<ModelSelection | null>(null);

  // Load the configured models (per layer) and seed the selection with the
  // server's defaults. Only models with a key present are returned.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/models')
      .then((res) => res.json())
      .then((data: ModelsResponse & { error?: string }) => {
        if (cancelled || data.error) return;
        setModels(data);
        setSelection(data.defaults);
      })
      .catch(() => {
        /* leave models null — dropdowns hidden, connect still uses .env defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSelectionChange = useCallback((layer: ModelLayer, modelId: string) => {
    setSelection((prev) => (prev ? { ...prev, [layer]: modelId } : prev));
  }, []);

  // WebRTC connects in one step via connectParams; fold the current model
  // selection into it so the bot receives it in runner_args.body. Fall back to
  // the scaffold's static params until the selection has loaded.
  const transportProps =
    transportType === 'smallwebrtc' && selection
      ? { connectParams: buildConnectParams(selection) }
      : TRANSPORT_PROPS[transportType];

  return (
    <ThemeProvider defaultTheme="terminal" disableStorage>
      <FullScreenContainer>
        <PipecatAppBase
          {...transportProps}
          transportType={transportType}>
          {({
            client,
            handleConnect,
            handleDisconnect,
            error,
          }: PipecatBaseChildProps) =>
            !client ? (
              <SpinLoader />
            ) : error ? (
              <ErrorCard>{error}</ErrorCard>
            ) : (
              <App
                client={client}
                handleConnect={handleConnect}
                handleDisconnect={handleDisconnect}
                transportType={transportType}
                onTransportChange={setTransportType}
                availableTransports={AVAILABLE_TRANSPORTS}
                models={models}
                selection={selection}
                onSelectionChange={onSelectionChange}
              />
            )
          }
        </PipecatAppBase>
      </FullScreenContainer>
    </ThemeProvider>
  );
}
