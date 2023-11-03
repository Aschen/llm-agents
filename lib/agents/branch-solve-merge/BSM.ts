import { BranchAgent } from './BranchAgent';
import { MergeAgent } from './MergeAgent';
import { SolveAgent } from './SolveAgent';

export type Analysis = {
  criteriaName: string;
  answerIndex: number;
  answer: string;
  analysis: string;
  note: number;
};

export type AnswersAnalyses = Array<{
  answerIndex: number;
  answer: string;
  analyses: Array<{ criteria: string; analyse: string; note: number }>;
}>;

export class BSMExecutor {
  public mergeMethod: 'classic' | 'agent';
  public question: string;
  public answers: string[];
  public criteriaCount: number;
  public criterias = new Map<string, string>();
  public analysis: Analysis[];

  public answersAnalyses: AnswersAnalyses = [];
  public finaleNotes: Record<number, number> = {};

  constructor({
    question,
    answers,
    criteriaCount = 2,
    criterias,
    mergeMethod = 'classic',
  }: {
    question: string;
    answers: string[];
    criteriaCount?: number;
    criterias?: string[];
    mergeMethod?: 'classic' | 'agent';
  }) {
    this.question = question;
    this.answers = answers;
    this.criteriaCount = criteriaCount;
    this.mergeMethod = mergeMethod;

    for (const criteria of criterias || []) {
      this.criterias.set(criteria, '');
    }
  }

  async execute() {
    const branchAgent = new BranchAgent({
      question: this.question,
      criteriaCount: this.criteriaCount,
      criterias: Array.from(this.criterias.keys()),
    });

    const criterias = await branchAgent.run();

    for (const {
      parameters: { criteria, definition },
    } of criterias) {
      this.criterias.set(criteria, definition);
    }

    const promises: Promise<Analysis>[] = [];

    for (const [criteriaName, criteria] of this.criterias.entries()) {
      for (let i = 0; i < this.answers.length; i++) {
        promises.push(
          this.solve({
            answer: this.answers[i],
            answerIndex: i,
            criteria,
            criteriaName,
          })
        );
      }
    }

    const analyses = await Promise.all(promises);
    this.classicMerge(analyses);
    const finalAnswer = await this.agentMerge();
    console.log(finalAnswer);
  }

  private async solve({
    answer,
    answerIndex,
    criteriaName,
    criteria,
  }: {
    answer: string;
    answerIndex;
    criteriaName: string;
    criteria: string;
  }): Promise<Analysis> {
    const solveAgent = new SolveAgent({
      question: this.question,
      criteria,
      answer,
    });

    const analysis = await solveAgent.run();

    return {
      criteriaName,
      answerIndex,
      answer,
      analysis: analysis[0].parameters.analysis,
      note: parseInt(analysis[0].parameters.note, 10),
    };
  }

  private classicMerge(analyses: Analysis[]) {
    for (const analyse of analyses) {
      if (!this.finaleNotes[analyse.answerIndex]) {
        this.finaleNotes[analyse.answerIndex] = 0;
      }

      this.finaleNotes[analyse.answerIndex] += analyse.note;
    }

    for (const analyse of analyses) {
      const existentAnswer = this.answersAnalyses.find(
        (answerAnalyses) => answerAnalyses.answerIndex === analyse.answerIndex
      );

      if (existentAnswer) {
        existentAnswer.analyses.push({
          criteria: analyse.criteriaName,
          analyse: analyse.analysis,
          note: analyse.note,
        });
      } else {
        this.answersAnalyses.push({
          answerIndex: analyse.answerIndex,
          answer: analyse.answer,
          analyses: [
            {
              criteria: analyse.criteriaName,
              analyse: analyse.analysis,
              note: analyse.note,
            },
          ],
        });
      }
    }
  }

  private async agentMerge() {
    const mergeAgent = new MergeAgent({
      answersAnalyses: this.answersAnalyses,
      question: this.question,
    });

    return mergeAgent.run();
  }
}
