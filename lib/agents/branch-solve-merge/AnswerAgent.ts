import { PromptTemplate } from 'langchain/prompts';

import { AbstractAgent } from '../../AbstractAgent';

export class AnswerAgent extends AbstractAgent {
  protected template = new PromptTemplate({
    template: `You are an expert in question and answer analysis.
    
You will be given a question and you need to answer it as best as you can.

Here is the question:
{question}`,
    inputVariables: ['question'],
  });

  private question: string;
  constructor({ question }: { question: string }) {
    super();

    this.question = question;
  }

  public async run(): Promise<string> {
    const prompt = await this.template.format({ question: this.question });

    const answer = await this.callModel({
      model: 'gpt-4',
      prompt,
      temperature: 0.8,
    });

    return answer;
  }

  protected async formatPrompt({
    actions,
    feedbackSteps,
  }: {
    actions: string;
    feedbackSteps: string[];
  }) {
    return this.template.format({ question: this.question });
  }
}
