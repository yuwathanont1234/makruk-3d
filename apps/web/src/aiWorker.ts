/// <reference lib="webworker" />
import { chooseMove, decodeBoard } from '@makruk/engine';
import type { Color } from '@makruk/engine';

interface Req {
  id: number;
  boardStr: string;
  color: Color;
  depth: number;
  randomness: number;
}

self.onmessage = (e: MessageEvent<Req>): void => {
  const { id, boardStr, color, depth, randomness } = e.data;
  const board = decodeBoard(boardStr);
  const { move, score } = chooseMove(board, color, depth, randomness);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, move, score });
};
