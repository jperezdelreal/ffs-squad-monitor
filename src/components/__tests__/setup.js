import '@testing-library/jest-dom/vitest'
import { useStore, initialState } from '../../store/store'
import { beforeEach } from 'vitest'

// Reset Zustand store between tests to prevent state leakage (merge, preserving actions)
beforeEach(() => {
  useStore.setState({ ...initialState })
})
