export interface DraftADRInput {
  title: string;
  description: string;
  diff: string;
}

export interface AIProvider {
  /** Human-readable name, used in CLI status messages. */
  name: string;
  draftADR(input: DraftADRInput): Promise<string>;
}
