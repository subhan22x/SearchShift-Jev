import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** Keep query-derived card fields in sync as the search text changes. */
export function useQueryState<T>(query: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initialValue);
  const previousQuery = useRef(query);
  const latestInitialValue = useRef(initialValue);
  latestInitialValue.current = initialValue;

  useEffect(() => {
    if (previousQuery.current === query) return;
    previousQuery.current = query;
    setValue(latestInitialValue.current);
  }, [query]);

  return [value, setValue];
}
