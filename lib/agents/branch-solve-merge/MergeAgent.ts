import { PromptTemplate } from 'langchain/prompts';

import { LLMAgentOneShot } from '../../LLMAgentOneShot';
import { describeMultilineAction } from '../../actions/LLMAction';
import { FileCache } from '../../cache/FileCache';

export class MergeAgent extends LLMAgentOneShot<'analysis' | 'note'> {
  protected template = new PromptTemplate({
    template: `You are an expert in question and answer analysis. 
You have a lot of experience in every field.

Other experts have examinated the pertinence of answers regarding a particular question.



Answer as following:
{format}
`,
    inputVariables: ['question', 'criteria', 'answer', 'format'],
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
    super({ cacheEngine: new FileCache() });

    this.question = question;
    this.criteria = criteria;
    this.answer = answer;
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
      criteria: this.criteria,
      answer: this.answer,
      format: describeMultilineAction({
        name: 'analysis',
        usage: 'analysis of the answer to the question based on the criteria',
        parameters: [
          {
            name: 'analysis',
            usage: 'content of the analysis',
          },
          {
            name: 'note',
            usage: 'note on 10 of the answer based on the criteria',
          },
        ],
      }),
    });
  }
}
