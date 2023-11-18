export type InstructionOptions = {
  verbose?: boolean;
};

// @todo name should be extracted from the constructor
export abstract class Instruction<TParametersNames extends string = string> {
  static get getName() {
    return this.name.replace('Instruction', '').replace('Action', '');
  }

  static is<T extends Instruction>(
    this: new (...args: any[]) => T,
    instruction: any
  ): instruction is T {
    // @ts-ignore
    return instruction.name === this.getName;
  }

  static select<T extends Instruction>(
    this: new (...args: any[]) => T,
    instructions: any[]
  ): T[] {
    return instructions.filter(
      // @ts-ignore
      (i) => i.name === this.getName
    );
  }

  static find<T extends Instruction>(
    this: new (...args: any[]) => T,
    instructions: any[]
  ): T | undefined {
    return instructions.find(
      // @ts-ignore
      (i) => i.name === this.getName
    );
  }

  public abstract usage: string;
  public abstract parameters: Record<TParametersNames, string>;

  public format: 'singleline' | 'multiline' = 'multiline';

  private verbose: boolean;

  constructor({ verbose = true }: InstructionOptions = {}) {
    this.verbose = verbose;
  }

  get describe(): string {
    if (this.format === 'singleline') {
      return this.describeSingleLine;
    }

    return this.describeMultiline;
  }

  get name(): string {
    // @ts-ignore
    return this.constructor.getName;
  }

  private get describeSingleLine(): string {
    // @ts-ignore
    let result = `Use this action to: ${this.usage}\n<Action name="${this.name}"`;

    for (const [name, usage] of Object.entries(this.parameters)) {
      result += ` parameter:${name}="${usage}"`;
    }

    result += ' />';

    return result;
  }

  private get describeMultiline() {
    // @ts-ignore
    let result = `Use this action to: ${this.usage}\n<Action name="${this.name}">`;

    for (const [name, usage] of Object.entries(this.parameters)) {
      result += `\n  <Parameter name="${name}">\n    // ${usage}\n  </Parameter>`;
    }

    result += '\n</Action>';

    return result;
  }

  protected log(...chunks: string[]) {
    if (this.verbose) {
      console.log(...chunks.map((c) => `${this.constructor.name}: ${c}`));
    }
  }
}
