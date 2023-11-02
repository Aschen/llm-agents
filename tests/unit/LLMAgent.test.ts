import { PromptTemplate } from 'langchain/prompts';

import { LLMAgent, LLMAgentOptions } from '../../lib/LLMAgent';
import {
  LLMAction,
  ActionFeedback,
  LLMActionOptions,
} from '../../lib/actions/LLMAction';
import { ListFilesAction } from '../lib/actions/ListFilesAction';

function* returnPrompt() {
  yield `
  <Action name="listFiles" parameter:directory="/home/aschen" feedback:type="message" feedback:message="found 42 files" />
  <Action name="listFiles" parameter:directory="/home/ocave" feedback:type="message" feedback:message="found 21 files" />
  `;
}

export class MockedListFilesAction extends LLMAction<'directory'> {
  public name = 'listFiles';
  public usage = 'list all files in a directory';
  public parameters = [
    {
      name: 'directory' as const,
      usage: 'path of the directory to list',
    },
  ];
  constructor({ format }: { format?: LLMActionOptions['format'] } = {}) {
    super({ format });
  }

  protected async executeAction(
    parameters: Record<'directory', string>
  ): Promise<ActionFeedback> {
    const { directory } = parameters;

    try {
      return {
        message: `Files in ${directory}: so.rs much.ts files.go`,
        type: 'success',
      };
    } catch (error) {
      return {
        message: error.message as string,
        type: 'error',
      };
    }
  }
}

class TestableAgent extends LLMAgent {
  protected template = new PromptTemplate({
    template: 'Tell me a joke about {subject}.',
    inputVariables: ['subject'],
  });

  constructor(options: LLMAgentOptions = {}) {
    super(options);
  }

  protected async formatPrompt({
    actions,
    feedbackSteps,
  }: {
    actions: string;
    feedbackSteps: string[];
  }) {
    return `${actions}${feedbackSteps.join('\n')}`;
  }
}

describe('LLMAgent', () => {
  describe('run', () => {
    it('should run the agent', async () => {
      const answer1 = `<Action name="listFiles" parameter:directory="/home/aschen" />`;
      const answer2 = `<Action name="listFiles" parameter:directory="/home/ocav" />`;
      const answer3 = `<Action name="done" />`;
      const agent = new TestableAgent({
        actions: [new MockedListFilesAction()],
      });
      // @ts-ignore
      agent.callModel = jest
        .fn()
        .mockReturnValueOnce(answer1)
        .mockReturnValueOnce(answer2)
        .mockReturnValueOnce(answer3);

      await agent.run();

      // @ts-ignore
      const calls = agent.callModel.mock.calls;
      // first prompt contains only actions list
      expect(calls[0][0]).toEqual({
        model: 'gpt-4',
        prompt: `<Action name=\"listFiles\" parameter:directory=\"<path of the directory to list>\" />\n<Action name=\"done\" />`,
      });
      // second prompt contains actions list and 1 feedback step
      expect(calls[1][0]).toEqual({
        model: 'gpt-4',
        prompt: `<Action name=\"listFiles\" parameter:directory=\"<path of the directory to list>\" />\n<Action name=\"done\" /><Step number=\"1\">\n  <Action name=\"listFiles\" parameter:directory=\"/home/aschen\" feedback:type=\"success\" feedback:message=\"Files in /home/aschen: so.rs much.ts files.go\" />\n</Step>`,
      });
      // third prompt contains actions list and 2 feedback step
      expect(calls[2][0]).toEqual({
        model: 'gpt-4',
        prompt: `<Action name=\"listFiles\" parameter:directory=\"<path of the directory to list>\" />\n<Action name=\"done\" /><Step number=\"1\">\n  <Action name=\"listFiles\" parameter:directory=\"/home/aschen\" feedback:type=\"success\" feedback:message=\"Files in /home/aschen: so.rs much.ts files.go\" />\n</Step>\n<Step number=\"2\">\n  <Action name=\"listFiles\" parameter:directory=\"/home/ocav\" feedback:type=\"success\" feedback:message=\"Files in /home/ocav: so.rs much.ts files.go\" />\n</Step>`,
      });
    });
  });

  describe('extractActions', () => {
    it('should extract actions', () => {
      const agent = new TestableAgent();
      const answer = `
      <Action name="listFile" parameter:directory="/home/aschen" />

      <Action name="readFuntion">
        <Parameter name="name">
          foobar
        </Parameter>
      
        <Parameter name="code">
          const a = 1;
          const b = 2;
        </Parameter>
      </Action>

      <Action name="listFile" parameter:directory="/home/ocav" />

      <Action name="createDirectory" parameter:directory="/home/aschen" />

      <Action name="readFuntion">
        <Parameter name="name">
          barfoo
        </Parameter>
      
        <Parameter name="code">
          const foobar = 1;
        </Parameter>
      </Action>
      `;

      // @ts-ignore
      const actions = agent.extractActions(answer);

      expect(actions.length).toBe(5);

      expect(actions[0].name).toBe('listFile');
      expect(actions[0].parameters).toEqual({
        directory: '/home/aschen',
      });
      expect(actions[1].name).toBe('readFuntion');
      expect(actions[1].parameters).toEqual({
        name: 'foobar',
        code: 'const a = 1;\n          const b = 2;',
      });
      expect(actions[2].name).toBe('listFile');
      expect(actions[2].parameters).toEqual({
        directory: '/home/ocav',
      });
      expect(actions[3].name).toBe('createDirectory');
      expect(actions[3].parameters).toEqual({
        directory: '/home/aschen',
      });
      expect(actions[4].name).toBe('readFuntion');
      expect(actions[4].parameters).toEqual({
        name: 'barfoo',
        code: 'const foobar = 1;',
      });
    });
  });

  describe('describeFeedback', () => {
    it('should add feedback into action with multiline format', () => {
      const agent = new TestableAgent({
        actions: [new ListFilesAction({ format: 'multiline' })],
      });
      const feedback: ActionFeedback = {
        type: 'error',
        message: 'directory does not exists',
      };
      const parameters = {
        directory: '/home/aschen',
      };

      // @ts-ignore
      const result = agent.describeFeedback({
        actionName: 'listFiles',
        parameters,
        feedback,
      });

      expect(result).toBe(`  <Action name=\"listFiles\">
    <Parameter name=\"directory\">
      /home/aschen
    </Parameter>
    <Feedback type=\"error\">
      directory does not exists
    </Feedback>
  </Action>`);
    });

    it('should add feedback into action with singleline format', () => {
      const agent = new TestableAgent({
        actions: [new ListFilesAction({ format: 'singleline' })],
      });
      const feedback: ActionFeedback = {
        type: 'error',
        message: 'directory does not exists',
      };
      const parameters = {
        directory: '/home/aschen',
      };

      // @ts-ignore
      const result = agent.describeFeedback({
        actionName: 'listFiles',
        parameters,
        feedback,
      });

      expect(result).toBe(
        `<Action name="listFiles" parameter:directory="/home/aschen" feedback:type="error" feedback:message="directory does not exists" />`
      );
    });
  });
});
