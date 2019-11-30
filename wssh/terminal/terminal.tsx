import * as React from 'react';

export interface TerminalState {
    text: string,
    typedLen: number,
    pendingCommands: string[],
    files: Set<string>,
}

interface StateUpdate {
    action: 'delete'|'create',
    file: string
}

export class Terminal extends React.Component<{}, TerminalState> {
    private PROMPT: string = '$ ';
    private sock!: WebSocket;
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

        this.sock = new WebSocket('ws://' + window.location.host + '/ws');
        this.sock.addEventListener('error', (e) => {
            console.error('websocket error', e);
        });
        this.sock.addEventListener('message', this.onSockMessage);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeyDown);

        this.sock.close();
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

    executeCommand = (commandText: string) => {
        type Command = (argv: string[], prevState: TerminalState) => string|[string, StateUpdate];

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
                    return ['', {action: 'create', file: argv[1]}];
                } else {
                    return 'usage: touch <file>';
                }
            },

            rm: (argv, prevState) => {
                if (argv.length === 2) {
                    const fileName = argv[1];
                    if (!prevState.files.has(fileName)) {
                        return 'rm: no such file ' + fileName;
                    }
                    return ['', {action: 'delete', file: fileName}];
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

            let output, update;
            if (typeof result === 'string') {
                output = result;
                update = null;
            } else {
                [output, update] = result;
            }

            if (update !== null)
                this.sendUpdate(update);

            return {text: prevState.text + output + (output? '\n' : '') + this.PROMPT};
        });
    };

    applyUpdate(files: Set<string>, update: StateUpdate): Set<string> {
        if (update === null) {
            return files;
        }

        switch (update.action) {
            case 'create':
                console.log('creating', update.file);
                return new Set([update.file, ...files]);

            case 'delete':
                console.log('deleting', update.file);
                const fixedSet = new Set(files);
                fixedSet.delete(update.file);
                return fixedSet;

            default:
                console.warn("unknown action", update.action);
                return files;
        }
    }

    sendUpdate(update: StateUpdate) {
        const data = JSON.stringify(update);
        this.sock.send(data);
    }

    onSockMessage = (e: MessageEvent) => {
        const update = JSON.parse(e.data) as StateUpdate;
        this.setState(prevState => ({files: this.applyUpdate(prevState.files, update)}));
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
