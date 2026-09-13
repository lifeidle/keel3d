// Fullscreen: a one-time invitation when the page opens, plus a small always
// available corner toggle.
//
// Two platform gotchas drive the design here:
//  1. Fullscreen MUST be requested from inside a user gesture, so it can never
//     be triggered automatically at boot — we can only *offer* it and enter on
//     the resulting click.
//  2. iPhone Safari has no Fullscreen API for the document (only <video>). We
//     feature-detect and simply hide the whole affordance there rather than
//     showing a button that does nothing. iPad Safari and desktop are fine.

const DISMISS_KEY = 'sf-fs-dismissed';

type FSElement = HTMLElement & {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FSDocument = Document & {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

/** iPhone Safari exposes no element fullscreen at all — never show the button. */
export function fullscreenSupported(): boolean {
  const el = document.documentElement as FSElement;
  const d = document as FSDocument;
  // webkitFullscreenEnabled is false on iPhone, true on iPad
  if (d.webkitFullscreenEnabled === false) return false;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  const d = document as FSDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Must be called from a user gesture. Resolves true if we actually went fullscreen. */
export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement as FSElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    return isFullscreen();
  } catch {
    // denied by the browser (permissions policy, iframe, or a rejected gesture)
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FSDocument;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    /* nothing we can do, and nothing the player needs to see */
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen();
  else await enterFullscreen();
}

export class FullscreenUI {
  private wrap = document.getElementById('fs-wrap');
  private btn = document.getElementById('fs-btn') as HTMLButtonElement | null;
  private prompt = document.getElementById('fs-prompt');
  private yes = document.getElementById('fs-yes');
  private no = document.getElementById('fs-no');

  /** True when the player dismissed the invitation for good. */
  private dismissed = false;

  constructor() {
    try {
      this.dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* localStorage unavailable — just ask every time */
    }

    if (!fullscreenSupported()) {
      // iPhone and any other host without the API: no button, no prompt.
      this.wrap?.remove();
      this.prompt?.remove();
      return;
    }

    this.wrap?.classList.remove('hidden');
    this.btn?.addEventListener('click', () => void toggleFullscreen());
    // the 全屏 label beside the icon is a second, bigger hit target
    document.getElementById('fs-tip')?.addEventListener('click', () => void toggleFullscreen());
    this.yes?.addEventListener('click', () => void this.accept());
    // "not now" also remembers the choice — one tap, no extra checkbox; the
    // corner button stays available for anyone who changes their mind
    this.no?.addEventListener('click', () => {
      this.hidePrompt();
      this.remember();
    });

    const sync = () => this.syncState();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    this.syncState();
  }

  /** Icon flips enter/exit; the hint text only makes sense while windowed. */
  private syncState() {
    const fs = isFullscreen();
    this.btn?.classList.toggle('is-fs', fs);
    this.wrap?.classList.toggle('is-fs', fs);
  }

  /**
   * Offer fullscreen once the player can actually act on it. Called after the
   * boot screen clears (the main menu is up). Safe to call more than once —
   * it no-ops after the first dismissal or if already fullscreen.
   */
  maybePrompt() {
    if (!fullscreenSupported()) return;
    if (this.dismissed || isFullscreen()) return;
    if (!this.prompt) return;
    this.prompt.classList.remove('hidden');
  }

  private async accept() {
    this.hidePrompt();
    await enterFullscreen();
  }

  private hidePrompt() {
    this.prompt?.classList.add('hidden');
  }

  private remember() {
    this.dismissed = true;
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }
}
