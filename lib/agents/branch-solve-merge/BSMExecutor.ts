import { AnswerAgent } from './AnswerAgent';
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
  public answers?: string[];
  public answerCount: number;
  public criteriaCount: number;
  public criterias = new Map<string, string>();
  public analysis: Analysis[];

  public answersAnalyses: AnswersAnalyses = [];
  public finaleNotes: Record<number, number> = {};

  constructor({
    question,
    answers,
    answerCount = 2,
    criterias,
    criteriaCount = 3,
    mergeMethod = 'classic',
  }: {
    question: string;
    answers?: string[];
    answerCount?: number;
    criteriaCount?: number;
    criterias?: string[];
    mergeMethod?: 'classic' | 'agent';
  }) {
    this.question = question;
    this.answers = answers;
    this.answerCount = answerCount;
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

    console.log(`Branch: generating ${this.criteriaCount} criterias`);

    const criterias = await branchAgent.run();

    console.log(
      `Branch: answer will be analyzed with the following criterias: ${Object.values(
        criterias
      )
        .map((criteria) => criteria.parameters.criteria)
        .join(', ')}`
    );

    for (const {
      parameters: { criteria, definition },
    } of criterias) {
      this.criterias.set(criteria, definition);
    }

    const answers = this.answers ? this.answers : await this.generateAnswers();

    const promises: Promise<Analysis>[] = [];

    for (const [criteriaName, criteria] of this.criterias.entries()) {
      for (let i = 0; i < answers.length; i++) {
        promises.push(
          this.solve({
            answer: answers[i],
            answerIndex: i,
            criteria,
            criteriaName,
          })
        );
      }
    }

    const analyses = await Promise.all(promises);

    this.classicMerge(analyses);

    const { bestAnswer, mergedAnswer } = await this.merge();

    console.log('Merge: best available answer:');
    console.log(answers[bestAnswer.parameters.index]);
    console.log('\n------\n');
    console.log('Merge: merged answer:');
    console.log(mergedAnswer.parameters.answer);
  }

  private generateAnswers(): Promise<string[]> {
    console.log(`(Generating ${this.answerCount} answers)`);

    const promises: Promise<string>[] = [];

    for (let i = 0; i < this.answerCount; i++) {
      promises.push(new AnswerAgent({ question: this.question }).run());
    }

    return Promise.all(promises);
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
    console.log(
      `Solve: evaluate answer n°${answerIndex} with criteria ${criteriaName}`
    );

    const solveAgent = new SolveAgent({
      question: this.question,
      criteria,
      answer,
    });

    const analysis = await solveAgent.run();
    console.log(
      `Solve: grade answer n°${answerIndex} on criteria ${criteriaName} with ${analysis[0].parameters.note}`
    );

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

  private async merge() {
    console.log(
      `Merge: merge ${this.answersAnalyses.length} analyses together`
    );

    const mergeAgent = new MergeAgent({
      answersAnalyses: this.answersAnalyses,
      question: this.question,
    });

    const results = await mergeAgent.run();

    const bestAnswer = results.find((result) => result.name === 'bestAnswer');
    const mergedAnswer = results.find(
      (result) => result.name === 'mergedAnswer'
    );

    if (!bestAnswer || !mergedAnswer) {
      throw new Error('Merge: could not find best answer or merged answer');
    }

    return { bestAnswer, mergedAnswer };
  }
}
