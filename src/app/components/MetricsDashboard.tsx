import { useCallback, useMemo, useRef, useState } from 'react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@pipecat-ai/voice-ui-kit';
import { RTVIEvent, type PipecatMetricsData } from '@pipecat-ai/client-js';
import { useRTVIClientEvent } from '@pipecat-ai/client-react';

import {
  LAYER_LABELS,
  MODEL_LAYERS,
  type ModelLayer,
  type ModelSelection,
  type ModelsResponse,
} from '../../config';

/** PRD target: p95 end-to-end turn latency under ~1.2s on the demo stack. */
const TARGET_MS = 1200;

/** Per-layer accent colors for the waterfall + cards. */
const LAYER_COLOR: Record<ModelLayer, string> = {
  stt: '#34d399', // emerald
  llm: '#38bdf8', // sky
  tts: '#fbbf24', // amber
};

type LayerTimings = Partial<Record<ModelLayer, number>>; // ms per layer

interface Turn extends LayerTimings {
  index: number;
  total: number; // sum of the present layers, ms
}

/** Map a Pipecat processor name (e.g. "GoogleLLMService#0") to a layer. */
const layerForProcessor = (processor: string): ModelLayer | null => {
  if (/STTService/i.test(processor)) return 'stt';
  if (/LLMService/i.test(processor)) return 'llm';
  if (/TTSService/i.test(processor)) return 'tts';
  return null;
};

const percentile = (sortedMs: number[], p: number): number => {
  if (sortedMs.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedMs.length) - 1;
  return sortedMs[Math.min(Math.max(rank, 0), sortedMs.length - 1)];
};

interface MetricsDashboardProps {
  selection: ModelSelection;
  models: ModelsResponse;
}

/**
 * Live latency dashboard. Listens to RTVI metrics (TTFB per pipeline stage),
 * groups them into turns, and shows: the latest turn as an STT→LLM→TTS
 * waterfall vs the 1.2s target, plus rolling avg/p50/p95 per layer — each
 * labeled with the model actually running for that layer this session.
 */
export const MetricsDashboard = ({
  selection,
  models,
}: MetricsDashboardProps) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const currentTurn = useRef<LayerTimings>({});
  const turnCount = useRef(0);

  const finalizeTurn = useCallback(() => {
    const acc = currentTurn.current;
    const present = MODEL_LAYERS.filter((l) => acc[l] !== undefined);
    if (present.length === 0) return;
    const total = present.reduce((sum, l) => sum + (acc[l] ?? 0), 0);
    turnCount.current += 1;
    const turn: Turn = { ...acc, index: turnCount.current, total };
    currentTurn.current = {};
    setTurns((prev) => [...prev.slice(-49), turn]);
  }, []);

  useRTVIClientEvent(
    RTVIEvent.Metrics,
    useCallback((data: PipecatMetricsData) => {
      for (const { processor, value } of data.ttfb ?? []) {
        const layer = layerForProcessor(processor);
        if (!layer) continue;
        const ms = Math.round(value * 1000); // Pipecat reports TTFB in seconds
        currentTurn.current[layer] = (currentTurn.current[layer] ?? 0) + ms;
      }
    }, [])
  );

  // A turn ends when the bot finishes speaking; also finalize when the next
  // user turn starts, in case a stop event is missed.
  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, finalizeTurn);
  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, finalizeTurn);

  const labelFor = useCallback(
    (layer: ModelLayer): string => {
      const id = selection[layer];
      return models[layer].find((m) => m.id === id)?.label ?? id;
    },
    [selection, models]
  );

  const latest = turns[turns.length - 1];

  const stats = useMemo(() => {
    return Object.fromEntries(
      MODEL_LAYERS.map((layer) => {
        const values = turns
          .map((t) => t[layer])
          .filter((v): v is number => v !== undefined);
        const sorted = [...values].sort((a, b) => a - b);
        const avg = values.length
          ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
          : 0;
        return [
          layer,
          {
            latest: values[values.length - 1] ?? 0,
            avg,
            p50: percentile(sorted, 50),
            p95: percentile(sorted, 95),
            count: values.length,
          },
        ];
      })
    ) as Record<
      ModelLayer,
      { latest: number; avg: number; p50: number; p95: number; count: number }
    >;
  }, [turns]);

  if (!latest) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        <div>
          <p className="font-medium">No turns measured yet.</p>
          <p className="mt-1 opacity-70">
            Connect and speak — per-layer latency will appear here after the
            first exchange.
          </p>
        </div>
      </div>
    );
  }

  const scaleMax = Math.max(latest.total, TARGET_MS) * 1.15;
  const targetLeft = `${(TARGET_MS / scaleMax) * 100}%`;
  const overTarget = latest.total > TARGET_MS;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-2">
      {/* Latest-turn waterfall */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Latest turn — response latency</span>
            <span
              className="font-mono text-sm"
              style={{ color: overTarget ? '#f87171' : '#34d399' }}>
              {latest.total.toLocaleString()} ms{' '}
              {overTarget ? 'OVER' : 'OK'} (target ≤ {TARGET_MS} ms)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-8 w-full overflow-hidden rounded bg-black/30">
            <div className="flex h-full">
              {MODEL_LAYERS.map((layer) => {
                const ms = latest[layer];
                if (!ms) return null;
                return (
                  <div
                    key={layer}
                    className="flex h-full items-center justify-center overflow-hidden text-[10px] font-medium text-black/80"
                    style={{
                      width: `${(ms / scaleMax) * 100}%`,
                      backgroundColor: LAYER_COLOR[layer],
                    }}
                    title={`${LAYER_LABELS[layer]}: ${ms} ms`}>
                    {ms >= 180 ? `${ms}ms` : ''}
                  </div>
                );
              })}
            </div>
            {/* Target marker */}
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-white/70"
              style={{ left: targetLeft }}
              title={`Target ${TARGET_MS} ms`}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {MODEL_LAYERS.map((layer) => (
              <div key={layer} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: LAYER_COLOR[layer] }}
                />
                <span className="opacity-70">{LAYER_LABELS[layer]}</span>
                <span className="font-mono">{labelFor(layer)}</span>
                <span className="font-mono opacity-90">
                  {latest[layer] ? `${latest[layer]} ms` : '—'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-layer rolling stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {MODEL_LAYERS.map((layer) => {
          const s = stats[layer];
          return (
            <Card key={layer}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: LAYER_COLOR[layer] }}
                  />
                  {LAYER_LABELS[layer]}
                </CardTitle>
                <p className="font-mono text-xs opacity-70">
                  {labelFor(layer)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-2xl">
                  {s.latest ? `${s.latest}` : '—'}
                  <span className="ml-1 text-xs opacity-60">ms TTFB</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs opacity-80">
                  <div>
                    <div className="opacity-60">avg</div>
                    {s.avg} ms
                  </div>
                  <div>
                    <div className="opacity-60">p50</div>
                    {s.p50} ms
                  </div>
                  <div>
                    <div className="opacity-60">p95</div>
                    {s.p95} ms
                  </div>
                </div>
                <div className="mt-2 text-[10px] opacity-50">
                  {s.count} turn{s.count === 1 ? '' : 's'}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* End-to-end trend across recent turns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            End-to-end per turn (STT + LLM + TTS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-end gap-1">
            {turns.slice(-24).map((t) => {
              const over = t.total > TARGET_MS;
              const trendMax = Math.max(
                TARGET_MS,
                ...turns.slice(-24).map((x) => x.total)
              );
              return (
                <div
                  key={t.index}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${(t.total / trendMax) * 100}%`,
                    backgroundColor: over ? '#f87171' : '#34d399',
                  }}
                  title={`Turn ${t.index}: ${t.total} ms`}
                />
              );
            })}
          </div>
          <div className="mt-1 text-[10px] opacity-50">
            Last {Math.min(turns.length, 24)} turns · dashed target ={' '}
            {TARGET_MS} ms
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
