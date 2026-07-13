"use client";

import { type SetStateAction, useCallback, useRef, useState } from "react";

export type CommitState<S> = (action: SetStateAction<S>) => S;

/**
 * Applies each update to the latest committed value immediately. This keeps
 * independent async card requests from restoring an older deck snapshot when
 * their responses finish out of order.
 */
export function useCommittedState<S>(initialState: S): [S, CommitState<S>] {
  const [state, setReactState] = useState(initialState);
  const stateRef = useRef(state);

  const commitState = useCallback<CommitState<S>>((action) => {
    const nextState = typeof action === "function"
      ? (action as (current: S) => S)(stateRef.current)
      : action;
    stateRef.current = nextState;
    setReactState(nextState);
    return nextState;
  }, []);

  return [state, commitState];
}
