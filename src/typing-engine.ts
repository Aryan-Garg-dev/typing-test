/**
 * TypingEngine.ts
 *
 * A reusable, class-based encapsulation of the typing-game logic extracted from the
 * hook implementation. This class provides a clear API for:
 * - creating a new test (createNewGame)
 * - starting / stopping / resetting the test
 * - handling keyboard input (handleKey)
 * - ticking an internal timer (managed by start/stop)
 * - retrieving evaluation metrics (getResult)
 * - subscribing to state updates via onStateChange callbacks
 *
 * Intended to be used either directly from components or wrapped by the existing
 * useTyping hook (recommended — the hook can instantiate this class and expose
 * a React-friendly API).
 *
 * Note: This file intentionally mirrors the types used in the repository for
 * compatibility with the rest of the codebase.
 */

import { generateText } from "@/lib/faker";

/* -------------------------
 * Types (same semantics as the previous hook)
 * ------------------------*/
export interface ILetterData {
  letter: string;
  typed: boolean;
  status?: "correct" | "incorrect";
}

export interface ITextCoord {
  word: number;
  letter: number;
}

export interface IGameResult {
  correct: number;
  incorrect: number;
  total: number; // number of relevant characters (excludes internal word placeholders)
  wpm: number;   // words per minute (net, based on correct characters)
  accuracy: number; // 0..100 integer percent
}

export interface IGameState {
  text: string;
  data: ILetterData[][];
  timeLimit?: number; // seconds
  counter: number; // seconds elapsed
  isRunning: boolean;
  isOver: boolean;
  currentPos: ITextCoord;
}

/* -------------------------
 * Engine Options & Callbacks
 * ------------------------*/
export interface TypingEngineOptions {
  textSize?: number;      // characters requested for generated text
  timeLimit?: number;     // seconds; optional
  autoCreateOnConstruct?: boolean; // if true, a new game is created immediately
}

export type StateChangeCallback = (state: IGameState) => void;
export type GameOverCallback = (result: IGameResult) => void;

/* -------------------------
 * TypingEngine
 * ------------------------*/
export class TypingEngine {
  private state: IGameState;
  private intervalId: number | null = null;
  private onStateChangeCallbacks: StateChangeCallback[] = [];
  private onGameOverCallbacks: GameOverCallback[] = [];

  constructor(opts?: TypingEngineOptions) {
    this.state = this.getInitialState();
    if (opts?.autoCreateOnConstruct) {
      this.createNewGame(opts.textSize ?? 100, opts.timeLimit);
    } else if (opts?.textSize || opts?.timeLimit) {
      // If only timeLimit provided, set it on the empty state
      if (opts?.timeLimit) this.state.timeLimit = opts.timeLimit;
    }
  }

  private getInitialState(): IGameState {
    return {
      text: "",
      data: [],
      timeLimit: undefined,
      counter: 0,
      isRunning: false,
      isOver: false,
      currentPos: {
        word: 0,
        letter: 0,
      },
    };
  }

  // Public read-only access to the state
  public getState(): Readonly<IGameState> {
    return this.state;
  }

  // Subscribe to state changes (UI components can use this to re-render)
  public onStateChange(cb: StateChangeCallback) {
    this.onStateChangeCallbacks.push(cb);
    // return unsubscribe
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter(c => c !== cb);
    };
  }

  public onGameOver(cb: GameOverCallback) {
    this.onGameOverCallbacks.push(cb);
    return () => {
      this.onGameOverCallbacks = this.onGameOverCallbacks.filter(c => c !== cb);
    };
  }

  /* -------------------------
   * Text / Data creation
   * ------------------------*/
  private createTextdata(text: string): ILetterData[][] {
    const words = text.split(" ");
    return words.map((word, wordIndex) => {
      const letters = word.split("").map(letter => ({ letter, typed: false } as ILetterData));
      // Add a placeholder for the space between words — use words.length to decide
      if (wordIndex !== words.length - 1) letters.push({ letter: "", typed: false });
      return letters;
    });
  }

  /**
   * createNewGame(textSize?, timeLimit?)
   * - Generates text (using existing generateText function) and initializes state.
   * - Does NOT auto-start the timer (call start() to begin).
   */
  public createNewGame(textSize: number = 100, timeLimit?: number) {
    const text = generateText(textSize);
    const data = this.createTextdata(text);
    if (this.state.isRunning) {
      // stop running game and replace with new one
      this.stop();
    }
    this.state = {
      ...this.getInitialState(),
      text,
      data,
      timeLimit,
    };
    this.emitState();
  }

  /* -------------------------
   * Lifecycle: start / stop / reset
   * ------------------------*/
  public start() {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.state.isOver = false;
    this.state.counter = 0;
    this.emitState();
    // start internal second ticker
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, 1000);
  }

  public stop() {
    this.state.isRunning = false;
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.emitState();
  }

  public reset() {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.state = this.getInitialState();
    this.emitState();
  }

  private tick() {
    // increment seconds, evaluate end conditions
    this.state.counter += 1;

    // time limit reached?
    if (this.state.timeLimit && this.state.counter >= this.state.timeLimit) {
      this.endGame();
      return;
    }

    // If user reached the last word and advanced past the last letter, end
    const { word, letter } = this.state.currentPos;
    if (this.state.data.length > 0 && word === this.state.data.length - 1 && letter >= this.state.data[word].length) {
      this.endGame();
      return;
    }

    this.emitState();
  }

  private endGame() {
    // stop timer, mark over and notify results
    this.stop();
    this.state.isOver = true;
    this.state.isRunning = false;
    const result = this.getResult();
    this.emitState();
    this.onGameOverCallbacks.forEach(cb => cb(result));
  }

  private emitState() {
    for (const cb of this.onStateChangeCallbacks) {
      try {
        cb(this.state);
      } catch (err) {
        console.error(err);
        // swallow callback errors to avoid breaking engine
        // but you may want to log in development
        // console.error("State change callback error", err);
      }
    }
  }

  /* -------------------------
   * Input handling
   * ------------------------*/
  public handleKey(e: KeyboardEvent) {
    if (!this.state.data || this.state.data.length === 0) return;
    if (this.state.isOver) return;

    let { word: wordOffset, letter: letterOffset } = this.state.currentPos;

    // ESC ends the game early
    if (e.key === "Escape") {
      this.endGame();
      return;
    }

    // BACKSPACE handling: move caret back and clear typed status for that char
    if (e.key === "Backspace") {
      if (letterOffset === 0) {
        if (wordOffset === 0) {
          // nothing to do
          return;
        }
        // move to previous word's last slot
        wordOffset = Math.max(0, wordOffset - 1);
        letterOffset = this.state.data[wordOffset].length - 1;
      } else {
        letterOffset -= 1;
      }

      // Reset that slot (if it exists)
      if (this.state.data[wordOffset] && this.state.data[wordOffset][letterOffset]) {
        this.state.data[wordOffset][letterOffset].typed = false;
        this.state.data[wordOffset][letterOffset].status = undefined;
      }

      // update current position but do NOT advance
      this.state.currentPos = { word: wordOffset, letter: letterOffset };
      this.emitState();
      return;
    }

    // SPACE handling: treat placeholder "" slots as separators
    if (e.key === " " || e.code === "Space") {
      // ignore if at beginning of a word (no-op)
      if (letterOffset === 0) return;
      // advance to next word (clamp)
      const nextWord = Math.min(wordOffset + 1, this.state.data.length - 1);
      this.state.currentPos = { word: nextWord, letter: 0 };
      this.emitState();
      return;
    }

    // If we've reached the end of the current word slot array, move to the next word
    if (this.state.data[wordOffset].length === letterOffset) {
      wordOffset += 1;
      letterOffset = 0;
      // guard against overflow
      if (wordOffset >= this.state.data.length) {
        // nothing to write
        this.endGame();
        return;
      }
    }

    // If the target slot doesn't exist, ignore input
    const slot = this.state.data[wordOffset]?.[letterOffset];
    if (!slot) {
      return;
    }

    // Mark typed and set status
    slot.typed = true;
    slot.status = slot.letter === e.key ? "correct" : "incorrect";

    // move caret forward
    this.state.currentPos = { word: wordOffset, letter: letterOffset + 1 };
    this.emitState();

    // If user typed the last character of the whole text, end the game
    if (wordOffset === this.state.data.length - 1 && this.state.currentPos.letter >= this.state.data[wordOffset].length) {
      this.endGame();
    }
  }

  /* -------------------------
   * Evaluation: compute results
   * ------------------------*/
  public getResult(): IGameResult {
    // compute correct/incorrect across slots; placeholders (letter === "") are not counted
    let correct = 0;
    let incorrect = 0;
    let totalChars = 0;

    for (const word of this.state.data) {
      for (const slot of word) {
        if (slot.letter === "") continue; // placeholder for space, ignore for counting
        totalChars += 1;
        if (slot.status === "correct") correct += 1;
        else if (slot.status === "incorrect") incorrect += 1;
      }
    }

    const total = totalChars > 0 ? totalChars : this.state.text.length || 0;

    // compute elapsed seconds (use at least 1s to avoid inflated WPM)
    const elapsedSeconds = Math.max(1, this.state.counter);
    const elapsedMinutes = elapsedSeconds / 60;

    // standard WPM: (correct chars / 5) / minutes
    const rawWpm = (correct / 5) / elapsedMinutes;
    const wpm = Math.round(rawWpm) || 0;

    const accuracy = (correct + incorrect === 0) ? 0 : Math.round((correct * 100) / (correct + incorrect));

    return {
      correct,
      incorrect,
      total,
      wpm,
      accuracy,
    };
  }
}

export default TypingEngine;