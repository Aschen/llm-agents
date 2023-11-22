import { PromptTemplate } from 'langchain/prompts';

import { AgentFullText } from '../lib/AgentFullText';

class FakeAgent extends AgentFullText {
  template = new PromptTemplate({
    template: `You are a professional liar.

Just answer a liar when you are asked something.

The question:
{question}`,
    inputVariables: ['question'],
  });

  constructor(private question: string) {
    super();
  }

  protected formatPrompt(): Promise<string> {
    return this.template.format({
      question: this.question,
    });
  }
}

const agent = new FakeAgent('How can I get rich quickly?');

console.log(await agent.bombi());
