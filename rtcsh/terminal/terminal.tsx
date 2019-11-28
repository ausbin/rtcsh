import * as React from 'react';

export interface TerminalState {
    text: string,
    typedLen: number,
    pendingCommands: string[],
    files: Set<string>,
}

export class Terminal extends React.Component<{}, TerminalState> {
    private PROMPT: string = '$ ';
    public cursorRef: React.RefObject<HTMLSpanElement>;

    constructor(props: {}) {
        super(props);

        this.cursorRef = React.createRef();
        this.state = {
            text: this.PROMPT,
            typedLen: 0,
            pendingCommands: [],
            files: new Set(),
        };
    }

    componentDidMount() {
        document.addEventListener('keydown', this.onKeyDown);
    }

    componentDidUpdate() {
        const cursor = this.cursorRef.current;
        if (cursor)
            cursor.scrollIntoView();

        if (this.state.pendingCommands.length > 0) {
            this.state.pendingCommands.forEach(this.executeCommand);
            this.setState({pendingCommands: []});
        }
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeyDown);
    }

    executeCommand = (commandText: string) => {
        type Command = (argv: string[], prevState: TerminalState) => string|[string, Set<string>];

        const unknownCommand: Command = argv => argv[0] + ': command not found';
        const commands: {[cmd: string]: Command} = {
            ls: (argv, prevState) => {
                if (argv.length === 1) {
                    return Array.from(prevState.files).sort().join('\t');
                } else {
                    return 'usage: ls';
                }
            },

            touch: (argv, prevState) => {
                if (argv.length === 2) {
                    return ['', new Set([argv[1], ...prevState.files])];
                } else {
                    return 'usage: touch <file>';
                }
            },

            rm: (argv, prevState) => {
                if (argv.length === 2) {
                    const fileName = argv[1];

                    const fixedSet = new Set(prevState.files);
                    if (!fixedSet.delete(fileName)) {
                        return 'rm: no such file ' + fileName;
                    }

                    return ['', fixedSet];
                } else {
                    return 'usage: rm <file>';
                }
            },

            echo: argv => argv.slice(1).join(' '),

            help: () => 'available commands:\n\n' +
                        Object.keys(commands).filter(cmd => cmd !== '').sort().join('\n'),

            '': () => '',
        };


        const argv = commandText.trim().split(/\s+/);
        const command = commands[argv[0]] || unknownCommand;

        this.setState(prevState => {
            const result = command(argv, prevState);

            let output, newFiles;
            if (typeof result === 'string') {
                output = result;
                newFiles = prevState.files;
            } else {
                [output, newFiles] = result;
            }

            return {text: prevState.text + output + (output? '\n' : '') + this.PROMPT, files: newFiles};
        });
    };

    onKeyDown = (e: KeyboardEvent) => {
        const key = e.key;

        if (key.length === 1 && !e.ctrlKey) {
            e.preventDefault();
            this.setState((prevState: TerminalState) => ({text: prevState.text + key, typedLen: prevState.typedLen + 1}));
        } else if (key === 'Backspace') {
            e.preventDefault();
            this.setState((prevState: TerminalState) => ({text: (prevState.text.length === 0 || prevState.typedLen === 0)? prevState.text : prevState.text.substring(0, prevState.text.length - 1), typedLen: Math.max(0, prevState.typedLen - 1)}));
        // Useful GNU readline shortcut
        } else if (key === 'u' && e.ctrlKey) {
            e.preventDefault();
            this.setState((prevState: TerminalState) => ({text: (prevState.text.length === 0 || prevState.typedLen === 0)? prevState.text : prevState.text.substring(0, prevState.text.length - prevState.typedLen), typedLen: 0}));
        } else if (key === 'Enter') {
            e.preventDefault();
            this.setState((prevState: TerminalState) => ({text: prevState.text + '\n', typedLen: 0, pendingCommands: prevState.pendingCommands.concat([prevState.typedLen? prevState.text.slice(-prevState.typedLen) : ''])}));
        }
    };

    render(): React.ReactNode {
        return <pre className="terminal">{this.state.text}<span ref={this.cursorRef}>█</span></pre>;
    }
}
