import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-5";
const MAX_DIFF_CHARS = 12000;

export interface DraftADRInput {
  title: string;
  description: string;
  diff: string;
}

const SYSTEM_PROMPT = [
  "You draft Architectural Decision Records (ADRs) from merged pull requests.",
  "Write a concise, readable ADR body in Markdown with exactly these sections,",
  "in this order: ## Context, ## Decision, ## Consequences.",
  "Do not include a top-level title heading — the caller adds that separately.",
  "Base the ADR only on the PR title, description, and diff provided.",
].join(" ");

export async function draftADR(input: DraftADRInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Set it to use --ai, or omit --ai to generate a template ADR instead."
    );
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.VERDIKT_MODEL ?? DEFAULT_MODEL;
  const diff = input.diff.slice(0, MAX_DIFF_CHARS);

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `PR Title: ${input.title}`,
          "",
          "PR Description:",
          input.description.trim() || "(none provided)",
          "",
          "Diff (may be truncated):",
          diff || "(no diff available)",
        ].join("\n"),
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Claude did not return a text response for this ADR draft.");
  }
  return textBlock.text;
}
