/**
 * InventoryGrid — DOM grid over Inventory. Null-safe without document.
 */
import type { Inventory, InvItem } from '../gameplay/Inventory';

export interface InventoryGridOpts {
  id?: string;
  parent?: HTMLElement;
  onUse?: (item: InvItem, index: number) => void;
  onDrop?: (item: InvItem, index: number) => void;
}

export class InventoryGrid {
  readonly el: HTMLElement | null;
  private inv: Inventory;

  constructor(inv: Inventory, opts: InventoryGridOpts = {}) {
    this.inv = inv;
    if (typeof document === 'undefined') {
      this.el = null;
      return;
    }
    const root = document.createElement('div');
    if (opts.id) root.id = opts.id;
    root.style.cssText =
      'position:fixed;right:12px;bottom:12px;z-index:30;display:grid;' +
      'grid-template-columns:repeat(6,44px);gap:4px;background:rgba(0,0,0,.55);' +
      'padding:8px;border-radius:8px;color:#e8eef7;font:11px system-ui;pointer-events:auto;';
    this.el = root;
    (opts.parent ?? document.body).appendChild(root);
    inv.onChange = () => this.render(opts);
    this.render(opts);
  }

  private render(opts: InventoryGridOpts): void {
    if (!this.el) return;
    this.el.innerHTML = '';
    const slots = this.inv.slots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const cell = document.createElement('div');
      cell.style.cssText =
        'width:44px;height:44px;border:1px solid #3a4a66;border-radius:6px;' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;background:#152033;';
      cell.title = s ? `${s.id} x${s.qty}` : '';
      cell.textContent = s ? `${s.id.slice(0, 4)}\n${s.qty}` : '';
      if (s) {
        cell.onclick = () => opts.onUse?.(s, i);
        cell.oncontextmenu = (e) => {
          e.preventDefault();
          opts.onDrop?.(s, i);
        };
      }
      this.el.appendChild(cell);
    }
  }

  show(): void {
    if (this.el) this.el.style.display = 'grid';
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }

  toggle(): void {
    if (!this.el) return;
    this.el.style.display = this.el.style.display === 'none' ? 'grid' : 'none';
  }

  dispose(): void {
    this.inv.onChange = undefined;
    this.el?.remove();
  }
}
