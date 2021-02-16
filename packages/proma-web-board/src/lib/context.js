import { getContext, setContext } from 'svelte';

const BOARD = Symbol('board');
const CHIP = Symbol('chip');
const CHIP_SIDE = Symbol('chip-side');

export const INPUT = 'input';
export const OUTPUT = 'output';

export function setBoard(value) {
  setContext(BOARD, value);
  return value;
}

export function getBoard() {
  const value = getContext(BOARD);
  if (!value) {
    throw new Error('Must be in a Board');
  }
  return value;
}

export function setChip(value) {
  setContext(CHIP, value);
  return value;
}

export function getChip() {
  const value = getContext(CHIP);
  if (!value) {
    throw new Error('Must be in a Chip');
  }
  return value;
}

export function setChipSide(value) {
  if (value !== INPUT && value !== OUTPUT) {
    throw new Error(
      `Chip side must be "${INPUT}" or "${OUTPUT}", got: "${String(value)}"`,
    );
  }
  getChip();
  setContext(CHIP_SIDE, value);
  return value;
}

export function getChipWithSide() {
  const chip = getChip();
  const side = getContext(CHIP_SIDE);
  if (!side) {
    throw new Error('Must be in a Chip side');
  }
  return { chip, side };
}
