/**
 * Interaction modes are bit flags, so they can be combined with `|`
 * (e.g. `CREATE | DELETE`) and toggled with `^`.
 */
export const NONE = 0;
export const CREATE = 1;
export const EDIT = 2;
export const DELETE = 4;
export const APPEND = 8;
export const EDIT_APPEND: number = EDIT | APPEND;
export const ALL: number = CREATE | EDIT | DELETE | APPEND;

/** A bitmask made of {@link CREATE}, {@link EDIT}, {@link DELETE} and {@link APPEND}. */
export type Mode = number;

/** CSS class applied to the map container for each active mode. */
export const modeClassNames: readonly (readonly [Mode, string])[] = [
  [CREATE, 'mode-create'],
  [EDIT, 'mode-edit'],
  [DELETE, 'mode-delete'],
  [APPEND, 'mode-append'],
];

export const noModeClassName = 'mode-none';

export function hasMode(mode: Mode, flag: Mode): boolean {
  return (mode & flag) === flag;
}
