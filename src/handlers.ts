import { Handler, type Map } from 'leaflet';
import { hasMode, type Mode } from './modes';

interface ModeTarget {
  getMode(): Mode;
  setMode(mode: Mode): unknown;
}

/**
 * An `L.Handler` that switches one mode flag of a layer on and off, so
 * `layer.editing.enable()` works like `map.dragging.enable()`. The layer's
 * mode stays the single source of truth.
 */
export class ModeHandler extends Handler {
  declare private _target: ModeTarget;
  declare private _flag: Mode;

  constructor(target: ModeTarget, flag: Mode) {
    // It toggles a flag on its layer instead of hooking into a map.
    super(null as unknown as Map);
    this._target = target;
    this._flag = flag;
  }

  override enable(): this {
    this._target.setMode(this._target.getMode() | this._flag);
    return this;
  }

  override disable(): this {
    this._target.setMode(this._target.getMode() & ~this._flag);
    return this;
  }

  override enabled(): boolean {
    return hasMode(this._target.getMode(), this._flag);
  }
}
