import { PromptTemplate } from "langchain/prompts";

import { CacheEngine } from "./cache/CacheEngine";
import { LLMAnswer } from "./instructions/LLMAnswer";
import { Instruction } from "./instructions/Instruction";
import { Action, ActionFeedback } from "./instructions/Action";

import { PromptCache } from "./cache/PromptCache";
import { LLMProvider } from "./llm-providers/LLMProvider";
import { kebabCase } from "./helpers/string";

export type AgentOptions<TProvider extends LLMProvider> = {
  instructions?: Instruction[];
  verbose?: boolean;
  tries?: number;
  cacheEngine?: CacheEngine;
  llmProvider: TProvider;
};

export abstract class AbstractAgent<TProvider extends LLMProvider> {
  public step = 0;
  public actionsCount = 0;
  public actionsErrorCount = 0;

  protected localDebug: boolean;
  protected promptStep = -1;
  protected tries: number;

  protected instructions: Instruction[];

  protected verbose: boolean;
  protected llmProvider: TProvider;

  protected abstract template: PromptTemplate;

  protected abstract formatPrompt(...any: any[]): Promise<string>;

  protected abstract run(...args: unknown[]): Promise<unknown>;

  get cost() {
    return parseFloat(this.llmProvider.cost.toFixed(4));
  }

  get tokens() {
    return this.llmProvider.tokens;
  }

  get name() {
    return kebabCase(this.constructor.name);
  }

  protected get promptCache(): PromptCache {
    // @ts-ignore
    return this.llmProvider.promptCache;
  }

  constructor({
    instructions = [],
    verbose = true,
    tries = 1,
    llmProvider,
  }: AgentOptions<TProvider>) {
    this.instructions = instructions;
    this.verbose = verbose;
    this.tries = tries;
    this.llmProvider = llmProvider;
  }

  protected log(...chunks: string[]) {
    if (this.verbose) {
      console.log(...chunks.map((c) => `${this.constructor.name}: ${c}`));
    }
  }

  /**
   * todo: handle when there is no trailing "/"
   */
  protected extractInstructions({ answer }: { answer: string }): LLMAnswer[] {
    const answers: LLMAnswer[] = [];

    const lines = answer.split(/\r?\n/);
    let insideActionBlock = false;
    let insideParameterBlock = false;
    let currentAnswer: LLMAnswer | null = null;
    let currentParameterName: string | null = null;
    let currentParameterValue: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("<Action")) {
        insideActionBlock = true;
        currentAnswer = { name: "", parameters: {} };

        const nameMatch = trimmedLine.match(/name="([^"]+)"/);
        if (nameMatch) {
          currentAnswer.name = nameMatch[1];
        }

        const inlineParameters = trimmedLine.match(
          /parameter:([^=]+)="([^"]+)"/g
        );
        if (inlineParameters) {
          for (const inlineParameter of inlineParameters) {
            const [key, value] = inlineParameter
              .replace("parameter:", "")
              .split("=");
            currentAnswer.parameters[key.replace(/"/g, "")] = value.replace(
              /"/g,
              ""
            );
          }
        }

        if (trimmedLine.endsWith("/>")) {
          insideActionBlock = false;
          if (currentAnswer.name) {
            answers.push(currentAnswer);
          }
          currentAnswer = null;
        }
      } else if (trimmedLine.startsWith("</Action>")) {
        insideActionBlock = false;
        if (currentAnswer && currentAnswer.name) {
          answers.push(currentAnswer);
        }
        currentAnswer = null;
      } else if (insideActionBlock && trimmedLine.startsWith("<Parameter")) {
        insideParameterBlock = true;
        currentParameterValue = "";
        const nameMatch = trimmedLine.match(/name="([^"]+)"/);
        if (nameMatch) {
          currentParameterName = nameMatch[1];
        }
        const parameterMatch = trimmedLine.match(
          /<Parameter name="([^"]+)">(.*?)<\/Parameter>/
        );
        if (parameterMatch) {
          const [, paramName, paramValue] = parameterMatch;
          currentAnswer.parameters[paramName] = paramValue;
        }
      } else if (
        insideActionBlock &&
        insideParameterBlock &&
        trimmedLine.startsWith("</Parameter>")
      ) {
        insideParameterBlock = false;
        if (
          currentAnswer &&
          currentParameterName &&
          currentParameterValue !== null
        ) {
          currentAnswer.parameters[currentParameterName] =
            currentParameterValue.trim();
        }
        currentParameterName = null;
        currentParameterValue = null;
      } else if (insideParameterBlock) {
        if (currentParameterValue !== null) {
          currentParameterValue += currentParameterValue ? "\n" + line : line;
        }
      }
    }

    if (answers.length === 0) {
      throw new Error("Incorrect answer format. Cannot parse answers.");
    }

    for (const answer of answers) {
      if (
        !this.instructions.find(
          (instruction) => instruction.name === answer.name
        )
      ) {
        throw new Error(`Hallucinated instruction "${answer.name}"`);
      }
    }

    return answers;
  }

  protected async executeAction({
    answer,
  }: {
    answer: LLMAnswer;
  }): Promise<ActionFeedback> {
    const action = this.findAction({ answer });

    if (!action) {
      return {
        message: `Action "${answer.name}" not found`,
        type: "error",
      };
    }

    return action.execute(answer.parameters);
  }

  protected describeFeedback({
    answer,
    feedback,
  }: {
    answer: LLMAnswer;
    feedback: ActionFeedback;
  }): string {
    const action = this.findAction({ answer });

    if (!action) {
      return `Action "${answer.name}" not found`;
    }

    return action.describeFeedback({ feedback, parameters: answer.parameters });
  }

  protected findAction({ answer }: { answer: LLMAnswer }): Action | null {
    const action = this.instructions.find(
      (instruction) =>
        instruction.name === answer.name && instruction instanceof Action
    );

    if (!(action instanceof Action)) {
      return null;
    }

    return action;
  }

  protected describeInstructions(): string {
    return this.instructions
      .map((instruction) => instruction.describe)
      .join("\n\n");
  }

  protected describeFeedbackSteps({
    feedbackSteps,
  }: {
    feedbackSteps: string[][];
  }): string[] {
    let describedSteps = [];

    for (let i = 0; i < feedbackSteps.length; i++) {
      describedSteps.push(`<Step number="${i + 1}">
  ${feedbackSteps[i].join("\n  ")}
</Step>`);
    }

    return describedSteps;
  }

  /**
   * Render the answer format block
   *
   * @example
   * You can answer with the following actions:
   * # BEGIN ACTIONS LIST
   * <Action name="ActionName" usage="do something interesting" />
   * # END ACTIONS LIST
   * ONLY ANSWER ACTION AS THEY ARE DEFINED USING THIS XML-LIKE FORMAT OTHERWISE I CANNOT PARSE THEM
   */
  protected promptActionsBlock() {
    return `You can answer with the following actions:
${this.contentDelimiter({
  name: "ACTIONS LIST",
  content: this.describeInstructions(),
})}
ONLY ANSWER ACTION AS THEY ARE DEFINED OTHERWISE I CANNOT PARSE THEM`;
  }

  /**
   * Use this in your prompt to improve it's performances
   *
   * @see https://arxiv.org/pdf/2307.11760.pdf
   *
   * @returns "The task I'm asking you is vital to my career, and I greatly value your thorough analysis."
   */
  protected promptEnhancersBlock() {
    return "The task I'm asking you is vital to my career, and I greatly value your thorough analysis.";
  }

  /**
   * Use this to inject informations block into the prompt.
   * A delimiter will be added to improve llm performances and
   * reduce prompt injection risks.
   *
   * @example
   * this.contentDelimiter({ name: "INSTRUCTIONS", content: "Do this and that"})
   * // # BEGIN INSTRUCTIONS
   * // Do this and that
   * // # END INSTRUCTIONS
   */
  protected contentDelimiter({
    name,
    content,
  }: {
    name: string;
    content: string;
  }) {
    return `# BEGIN ${name}
${content}
# END ${name}`;
  }
}
