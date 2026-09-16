import type { ApexTrack } from '../types';
import type { RuntimeColumn, RuntimeTable } from './runtime';
import { visibleColumns } from './runtime';

/*
 * 所有列共用一次几何计算，原生固定顺序和基础尺寸不变。
 * 空间不足仅撤销视觉 sticky，不写入 columnPinning 或偏好。
 */
export interface Track {
  key: string;
  /*
   * 展开列参与统一宽度和固定偏移计算。
   * 辅助列不进入原生业务列模型或列偏好。
   */
  kind: 'column' | 'selection' | 'number' | 'expansion';
  column?: RuntimeColumn;
  size: number;
  pin: false | 'start' | 'end';
  sticky: false | 'start' | 'end';
  offset: number;
  priority: number;
}
function auxiliary(kind: 'selection' | 'number' | 'expansion', config: ApexTrack): Track {
  const options = typeof config === 'object' ? config : {};
  const pin = options.sticky ?? (kind === 'selection' ? 'start' : false);
  return { kind, key: `apex-aux-${kind}`, size: options.size ?? (kind === 'number' ? 48 : 44), pin, sticky: pin, offset: 0, priority: 100 };
}
export function calculateLayout(table: RuntimeTable, width: number, selection: ApexTrack, number: ApexTrack, expansion: ApexTrack = false) {
  const tracks: Track[] = visibleColumns(table).map((column) => ({
    kind: 'column', key: column.id, column, size: column.getSize?.() ?? 150,
    pin: column.getIsPinned?.() ?? false, sticky: column.getIsPinned?.() ?? false,
    offset: 0, priority: column.columnDef.meta?.apex?.pinPriority ?? 0,
  }));
  const extras = [expansion ? auxiliary('expansion', expansion) : null, selection ? auxiliary('selection', selection) : null, number ? auxiliary('number', number) : null].filter((track): track is Track => !!track);
  tracks.unshift(...extras.filter((track) => track.pin !== 'end'));
  tracks.push(...extras.filter((track) => track.pin === 'end'));
  const sizing = table.atoms.columnSizing?.get() ?? {};
  let remaining = width - tracks.reduce((sum, track) => sum + track.size, 0);
  let flexible = tracks.filter((track) => track.column && !track.pin && (track.column.columnDef.meta?.apex?.flex ?? 0) > 0 && !Object.prototype.hasOwnProperty.call(sizing, track.key));
  while (remaining > 0.5 && flexible.length) {
    const weight = flexible.reduce((sum, track) => sum + track.column!.columnDef.meta!.apex!.flex!, 0);
    const extra = remaining;
    for (const track of flexible) {
      const addition = Math.min(extra * track.column!.columnDef.meta!.apex!.flex! / weight, (track.column!.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER) - track.size);
      track.size += addition;
      remaining -= addition;
    }
    flexible = flexible.filter((track) => track.size < (track.column!.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER));
  }
  let pinnedWidth = tracks.filter((track) => track.sticky).reduce((sum, track) => sum + track.size, 0);
  const candidates = tracks.filter((track) => track.sticky).sort((a, b) => {
    const distanceA = a.pin === 'start' ? tracks.indexOf(a) : tracks.length - tracks.indexOf(a);
    const distanceB = b.pin === 'start' ? tracks.indexOf(b) : tracks.length - tracks.indexOf(b);
    return a.priority - b.priority || distanceB - distanceA;
  });
  candidates.forEach((track) => {
    if (width < 160 || pinnedWidth > width - 160) { track.sticky = false; pinnedWidth -= track.size; }
  });
  let start = 0;
  tracks.forEach((track) => { if (track.sticky === 'start') { track.offset = start; start += track.size; } });
  let end = 0;
  [...tracks].reverse().forEach((track) => { if (track.sticky === 'end') { track.offset = end; end += track.size; } });
  return tracks;
}
export function trackStyle(track: Track) {
  return { width: track.size, minWidth: track.size, maxWidth: track.size, ...(track.sticky === 'start' ? { left: track.offset } : track.sticky === 'end' ? { right: track.offset } : {}) };
}
