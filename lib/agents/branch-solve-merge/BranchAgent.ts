import { PromptTemplate } from 'langchain/prompts';

import { LLMAgentOneShot } from '../../LLMAgentOneShot';
import { describeMultilineAction } from '../../actions/LLMAction';
import { FileCache } from '../../cache/FileCache';

export type CriteriaDefinition = {
  name: string;
  parameters: { definition: string };
};

export class BranchAgent extends LLMAgentOneShot<'criteria' | 'definition'> {
  protected template = new PromptTemplate({
    template: `You are an expert in question and answer analysis. 
You have a lot of experience in every field.

You will be given a question and you need to take an analytical approach to determine {criteriaCount} criteria 
in order to verify quality of potential answers.

{existingCriteriaInstructions}{criterias}

The question is the following:
# BEGIN QUESTION
{question}
# END QUESTION

Answer as following:
{format}
`,
    inputVariables: [
      'question',
      'format',
      'criteriaCount',
      'criterias',
      'existingCriteriaInstructions',
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
    super({ cacheEngine: new FileCache() });

    this.question = question;
    this.criteriaCount = criteriaCount;
    this.criterias = criterias;
  }

  protected formatPrompt({
    actions,
    feedbackSteps,
  }: {
    actions: string;
    feedbackSteps?: string[] | undefined;
  }): Promise<string> {
    return this.template.format({
      question: this.question,
      criteriaCount: this.criterias
        ? this.criterias.length
        : this.criteriaCount,

      existingCriteriaInstructions: this.criterias
        ? 'Create a detailled description of those criteria regarding the question to evaluate: '
        : '',

      criterias: this.criterias
        ? Array.from(this.criterias.keys()).join(',')
        : '',

      format: describeMultilineAction({
        name: 'criteria',
        usage:
          'describe one of the criteria to evaluate the answer. you can use this action multiple times to describe multiple criteria',
        parameters: [
          {
            name: 'criteria',
            usage: 'Name of the criteria',
          },
          {
            name: 'definition',
            usage: 'Definition of the criteria',
          },
        ],
      }),
    });
  }
}
