import { PromptTemplate } from "langchain/prompts";
import { Agent } from "../lib/Agent";
import { FileCache } from "../lib/cache/FileCache";

class JokeAgent extends Agent {
  private subject: string;

  protected template = new PromptTemplate({
    template: "Tell me a joke about {subject}",
    inputVariables: ["subject"],
  });

  constructor(subject: string) {
    super({ cacheEngine: new FileCache() });

    this.subject = subject;
  }

  async run(): Promise<any> {
    const prompt = await this.template.format({ subject: this.subject });

    const answer = await this.callModel({
      model: "gpt-3.5-turbo-16k",
      prompt,
    });

    console.log(answer);
  }
}

const agent = new JokeAgent("physics");

await agent.run();
