import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGuide,
} from '@pipecat-ai/voice-ui-kit';

import {
  LAYER_LABELS,
  MODEL_LAYERS,
  type ModelLayer,
  type ModelSelection,
  type ModelsResponse,
} from '../../config';

interface ModelSelectProps {
  models: ModelsResponse;
  selection: ModelSelection;
  onChange: (layer: ModelLayer, modelId: string) => void;
  /** Disabled once connected — selection is applied at connect time. */
  disabled?: boolean;
}

/**
 * Per-layer model pickers (STT / LLM / TTS). The options come from the bot,
 * already filtered to models whose API key is configured, so every choice
 * here is guaranteed to connect.
 */
export const ModelSelect = ({
  models,
  selection,
  onChange,
  disabled,
}: ModelSelectProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {MODEL_LAYERS.map((layer: ModelLayer) => {
        const options = models[layer];
        return (
          <Select
            key={layer}
            value={selection[layer]}
            onValueChange={(value) => onChange(layer, value)}
            disabled={disabled || options.length <= 1}>
            <SelectTrigger size="sm">
              <SelectGuide>{LAYER_LABELS[layer]}</SelectGuide>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
};
