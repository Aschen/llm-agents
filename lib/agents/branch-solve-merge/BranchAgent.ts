import { PromptTemplate } from "langchain/prompts";

import { AgentOneShot } from "../../AgentOneShot";
import { FileCache } from "../../cache/FileCache";
import { Instruction } from "../../instructions/Instruction";

export type CriteriaDefinition = {
  name: string;
  parameters: { definition: string };
};

class CriteriaInstruction extends Instruction {
  public usage =
    "describe one of the criteria to evaluate the answer. you can use this action multiple times to describe multiple criteria";

  public parameters = {
    criteria: "name of the criteria",
    definition: "definition of the criteria",
  };
}

export class BranchAgent extends AgentOneShot<CriteriaInstruction> {
  protected template = new PromptTemplate({
    template: `You are an expert in question and answer analysis.
You have a lot of experience in every field.

You will be given a question and you need to take an analytical approach to determine {criteriaCount} criteria
in order to verify quality of potential answers.

{existingCriteriaInstructions}

The question is the following:
# BEGIN QUESTION
{question}
# END QUESTION

Answer with the following actions:
{instructionsDescription}

{existingCriteriaInstructionsEmphasis}
`,
    inputVariables: [
      "question",
      "instructionsDescription",
      "criteriaCount",
      "existingCriteriaInstructionsEmphasis",
      "existingCriteriaInstructions",
    ],
  });

  private question: string;
  private criteriaCount: number;
  private criterias?: string[];

  constructor({
    question,
    criteriaCount = 2,
    criterias,
  }: {
    question: string;
    criteriaCount?: number;
    criterias?: string[];
  }) {
    super({
      instructions: [new CriteriaInstruction()],
      cacheEngine: new FileCache(),
    });

    this.question = question;
    this.criteriaCount = criteriaCount;
    this.criterias = criterias;
  }

  protected formatPrompt({
    instructionsDescription,
    feedbackSteps,
  }: {
    instructionsDescription: string;
    feedbackSteps?: string[] | undefined;
  }): Promise<string> {
    return this.template.format({
      question: this.question,

      criteriaCount:
        this.criterias && this.criterias?.length
          ? this.criterias.length
          : this.criteriaCount,

      existingCriteriaInstructions: this.criterias
        ? `Create a detailled description of those criteria regarding the question to evaluate: ${this.criterias.join(
            ", "
          )}`
        : "",

      existingCriteriaInstructionsEmphasis: this.criterias
        ? `ONLY ANSWER DESCRIPTION FOR THE ${
            this.criterias.length
          } CRITERIAS I GAVE TO YOU: ${this.criterias.join(", ")}`
        : "",

      instructionsDescription,
    });
  }
}
