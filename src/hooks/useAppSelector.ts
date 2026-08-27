/**
 * 带类型的 useSelector。
 */

import { useSelector } from 'react-redux'
import type { RootState } from '@/store/store'

export function useAppSelector<Selected>(
  selector: (state: RootState) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean,
): Selected {
  return useSelector(selector, equalityFn)
}
