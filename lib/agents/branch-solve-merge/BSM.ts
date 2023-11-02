import { BranchAgent } from './BranchAgent';
import { SolveAgent } from './SolveAgent';

type Analysis = {
  criteriaName: string;
  answerIndex: number;
  answer: string;
  analysis: string;
  note: number;
};

export class BSMExecutor {
  public question: string;
  public answers: string[];
  public criteriaCount: number;
  public criterias = new Map<string, string>();
  public analysis: Analysis[];

  constructor({
    question,
    answers,
    criteriaCount = 2,
  }: {
    question: string;
    answers: string[];
    criteriaCount?: number;
  }) {
    this.question = question;
    this.answers = answers;
    this.criteriaCount = criteriaCount;
  }

  async execute() {
    const branchAgent = new BranchAgent({
      question: this.question,
      criteriaCount: this.criteriaCount,
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

    const analysis = await Promise.all(promises);

    const analyse: Array<{
      answer: string;
      answerIndex: number;
      note: number;
    }> = [];
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
}
