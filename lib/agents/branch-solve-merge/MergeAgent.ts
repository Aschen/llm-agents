import { PromptTemplate } from 'langchain/prompts';

import { AgentOneShot } from '../../AgentOneShot';
import { Instruction } from '../../instructions/Instruction';
import { FileCache } from '../../cache/FileCache';
import { AnswersAnalyses } from './BSMExecutor';

export class MergedAnswerInstruction extends Instruction {
  public name = 'mergedAnswer';

  public usage =
    'use the analyses and the answer content to create a new answer to the question';

  public parameters = {
    answer: 'content of the answer',
  };
}

export class BestAnswerInstruction extends Instruction {
  public name = 'bestAnswer';

  public format = 'multiline' as const;

  public usage = 'best answer number based on the analysis';

  public parameters = {
    index: 'number of the answer',
  };
}

export class MergeAgent extends AgentOneShot<
  MergedAnswerInstruction | BestAnswerInstruction
> {
  protected template = new PromptTemplate({
    template: `You are an expert in question and answer analysis. 
You have a lot of experience in every field.

A question was asked to you:
# BEGIN QUESTION
{question}
# END QUESTION

Other experts have examinated the pertinence of answers regarding a particular question.
You need to merge their analysis into a single analysis.

# BEGIN ANALYSIS
{analyses}
# END ANALYSIS

Answer with the following actions:
{instructionsDescription}
`,
    inputVariables: ['question', 'analyses', 'instructionsDescription'],
  });

  private question: string;
  private answersAnalyses: AnswersAnalyses;

  constructor({
    question,
    answersAnalyses,
  }: {
    question: string;
    answersAnalyses: AnswersAnalyses;
  }) {
    super({
      instructions: [
        new BestAnswerInstruction(),
        new MergedAnswerInstruction(),
      ],
      cacheEngine: new FileCache(),
    });

    this.question = question;
    this.answersAnalyses = answersAnalyses;
  }

  describeAnalysis() {
    let description = '';

    for (const answerAnalyses of this.answersAnalyses) {
      description += `## Answer ${answerAnalyses.answerIndex}\n`;
      description += `${answerAnalyses.answer}\n\n`;

      for (const analyse of answerAnalyses.analyses) {
        description += `### Criteria ${analyse.criteria}\n`;
        description += `#### Analysis (note: ${analyse.note}) \n`;
        description += `${analyse.analyse}\n\n`;
      }
    }

    return description;
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
      analyses: this.describeAnalysis(),
      instructionsDescription,
    });
  }
}
