import { PromptTemplate } from 'langchain/prompts';

import { AgentOneShot } from '../../AgentOneShot';
import { OneShotAction } from '../../actions/LLMAction';
import { FileCache } from '../../cache/FileCache';
import { AnswersAnalyses } from './BSMExecutor';

class MergedAnswerAction extends OneShotAction {
  public name = 'mergedAnswer';

  public usage =
    'use the analyses and the answer content to create a new answer to the question';

  public parameters = [
    {
      name: 'answer',
      usage: 'content of the answer',
    },
  ];
}

class BestAnswerAction extends OneShotAction {
  public name = 'bestAnswer';

  public format = 'multiline' as const;

  public usage = 'best answer number based on the analysis';

  public parameters = [
    {
      name: 'index',
      usage: 'number of the answer',
    },
  ];
}

export class MergeAgent extends AgentOneShot {
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
{actions}
`,
    inputVariables: ['question', 'analyses', 'actions'],
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
      actions: [new BestAnswerAction(), new MergedAnswerAction()],
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
    actions,
    feedbackSteps,
  }: {
    actions: string;
    feedbackSteps?: string[] | undefined;
  }): Promise<string> {
    return this.template.format({
      question: this.question,
      analyses: this.describeAnalysis(),
      actions,
    });
  }
}
