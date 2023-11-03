import { PromptTemplate } from 'langchain/prompts';

import { LLMAgentOneShot } from '../../LLMAgentOneShot';
import { describeMultilineAction } from '../../actions/LLMAction';
import { FileCache } from '../../cache/FileCache';
import { AnswersAnalyses } from './BSM';

export class MergeAgent extends LLMAgentOneShot<'bestAnswer' | 'mergedAnswer'> {
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

Answer as following:
{format}
`,
    inputVariables: ['question', 'analyses', 'format'],
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
    super({ cacheEngine: new FileCache() });

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
      format:
        describeMultilineAction({
          name: 'bestAnswer',
          usage: 'best answer number based on the analysis',
          parameters: [
            {
              name: 'index',
              usage: 'number of the answer',
            },
          ],
        }) +
        '\n\n' +
        describeMultilineAction({
          name: 'mergedAnswer',
          usage:
            'use the analyses and the answer content to create a new answer to the question',
          parameters: [
            {
              name: 'answer',
              usage: 'content of the answer',
            },
          ],
        }),
    });
  }
}
