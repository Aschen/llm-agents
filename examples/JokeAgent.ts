import { AgentOneShot, Instruction, PromptTemplate } from '../index';

export class TellJokeInstruction extends Instruction {
  public usage = 'tell a joke';

  public parameters = {
    joke: 'the joke',
  };
}

export class JokeAgent extends AgentOneShot<TellJokeInstruction> {
  protected template = new PromptTemplate({
    template: `Tell me a good joke about {subject}

{promptActionsBlock}
`,
    inputVariables: ['subject', 'promptActionsBlock'],
  });

  constructor() {
    super({ instructions: [new TellJokeInstruction()] });
  }

  protected formatPrompt(): Promise<string> {
    return this.template.format({
      subject: 'french people always protesting',
      promptActionsBlock: this.promptActionsBlock(),
    });
  }
}

const agent = new JokeAgent();

const results = await agent.run();

// returns the first TellJokeInstruction or null
const joke = TellJokeInstruction.find(results);

console.log(joke?.parameters.joke);
