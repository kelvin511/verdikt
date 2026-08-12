export interface DraftADRInput {
  title: string;
  description: string;
  diff: string;
}

export interface DraftADRResult {
  content: string;
  /** The model actually used — surfaced so live-picked models are visible, not silent. */
  model: string;
}

export interface AIProvider {
  /** Human-readable name, used in CLI status messages. */
  name: string;
  draftADR(input: DraftADRInput): Promise<DraftADRResult>;
}
