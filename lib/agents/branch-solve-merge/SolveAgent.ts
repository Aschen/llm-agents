import { PromptTemplate } from "langchain/prompts";

import { AgentOneShot } from "../../AgentOneShot";
import { Instruction } from "../../instructions/Instruction";
import { FileCache } from "../../cache/FileCache";

class AnalysisInstruction extends Instruction {
  public usage = "analysis of the answer to the question based on the criteria";

  public parameters = {
    analysis: "content of the analysis",
    note: "note on 10 of the answer based on the criteria",
  };
}

export class SolveAgent extends AgentOneShot<AnalysisInstruction> {
  protected template = new PromptTemplate({
    template: `You are an expert in question and answer analysis.
You have a lot of experience in every field.

A question was asked to you:
# BEGIN QUESTION
{question}
# END QUESTION


You need to evaluate the pertinence of an answer based on the following criteria:
# BEGIN CRITERIA
{criteria}
# END CRITERIA

This criteria is used to evaluate the answer.

The answer is:
# BEGIN ANSWER
{answer}
# END ANSWER

Write an extensive analysis on the answer to the question based on the criteria.
Also give a note on 10 to the answer based on the criteria.

Answer with the following actions:
{instructionsDescription}
`,
    inputVariables: [
      "question",
      "criteria",
      "answer",
      "instructionsDescription",
    ],
  });

  private question: string;
  private criteria: string;
  private answer: string;

  constructor({
    question,
    criteria,
    answer,
  }: {
    question: string;
    criteria: string;
    answer: string;
  }) {
    super({
      instructions: [new AnalysisInstruction()],
      cacheEngine: new FileCache(),
    });

    this.question = question;
    this.criteria = criteria;
    this.answer = answer;
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
      criteria: this.criteria,
      answer: this.answer,
      instructionsDescription,
    });
  }
}
