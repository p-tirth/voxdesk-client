import { useEffect } from 'react';

import type { PipecatBaseChildProps } from '@pipecat-ai/voice-ui-kit';
import {
  ConnectButton,
  ConversationPanel,
  EventsPanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UserAudioControl,
} from '@pipecat-ai/voice-ui-kit';
import { usePipecatClientTransportState } from '@pipecat-ai/client-react';

import type {
  ModelLayer,
  ModelSelection,
  ModelsResponse,
  TransportType,
} from '../../config';
import { ModelSelect } from './ModelSelect';
import { MetricsDashboard } from './MetricsDashboard';
import { TransportSelect } from './TransportSelect';

interface AppProps extends PipecatBaseChildProps {
  transportType: TransportType;
  onTransportChange: (type: TransportType) => void;
  availableTransports: TransportType[];
  models: ModelsResponse | null;
  selection: ModelSelection | null;
  onSelectionChange: (layer: ModelLayer, modelId: string) => void;
}

/** Connection states in which the model selection is still editable. */
const EDITABLE_STATES = ['disconnected', 'initializing', 'initialized', 'error'];

export const App = ({
  client,
  handleConnect,
  handleDisconnect,
  transportType,
  onTransportChange,
  availableTransports,
  models,
  selection,
  onSelectionChange,
}: AppProps) => {
  useEffect(() => {
    client?.initDevices();
  }, [client]);

  const transportState = usePipecatClientTransportState();
  const connected = !EDITABLE_STATES.includes(transportState);
  const showTransportSelector = availableTransports.length > 1;

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {showTransportSelector && (
            <TransportSelect
              transportType={transportType}
              onTransportChange={onTransportChange}
              availableTransports={availableTransports}
            />
          )}
          {models && selection && (
            <ModelSelect
              models={models}
              selection={selection}
              onChange={onSelectionChange}
              disabled={connected}
            />
          )}
        </div>
        <div className="flex items-center gap-4">
          <UserAudioControl size="lg" />
          <ConnectButton
            size="lg"
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <Tabs defaultValue="conversation" className="flex h-full flex-col">
          <TabsList>
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <TabsContent
            value="conversation"
            className="min-h-0 flex-1 overflow-hidden">
            {/* noMetrics: our dedicated Metrics tab replaces the panel's own
                built-in metrics sub-tab, so they don't duplicate. */}
            <ConversationPanel noMetrics />
          </TabsContent>
          <TabsContent
            value="metrics"
            className="min-h-0 flex-1 overflow-hidden">
            {models && selection ? (
              <MetricsDashboard models={models} selection={selection} />
            ) : null}
          </TabsContent>
          <TabsContent
            value="events"
            className="min-h-0 flex-1 overflow-hidden">
            <EventsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
