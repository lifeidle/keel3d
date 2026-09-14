/**
 * Dialogue — node graph conversation. Pure logic.
 */
export interface DialogueOption {
  text: string;
  /** next node id, or null to end */
  next: string | null;
  flag?: string;
}

export interface DialogueNode {
  id: string;
  lines: string[];
  options?: DialogueOption[];
}

export interface DialogueState {
  nodeId: string | null;
  lineIndex: number;
  ended: boolean;
}

export class Dialogue {
  private nodes = new Map<string, DialogueNode>();
  private flags = new Set<string>();
  private state: DialogueState = { nodeId: null, lineIndex: 0, ended: true };
  onChange?: (s: DialogueState) => void;
  onEnd?: () => void;

  constructor(nodes: DialogueNode[] = []) {
    for (const n of nodes) this.nodes.set(n.id, n);
  }

  get current(): DialogueState {
    return { ...this.state };
  }

  get flagsSet(): ReadonlySet<string> {
    return this.flags;
  }

  addNode(n: DialogueNode): void {
    this.nodes.set(n.id, n);
  }

  setFlag(f: string): void {
    this.flags.add(f);
  }

  hasFlag(f: string): boolean {
    return this.flags.has(f);
  }

  start(id: string): boolean {
    const n = this.nodes.get(id);
    if (!n) return false;
    this.state = { nodeId: id, lineIndex: 0, ended: false };
    this.emit();
    return true;
  }

  /** Current line text, or null if ended / no options yet shown. */
  line(): string | null {
    if (this.state.ended || !this.state.nodeId) return null;
    const n = this.nodes.get(this.state.nodeId);
    if (!n) return null;
    return n.lines[this.state.lineIndex] ?? n.lines[n.lines.length - 1] ?? null;
  }

  options(): DialogueOption[] {
    if (this.state.ended || !this.state.nodeId) return [];
    const n = this.nodes.get(this.state.nodeId);
    if (!n?.options) return [];
    // only show options after last line
    if (this.state.lineIndex < n.lines.length - 1) return [];
    return n.options;
  }

  /** Advance to next line; returns false if already at options/end. */
  advance(): boolean {
    if (this.state.ended || !this.state.nodeId) return false;
    const n = this.nodes.get(this.state.nodeId);
    if (!n) return false;
    if (this.state.lineIndex < n.lines.length - 1) {
      this.state.lineIndex++;
      this.emit();
      return true;
    }
    if (!n.options || n.options.length === 0) {
      this.end();
    }
    return false;
  }

  choose(index: number): boolean {
    const opts = this.options();
    const o = opts[index];
    if (!o) return false;
    if (o.flag) this.flags.add(o.flag);
    if (o.next == null) {
      this.end();
      return true;
    }
    return this.start(o.next);
  }

  end(): void {
    this.state = { nodeId: null, lineIndex: 0, ended: true };
    this.emit();
    this.onEnd?.();
  }

  private emit(): void {
    this.onChange?.(this.current);
  }
}
