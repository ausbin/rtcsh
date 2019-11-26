import * as React from 'react';

export interface TerminalState {
    text: string,
    typedLen: number,
    pendingCommands: string[],
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

    executeCommand = (command: string) => {
        const argv = command.trim().split(/\s+/);

        if (argv.length === 0) {
            // empty command, no probs
            return;
        }

        const pushText = (text: string) => {this.setState(prevState => ({text: prevState.text + text + this.PROMPT}));};

        switch (argv[0]) {
            case 'ls':
                pushText('bin\tetc\ttmp\n');
                break;

            case 'echo':
                pushText(argv.slice(1).join(' ') + '\n');
                break;

            default:
                pushText(argv[0] + ': command not found\n');
        }
    };

    onKeyDown = (e: KeyboardEvent) => {
        const key = e.key;

        if (key.length === 1 && !e.ctrlKey) {
            e.preventDefault();
            this.setState((prevState: TerminalState) => ({text: prevState.text + key, typedLen: prevState.typedLen + 1}));
        } else if (key === 'Backspace') {
            e.preventDefault();
            this.setState((prevState: TerminalState) => ({text: (prevState.text.length === 0 || prevState.typedLen === 0)? prevState.text : prevState.text.substring(0, prevState.text.length - 1), typedLen: Math.max(0, prevState.typedLen - 1)}));
        } else if (key === 'Enter') {
            e.preventDefault();
            this.setState((prevState: TerminalState) => ({text: prevState.text + '\n', typedLen: 0, pendingCommands: prevState.pendingCommands.concat([prevState.text.slice(-prevState.typedLen)])}));
        }
    };

    render(): React.ReactNode {
        return <pre className="terminal">{this.state.text}<span ref={this.cursorRef}>█</span></pre>;
    }
}
